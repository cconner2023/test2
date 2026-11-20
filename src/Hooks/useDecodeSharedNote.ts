import { useCallback } from 'react'
import { useNoteImport } from './useNoteImport'
import { useNavigationStore } from '../stores/useNavigationStore'
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec'
import { logError } from '../Utilities/ErrorHandler'
import { emitErrorToast } from '../lib/errorFeedback'
import { getBarcodeKey } from '../lib/cryptoService'

/**
 * Decode a shared note token found in a chat message and open it in the
 * app-level ImportedNoteDrawer — the same surface the barcode importer uses.
 * Encrypted ("enc:") tokens are AES-GCM decrypted on-device first; the
 * resulting pipe-delimited string runs through the shared import pipeline.
 * Nothing is decoded until the medic taps, and decryption stays local, so no
 * PHI ever leaves the device.
 */
export function useDecodeSharedNote() {
  const { importFromBarcode } = useNoteImport()
  const setImportPreview = useNavigationStore(s => s.setImportPreview)

  return useCallback(async (token: string) => {
    try {
      let ascii = token
      if (isEncryptedBarcode(token)) {
        const decrypted = await decryptBarcode(token)
        if (!decrypted) {
          // decryptBarcode returns null for both a missing key and a token that
          // fails GCM auth (truncated/corrupted) — tell them apart for the user.
          const hasKey = !!(await getBarcodeKey())
          logError('useDecodeSharedNote', new Error(hasKey ? 'decrypt failed — token unreadable' : 'decrypt failed — key unavailable'))
          emitErrorToast('Couldn’t decode note', hasKey
            ? 'This note is incomplete or damaged. Ask the sender to share it again.'
            : 'The note key isn’t available on this device. Check your connection and try again.')
          return
        }
        ascii = decrypted
      }
      const preview = importFromBarcode(ascii)
      // Match the barcode path: keep the original (possibly encrypted) token for re-share/render.
      preview.encodedText = token
      setImportPreview(preview)
    } catch (e) {
      logError('useDecodeSharedNote', e)
      emitErrorToast('Couldn’t decode note', 'This note couldn’t be read.')
    }
  }, [importFromBarcode, setImportPreview])
}
