import { memo, useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useTC3Store } from '../../stores/useTC3Store'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'

/** Right column of the desktop DD1380 layout — back of the card. */
export const TC3BackColumn = memo(function TC3BackColumn() {
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExport = useTC3Store((s) => s.openExport)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <div className="h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Interventions (unified MARCH + Meds/Fluids) */}
        <MARCHForm />

        {/* Notes */}
        <NotesPanel />

        {/* Export — disposition card style */}
        <div className="space-y-3">
          <div
            onClick={() => openExport()}
            className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themeredred/30 cursor-pointer active:scale-95 transition-all"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="px-3 py-2 shrink-0 rounded-md flex items-center justify-center bg-themeredred font-bold text-sm text-white">
                    TC3
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <p className="text-sm text-primary">Export Note & Barcode</p>
                    <p className="text-xs text-secondary mt-0.5">Generate encoded card for transfer</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-themeredred/60 hover:bg-themeredred/30 text-white">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* New Card */}
          <div className="pt-2 border-t border-tertiary/10">
            <button
              onClick={() => setShowConfirmReset(true)}
              className="flex items-center gap-1.5 text-[11px] text-tertiary hover:text-themeredred transition-colors px-1 py-1"
            >
              <RotateCcw size={14} /> <span>New Card</span>
            </button>
            <ConfirmDialog
              visible={showConfirmReset}
              title="Clear card? Current entries will be lost."
              confirmLabel="Clear"
              variant="danger"
              onConfirm={handleReset}
              onCancel={() => setShowConfirmReset(false)}
            />
          </div>
        </div>

      </div>
    </div>
  )
})
