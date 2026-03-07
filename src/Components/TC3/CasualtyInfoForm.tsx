import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { EvacPriority } from '../../Types/TC3Types'

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

const EVAC_OPTIONS: { value: EvacPriority; label: string }[] = [
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Priority', label: 'Priority' },
  { value: 'Routine', label: 'Routine' },
]

export const CasualtyInfoForm = memo(function CasualtyInfoForm() {
  const casualty = useTC3Store((s) => s.card.casualty)
  const updateCasualty = useTC3Store((s) => s.updateCasualty)
  const evacuation = useTC3Store((s) => s.card.evacuation)
  const updateEvacuation = useTC3Store((s) => s.updateEvacuation)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Casualty Information</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Casualty demographics & evacuation</p>
      </div>

      {/* EVAC Priority — DD 1380 top of card */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">EVAC Priority</p>
        <div className="flex gap-2">
          {EVAC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateEvacuation({ priority: evacuation.priority === opt.value ? '' : opt.value })}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border
                ${evacuation.priority === opt.value
                  ? 'bg-themeredred text-white border-themeredred'
                  : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
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

        {/* Sex toggle */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Sex</p>
          <div className="flex gap-2">
            {(['M', 'F'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateCasualty({ sex: casualty.sex === s ? '' : s })}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border
                  ${casualty.sex === s
                    ? 'bg-themeredred text-white border-themeredred'
                    : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                  }`}
              >
                {s === 'M' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Service (Branch)"
          value={casualty.service}
          onChange={(v) => updateCasualty({ service: v })}
          placeholder="Branch of service"
        />
        <Field
          label="Allergies"
          value={casualty.allergies}
          onChange={(v) => updateCasualty({ allergies: v })}
          placeholder="Known allergies (NKDA if none)"
        />
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
