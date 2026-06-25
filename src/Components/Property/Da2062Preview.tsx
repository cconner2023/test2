import { useMemo, useEffect } from 'react'
import { Download } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { PillButton } from '../HeaderPill'
import { PdfPreviewFallback } from '../PdfPreviewFallback'
import type { PdfPreviewData } from '../../Hooks/usePdfExport'

interface Da2062PreviewProps {
  /** The generated 2062 — null closes the overlay. */
  preview: PdfPreviewData | null
  onDownload: () => void
  onClose: () => void
  /** Scopes the overlay to a container (the property drawer / settings sheet).
   *  Null → floats fixed, auto-stacking above its host sheet via OverlayStackContext. */
  containerRef?: React.RefObject<HTMLElement | null>
}

/**
 * Da2062Preview — the generated DA 2062 PDF as a nested PreviewOverlay (our object-
 * viewing primitive). Objects are normally viewed in a right-pane / sheet; but this
 * preview is launched from SignOutForm, which ALREADY lives in a sheet/pane (the
 * property detail pane / detail sheet), so the preview nests as a PreviewOverlay and
 * auto-stacks above its host via OverlayStackContext rather than stacking a second
 * sheet. Mirrors the RecordPreview pattern. (When the launcher is MAIN-panel content
 * instead — e.g. CustodyPanel — the 2062 opens in the host's right-pane/sheet via
 * Da2062PdfView, not this overlay.)
 *
 * The PDF renders in an <object>; the footer carries Save (download + close), and
 * the filename rides the overlay header beside the X.
 */
export function Da2062Preview({ preview, onDownload, onClose, containerRef }: Da2062PreviewProps) {
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
      containerRef={containerRef}
      title={preview?.filename ?? 'DA 2062'}
      maxWidth={640}
      previewMaxHeight="62dvh"
      rightFooter={
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          <PillButton icon={Download} iconSize={16} accent="info" onClick={save} label="Save" />
        </div>
      }
    >
      {blobUrl && (
        <object data={blobUrl} type="application/pdf" className="w-full h-[62dvh] block bg-themewhite">
          <PdfPreviewFallback />
        </object>
      )}
    </PreviewOverlay>
  )
}
