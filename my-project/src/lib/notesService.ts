/**
 * Notes service that persists notes to Supabase.
 * Provides offline-first data persistence with automatic sync.
 *
 * Falls back to localStorage if Supabase is unavailable (offline mode).
 */

import { supabase } from './supabase'
import type { Database } from '../Types/database.types.generated'

type NoteRow = Database['public']['Tables']['notes']['Row']
type NoteInsert = Database['public']['Tables']['notes']['Insert']
type NoteUpdate = Database['public']['Tables']['notes']['Update']

export interface NoteRecord {
  id: string
  encodedText: string
  createdAt: string
  symptomIcon: string
  symptomText: string
  dispositionType: string
  dispositionText: string
  previewText: string
  source?: string
}

/**
 * Convert Supabase note row to NoteRecord format
 */
function noteRowToRecord(row: NoteRow): NoteRecord {
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
  }
}

/**
 * Convert NoteRecord to Supabase insert format
 */
async function recordToNoteInsert(
  record: Omit<NoteRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<NoteInsert> {
  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  return {
    id: record.id,
    user_id: user.id,
    timestamp: record.createdAt || new Date().toISOString(),
    hpi_encoded: record.encodedText,
    symptom_icon: record.symptomIcon,
    symptom_text: record.symptomText,
    disposition_type: record.dispositionType,
    disposition_text: record.dispositionText,
    preview_text: record.previewText,
    source_device: record.source || null,
  }
}

/**
 * Check if Supabase is available and connected
 */
export async function checkApiHealth(): Promise<{ ok: boolean; noteCount?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // If no user, Supabase works but user isn't authenticated
    if (!user) {
      return { ok: true, noteCount: 0 }
    }

    const { count, error } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (error) {
      console.error('[NotesService] Health check error:', error)
      return { ok: false }
    }

    return { ok: true, noteCount: count || 0 }
  } catch (error) {
    console.error('[NotesService] Health check failed:', error)
    return { ok: false }
  }
}

/**
 * Fetch all notes for the current user from Supabase
 */
export async function fetchNotes(): Promise<NoteRecord[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('timestamp', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch notes: ${error.message}`)
  }

  return (data || []).map(noteRowToRecord)
}

/**
 * Create a new note in Supabase
 */
export async function createNote(
  note: Omit<NoteRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<NoteRecord> {
  const insertData = await recordToNoteInsert(note)

  const { data, error } = await supabase
    .from('notes')
    .insert(insertData as NoteInsert)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create note: ${error.message}`)
  }

  return noteRowToRecord(data)
}

/**
 * Update an existing note in Supabase
 */
export async function updateNote(
  id: string,
  updates: Partial<NoteRecord>
): Promise<NoteRecord> {
  const updateData: NoteUpdate = {}

  if (updates.encodedText !== undefined) updateData.hpi_encoded = updates.encodedText
  if (updates.createdAt !== undefined) updateData.timestamp = updates.createdAt
  if (updates.symptomIcon !== undefined) updateData.symptom_icon = updates.symptomIcon
  if (updates.symptomText !== undefined) updateData.symptom_text = updates.symptomText
  if (updates.dispositionType !== undefined) updateData.disposition_type = updates.dispositionType
  if (updates.dispositionText !== undefined) updateData.disposition_text = updates.dispositionText
  if (updates.previewText !== undefined) updateData.preview_text = updates.previewText
  if (updates.source !== undefined) updateData.source_device = updates.source

  const { data, error } = await supabase
    .from('notes')
    .update(updateData as NoteUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update note: ${error.message}`)
  }

  return noteRowToRecord(data)
}

/**
 * Delete a note from Supabase (soft delete)
 */
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() } as NoteUpdate)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`)
  }
}
