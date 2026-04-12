import { memo, useState } from 'react'
import { RotateCcw, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useTC3Store } from '../../stores/useTC3Store'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram, INJURY_TYPE_COLOR } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'

/** Left column of the desktop DD1380 layout — front of the card. */
export const TC3FrontColumn = memo(function TC3FrontColumn() {
  const card = useTC3Store((s) => s.card)
  const resetCard = useTC3Store((s) => s.resetCard)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  const markerCount = card.markers.length

  return (
    <div className="relative h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Casualty Info */}
        <CasualtyInfoForm />

        {/* Mechanism */}
        <MechanismForm />

        {/* Body Diagram — front + back side by side (desktop) */}
        <BodyDiagram
          editingMarkerId={editingMarker}
          onEditMarker={setEditingMarker}
        />

        {/* Marker list summary */}
        {markerCount > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
              Markers ({markerCount})
            </p>
            <div className="rounded-2xl border border-tertiary/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
              {card.markers.map((m) => {
                const primaryInjury = m.injuries[0]
                const dotColor = primaryInjury ? (INJURY_TYPE_COLOR[primaryInjury] ?? '#6b7280') : m.procedures.length > 0 ? '#22c55e' : '#f59e0b'
                const typeLabel = m.injuries.length > 0
                  ? m.injuries.join(', ')
                  : m.procedures.length > 0
                    ? m.procedures.join(', ')
                    : 'Treatment'
                const regionLabel = m.bodyRegion ? getRegionLabel(m.bodyRegion) : null
                const txCount = m.treatments.length

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditingMarker(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tertiary/3 transition-colors"
                  >
                    {/* Colored dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />

                    {/* Type label */}
                    <span className="text-xs font-medium text-primary">{typeLabel}</span>

                    {/* Region badge */}
                    {regionLabel && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred shrink-0">
                        {regionLabel}
                      </span>
                    )}

                    {/* Description (truncated) */}
                    {m.description && (
                      <span className="text-[10px] text-tertiary/60 truncate min-w-0">{m.description}</span>
                    )}

                    {/* Spacer */}
                    <span className="flex-1" />

                    {/* Treatment count */}
                    {txCount > 0 && (
                      <span className="text-[9px] text-themegreen font-medium shrink-0">{txCount} tx</span>
                    )}

                    {/* Chevron */}
                    <ChevronRight size={14} className="text-tertiary/30 shrink-0" />
                  </button>
                )
              })}
            </div>
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
            title="Clear card? Current entries will be lost."
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
