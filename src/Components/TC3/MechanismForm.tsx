import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { MechanismType } from '../../Types/TC3Types'

const MECHANISM_OPTIONS: { type: MechanismType; label: string }[] = [
  { type: 'blast', label: 'Blast / IED' },
  { type: 'gunshot', label: 'Gunshot Wound' },
  { type: 'vehicle', label: 'Motor Vehicle' },
  { type: 'fall', label: 'Fall' },
  { type: 'burn', label: 'Burn' },
  { type: 'other', label: 'Other' },
]

export const MechanismForm = memo(function MechanismForm() {
  const mechanism = useTC3Store((s) => s.card.mechanism)
  const toggleMechanism = useTC3Store((s) => s.toggleMechanism)
  const setMechanismOther = useTC3Store((s) => s.setMechanismOther)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Mechanism of Injury</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 2 — Select all that apply</p>
      </div>

      <div className="space-y-2">
        {MECHANISM_OPTIONS.map((opt) => {
          const isSelected = mechanism.types.includes(opt.type)
          return (
            <button
              key={opt.type}
              onClick={() => toggleMechanism(opt.type)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                ${isSelected
                  ? 'border-themeredred/25 bg-themeredred/10'
                  : 'border-tertiary/15 bg-themewhite2 hover:bg-themewhite2/80'
                }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                ${isSelected ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-tertiary'}`}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Other description */}
      {mechanism.types.includes('other') && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Describe Other</label>
          <input
            type="text"
            value={mechanism.otherDescription}
            onChange={(e) => setMechanismOther(e.target.value)}
            placeholder="Describe mechanism..."
            className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
      )}
    </div>
  )
})
