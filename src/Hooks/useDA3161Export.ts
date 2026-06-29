/**
 * Hook for lazy-loading DA Form 3161 (Turn-In) PDF generation. Like useDA2062Export,
 * pdf-lib + the generator are only imported when the user actually exports. Generates
 * the filled 3161 and downloads it (the turn-in surfaces are document-light — no in-pane
 * preview pipeline like the 2062 reprint).
 */
import { useCallback, useState } from 'react'
import type { DA3161Params } from '../Utilities/DA3161Export'

export function useDA3161Export() {
  const [generating, setGenerating] = useState(false)

  const exportDA3161 = useCallback(async (params: DA3161Params) => {
    setGenerating(true)
    try {
      const { generateDA3161, downloadPdfBytes } = await import('../Utilities/DA3161Export')
      const bytes = await generateDA3161(params)
      const who = params.fromHolder.displayName.replace(/[^a-zA-Z0-9]/g, '_') || 'turnin'
      downloadPdfBytes(bytes, `DA3161-TurnIn-${who}-${params.date}.pdf`)
    } finally {
      setGenerating(false)
    }
  }, [])

  return { exportDA3161, generatingDA3161: generating }
}
