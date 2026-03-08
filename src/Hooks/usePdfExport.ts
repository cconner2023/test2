/**
 * Generic PDF export hook factory.
 *
 * Extracted from useDD689Export.ts and useDA2062Export.ts to eliminate
 * the duplicated status-state + try/catch + dynamic-import pattern.
 *
 * Each export hook calls usePdfExport with its own export function and
 * filename builder, reducing each hook to a thin wrapper.
 */
import { useState, useCallback } from 'react'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('usePdfExport')

export type PdfExportStatus = 'idle' | 'generating' | 'done' | 'error'

export interface UsePdfExportOptions {
  /** Milliseconds to hold the done/error status before resetting to idle.
   *  Pass 0 or undefined to disable the auto-reset. */
  resetAfterMs?: number
}

export interface UsePdfExportResult<P> {
  status: PdfExportStatus
  error: string | null
  exportPdf: (params: P) => Promise<void>
}

/**
 * Generic PDF export hook.
 *
 * @param exportFn   Async function that generates and downloads the PDF.
 *                   Receives the params object passed to exportPdf().
 * @param options    Optional configuration (e.g. auto-reset timing).
 */
export function usePdfExport<P>(
  exportFn: (params: P) => Promise<void>,
  options?: UsePdfExportOptions,
): UsePdfExportResult<P> {
  const [status, setStatus] = useState<PdfExportStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const exportPdf = useCallback(async (params: P) => {
    setStatus('generating')
    setError(null)

    try {
      await exportFn(params)
      setStatus('done')
      if (options?.resetAfterMs) {
        setTimeout(() => setStatus('idle'), options.resetAfterMs)
      }
    } catch (err) {
      logger.error('PDF export failed:', err)
      setError(String(err))
      setStatus('error')
      if (options?.resetAfterMs) {
        setTimeout(() => setStatus('idle'), options.resetAfterMs)
      }
    }
  }, [exportFn, options?.resetAfterMs])

  return { status, error, exportPdf }
}
