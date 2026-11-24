import { useCallback } from 'react'
import { useNavigationStore } from '../stores/useNavigationStore'
import { decodeSavedNote, savedNoteErrorMessage } from '../Utilities/savedNoteCodec'
import { emitErrorToast } from '../lib/errorFeedback'
import { logError } from '../Utilities/ErrorHandler'

/** Open an encoded note (enc: or plaintext) in the Provider drawer. */
export function useEditInProvider() {
  const openProviderNote = useNavigationStore(s => s.openProviderNote)

  return useCallback(async (
    encodedText: string,
    opts: { savedNoteId?: string; beforeOpen?: () => void } = {},
  ): Promise<boolean> => {
    try {
      const decoded = await decodeSavedNote({ encodedText, kind: 'provider', dispositionType: '', dispositionText: '' })
      opts.beforeOpen?.()
      openProviderNote({ savedNoteId: opts.savedNoteId, payload: decoded.ascii })
      return true
    } catch (e) {
      logError('useEditInProvider', e)
      emitErrorToast("Couldn't open in Provider", savedNoteErrorMessage(e, 'This note could not be opened.'))
      return false
    }
  }, [openProviderNote])
}
