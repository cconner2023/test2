import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'

const CheckBox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
      ${checked ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
  >
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
      ${checked ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className={`text-xs font-medium ${checked ? 'text-primary' : 'text-tertiary'}`}>{label}</span>
  </button>
)

export const OtherSectionMobile = memo(function OtherSectionMobile() {
  const other = useTC3Store((s) => s.card.other)
  const updateOther = useTC3Store((s) => s.updateOther)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Other</h3>
        <p className="text-[9pt] text-tertiary">DD 1380 — Additional treatments</p>
      </div>

      <CheckBox label="Combat Pill Pack" checked={other.combatPillPack} onChange={(v) => updateOther({ combatPillPack: v })} />

      <div className="space-y-2">
        <CheckBox
          label="Eye Shield"
          checked={other.eyeShield.applied}
          onChange={(v) => updateOther({ eyeShield: { ...other.eyeShield, applied: v } })}
        />
        {other.eyeShield.applied && (
          <div className="pl-6 flex gap-2">
            {(['R', 'L', 'both'] as const).map((side) => (
              <button
                key={side}
                onClick={() => updateOther({ eyeShield: { ...other.eyeShield, side } })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${other.eyeShield.side === side
                    ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                    : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                  }`}
              >
                {side === 'both' ? 'Both' : side}
              </button>
            ))}
          </div>
        )}
      </div>

      <CheckBox label="Splint" checked={other.splint} onChange={(v) => updateOther({ splint: v })} />

      <div className="space-y-2">
        <CheckBox
          label="Hypothermia Prevention"
          checked={other.hypothermiaPrevention.applied}
          onChange={(v) => updateOther({ hypothermiaPrevention: { ...other.hypothermiaPrevention, applied: v } })}
        />
        {other.hypothermiaPrevention.applied && (
          <div className="pl-6">
            <input
              type="text"
              value={other.hypothermiaPrevention.type}
              onChange={(e) => updateOther({ hypothermiaPrevention: { ...other.hypothermiaPrevention, type: e.target.value } })}
              placeholder="Method (Blanket, HPMK, Ready-Heat...)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
            />
          </div>
        )}
      </div>
    </div>
  )
})

export const FirstResponderMobile = memo(function FirstResponderMobile() {
  const firstResponder = useTC3Store((s) => s.card.firstResponder)
  const updateFirstResponder = useTC3Store((s) => s.updateFirstResponder)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">First Responder</h3>
        <p className="text-[9pt] text-tertiary">DD 1380 — Signature block</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Last Name</label>
          <input
            type="text"
            value={firstResponder.lastName}
            onChange={(e) => updateFirstResponder({ lastName: e.target.value })}
            placeholder="Last name"
            className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">First Name</label>
          <input
            type="text"
            value={firstResponder.firstName}
            onChange={(e) => updateFirstResponder({ firstName: e.target.value })}
            placeholder="First name"
            className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Last 4</label>
        <input
          type="text"
          value={firstResponder.last4}
          onChange={(e) => updateFirstResponder({ last4: e.target.value.slice(0, 4) })}
          placeholder="0000"
          className="w-32 text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
      </div>
    </div>
  )
})
