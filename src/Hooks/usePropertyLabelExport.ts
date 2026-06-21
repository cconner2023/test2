/**
 * Hook for lazy-loading property label-sheet PDF generation.
 * pdf-lib + the generator are only imported when the user actually exports.
 * Mirrors useDA2062Export: returns a usePdfExport result surface.
 */
import { useCallback } from 'react'
import type { LabelSheetParams } from '../Utilities/PropertyLabelExport'
import { usePdfExport } from './usePdfExport'

export function usePropertyLabelExport() {
  const generateFn = useCallback(async (params: LabelSheetParams) => {
    const { generateLabelSheet } = await import('../Utilities/PropertyLabelExport')
    const bytes = await generateLabelSheet(params)
    const preset = typeof params.geometry === 'string' ? params.geometry : 'custom'
    const filename = `property-labels-${preset}-${params.items.length}.pdf`
    return { bytes, filename }
  }, [])

  const { status, error, preview, exportPdf, downloadPreview, clearPreview } = usePdfExport(generateFn)

  return {
    exportLabels: exportPdf,
    status,
    error,
    labelPreview: preview,
    downloadLabels: downloadPreview,
    clearLabelPreview: clearPreview,
  }
}
