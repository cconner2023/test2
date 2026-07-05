import { PdfCanvasView } from '../PdfCanvasView'
import type { PdfPreviewData } from '../../Hooks/usePdfExport'

interface Da2062PdfViewProps {
  preview: PdfPreviewData
}

/**
 * Da2062PdfView — the generated DA 2062 PDF as right-pane / detail-sheet BODY
 * content (the object-view surface), filling its bounded-height parent. Used when
 * the launching roster lives in a MAIN panel (property CustodyPanel): objects are
 * viewed in a right-pane/sheet, so the host (PropertyPanel) renders this in the
 * detail pane (desktop) / detail Sheet (mobile) with its own filename + Save/Close
 * header. Contrast Da2062Preview (the nested PreviewOverlay) used when the launcher
 * is ALREADY inside a pane/sheet (SignOutForm).
 */
export function Da2062PdfView({ preview }: Da2062PdfViewProps) {
  return <PdfCanvasView bytes={preview.bytes} className="bg-themewhite3" />
}
