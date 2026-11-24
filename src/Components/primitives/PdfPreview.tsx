import { Download, Share2 } from 'lucide-react'
import { PaneSurface } from '@/Components/primitives/PaneCard'
import { HeaderMenuPill } from '@/Components/primitives/HeaderMenuPill'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { OverlayStack, type CardMorphHost } from '@/Components/primitives/OverlayStack'
import { PdfCanvasView } from '../PdfCanvasView'
import type { PdfPreviewData } from '../../Hooks/usePdfExport'

/** PDF pages as surface body. Every PDF preview renders through this. */
export function PdfPreviewBody({ preview }: { preview: PdfPreviewData }) {
  return <PdfCanvasView bytes={preview.bytes} scroll={false} className="bg-themewhite" />
}

/** Header ellipsis: Download (then close), Share when the OS accepts files. */
export function PdfSaveAction({ preview, onSave }: { preview: PdfPreviewData; onSave: () => void }) {
  const file = new File([preview.bytes], preview.filename, { type: 'application/pdf' })
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })
  const items: ContextMenuItem[] = [
    { key: 'download', label: 'Download', icon: Download, onAction: onSave },
    ...(canShare ? [{
      key: 'share',
      label: 'Share',
      icon: Share2,
      onAction: () => { navigator.share({ files: [file], title: preview.filename }).catch(() => {}) },
    }] : []),
  ]
  return <HeaderMenuPill items={items} />
}

interface PdfPreviewProps {
  preview: PdfPreviewData | null
  /** Opens on a loading surface before bytes arrive. */
  generating?: boolean
  onDownload: () => void
  onClose: () => void
  /** Nested in a property card/sheet: morph into it. */
  cardHost?: CardMorphHost
  /** Mobile Sheet z-index. */
  zIndex?: number
  desktopZIndex?: number
  title?: string
}

/**
 * PdfPreview — the one generated-PDF surface. PaneCard on desktop, fit Sheet
 * on mobile; with `cardHost` it morphs into the host card/sheet instead.
 */
export function PdfPreview({ preview, generating = false, onDownload, onClose, cardHost, zIndex, desktopZIndex, title = 'PDF' }: PdfPreviewProps) {
  const isOpen = generating || !!preview
  const save = () => { onDownload(); onClose() }
  const heading = preview?.filename ?? title
  const actions = preview ? <PdfSaveAction preview={preview} onSave={save} /> : undefined

  if (cardHost) {
    return (
      <OverlayStack
        isOpen={isOpen}
        onClose={onClose}
        cardHost={cardHost}
        loading={!preview}
        initial={{ key: 'pdf' }}
        screens={{
          pdf: {
            title: heading,
            headerActions: actions,
            render: () => preview ? <PdfPreviewBody preview={preview} /> : null,
          },
        }}
      />
    )
  }

  return (
    <PaneSurface
      isOpen={isOpen}
      onClose={onClose}
      title={heading}
      actions={actions}
      loading={!preview}
      width={480}
      maxHeight={90}
      zIndex={zIndex}
      desktopZIndex={desktopZIndex}
    >
      {preview && <PdfPreviewBody preview={preview} />}
    </PaneSurface>
  )
}
