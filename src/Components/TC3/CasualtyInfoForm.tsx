import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'

const Field = ({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) => (
  <div className="space-y-1">
    <label className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
    />
  </div>
)

export const CasualtyInfoForm = memo(function CasualtyInfoForm() {
  const casualty = useTC3Store((s) => s.card.casualty)
  const updateCasualty = useTC3Store((s) => s.updateCasualty)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Casualty Information</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 Section 1 — Casualty demographics</p>
      </div>

      <div className="space-y-3">
        <Field
          label="Battle Roster No."
          value={casualty.battleRosterNo}
          onChange={(v) => updateCasualty({ battleRosterNo: v })}
          placeholder="Roster number"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Last Name"
            value={casualty.lastName}
            onChange={(v) => updateCasualty({ lastName: v })}
            placeholder="Last name"
          />
          <Field
            label="First Name"
            value={casualty.firstName}
            onChange={(v) => updateCasualty({ firstName: v })}
            placeholder="First name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Last 4 (SSN/DoD ID)"
            value={casualty.last4}
            onChange={(v) => updateCasualty({ last4: v.slice(0, 4) })}
            placeholder="0000"
          />
          <Field
            label="Unit"
            value={casualty.unit}
            onChange={(v) => updateCasualty({ unit: v })}
            placeholder="Unit designation"
          />
        </div>
        <Field
          label="Date/Time of Injury"
          value={casualty.dateTimeOfInjury}
          onChange={(v) => updateCasualty({ dateTimeOfInjury: v })}
          type="datetime-local"
        />
        <Field
          label="Date/Time of Treatment"
          value={casualty.dateTimeOfTreatment}
          onChange={(v) => updateCasualty({ dateTimeOfTreatment: v })}
          type="datetime-local"
        />
      </div>
    </div>
  )
})
