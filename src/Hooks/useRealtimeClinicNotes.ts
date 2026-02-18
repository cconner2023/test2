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

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { SavedNote } from '../lib/notesService'

interface RealtimeNoteRow {
  id: string
  user_id: string
  clinic_id: string | null
  timestamp: string
  display_name: string | null
  rank: string | null
  uic: string | null
  algorithm_reference: string | null
  hpi_encoded: string | null
  symptom_icon: string | null
  symptom_text: string | null
  disposition_type: string | null
  disposition_text: string | null
  preview_text: string | null
  is_imported: boolean
  source_device: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function realtimeRowToSavedNote(row: RealtimeNoteRow): SavedNote {
  return {
    id: row.id,
    encodedText: row.hpi_encoded || '',
    createdAt: row.timestamp,
    symptomIcon: row.symptom_icon || '',
    symptomText: row.symptom_text || '',
    dispositionType: row.disposition_type || '',
    dispositionText: row.disposition_text || '',
    previewText: row.preview_text || '',
    source: row.source_device || undefined,
    sync_status: 'synced',
    authorId: row.user_id,
    authorName: row.display_name || null,
  }
}

interface UseRealtimeClinicNotesOptions {
  clinicId: string | null
  userId: string | null
  isAuthenticated: boolean
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
  isPageVisible,
  isNotePanelOpen,
  onClinicUpsert,
  onClinicDelete,
  onPersonalUpsert,
  onPersonalDelete,
}: UseRealtimeClinicNotesOptions): void {
  const channelRef = useRef<RealtimeChannel | null>(null)

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

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('[RealtimeClinicNotes] Unsubscribing from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    // Pause when backgrounded, not authenticated, missing IDs, or note panel is closed
    if (!isAuthenticated || !clinicId || !userId || !isPageVisible || !isNotePanelOpen) {
      cleanup()
      return
    }

    // Clean up any previous subscription before creating a new one
    cleanup()

    console.log(`[RealtimeClinicNotes] Subscribing to notes for clinic ${clinicId}`)

    /**
     * Handle a Realtime postgres_changes event.
     *
     * Routes events to either personal or clinic callbacks based on
     * whether the event's user_id matches the current user. This
     * replaces the old two-channel setup (clinic + personal) with a
     * single channel, halving WebSocket connections for notes.
     */
    const handlePayload = (payload: RealtimePostgresChangesPayload<RealtimeNoteRow>) => {
      const eventType = payload.eventType
      const currentUserId = userIdRef.current

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        const note = realtimeRowToSavedNote(row)

        // Soft-deleted notes should be treated as deletes
        if (row.deleted_at) {
          if (row.user_id === currentUserId) {
            onPersonalDeleteRef.current(row.id)
          } else {
            onClinicDeleteRef.current(row.id)
          }
          return
        }

        if (row.user_id === currentUserId) {
          onPersonalUpsertRef.current(note)
        } else {
          onClinicUpsertRef.current(note)
        }
        return
      }

      if (eventType === 'DELETE') {
        // Without REPLICA IDENTITY FULL, payload.old only contains the
        // primary key column(s). We defensively handle both cases.
        const oldRow = payload.old as Partial<RealtimeNoteRow>
        const noteId = oldRow.id

        if (!noteId) {
          console.warn('[RealtimeClinicNotes] DELETE event missing row id, ignoring')
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
    }

    const channel = supabase
      .channel(`clinic-notes:${clinicId}`)
      .on<RealtimeNoteRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `clinic_id=eq.${clinicId}`,
        },
        handlePayload,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RealtimeClinicNotes] Subscribed to clinic ${clinicId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeClinicNotes] Channel error:', err?.message ?? 'unknown')
        } else if (status === 'TIMED_OUT') {
          console.warn('[RealtimeClinicNotes] Subscription timed out, will retry')
        } else {
          console.log(`[RealtimeClinicNotes] Channel status: ${status}`)
        }
      })

    channelRef.current = channel

    return cleanup
  }, [isAuthenticated, clinicId, userId, isPageVisible, isNotePanelOpen, cleanup])
}
