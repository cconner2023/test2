import { useMemo, useEffect } from 'react'
import { Download } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { PillButton } from './HeaderPill'
import { PdfPreviewFallback } from './PdfPreviewFallback'
import type { PdfPreviewData } from '../Hooks/usePdfExport'

interface PdfPreviewModalProps {
  preview: PdfPreviewData | null
  onDownload: () => void
  onClose: () => void
  /** Explicit z-tier — pass when launched from a surface that mounts OUTSIDE the host
   *  sheet (e.g. the shared ItemActionMenu on mobile), so the preview floats above it
   *  instead of inheriting a low default. Omit for the in-context call sites. */
  zIndex?: number
}

/**
 * Shared export-preview surface for generated PDFs (note exports — SF600 / DD689 —
 * and property labels). A nested PreviewOverlay (our object-viewing primitive): the
 * filename rides the overlay header beside the X, the PDF renders in an <object>
 * (falling back to PdfPreviewFallback where the device can't inline-render), and Save
 * (download + close) is a footer action pill. Mirrors Da2062Preview. Name kept as
 * PdfPreviewModal for its call sites (WriteNotePage, ProviderNoteOutput,
 * PropertyDrawer) though it is no longer a centered Modal.
 */
export function PdfPreviewModal({ preview, onDownload, onClose, zIndex }: PdfPreviewModalProps) {
  const blobUrl = useMemo(() => {
    if (!preview) return null
    return URL.createObjectURL(new Blob([preview.bytes], { type: 'application/pdf' }))
  }, [preview])

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  const save = () => { onDownload(); onClose() }

  return (
    <PreviewOverlay
      isOpen={!!preview && !!blobUrl}
      onClose={onClose}
      anchorRect={null}
      zIndex={zIndex}
      title={preview?.filename ?? 'PDF'}
      maxWidth={672}
      previewMaxHeight="70dvh"
      rightFooter={
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          <PillButton icon={Download} iconSize={16} accent="info" onClick={save} label="Save" />
        </div>
      }
    >
      {blobUrl && (
        <object data={blobUrl} type="application/pdf" className="w-full h-[70dvh] block bg-themewhite">
          <PdfPreviewFallback />
        </object>
      )}
    </PreviewOverlay>
  )
}
