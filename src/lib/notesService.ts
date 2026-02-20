/**
 * Notes service that bridges between the UI (SavedNote), IndexedDB (LocalNote),
 * and Supabase (notes table row).
 *
 * This service is the single source of truth for note CRUD operations.
 * It follows an offline-first pattern:
 *   1. All writes go to IndexedDB first (immediate, always available)
 *   2. Writes are queued for Supabase sync via the sync queue
 *   3. When online, the sync service pushes queued changes to Supabase
 *   4. On reconnect, the sync service reconciles local vs. server state
 *
 * The UI layer (useNotesStorage hook) calls these functions and never
 * talks to Supabase directly.
 */

import { supabase } from './supabase'
import {
  getLocalNotes,
  saveLocalNote,
  hardDeleteLocalNote,
  addToSyncQueue,
  updateNoteSyncStatus,
  stripLocalFields,
  type LocalNote,
  type NoteSyncStatus,
} from './offlineDb'
import { isOnline } from './syncService'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('NotesService')

// ============================================================
// Public Types
// ============================================================

/**
 * The note shape exposed to the UI layer.
 * Contains display-friendly field names and the sync_status
 * for badge rendering.
 */
export interface SavedNote {
  id: string
  encodedText: string
  createdAt: string
  symptomIcon: string
  symptomText: string
  dispositionType: string
  dispositionText: string
  previewText: string
  source?: string
  /** Sync status for UI badge display. */
  sync_status: NoteSyncStatus
  /** The user_id of the note author. Present on all notes. */
  authorId: string
  /**
   * Formatted display name of the note author (e.g., "CPT Smith, J.D. PA-C").
   * Present on clinic notes fetched from the server via profiles join.
   * For the current user's own local notes this will be null; the
   * frontend can use useUserProfile to display the current user's name.
   */
  authorName: string | null
  /**
   * Name of the originating clinic. Present on clinic notes fetched
   * via the UIC-based RPC. Used for badge display and clinic-based sorting.
   */
  clinicName?: string
  /** The clinic_id of the note, propagated to IndexedDB for realtime writes. */
  clinicId?: string | null
}

/**
 * Shape returned by the Supabase query when joining notes with
 * the author's profile. The profiles relation is accessed via
 * the notes.user_id -> profiles.id foreign key.
 */
interface NoteWithProfile {
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
  /** Joined profile data for the note author. May be null if the
   *  profile is inaccessible (RLS) or the user was deleted. */
  profiles: {
    first_name: string | null
    last_name: string | null
    middle_initial: string | null
    rank: string | null
    credential: string | null
    display_name: string | null
  } | null
}

// ============================================================
// Conversion Functions
// ============================================================

/**
 * Build a formatted author name from profile data.
 * Format: "RANK Last, F.M. CREDENTIAL" (e.g., "CPT Smith, J.D. PA-C").
 * Falls back to display_name, then returns null.
 */
function formatAuthorName(profile: NoteWithProfile['profiles']): string | null {
  if (!profile) return null

  if (profile.last_name) {
    let result = ''

    // Prefix with rank
    if (profile.rank) {
      result = profile.rank + ' '
    }

    result += profile.last_name

    // Add first initial
    if (profile.first_name) {
      result += ', ' + profile.first_name.charAt(0) + '.'

      // Add middle initial
      if (profile.middle_initial) {
        result += profile.middle_initial.charAt(0) + '.'
      }
    }

    // Append credential
    if (profile.credential) {
      result += ' ' + profile.credential
    }

    return result
  }

  // Fallback to display_name
  return profile.display_name || null
}

/**
 * Convert a LocalNote (IndexedDB format) to a SavedNote (UI format).
 * The optional authorName parameter allows callers to inject a
 * pre-formatted author name (e.g., from a profiles join).
 */
export function localNoteToSavedNote(
  note: LocalNote,
  authorName?: string | null,
  clinicName?: string
): SavedNote {
  return {
    id: note.id,
    encodedText: note.hpi_encoded || '',
    createdAt: note.timestamp,
    symptomIcon: note.symptom_icon || '',
    symptomText: note.symptom_text || '',
    dispositionType: note.disposition_type || '',
    dispositionText: note.disposition_text || '',
    previewText: note.preview_text || '',
    source: note.source_device || undefined,
    sync_status: note._sync_status,
    authorId: note.user_id,
    authorName: authorName ?? note.display_name ?? null,
    clinicName: clinicName ?? note.clinic_name ?? undefined,
    clinicId: note.clinic_id,
  }
}

/**
 * Build a LocalNote from SavedNote input data + user context.
 * Used when creating a new note.
 */
function buildLocalNote(
  input: Omit<SavedNote, 'id' | 'createdAt' | 'sync_status' | 'authorId' | 'authorName'>,
  userId: string,
  clinicId: string | null,
  displayName: string | null = null,
  rank: string | null = null,
  noteId?: string,
  clinicName: string | null = null
): LocalNote {
  const now = new Date().toISOString()
  return {
    id: noteId ?? crypto.randomUUID(),
    user_id: userId,
    clinic_id: clinicId,
    clinic_name: clinicName,
    timestamp: now,
    display_name: displayName,
    rank: rank,
    uic: null,
    algorithm_reference: null,
    hpi_encoded: input.encodedText,
    symptom_icon: input.symptomIcon,
    symptom_text: input.symptomText,
    disposition_type: input.dispositionType,
    disposition_text: input.dispositionText,
    preview_text: input.previewText,
    is_imported: input.source === 'external source',
    source_device: input.source || null,
    created_at: now,
    updated_at: now,
    deleted_at: null, // Legacy field; hard deletes are now used
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}


// ============================================================
// User Context
// ============================================================

/**
 * Get the current authenticated user's ID and clinic_id.
 * Also returns display_name and rank for stamping on new notes.
 * Returns null values if not authenticated (guest mode).
 */
async function getUserContext(): Promise<{
  userId: string | null
  clinicId: string | null
  clinicName: string | null
  displayName: string | null
  rank: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, clinicId: null, clinicName: null, displayName: null, rank: null }

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, first_name, last_name, rank, clinics(name)')
      .eq('id', user.id)
      .single()

    // Build a short display name: "Rank LastName" or just "LastName"
    const lastName = profile?.last_name ?? null
    const rank = profile?.rank ?? null
    const displayName = lastName
      ? (rank ? `${rank} ${lastName}` : lastName)
      : null

    // Extract clinic name from the joined clinics relation
    const clinicData = profile?.clinics as { name: string } | null
    const clinicName = clinicData?.name ?? null

    return {
      userId: user.id,
      clinicId: profile?.clinic_id ?? null,
      clinicName,
      displayName,
      rank,
    }
  } catch {
    return { userId: null, clinicId: null, clinicName: null, displayName: null, rank: null }
  }
}

// ============================================================
// CRUD Operations (Offline-First)
// ============================================================

/**
 * Get all active notes for the current user.
 * Reads from IndexedDB (the local cache).
 * Returns SavedNote[] with sync_status for UI display.
 */
export async function getNotes(userId: string): Promise<SavedNote[]> {
  const localNotes = await getLocalNotes(userId)
  return localNotes.map((n) => localNoteToSavedNote(n))
}

/**
 * Create a new note. Writes to IndexedDB immediately and queues
 * a sync item for Supabase.
 *
 * If online and authenticated, also attempts an immediate sync
 * to minimize the time the note shows as "pending".
 */
export async function createNote(
  input: Omit<SavedNote, 'id' | 'createdAt' | 'sync_status' | 'authorId' | 'authorName'>,
  noteId?: string
): Promise<SavedNote> {
  const { userId, clinicId, clinicName, displayName, rank } = await getUserContext()

  if (!userId) {
    // Guest mode: create a local-only note that can never sync.
    const guestNote: LocalNote = {
      ...buildLocalNote(input, 'guest', null, null, null, noteId),
      _sync_status: 'synced', // Mark as "synced" since there's nothing to sync
    }
    await saveLocalNote(guestNote)
    return localNoteToSavedNote(guestNote)
  }

  // Authenticated user: write to IndexedDB + queue for sync.
  // Stamp the note with the user's display_name and rank so
  // other clinic members can see who wrote it (the display_name
  // column on the notes table acts as a denormalized snapshot).
  const note = buildLocalNote(input, userId, clinicId, displayName, rank, noteId, clinicName)
  await saveLocalNote(note)

  // Queue for sync
  await addToSyncQueue({
    user_id: userId,
    action: 'create',
    table_name: 'notes',
    record_id: note.id,
    payload: stripLocalFields(note as unknown as Record<string, unknown>),
  })

  // Attempt immediate sync if online
  if (isOnline()) {
    try {
      const payload = stripLocalFields(note as unknown as Record<string, unknown>)
      const { error } = await supabase
        .from('notes')
        .upsert(payload as never, { onConflict: 'id' })

      if (!error) {
        await updateNoteSyncStatus(note.id, 'synced')
        note._sync_status = 'synced'
        logger.info(`Note ${note.id} synced immediately`)

        // Fire-and-forget: notify clinic members (parent clinics via hierarchy)
        if (clinicId) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              type: 'new_clinic_note',
              name: displayName,
              clinic_id: clinicId,
              author_id: userId,
            },
          }).catch(() => {})
        }
      } else {
        logger.warn(`Immediate sync failed, queued for later: ${error.message}`)
      }
    } catch (err) {
      logger.warn('Immediate sync failed, queued for later:', err)
    }
  }

  return localNoteToSavedNote(note)
}

/**
 * Update an existing note. Writes to IndexedDB immediately and queues
 * a sync item.
 */
export async function updateNote(
  noteId: string,
  updates: Partial<Omit<SavedNote, 'id' | 'sync_status' | 'authorId' | 'authorName'>>,
  userId: string
): Promise<SavedNote | null> {
  const localNotes = await getLocalNotes(userId)
  const existing = localNotes.find((n) => n.id === noteId)
  if (!existing) return null

  const now = new Date().toISOString()
  const updatedNote: LocalNote = {
    ...existing,
    updated_at: now,
    _sync_status: userId === 'guest' ? 'synced' : 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  // Apply field updates
  if (updates.encodedText !== undefined) updatedNote.hpi_encoded = updates.encodedText
  if (updates.createdAt !== undefined) updatedNote.timestamp = updates.createdAt
  if (updates.symptomIcon !== undefined) updatedNote.symptom_icon = updates.symptomIcon
  if (updates.symptomText !== undefined) updatedNote.symptom_text = updates.symptomText
  if (updates.dispositionType !== undefined) updatedNote.disposition_type = updates.dispositionType
  if (updates.dispositionText !== undefined) updatedNote.disposition_text = updates.dispositionText
  if (updates.previewText !== undefined) updatedNote.preview_text = updates.previewText
  if (updates.source !== undefined) updatedNote.source_device = updates.source || null

  await saveLocalNote(updatedNote)

  // Queue for sync (only for authenticated users)
  if (userId !== 'guest') {
    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'notes',
      record_id: noteId,
      payload: stripLocalFields(updatedNote as unknown as Record<string, unknown>),
    })

    // Attempt immediate sync if online
    if (isOnline()) {
      try {
        const payload = stripLocalFields(updatedNote as unknown as Record<string, unknown>)
        const { error } = await supabase
          .from('notes')
          .update(payload as never)
          .eq('id', noteId)

        if (!error) {
          await updateNoteSyncStatus(noteId, 'synced')
          updatedNote._sync_status = 'synced'
        }
      } catch {
        // Will be retried by sync queue
      }
    }
  }

  return localNoteToSavedNote(updatedNote)
}

/**
 * Hard-delete a note. Removes it from IndexedDB immediately and
 * queues a DELETE action for Supabase sync.
 *
 * The deletion timestamp is stored in the sync queue payload for
 * conflict resolution: if the server note has an updated_at newer
 * than our deletion timestamp, the server version wins and the
 * delete is skipped (the note will reappear on next reconciliation).
 */
export async function deleteNote(noteId: string, userId: string): Promise<void> {
  const deletedAt = new Date().toISOString()

  // Remove from IndexedDB immediately (hard delete)
  await hardDeleteLocalNote(noteId)

  // Queue for sync (only for authenticated users)
  if (userId !== 'guest') {
    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'notes',
      record_id: noteId,
      payload: { _deleted_at_timestamp: deletedAt },
    })

    // Attempt immediate sync if online
    if (isOnline()) {
      try {
        // Check if the server has a newer version before deleting.
        // If server updated_at > our deletion timestamp, skip the delete.
        const { data: serverNote } = await supabase
          .from('notes')
          .select('updated_at')
          .eq('id', noteId)
          .maybeSingle()

        if (serverNote) {
          const serverTime = new Date(serverNote.updated_at).getTime()
          const deleteTime = new Date(deletedAt).getTime()
          if (serverTime > deleteTime) {
            logger.debug(`Skipping delete for ${noteId}: server version is newer`)
            return
          }
        }

        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)

        if (error) {
          logger.warn(`Immediate delete failed, queued for later: ${error.message}`)
        }
        // Note is already hard-deleted from IndexedDB; no local status to update.
      } catch {
        // Will be retried by sync queue
      }
    }
  }
}

/**
 * Delete all notes for a user. Used by "clear all notes" action.
 * Hard-deletes each note individually and queues sync for each.
 */
export async function deleteAllNotes(userId: string): Promise<void> {
  const notes = await getLocalNotes(userId)
  for (const note of notes) {
    await deleteNote(note.id, userId)
  }
}

/**
 * Fetch all notes directly from Supabase (bypassing IndexedDB).
 * Used only for initial reconciliation when the local cache is empty.
 */
export async function fetchNotesFromServer(userId: string): Promise<LocalNote[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch notes from server: ${error.message}`)
  }

  return (data || []).map((row): LocalNote => ({
    ...row,
    _sync_status: 'synced' as NoteSyncStatus,
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }))
}

/**
 * Fetch all notes for a clinic directly from Supabase,
 * EXCLUDING notes owned by the current user.
 *
 * The current user's own notes are already managed locally via IndexedDB
 * and appear in the `notes` array. Fetching them again as clinic notes
 * would cause duplicates in the UI. By filtering with `.neq('user_id', userId)`,
 * we ensure only *other* clinic members' notes are returned here.
 *
 * This query joins with the profiles table to include author info
 * (name, rank, credential) for display in the UI. The RLS policy
 * "Profiles: clinic members can select" (migration 010) allows any
 * authenticated user in the same clinic to read basic profile fields.
 *
 * The RLS policy "Notes: clinic members can select" (migration 007/009)
 * ensures that only users who belong to this clinic can read these rows.
 * Hard-deleted notes will simply not exist in the table.
 *
 * Returns SavedNote[] with authorId and authorName populated from
 * the joined profile data.
 */
export async function fetchClinicNotesFromServer(
  clinicId: string,
  excludeUserId?: string
): Promise<SavedNote[]> {
  // Use the hierarchy-based RPC to fetch notes visible to the current
  // user's clinic + child clinics. The RPC filters by clinic_id match.
  // The clinicId parameter is kept for API compatibility.
  const { data, error } = await supabase.rpc('get_clinic_notes_by_hierarchy', {
    p_exclude_user_id: excludeUserId ?? undefined,
  })

  if (error) {
    throw new Error(`Failed to fetch clinic notes from server: ${error.message}`)
  }

  const rows = data || []
  if (rows.length === 0) return []

  // Collect unique user_ids from the notes to batch-fetch their profiles.
  const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))]

  // Fetch profiles for all note authors in a single query.
  // The RLS policy "Profiles: visible by clinic hierarchy" allows reading
  // profiles of users in visible clinics.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, middle_initial, rank, credential, display_name')
    .in('id', userIds)

  // Build a lookup map: user_id -> formatted author name
  const authorMap = new Map<string, string | null>()
  for (const p of (profiles || [])) {
    const name = formatAuthorName(p)
    authorMap.set(p.id, name)
  }

  // Batch-fetch clinic names for badge display.
  // Collect unique clinic_id values, query clinics table, build lookup.
  const clinicIds = [...new Set(rows
    .map((r: { clinic_id: string | null }) => r.clinic_id)
    .filter((id: string | null): id is string => id != null)
  )]
  const clinicNameMap = new Map<string, string>()
  if (clinicIds.length > 0) {
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name')
      .in('id', clinicIds)
    for (const c of (clinics || [])) {
      clinicNameMap.set(c.id, c.name)
    }
  }

  return rows.map((row: typeof rows[number]): SavedNote => {
    const authorName = authorMap.get(row.user_id) ?? row.display_name ?? null
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
      authorName,
      clinicName: row.clinic_id ? clinicNameMap.get(row.clinic_id) : undefined,
    }
  })
}

/**
 * Hard-delete a clinic note directly on Supabase.
 * Used by any authenticated user to delete notes from their clinic.
 * Clinic notes are server-only (never stored in IndexedDB),
 * so this only talks to Supabase -- no local DB involvement.
 *
 * RLS policy "Notes: clinic members can delete" (migration 009)
 * enforces that only users belonging to the same clinic can
 * delete the note.
 */
export async function deleteClinicNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)

  if (error) {
    throw new Error(`Failed to delete clinic note: ${error.message}`)
  }
}
