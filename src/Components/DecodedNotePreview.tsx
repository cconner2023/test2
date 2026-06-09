import { useState, useEffect } from 'react'
import { Copy, Check, Share2, ExternalLink } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import type { ContextMenuAction } from './PreviewOverlay'
import { NotePreviewContent } from './ImportResultPopover'
import { useNoteImport } from '../Hooks/useNoteImport'
import type { ImportPreview } from '../Hooks/useNoteImport'
import { useNoteShare } from '../Hooks/useNoteShare'
import { useIsMobile } from '../Hooks/useIsMobile'
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec'
import { copyWithHtml } from '../Utilities/clipboardUtils'
import { logError } from '../Utilities/ErrorHandler'
import type { MedevacRequest } from '../Types/MedevacTypes'

interface DecodedNotePreviewProps {
  /** Raw encoded token extracted from the chat message. */
  token: string
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  /** Open a decoded 9-Line MEDEVAC in the medevac drawer. */
  onOpenMedevac?: (req: MedevacRequest) => void
}

/**
 * Decode a shared Beacon note found in a chat message and preview it in the
 * same overlay used by the barcode importer. Encrypted ("enc:") tokens are
 * AES-GCM decrypted on-device first; the resulting pipe-delimited string is run
 * through the shared import pipeline. Nothing is decoded until the overlay opens
 * — and decryption stays local, so no PHI ever leaves the device.
 */
export function DecodedNotePreview({ token, isOpen, anchorRect, onClose, onOpenMedevac }: DecodedNotePreviewProps) {
  const { importFromBarcode } = useNoteImport()
  const { shareNote } = useNoteShare()
  const isMobile = useIsMobile()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setStatus('loading')
    setPreview(null)
    ;(async () => {
      try {
        let ascii = token
        if (isEncryptedBarcode(token)) {
          const decrypted = await decryptBarcode(token)
          if (!decrypted) { if (!cancelled) setStatus('error'); return }
          ascii = decrypted
        }
        const result = importFromBarcode(ascii)
        if (!cancelled) { setPreview(result); setStatus('ready') }
      } catch (e) {
        logError('DecodedNotePreview.decode', e)
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, token, importFromBarcode])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const actions: ContextMenuAction[] = preview
    ? [
        ...(preview.isMedevac && preview.medevacReq && onOpenMedevac
          ? [{
              key: 'open-9line',
              label: 'Open',
              icon: ExternalLink,
              onAction: () => { onOpenMedevac(preview.medevacReq!); onClose() },
              closesOnAction: false,
            } as ContextMenuAction]
          : []),
        {
          key: 'copy',
          label: copied ? 'Copied' : 'Copy',
          icon: copied ? Check : Copy,
          onAction: () => { copyWithHtml(preview.fullNote); setCopied(true) },
          closesOnAction: false,
        },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onAction: () => shareNote({
            encodedText: preview.encodedText,
            symptomText: preview.symptomText,
            dispositionType: preview.dispositionType,
            dispositionText: preview.dispositionText,
          }, isMobile),
          closesOnAction: false,
        },
      ]
    : []

  const body =
    status === 'loading' ? (
      <div className="flex items-center justify-center p-8 text-sm text-tertiary animate-pulse">Decoding note…</div>
    ) : status === 'error' ? (
      <div className="px-5 py-7 text-[10pt] text-tertiary text-center leading-relaxed">
        Couldn't decode this note. It may be incomplete, or the decode key isn't
        available yet — reconnect and try again.
      </div>
    ) : preview ? (
      <NotePreviewContent preview={preview} />
    ) : null

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      preview={body}
      actions={actions}
      title="Decoded note"
      maxWidth={360}
    />
  )
}
