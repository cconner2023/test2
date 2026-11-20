import { useCallback } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSavedNotesStore } from '../stores/useSavedNotesStore'
import { decodeSavedNote, savedNoteErrorMessage } from '../Utilities/savedNoteCodec'
import { emitErrorToast } from '../lib/errorFeedback'
import { logError } from '../Utilities/ErrorHandler'
import type { SavedNote } from '../lib/savedNotesDb'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * Reopen a My Notes entry in WriteNotePage — 'view' lands on Full Note, 'edit'
 * on Write Note. Decrypts on-device,
 * rebuilds the algorithm card states, and seeds HPI/PE/DDx/Plan so the medic
 * can step back to Write Note, edit, and re-save over the same entry.
 * Provider entries re-import into the Provider drawer instead.
 * Failure is shown to the user; the stored entry is never touched.
 */
export function useOpenSavedNote() {
  const openWriteNote = useNavigationStore(s => s.openWriteNote)
  const openProviderNote = useNavigationStore(s => s.openProviderNote)

  return useCallback(async (saved: SavedNote, mode: 'view' | 'edit' = 'view'): Promise<boolean> => {
    try {
      const decoded = await decodeSavedNote(saved)
      if (decoded.kind === 'provider') {
        openProviderNote({ savedNoteId: saved.id, payload: decoded.ascii })
        return true
      }
      const { parsed } = decoded
      openWriteNote({
        disposition: decoded.disposition,
        algorithmOptions: decoded.algorithmOptions,
        cardStates: decoded.cardStates,
        selectedSymptom: {
          icon: decoded.symptom?.icon || saved.symptomIcon,
          text: decoded.symptom?.text || saved.symptomText,
        },
        initialPage: mode === 'edit' ? 0 : 1,
        restore: {
          savedNoteId: saved.id,
          hpi: parsed.flags.includeHPI ? parsed.hpiText : '',
          peNote: parsed.flags.includePhysicalExam ? parsed.peText : '',
          peState: decoded.peState,
          planNote: parsed.flags.includePlan ? parsed.planText : '',
          assessmentNote: parsed.flags.includeAssessment ? parsed.assessmentText : '',
          history: parsed.history,
          selectedDdx: parsed.ddx.selected,
          customDdx: parsed.ddx.custom,
          includeDecisionMaking: parsed.flags.includeDecisionMaking,
        },
      })
      return true
    } catch (e) {
      logError('useOpenSavedNote', e)
      emitErrorToast('Couldn’t open note', savedNoteErrorMessage(e, 'This note could not be opened. It is still saved — try again.'))
      return false
    }
  }, [openWriteNote, openProviderNote])
}

/**
 * View / Edit / Delete for a My Notes row — shared by the side nav, the rail's
 * hover card and the Mission Overview widget. Provider entries only re-import
 * into the editing view, so they get Edit alone. `onOpened` runs after a
 * successful open (close the nav).
 */
export function useSavedNoteActions() {
  const openSavedNote = useOpenSavedNote()
  const removeSavedNote = useSavedNotesStore(s => s.remove)

  return useCallback((note: SavedNote, onOpened?: () => void): ContextMenuItem[] => {
    const open = (mode: 'view' | 'edit') => async () => { if (await openSavedNote(note, mode)) onOpened?.() }
    return [
      ...(note.kind === 'provider' ? [] : [{ key: 'view', label: 'View', icon: Eye, onAction: open('view') }]),
      { key: 'edit', label: 'Edit', icon: Pencil, onAction: open('edit') },
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => { void removeSavedNote(note.id) } },
    ]
  }, [openSavedNote, removeSavedNote])
}
