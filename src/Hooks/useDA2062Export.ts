/**
 * Hook for lazy-loading DA Form 2062 PDF generation.
 * Double-lazy: the hook itself is cheap; pdf-lib is only loaded
 * when the user actually triggers an export.
 */
import { useCallback } from 'react'
import type { DA2062Params } from '../Utilities/DA2062Export'
import { usePdfExport } from './usePdfExport'

export type ExportStatus = 'idle' | 'generating' | 'done' | 'error'

export function useDA2062Export() {
  const generateFn = useCallback(async (params: DA2062Params) => {
    const { generateDA2062 } = await import('../Utilities/DA2062Export')
    const bytes = await generateDA2062(params)

    const holderName = params.toHolder.displayName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `DA2062-${holderName}-${params.date.replace(/\//g, '-')}.pdf`

    return { bytes, filename }
  }, [])

  const { status, error, preview, exportPdf: exportDA2062, downloadPreview: downloadDA2062, clearPreview: clearDA2062Preview } = usePdfExport(generateFn)

  return { exportDA2062, status, error, da2062Preview: preview, downloadDA2062, clearDA2062Preview }
}
