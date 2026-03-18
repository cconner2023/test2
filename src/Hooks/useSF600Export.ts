// Hooks/useSF600Export.ts — Export a note as a filled SF600 PDF
import { useCallback } from 'react'
import type { SF600Params } from '../Utilities/SF600Export'
import { UI_TIMING } from '../Utilities/constants'
import { usePdfExport } from './usePdfExport'

/** Lazy-loads the SF600 PDF generator and triggers a browser download. */
export function useSF600Export() {
  const doExport = useCallback(async (params: SF600Params) => {
    const { generateSF600, downloadPdfBytes } = await import('../Utilities/SF600Export')
    const bytes = await generateSF600(params)
    const filename = `SF600-${params.date?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.pdf`
    downloadPdfBytes(bytes, filename)
  }, [])

  const { status: sf600ExportStatus, exportPdf: exportSF600 } = usePdfExport(doExport, {
    resetAfterMs: UI_TIMING.FEEDBACK_DURATION,
  })

  return { exportSF600, sf600ExportStatus }
}
