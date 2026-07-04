/**
 * Hook for lazy-loading property-ZONE label-sheet PDF generation.
 * The zone sibling of usePropertyLabelExport: same label-sheet generator, but
 * the Data Matrix encodes the ZONE tag (BCN-ZONE:<id>). pdf-lib + the generator
 * import only on export.
 */
import { useCallback } from 'react'
import type { LabelSheetParams } from '../Utilities/PropertyLabelExport'
import { encodeZoneTag } from '../Utilities/zoneLabelCodec'
import { usePdfExport } from './usePdfExport'

export function useZoneLabelExport() {
  const generateFn = useCallback(async (params: LabelSheetParams) => {
    const { generateLabelSheet } = await import('../Utilities/PropertyLabelExport')
    const bytes = await generateLabelSheet({ ...params, encode: encodeZoneTag })
    const preset = typeof params.geometry === 'string' ? params.geometry : 'custom'
    const filename = `zone-labels-${preset}-${params.items.length}.pdf`
    return { bytes, filename }
  }, [])

  const { status, error, preview, exportPdf, downloadPreview, clearPreview } = usePdfExport(generateFn)

  return {
    exportZoneLabels: exportPdf,
    status,
    error,
    zoneLabelPreview: preview,
    downloadZoneLabels: downloadPreview,
    clearZoneLabelPreview: clearPreview,
  }
}
