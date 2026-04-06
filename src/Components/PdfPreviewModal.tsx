import { useMemo, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { useOverlay } from '../Hooks/useOverlay'
import { useIsMobile } from '../Hooks/useIsMobile'
import type { PdfPreviewData } from '../Hooks/usePdfExport'

interface PdfPreviewModalProps {
  preview: PdfPreviewData | null
  onDownload: () => void
  onClose: () => void
}

export function PdfPreviewModal({ preview, onDownload, onClose }: PdfPreviewModalProps) {
  const isMobile = useIsMobile()
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(!!preview, onClose)

  const blobUrl = useMemo(() => {
    if (!preview) return null
    return URL.createObjectURL(new Blob([preview.bytes], { type: 'application/pdf' }))
  }, [preview])

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  if (!mounted || !blobUrl) return null

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
      <h2 className="text-sm font-semibold text-primary truncate">{preview?.filename}</h2>
      <div className="flex items-center gap-1">
        <button
          onClick={() => { onDownload(); close() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white active:scale-95 transition-transform"
        >
          <Download size={14} />
          Save
        </button>
        <button
          onClick={close}
          className="p-1.5 rounded-lg text-tertiary hover:text-primary hover:bg-tertiary/10 active:scale-95 transition-all"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-70 bg-black transition-opacity duration-300 ${open ? 'opacity-50' : 'opacity-0'}`}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
          onClick={close}
        />
        <div
          className={`fixed left-0 right-0 bottom-0 z-70 bg-themewhite rounded-t-[1.25rem] flex flex-col ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            height: '85dvh',
          }}
          {...touchHandlers}
        >
          <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25" />
          </div>
          {header}
          <div className="flex-1 min-h-0 bg-neutral-100">
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <div className="flex flex-col items-center justify-center h-full gap-3 text-tertiary text-sm px-6 text-center">
                <p>PDF preview not supported on this device.</p>
                <button
                  onClick={() => { onDownload(); close() }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white active:scale-95 transition-transform"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </object>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-70 bg-black transition-opacity duration-300 ${open ? 'opacity-50' : 'opacity-0'}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={close}
      />
      <div className="fixed inset-0 z-70 flex items-center justify-center pointer-events-none p-8">
        <div
          className={`bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 w-full max-w-2xl pointer-events-auto flex flex-col transition-all duration-300 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          style={{ height: '80vh' }}
        >
          {header}
          <div className="flex-1 min-h-0 rounded-b-2xl overflow-hidden bg-neutral-100">
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <div className="flex flex-col items-center justify-center h-full gap-3 text-tertiary text-sm">
                <p>Unable to display PDF preview.</p>
                <button
                  onClick={() => { onDownload(); close() }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white active:scale-95 transition-transform"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </object>
          </div>
        </div>
      </div>
    </>
  )
}
