import { useCallback } from 'react'
import { useNavigationStore } from '../stores/useNavigationStore'
import { isEncryptedBarcode, decryptBarcode, parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/NoteCodec'
import { decodePEState } from '../Utilities/peCodec'
import { logError } from '../Utilities/ErrorHandler'
import { withTimeout } from '../Utilities/withTimeout'
import type { SavedNote } from '../lib/savedNotesDb'

/**
 * Reopen a My Notes entry in WriteNotePage at Full Note. Decrypts on-device,
 * rebuilds the algorithm card states, and seeds HPI/PE/DDx/Plan so the medic
 * can step back to Write Note, edit, and re-save over the same entry.
 * Provider entries re-import into the Provider drawer instead.
 */
export function useOpenSavedNote() {
  const openWriteNote = useNavigationStore(s => s.openWriteNote)
  const openProviderNote = useNavigationStore(s => s.openProviderNote)

  return useCallback(async (saved: SavedNote): Promise<boolean> => {
    try {
      let ascii = saved.encodedText
      if (isEncryptedBarcode(ascii)) {
        // Key lookup can fall through to IDB/network; never let the tap hang on it.
        const decrypted = await withTimeout(decryptBarcode(ascii), 10_000, 'savedNote.decrypt')
        if (!decrypted) throw new Error('decrypt failed — key unavailable')
        ascii = decrypted
      }
      if (saved.kind === 'provider') {
        openProviderNote({ savedNoteId: saved.id, payload: ascii })
        return true
      }
      const parsed = parseNoteEncoding(ascii)
      if (!parsed?.symptomCode) throw new Error('unparseable saved note')
      const algorithmOptions = findAlgorithmByCode(parsed.symptomCode)
      if (!algorithmOptions?.length) throw new Error(`Algorithm ${parsed.symptomCode} not found`)

      const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed)
      if (!disposition) throw new Error('saved note has no disposition')
      const found = findSymptomByCode(parsed.symptomCode)

      openWriteNote({
        disposition,
        algorithmOptions,
        cardStates,
        selectedSymptom: {
          icon: found?.symptom.icon || saved.symptomIcon,
          text: found?.symptom.text || saved.symptomText,
        },
        initialPage: 1,
        restore: {
          savedNoteId: saved.id,
          hpi: parsed.flags.includeHPI ? parsed.hpiText : '',
          peNote: parsed.flags.includePhysicalExam ? parsed.peText : '',
          peState: parsed.peRaw ? decodePEState(parsed.peRaw, parsed.symptomCode) : null,
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
      return false
    }
  }, [openWriteNote, openProviderNote])
}
