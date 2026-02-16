/**
 * useRealtimeClinicNotes -- Supabase Realtime subscription for clinic notes.
 *
 * Subscribes to INSERT, UPDATE, and DELETE events on the `notes` table
 * filtered by `clinic_id`. When another clinic member creates, updates,
 * or deletes a note, the change is reflected in the local state without
 * requiring a manual refresh or full sync.
 *
 * This hook is additive -- it enhances the existing offline-first sync
 * mechanism without replacing it.
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
  onUpsert: (note: SavedNote) => void
  onDelete: (noteId: string) => void
}

export function useRealtimeClinicNotes({
  clinicId,
  userId,
  isAuthenticated,
  onUpsert,
  onDelete,
}: UseRealtimeClinicNotesOptions): void {
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Use refs for callbacks to avoid resubscribing on every render
  const onUpsertRef = useRef(onUpsert)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onUpsertRef.current = onUpsert
    onDeleteRef.current = onDelete
  }, [onUpsert, onDelete])

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('[RealtimeClinicNotes] Unsubscribing from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !clinicId || !userId) {
      cleanup()
      return
    }

    // Clean up any previous subscription before creating a new one
    cleanup()

    console.log(`[RealtimeClinicNotes] Subscribing to notes for clinic ${clinicId}`)

    /**
     * Handle a Realtime postgres_changes event.
     *
     * Using a single wildcard ('*') listener for all event types on the
     * same table+filter combination. This avoids potential issues with
     * multiple `.on()` calls for the same channel competing for events,
     * and simplifies the event routing logic.
     */
    const handlePayload = (payload: RealtimePostgresChangesPayload<RealtimeNoteRow>) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        // Skip events from the current user -- their own notes are
        // managed locally via IndexedDB and appear in the `notes` array.
        if (row.user_id === userId) return

        console.log(`[RealtimeClinicNotes] ${eventType}: ${row.id} by ${row.user_id}`)
        onUpsertRef.current(realtimeRowToSavedNote(row))
        return
      }

      if (eventType === 'DELETE') {
        // Without REPLICA IDENTITY FULL, payload.old only contains the
        // primary key column(s). We defensively handle both cases:
        //   - Full row: check user_id to skip own deletions
        //   - PK only:  skip the user_id check (safe because own notes
        //               aren't in clinicNotes anyway -- they're excluded
        //               by the fetchClinicNotesFromServer query)
        const oldRow = payload.old as Partial<RealtimeNoteRow>
        const noteId = oldRow.id

        if (!noteId) {
          console.warn('[RealtimeClinicNotes] DELETE event missing row id, ignoring')
          return
        }

        // If we have user_id info, skip own deletions for correctness
        if (oldRow.user_id && oldRow.user_id === userId) return

        console.log(`[RealtimeClinicNotes] DELETE: ${noteId}`)
        onDeleteRef.current(noteId)
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
  }, [isAuthenticated, clinicId, userId, cleanup])
}
