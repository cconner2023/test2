import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { EvacPriority } from '../../Types/TC3Types'

const EVAC_PRIORITIES: { value: EvacPriority; label: string; description: string }[] = [
  { value: 'Urgent', label: 'Urgent', description: 'Within 2 hours to save life, limb, or eyesight' },
  { value: 'Urgent-Surgical', label: 'Urgent Surgical', description: 'Requires surgical intervention within 2 hours' },
  { value: 'Priority', label: 'Priority', description: 'Within 4 hours to prevent deterioration' },
  { value: 'Routine', label: 'Routine', description: 'Within 24 hours, no expected deterioration' },
  { value: 'Convenience', label: 'Convenience', description: 'Next available transport' },
]

export const EvacuationForm = memo(function EvacuationForm() {
  const evacuation = useTC3Store((s) => s.card.evacuation)
  const updateEvacuation = useTC3Store((s) => s.updateEvacuation)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Evacuation</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 8 — Evacuation priority and additional notes</p>
      </div>

      {/* Evacuation Priority */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Evacuation Priority</p>
        {EVAC_PRIORITIES.map((opt) => {
          const isSelected = evacuation.priority === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => updateEvacuation({ priority: isSelected ? '' : opt.value })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                ${isSelected
                  ? 'border-themeredred/25 bg-themeredred/10'
                  : 'border-tertiary/15 bg-themewhite2 hover:bg-themewhite2/80'
                }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                ${isSelected ? 'border-themeredred' : 'border-tertiary/30'}`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-themeredred" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-tertiary'}`}>{opt.label}</p>
                <p className="text-[10px] text-tertiary/60 mt-0.5">{opt.description}</p>
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
})
