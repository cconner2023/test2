import { memo } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
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
  const openExport = useTC3Store((s) => s.openExport)
  const card = useTC3Store((s) => s.card)
  const hasData = isPopulated(card)

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
        <div className="shrink-0 px-3 py-3 border-t border-tertiary/10">
          <button
            data-tour="tc3-export"
            type="button"
            onClick={() => openExport()}
            className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <FileText size={18} className="text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">Export Note & Barcode</p>
                <p className="text-[9pt] text-secondary mt-0.5">Generate encoded card for transfer</p>
              </div>
              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
})
