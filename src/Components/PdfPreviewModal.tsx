import { useMemo, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Modal } from './Modal'
import type { PdfPreviewData } from '../Hooks/usePdfExport'

interface PdfPreviewModalProps {
  preview: PdfPreviewData | null
  onDownload: () => void
  onClose: () => void
}

export function PdfPreviewModal({ preview, onDownload, onClose }: PdfPreviewModalProps) {
  const blobUrl = useMemo(() => {
    if (!preview) return null
    return URL.createObjectURL(new Blob([preview.bytes], { type: 'application/pdf' }))
  }, [preview])

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  if (!blobUrl) return null

  return (
    <Modal isOpen={!!preview} onClose={onClose} hideClose maxWidth={672} mobileMaxHeight="85dvh">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
          <h2 className="text-sm font-semibold text-primary truncate">{preview?.filename}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDownload(); onClose() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10pt] font-medium bg-blue-600 text-white active:scale-95 transition-transform"
            >
              <Download size={14} />
              Save
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-tertiary hover:text-primary hover:bg-tertiary/10 active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-neutral-100">
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full"
          >
            <div className="flex flex-col items-center justify-center h-full gap-3 text-tertiary text-sm px-6 text-center">
              <p>PDF preview not supported on this device.</p>
              <button
                onClick={() => { onDownload(); onClose() }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white active:scale-95 transition-transform"
              >
                <Download size={14} />
                Download PDF
              </button>
            </div>
          </object>
        </div>
      </div>
    </Modal>
  )
}
