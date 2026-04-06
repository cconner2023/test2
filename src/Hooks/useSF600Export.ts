// Hooks/useSF600Export.ts — Export a note as a filled SF600 PDF
import { useCallback } from 'react'
import type { SF600Params } from '../Utilities/SF600Export'
import { usePdfExport } from './usePdfExport'

/** Lazy-loads the SF600 PDF generator and returns preview data. */
export function useSF600Export() {
  const generateFn = useCallback(async (params: SF600Params) => {
    const { generateSF600 } = await import('../Utilities/SF600Export')
    const bytes = await generateSF600(params)
    const filename = `SF600-${params.date?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.pdf`
    return { bytes, filename }
  }, [])

  const { status, preview, exportPdf, downloadPreview, clearPreview } = usePdfExport(generateFn)

  return {
    exportSF600: exportPdf,
    sf600ExportStatus: status,
    sf600Preview: preview,
    downloadSF600: downloadPreview,
    clearSF600Preview: clearPreview,
  }
}
