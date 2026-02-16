/**
 * useRealtimePersonalNotes -- Supabase Realtime subscription for the
 * current user's own notes across devices.
 *
 * Subscribes to INSERT, UPDATE, and DELETE events on the `notes` table
 * filtered by `user_id`. When the same user creates, updates, or deletes
 * a note on another device, the change is reflected locally without
 * requiring a manual refresh or page reload.
 *
 * Unlike useRealtimeClinicNotes, this hook does NOT skip events from the
 * current user -- that's the entire point. The handlers are idempotent:
 * on the originating device the optimistic state already matches, so the
 * upsert is a no-op (or harmless overwrite with the same data).
 *
 * Requires the `notes` table to be in the Supabase Realtime publication.
 * See sql/011_enable_realtime_notes.sql.
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

interface UseRealtimePersonalNotesOptions {
  userId: string | null
  isAuthenticated: boolean
  onUpsert: (note: SavedNote) => void
  onDelete: (noteId: string) => void
}

export function useRealtimePersonalNotes({
  userId,
  isAuthenticated,
  onUpsert,
  onDelete,
}: UseRealtimePersonalNotesOptions): void {
  const channelRef = useRef<RealtimeChannel | null>(null)

  const onUpsertRef = useRef(onUpsert)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onUpsertRef.current = onUpsert
    onDeleteRef.current = onDelete
  }, [onUpsert, onDelete])

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('[RealtimePersonalNotes] Unsubscribing from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      cleanup()
      return
    }

    cleanup()

    console.log(`[RealtimePersonalNotes] Subscribing to notes for user ${userId}`)

    const handlePayload = (payload: RealtimePostgresChangesPayload<RealtimeNoteRow>) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        // Soft-deleted notes should be treated as deletes
        if (row.deleted_at) {
          console.log(`[RealtimePersonalNotes] ${eventType} with deleted_at, treating as DELETE: ${row.id}`)
          onDeleteRef.current(row.id)
          return
        }
        console.log(`[RealtimePersonalNotes] ${eventType}: ${row.id}`)
        onUpsertRef.current(realtimeRowToSavedNote(row))
        return
      }

      if (eventType === 'DELETE') {
        const oldRow = payload.old as Partial<RealtimeNoteRow>
        const noteId = oldRow.id
        if (!noteId) {
          console.warn('[RealtimePersonalNotes] DELETE event missing row id, ignoring')
          return
        }
        console.log(`[RealtimePersonalNotes] DELETE: ${noteId}`)
        onDeleteRef.current(noteId)
      }
    }

    const channel = supabase
      .channel(`personal-notes:${userId}`)
      .on<RealtimeNoteRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        handlePayload,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RealtimePersonalNotes] Subscribed for user ${userId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimePersonalNotes] Channel error:', err?.message ?? 'unknown')
        } else if (status === 'TIMED_OUT') {
          console.warn('[RealtimePersonalNotes] Subscription timed out, will retry')
        } else {
          console.log(`[RealtimePersonalNotes] Channel status: ${status}`)
        }
      })

    channelRef.current = channel

    return cleanup
  }, [isAuthenticated, userId, cleanup])
}
