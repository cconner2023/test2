import { memo, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useTC3Store } from '../../stores/useTC3Store'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'

/** Left column of the desktop DD1380 layout — front of the card. */
export const TC3FrontColumn = memo(function TC3FrontColumn() {
  const card = useTC3Store((s) => s.card)
  const removeInjury = useTC3Store((s) => s.removeInjury)
  const resetCard = useTC3Store((s) => s.resetCard)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  const injuryCount = card.injuries.length

  return (
    <div className="h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Header */}
        <div className="px-1">
          <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase">
            DD 1380 — TC3 Card (Front)
          </p>
        </div>

        {/* Casualty Info */}
        <CasualtyInfoForm />

        {/* Mechanism */}
        <MechanismForm />

        {/* Body Diagram — front + back side by side (desktop) */}
        <BodyDiagram />

        {/* Injury list summary */}
        {injuryCount > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
              Marked Injuries ({injuryCount})
            </p>
            {card.injuries.map((inj) => (
              <div key={inj.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  inj.side === 'front' ? 'bg-themeblue2/10 text-themeblue2' : 'bg-tertiary/10 text-tertiary'
                }`}>
                  {inj.side}
                </span>
                <span className="text-xs font-medium text-primary">{inj.type}</span>
                {inj.bodyRegion && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred">
                    {getRegionLabel(inj.bodyRegion)}
                  </span>
                )}
                {inj.description && <span className="text-[10px] text-tertiary/60 truncate">{inj.description}</span>}
                {inj.treatmentLinks.length > 0 && (
                  <span className="text-[8px] text-green-600 font-medium">{inj.treatmentLinks.length} tx</span>
                )}
                <button
                  onClick={() => removeInjury(inj.id)}
                  className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors shrink-0"
                >
                  <X size={12} className="text-themeredred/60" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Signs & Symptoms */}
        <VitalsForm />

        {/* Reset card */}
        <div className="pt-2 border-t border-tertiary/10 px-1">
          <button onClick={() => setShowConfirmReset(true)} className="flex items-center gap-1.5 text-[10px] text-tertiary/50 hover:text-themeredred transition-colors py-1">
            <RotateCcw size={12} /> <span>New Card</span>
          </button>
          <ConfirmDialog
            visible={showConfirmReset}
            title="Clear all data and start a new card?"
            confirmLabel="Clear"
            variant="danger"
            onConfirm={handleReset}
            onCancel={() => setShowConfirmReset(false)}
          />
        </div>
      </div>
    </div>
  )
})
