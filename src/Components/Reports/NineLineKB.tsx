// src/Components/Reports/NineLineKB.tsx
import { useState, useRef } from 'react'
import { Copy, Check, ChevronRight, Printer, RefreshCw, Image } from 'lucide-react'
import { MedevacForm } from '../Medevac/MedevacForm'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { BarcodeDisplay } from '../Barcode'

import type { MedevacRequest } from '../../Types/MedevacTypes'
import { medevacPatientTotal } from '../../Types/MedevacTypes'
import { medevacToText, medevacToCompact, copyToClipboard, printReport } from '../../lib/reportExport'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'

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
      <div className="relative">
        <div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3 text-tertiary text-[10pt] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {text}
          </div>
        </div>
        <OverlayActionMenu
          items={[
            { key: 'copy', label: 'Copy text', icon: copiedText ? Check : Copy, onAction: handleCopyText, variant: copiedText ? 'success' : 'default' },
            { key: 'print', label: 'Print', icon: Printer, onAction: handlePrint },
            { key: 'clear', label: 'Clear form', icon: RefreshCw, destructive: true, onAction: onClear },
          ]}
        />
      </div>

      {/* Data Matrix — compact encoding, not prose text */}
      <div ref={barcodeRef} className="relative">
        <div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div>
            <BarcodeDisplay encodedText={compact} layout="col" />
          </div>
        </div>
        <ActionPill shadow="sm" placement="overlay">
          <ActionButton icon={copiedDm === 'image' ? Check : Image} label="Copy image" onClick={handleCopyImage} variant={copiedDm === 'image' ? 'success' : 'default'} />
          <ActionButton icon={copiedDm === 'code' ? Check : Copy} label="Copy code" onClick={handleCopyCode} variant={copiedDm === 'code' ? 'success' : 'default'} />
        </ActionPill>
      </div>
    </div>
  )
}
