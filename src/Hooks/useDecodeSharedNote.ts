import { useCallback } from 'react'
import { useNoteImport } from './useNoteImport'
import { useNavigationStore } from '../stores/useNavigationStore'
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec'
import { logError } from '../Utilities/ErrorHandler'

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
        if (!decrypted) { logError('useDecodeSharedNote', new Error('decrypt failed — key unavailable')); return }
        ascii = decrypted
      }
      const preview = importFromBarcode(ascii)
      // Match the barcode path: keep the original (possibly encrypted) token for re-share/render.
      preview.encodedText = token
      setImportPreview(preview)
    } catch (e) {
      logError('useDecodeSharedNote', e)
    }
  }, [importFromBarcode, setImportPreview])
}
