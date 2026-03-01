/**
 * Hook for lazy-loading DA Form 2062 PDF generation.
 * Double-lazy: the hook itself is cheap; pdf-lib is only loaded
 * when the user actually triggers an export.
 */
import { useState, useCallback } from 'react'
import type { DA2062Params } from '../Utilities/DA2062Export'

export type ExportStatus = 'idle' | 'generating' | 'done' | 'error'

export function useDA2062Export() {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const exportDA2062 = useCallback(async (params: DA2062Params) => {
    setStatus('generating')
    setError(null)

    try {
      const { generateDA2062, downloadPdfBytes } = await import('../Utilities/DA2062Export')
      const bytes = await generateDA2062(params)

      const holderName = params.toHolder.displayName.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `DA2062-${holderName}-${params.date.replace(/\//g, '-')}.pdf`

      downloadPdfBytes(bytes, filename)
      setStatus('done')
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }, [])

  return { exportDA2062, status, error }
}
