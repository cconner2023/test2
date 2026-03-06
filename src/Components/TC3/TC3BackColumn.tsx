import { memo, useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { MARCHForm } from './MARCHForm'
import { MedicationsForm } from './MedicationsForm'
import { FluidsPanel } from './FluidsPanel'
import { NotesPanel } from './NotesPanel'
import { EvacuationForm } from './EvacuationForm'
import { TC3WriteNote } from './TC3WriteNote'

/** Right column of the desktop DD1380 layout — back of the card. */
export const TC3BackColumn = memo(function TC3BackColumn() {
  const resetCard = useTC3Store((s) => s.resetCard)
  const [showWriteNote, setShowWriteNote] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const handleReset = () => {
    if (!showConfirmReset) {
      setShowConfirmReset(true)
      return
    }
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <div className="h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Header */}
        <div className="px-1">
          <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase">
            DD 1380 — TC3 Card (Back)
          </p>
        </div>

        {/* MARCH Protocol */}
        <MARCHForm />

        {/* Medications */}
        <MedicationsForm />

        {/* Fluids & Blood Products (extracted from Circulation) */}
        <FluidsPanel />

        {/* Notes */}
        <NotesPanel />

        {/* Evacuation */}
        <EvacuationForm />

        {/* Export — disposition card style */}
        <div className="space-y-3">
          <div
            onClick={() => setShowWriteNote(true)}
            className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themeredred/30 cursor-pointer active:scale-[0.98] transition-all"
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
        </div>

        {/* Export drawer */}
        <TC3WriteNote
          isVisible={showWriteNote}
          onClose={() => setShowWriteNote(false)}
        />
      </div>
    </div>
  )
})
