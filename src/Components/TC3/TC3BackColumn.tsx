import { memo, useState } from 'react'
import { ChevronRight, RotateCcw, FileText, Trash2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Card } from '../../Types/TC3Types'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'

/** Right column of the desktop DD1380 layout — back of the card. */
function isPopulated(card: TC3Card): boolean {
  return (
    card.markers.length > 0 ||
    card.medications.length > 0 ||
    card.vitals.length > 0 ||
    card.mechanism.types.length > 0 ||
    !!card.casualty.lastName ||
    !!card.casualty.firstName ||
    !!card.notes
  )
}

export const TC3BackColumn = memo(function TC3BackColumn() {
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExport = useTC3Store((s) => s.openExport)
  const card = useTC3Store((s) => s.card)
  const hasData = isPopulated(card)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <div className="h-full flex flex-col bg-themewhite">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-3 py-4 space-y-6">
          <MARCHForm />
          <NotesPanel />
        </div>
      </div>

      {/* Footer */}
      {hasData && (
        <div className="shrink-0 px-3 py-3 border-t border-tertiary/10 space-y-2">
          <button
            data-tour="tc3-export"
            type="button"
            onClick={() => openExport()}
            className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <FileText size={18} className="text-tertiary/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">Export Note & Barcode</p>
                <p className="text-[11px] text-secondary mt-0.5">Generate encoded card for transfer</p>
              </div>
              <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
            </div>
          </button>

          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-themeredred transition-colors px-1 py-1"
          >
            <RotateCcw size={14} /> <span>New Card</span>
          </button>
        </div>
      )}

      <PreviewOverlay
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        anchorRect={null}
        maxWidth={280}
        title="Clear card?"
        actions={[
          { key: 'clear', label: 'Clear card', icon: Trash2, onAction: handleReset, variant: 'danger' },
        ]}
      >
        <p className="px-4 pb-4 text-xs text-secondary">Current entries will be lost.</p>
      </PreviewOverlay>
    </div>
  )
})
