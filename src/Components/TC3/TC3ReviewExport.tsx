import { memo, useMemo, useState } from 'react'
import { Copy, Check, RotateCcw, FileText } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { useAuthStore } from '../../stores/useAuthStore'
import { formatTC3Note } from '../../Utilities/TC3Formatter'
import { TC3WriteNote } from './TC3WriteNote'

export const TC3ReviewExport = memo(function TC3ReviewExport() {
  const card = useTC3Store((s) => s.card)
  const resetCard = useTC3Store((s) => s.resetCard)
  const profile = useAuthStore((s) => s.profile)

  const [copied, setCopied] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [showWriteNote, setShowWriteNote] = useState(false)

  const noteText = useMemo(() => formatTC3Note(card, profile), [card, profile])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(noteText)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = noteText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    if (!showConfirmReset) {
      setShowConfirmReset(true)
      return
    }
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Review & Export</h3>
        <p className="text-[11px] text-tertiary/70">Review the TC3 card and export via barcode or text</p>
      </div>

      {/* Note preview (condensed) */}
      <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
        <div className="px-3 py-2 bg-tertiary/5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">TC3 Card Preview</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre className="px-3 py-3 text-[10px] text-tertiary leading-relaxed whitespace-pre-wrap font-mono overflow-y-auto max-h-[40vh]">
          {noteText}
        </pre>
      </div>

      {/* Export button — opens write note wizard */}
      <button
        onClick={() => setShowWriteNote(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-themeredred text-white hover:bg-themeredred/90 transition-all"
      >
        <FileText size={16} />
        Export Note & Barcode
      </button>

      {/* Quick copy */}
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border
          ${copied
            ? 'bg-green-500 text-white border-green-500'
            : 'border-tertiary/20 text-tertiary hover:bg-tertiary/5'
          }`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied to Clipboard' : 'Copy Note Text'}
      </button>

      {/* New Card */}
      <div className="pt-2 border-t border-tertiary/10">
        {showConfirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-themeredred">Clear all data and start a new card?</span>
            <button
              onClick={handleReset}
              className="text-[11px] px-3 py-1 rounded-md bg-themeredred text-white hover:bg-themeredred/90 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowConfirmReset(false)}
              className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[11px] text-tertiary hover:text-themeredred transition-colors px-1 py-1"
          >
            <RotateCcw size={14} /> <span>New Card</span>
          </button>
        )}
      </div>

      {/* Write Note Wizard (BaseDrawer) */}
      <TC3WriteNote
        isVisible={showWriteNote}
        onClose={() => setShowWriteNote(false)}
      />
    </div>
  )
})
