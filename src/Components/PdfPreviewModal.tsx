import { Download } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { PdfCanvasView } from './PdfCanvasView'
import type { PdfPreviewData } from '../Hooks/usePdfExport'

interface PdfPreviewModalProps {
  preview: PdfPreviewData | null
  onDownload: () => void
  onClose: () => void
  /** Explicit z-tier — pass when launched from a surface that mounts OUTSIDE the host
   *  sheet (e.g. the shared ItemActionMenu on mobile), so the preview floats above it
   *  instead of inheriting a low default. Omit for the in-context call sites. */
  zIndex?: number
  /** True while the PDF is still generating (before `preview` bytes arrive). Opens
   *  the overlay immediately as a HUD puck that holds through generation, then morphs
   *  into the full preview once the bytes land. Omit for an instant (non-morph) open. */
  generating?: boolean
}

/**
 * Shared export-preview surface for generated PDFs (note exports — SF600 / DD689 —
 * and property labels). A nested PreviewOverlay (our object-viewing primitive): the
 * filename rides the overlay header beside the X, the PDF renders to page canvases
 * via PdfCanvasView (pdf.js — works on iOS Safari, unlike the old native <object>
 * embed the build CSP blocked), and Save (download + close) is a footer action pill.
 * Mirrors Da2062Preview. Name kept as
 * PdfPreviewModal for its call sites (WriteNotePage, ProviderNoteOutput,
 * PropertyDrawer) though it is no longer a centered Modal.
 */
export function PdfPreviewModal({ preview, onDownload, onClose, zIndex, generating = false }: PdfPreviewModalProps) {
  const save = () => { onDownload(); onClose() }

  return (
    <PreviewOverlay
      isOpen={generating || !!preview}
      onClose={onClose}
      anchorRect={null}
      zIndex={zIndex}
      title={preview?.filename ?? 'PDF'}
      maxWidth={672}
      previewMaxHeight="70dvh"
      loading={generating || !preview}
      rightFooter={
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          <PillButton icon={Download} iconSize={16} accent="info" onClick={save} label="Save" />
        </div>
      }
    >
      {preview && <PdfCanvasView bytes={preview.bytes} className="bg-themewhite" />}
    </PreviewOverlay>
  )
}
