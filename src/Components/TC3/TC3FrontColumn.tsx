import { memo, useState } from 'react'
import { RotateCcw, ChevronRight, Crosshair, Trash2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { SectionHeader } from '../Section'
import { useTC3Store } from '../../stores/useTC3Store'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
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
        <div data-tour="tc3-body-diagram">
          <BodyDiagram
            editingMarkerId={editingMarker}
            onEditMarker={setEditingMarker}
          />
        </div>

        {/* Marker list summary */}
        {markerCount > 0 && (
          <div className="space-y-1.5">
            <SectionHeader>Markers</SectionHeader>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
              {card.markers.map((m) => {
                const typeLabel = m.injuries.length > 0
                  ? m.injuries.join(', ')
                  : m.procedures.length > 0
                    ? m.procedures.join(', ')
                    : 'Treatment'
                const regionLabel = m.bodyRegion ? getRegionLabel(m.bodyRegion) : null

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditingMarker(m.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                      <Crosshair size={18} className="text-tertiary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary">{typeLabel}</p>
                      {regionLabel && (
                        <p className="text-[11px] text-secondary mt-0.5">{regionLabel}</p>
                      )}
                      {m.description && (
                        <p className="text-[10px] text-tertiary/60 mt-0.5 truncate">{m.description}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
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
      </div>
    </div>
  )
})
