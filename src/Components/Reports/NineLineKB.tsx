// src/Components/Reports/NineLineKB.tsx
import { useState } from 'react'
import { Copy, Download, Printer, Trash2 } from 'lucide-react'
import { MedevacForm } from '../Medevac/MedevacForm'
import type { MedevacRequest } from '../../Types/MedevacTypes'
import { medevacToText, copyToClipboard, downloadAsText, printReport } from '../../lib/reportExport'

export function NineLineKB() {
  const [req, setReq] = useState<MedevacRequest | null>(null)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!req) return
    copyToClipboard(medevacToText(req)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    if (!req) return
    downloadAsText(medevacToText(req), '9line-medevac.txt')
  }

  function handlePrint() {
    if (!req) return
    printReport('9-Line MEDEVAC', medevacToText(req))
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <MedevacForm value={req} onChange={setReq} />
      {req && (
        <>
          <div className="flex gap-2 pt-2 pb-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-themewhite2 text-sm text-secondary active:scale-95 transition-all"
            >
              <Copy size={14} />{copied ? 'Copied!' : 'Copy Text'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-themewhite2 text-sm text-secondary active:scale-95 transition-all"
            >
              <Download size={14} />
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-themewhite2 text-sm text-secondary active:scale-95 transition-all"
            >
              <Printer size={14} />
            </button>
          </div>
          <div className="pb-4">
            <button
              onClick={() => setReq(null)}
              className="flex items-center gap-1.5 text-xs text-tertiary/50 active:scale-95 transition-all mx-auto"
            >
              <Trash2 size={12} /> Clear form
            </button>
          </div>
        </>
      )}
    </div>
  )
}
