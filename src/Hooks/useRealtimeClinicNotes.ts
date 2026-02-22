/**
 * useRealtimeClinicNotes -- Supabase Realtime subscription for clinic notes.
 *
 * Subscribes to INSERT, UPDATE, and DELETE events on the `notes` table
 * filtered by `clinic_id`. All notes in the clinic (including the current
 * user's own notes) are handled through this single channel. The caller
 * provides separate callbacks for clinic-member events vs own-user events,
 * allowing cross-device sync of personal notes without a second channel.
 *
 * This hook is additive -- it enhances the existing offline-first sync
 * mechanism without replacing it.
 *
 * The channel automatically pauses when the page is hidden (backgrounded)
 * and resumes when visible again, reducing battery drain on mobile devices.
 *
 * IMPORTANT: Requires the `notes` table to be added to the Supabase
 * Realtime publication. See sql/011_enable_realtime_notes.sql.
 * For full DELETE event payloads, REPLICA IDENTITY FULL is recommended
 * but not required -- the DELETE handler gracefully degrades when only
 * the primary key is available.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { SavedNote } from '../lib/notesService'
import { decryptServerNoteRow } from '../lib/cryptoService'
import { deriveNoteMetadata, deriveAuthorFromEncoded } from '../Utilities/noteMetadata'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'

const logger = createLogger('RealtimeClinicNotes')

type RealtimeNoteRow = {
  id: string
  user_id: string
  clinic_id: string | null
  hpi_encoded: string | null
  timestamp: string
  is_imported: boolean
  originating_clinic_id: string | null
  visible_clinic_ids: string[]
  source_device: string | null
  created_at: string
  updated_at: string
}

function realtimeRowToSavedNote(row: RealtimeNoteRow): SavedNote {
  const meta = deriveNoteMetadata(row.hpi_encoded)
  return {
    id: row.id,
    encodedText: row.hpi_encoded || '',
    createdAt: row.timestamp,
    symptomIcon: meta.symptomIcon,
    symptomText: meta.symptomText,
    dispositionType: meta.dispositionType,
    dispositionText: meta.dispositionText,
    previewText: '',
    source: row.source_device || undefined,
    sync_status: 'synced',
    authorId: row.user_id,
    authorName: deriveAuthorFromEncoded(row.hpi_encoded),
    clinicId: row.clinic_id,
    originating_clinic_id: row.originating_clinic_id ?? null,
    visible_clinic_ids: row.visible_clinic_ids ?? [],
  }
}

interface UseRealtimeClinicNotesOptions {
  clinicId: string | null
  userId: string | null
  isAuthenticated: boolean
  /** Clinic IDs visible to the current user (own + children, for realtime filtering). */
  visibleClinicIds: string[]
  isPageVisible: boolean
  /** Only subscribe when the note panel is open. */
  isNotePanelOpen: boolean
  /** Called for notes from other clinic members. */
  onClinicUpsert: (note: SavedNote) => void
  onClinicDelete: (noteId: string) => void
  /** Called for the current user's own notes (cross-device sync). */
  onPersonalUpsert: (note: SavedNote) => void
  onPersonalDelete: (noteId: string) => void
}

export function useRealtimeClinicNotes({
  clinicId,
  userId,
  isAuthenticated,
  visibleClinicIds,
  isPageVisible,
  isNotePanelOpen,
  onClinicUpsert,
  onClinicDelete,
  onPersonalUpsert,
  onPersonalDelete,
}: UseRealtimeClinicNotesOptions): void {
  // Use refs for callbacks to avoid resubscribing on every render
  const onClinicUpsertRef = useRef(onClinicUpsert)
  const onClinicDeleteRef = useRef(onClinicDelete)
  const onPersonalUpsertRef = useRef(onPersonalUpsert)
  const onPersonalDeleteRef = useRef(onPersonalDelete)
  useEffect(() => {
    onClinicUpsertRef.current = onClinicUpsert
    onClinicDeleteRef.current = onClinicDelete
    onPersonalUpsertRef.current = onPersonalUpsert
    onPersonalDeleteRef.current = onPersonalDelete
  }, [onClinicUpsert, onClinicDelete, onPersonalUpsert, onPersonalDelete])

  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  /**
   * Handle a Realtime postgres_changes event.
   *
   * Routes events to either personal or clinic callbacks based on
   * whether the event's user_id matches the current user. This
   * replaces the old two-channel setup (clinic + personal) with a
   * single channel, halving WebSocket connections for notes.
   *
   * Async: decrypts encrypted fields (Supabase stores ciphertext)
   * before converting to SavedNote for the UI.
   */
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<RealtimeNoteRow>) => {
      const eventType = payload.eventType
      const currentUserId = userIdRef.current

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new

        // Decrypt encrypted fields, then route to the appropriate handler.
        // Fire-and-forget: the Realtime callback doesn't await promises.
        decryptServerNoteRow(row as unknown as Record<string, unknown>)
          .then((decrypted) => {
            const note = realtimeRowToSavedNote(decrypted as unknown as RealtimeNoteRow)
            if (row.user_id === currentUserId) {
              onPersonalUpsertRef.current(note)
            } else {
              onClinicUpsertRef.current(note)
            }
          })
          .catch((err) => {
            // Fallback: use the row as-is (may show ciphertext, but won't crash)
            logger.warn('Failed to decrypt realtime note, using raw:', err)
            const note = realtimeRowToSavedNote(row)
            if (row.user_id === currentUserId) {
              onPersonalUpsertRef.current(note)
            } else {
              onClinicUpsertRef.current(note)
            }
          })
        return
      }

      if (eventType === 'DELETE') {
        // Without REPLICA IDENTITY FULL, payload.old only contains the
        // primary key column(s). We defensively handle both cases.
        const oldRow = payload.old as Partial<RealtimeNoteRow>
        const noteId = oldRow.id

        if (!noteId) {
          logger.warn('DELETE event missing row id, ignoring')
          return
        }

        // Route to the appropriate handler based on user_id (if available)
        if (oldRow.user_id && oldRow.user_id === currentUserId) {
          onPersonalDeleteRef.current(noteId)
        } else {
          // Either from another user, or user_id unknown (PK-only payload)
          // — route to clinic handler. Safe because personal notes that
          // don't match will be a no-op in the clinic state filter.
          onClinicDeleteRef.current(noteId)
        }
      }
    },
    [],
  )

  const postgresFilter = useMemo(
    () => ({
      table: 'notes',
      filter: visibleClinicIds.length > 0
        ? `clinic_id=in.(${visibleClinicIds.join(',')})`
        : `clinic_id=eq.${clinicId}`,   // fallback when hierarchy not yet loaded
    }),
    [visibleClinicIds, clinicId],
  )

  // Include visible IDs in channel name so Supabase re-subscribes when they change
  const channelName = useMemo(
    () => visibleClinicIds.length > 0
      ? `clinic-notes:${visibleClinicIds.join(',')}`
      : `clinic-notes:${clinicId}`,
    [visibleClinicIds, clinicId],
  )

  useSupabaseSubscription<RealtimeNoteRow>({
    shouldSubscribe: isAuthenticated && (visibleClinicIds.length > 0 || !!clinicId) && !!userId && isPageVisible && isNotePanelOpen,
    channelName,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })
}
