// src/Components/Reports/NineLineKB.tsx
import { useState, useRef } from 'react'
import { Copy, Check, ChevronRight, Printer, RefreshCw, Image } from 'lucide-react'
import { MedevacForm } from '../Medevac/MedevacForm'
import { ActionButton } from '../ActionButton'
import { BarcodeDisplay } from '../Barcode'

import type { MedevacRequest } from '../../Types/MedevacTypes'
import { medevacPatientTotal } from '../../Types/MedevacTypes'
import { medevacToText, medevacToCompact, copyToClipboard, printReport } from '../../lib/reportExport'
import { ActionPill } from '../ActionPill'

function hasContent(req: MedevacRequest): boolean {
  return !!(req.l1 || req.l2f || req.l2c || medevacPatientTotal(req) > 0)
}

// ── Form view ────────────────────────────────────────────────────────────────

interface NineLineKBProps {
  req: MedevacRequest
  onChange: (req: MedevacRequest) => void
  onReview: () => void
}

export function NineLineKB({ req, onChange, onReview }: NineLineKBProps) {
  return (
    <div className="px-4 py-4 space-y-4">
      <MedevacForm value={req} onChange={onChange} />
      {hasContent(req) && (
        <div className="flex justify-end pb-2">
          <ActionPill>
            <button
              type="button"
              onClick={onReview}
              aria-label="Review"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all bg-themeblue2 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </ActionPill>
        </div>
      )}
    </div>
  )
}

// ── Export / Review view ─────────────────────────────────────────────────────

interface NineLineExportProps {
  req: MedevacRequest
  onClear: () => void
}

export function NineLineExport({ req, onClear }: NineLineExportProps) {
  const [copiedText, setCopiedText] = useState(false)
  const [copiedDm, setCopiedDm] = useState<'image' | 'code' | null>(null)
  const barcodeRef = useRef<HTMLDivElement>(null)
  const text = medevacToText(req)
  const compact = medevacToCompact(req)

  function handleCopyText() {
    copyToClipboard(text).then(() => {
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    })
  }

  function handlePrint() {
    printReport('9-Line MEDEVAC', text)
  }

  function handleCopyCode() {
    copyToClipboard(compact).then(() => {
      setCopiedDm('code')
      setTimeout(() => setCopiedDm(null), 2000)
    })
  }

  function handleCopyImage() {
    const canvas = barcodeRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) return
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(() => { setCopiedDm('image'); setTimeout(() => setCopiedDm(null), 2000) })
        .catch(() => {})
    }, 'image/png')
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Text Preview */}
      <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-4 py-3 pt-14 text-tertiary text-[10pt] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {text}
        </div>
        <ActionPill shadow="sm" className="absolute top-2 right-2">
          <ActionButton icon={copiedText ? Check : Copy} label="Copy text" onClick={handleCopyText} variant={copiedText ? 'success' : 'default'} iconSize={14} />
          <ActionButton icon={Printer} label="Print" onClick={handlePrint} iconSize={14} />
          <ActionButton icon={RefreshCw} label="Clear form" variant="danger" onClick={onClear} iconSize={14} />
        </ActionPill>
      </div>

      {/* Data Matrix — compact encoding, not prose text */}
      <div ref={barcodeRef} className="relative rounded-xl bg-themewhite2 overflow-hidden">
        <div className="pt-14">
          <BarcodeDisplay encodedText={compact} layout="col" />
        </div>
        <ActionPill shadow="sm" className="absolute top-2 right-2">
          <ActionButton icon={copiedDm === 'image' ? Check : Image} label="Copy image" onClick={handleCopyImage} variant={copiedDm === 'image' ? 'success' : 'default'} iconSize={14} />
          <ActionButton icon={copiedDm === 'code' ? Check : Copy} label="Copy code" onClick={handleCopyCode} variant={copiedDm === 'code' ? 'success' : 'default'} iconSize={14} />
        </ActionPill>
      </div>
    </div>
  )
}
