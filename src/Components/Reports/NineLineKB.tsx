// src/Components/Reports/NineLineKB.tsx
import { useState, useRef } from 'react'
import { Copy, Check, Printer, X, Image } from 'lucide-react'
import { MedevacForm } from '../Medevac/MedevacForm'
import { ActionButton } from '../ActionButton'
import { BarcodeDisplay } from '../Barcode'
import type { MedevacRequest } from '../../Types/MedevacTypes'
import { medevacPatientTotal } from '../../Types/MedevacTypes'
import { medevacToText, medevacToCompact, copyToClipboard, printReport } from '../../lib/reportExport'

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
        <div className="flex justify-center pb-2">
          <ActionButton icon={Check} label="Review" onClick={onReview} />
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

const BTN = 'p-1.5 rounded-full transition-all active:scale-95'
const BTN_IDLE = `${BTN} text-tertiary hover:text-primary hover:bg-themewhite3`
const BTN_DONE = `${BTN} text-themegreen`

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
      <div>
        <div className="pb-2 flex items-center justify-between">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">9-Line Preview</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopyText}
              title="Copy text"
              className={copiedText ? BTN_DONE : BTN_IDLE}
            >
              {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              title="Print"
              className={BTN_IDLE}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3 text-tertiary text-[9pt] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {text}
          </div>
        </div>
      </div>

      {/* Data Matrix — compact encoding, not prose text */}
      <div>
        <div className="pb-2 flex items-center justify-between">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Data Matrix</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopyImage}
              title="Copy image"
              className={copiedDm === 'image' ? BTN_DONE : BTN_IDLE}
            >
              {copiedDm === 'image' ? <Check className="w-4 h-4" /> : <Image className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy code"
              className={copiedDm === 'code' ? BTN_DONE : BTN_IDLE}
            >
              {copiedDm === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div ref={barcodeRef} className="rounded-xl overflow-hidden">
          <BarcodeDisplay encodedText={compact} layout="col" />
        </div>
      </div>

      {/* Clear */}
      <div className="flex justify-center pb-2">
        <ActionButton icon={X} label="Clear form" variant="danger" onClick={onClear} />
      </div>
    </div>
  )
}
