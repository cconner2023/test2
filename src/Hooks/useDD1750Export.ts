/**
 * Hook for lazy-loading DD Form 1750 (Packing List) PDF generation.
 * Double-lazy: the hook is cheap; pdf-lib + the exporter load only on trigger.
 * Mirrors useDA2062Export.
 */
import { useCallback } from 'react'
import type { DD1750Params } from '../Utilities/DD1750Export'
import { usePdfExport } from './usePdfExport'

export function useDD1750Export() {
  const generateFn = useCallback(async (params: DD1750Params) => {
    const { generateDD1750 } = await import('../Utilities/DD1750Export')
    const bytes = await generateDD1750(params)

    const zone = params.zoneName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `DD1750-${zone}-${params.date.replace(/\//g, '-')}.pdf`

    return { bytes, filename }
  }, [])

  const { status, error, preview, exportPdf: exportDD1750, downloadPreview: downloadDD1750, clearPreview: clearDD1750Preview } = usePdfExport(generateFn)

  return { exportDD1750, status, error, dd1750Preview: preview, downloadDD1750, clearDD1750Preview }
}
