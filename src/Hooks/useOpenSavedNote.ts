import { useCallback } from 'react'
import { useNavigationStore } from '../stores/useNavigationStore'
import { decodeSavedNote, savedNoteErrorMessage } from '../Utilities/savedNoteCodec'
import { emitErrorToast } from '../lib/errorFeedback'
import { logError } from '../Utilities/ErrorHandler'
import type { SavedNote } from '../lib/savedNotesDb'

/**
 * Reopen a My Notes entry in WriteNotePage at Full Note. Decrypts on-device,
 * rebuilds the algorithm card states, and seeds HPI/PE/DDx/Plan so the medic
 * can step back to Write Note, edit, and re-save over the same entry.
 * Provider entries re-import into the Provider drawer instead.
 * Failure is shown to the user; the stored entry is never touched.
 */
export function useOpenSavedNote() {
  const openWriteNote = useNavigationStore(s => s.openWriteNote)
  const openProviderNote = useNavigationStore(s => s.openProviderNote)

  return useCallback(async (saved: SavedNote): Promise<boolean> => {
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
        initialPage: 1,
        restore: {
          savedNoteId: saved.id,
          hpi: parsed.flags.includeHPI ? parsed.hpiText : '',
          peNote: parsed.flags.includePhysicalExam ? parsed.peText : '',
          peState: decoded.peState,
          planNote: parsed.flags.includePlan ? parsed.planText : '',
          assessmentNote: parsed.flags.includeAssessment ? parsed.assessmentText : '',
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
