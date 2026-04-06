/**
 * Generic PDF export hook factory.
 *
 * Generates PDF bytes and surfaces them for preview instead of
 * auto-downloading. Callers render a PdfPreviewModal with the
 * returned preview data, letting the user inspect before saving.
 */
import { useState, useCallback } from 'react'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('usePdfExport')

export type PdfExportStatus = 'idle' | 'generating' | 'done' | 'error'

export interface PdfPreviewData {
  bytes: Uint8Array
  filename: string
}

export interface UsePdfExportOptions {
  /** Milliseconds to hold the done/error status before resetting to idle.
   *  Pass 0 or undefined to disable the auto-reset. */
  resetAfterMs?: number
}

export interface UsePdfExportResult<P> {
  status: PdfExportStatus
  error: string | null
  preview: PdfPreviewData | null
  exportPdf: (params: P) => Promise<void>
  downloadPreview: () => void
  clearPreview: () => void
}

/**
 * Generic PDF export hook.
 *
 * @param generatorFn  Async function that generates PDF bytes + filename.
 * @param options      Optional configuration (e.g. auto-reset timing).
 */
export function usePdfExport<P>(
  generatorFn: (params: P) => Promise<PdfPreviewData>,
  options?: UsePdfExportOptions,
): UsePdfExportResult<P> {
  const [status, setStatus] = useState<PdfExportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PdfPreviewData | null>(null)

  const exportPdf = useCallback(async (params: P) => {
    setStatus('generating')
    setError(null)

    try {
      const result = await generatorFn(params)
      setPreview(result)
      setStatus('done')
    } catch (err) {
      logger.error('PDF export failed:', err)
      setError(String(err))
      setStatus('error')
      if (options?.resetAfterMs) {
        setTimeout(() => setStatus('idle'), options.resetAfterMs)
      }
    }
  }, [generatorFn, options?.resetAfterMs])

  const downloadPreview = useCallback(async () => {
    if (!preview) return
    const { downloadPdfBytes } = await import('../Utilities/downloadUtils')
    downloadPdfBytes(preview.bytes, preview.filename)
  }, [preview])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setStatus('idle')
  }, [])

  return { status, error, preview, exportPdf, downloadPreview, clearPreview }
}
