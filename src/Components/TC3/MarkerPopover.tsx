import { memo } from 'react'
import { Check } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { getSuggestedTreatments, getRegionLabel } from '../../Utilities/bodyRegionMap'
import { DatePickerInput, PickerInput } from '../FormInputs'
import type {
  TC3Marker,
  InjuryType,
  TreatmentCategory,
  ProcedureType,
  TriagePriority,
  TourniquetType,
  TQCategory,
  DressingType,
} from '../../Types/TC3Types'

/* ── Static data ─────────────────────────────────────────────────────────── */

const INJURY_OPTIONS: { value: InjuryType; label: string }[] = [
  { value: 'GSW', label: 'GSW' },
  { value: 'blast', label: 'Blast' },
  { value: 'burn', label: 'Burn' },
  { value: 'laceration', label: 'Laceration' },
  { value: 'fracture', label: 'Fracture' },
  { value: 'amputation', label: 'Amputation' },
]

const ALL_TREATMENTS: { value: TreatmentCategory; label: string }[] = [
  { value: 'tourniquet', label: 'Tourniquet' },
  { value: 'hemostatic', label: 'Hemostatic' },
  { value: 'chestSeal', label: 'Chest Seal' },
  { value: 'needleDecomp', label: 'Needle Decomp' },
]

const PROCEDURE_OPTIONS: { value: ProcedureType; label: string }[] = [
  { value: 'IV', label: 'IV' },
  { value: 'IO', label: 'IO' },
]

const PRIORITY_OPTIONS: { value: TriagePriority; label: string; color: string }[] = [
  { value: 'U', label: 'U', color: '#ef4444' },
  { value: 'P', label: 'P', color: '#f59e0b' },
  { value: 'R', label: 'R', color: '#22c55e' },
  { value: 'E', label: 'E', color: '#6b7280' },
]

const TQ_TYPES: TourniquetType[] = ['CAT', 'SOFT-T']
const TQ_CATEGORIES: TQCategory[] = ['Extremity', 'Junctional', 'Truncal']
const DRESSING_TYPES: DressingType[] = ['Hemostatic', 'Pressure', 'Other']

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      opts.push({ value: `${hh}:${mm}`, label: `${hh}${mm}` })
    }
  }
  return opts
})()

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function matchesFilter(label: string, filter: string): boolean {
  if (!filter) return true
  return label.toLowerCase().includes(filter.toLowerCase())
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface MarkerPopoverProps {
  marker: TC3Marker
  filter: string
  clearFilter: () => void
}

export const MarkerPopover = memo(function MarkerPopover({ marker, filter }: MarkerPopoverProps) {
  const updateMarker = useTC3Store((s) => s.updateMarker)

  const regionLabel = marker.bodyRegion ? getRegionLabel(marker.bodyRegion) : ''
  const suggested = getSuggestedTreatments(marker.bodyRegion)

  // Sort treatments: suggested first, then the rest
  const sortedTreatments = [
    ...ALL_TREATMENTS.filter(t => suggested.includes(t.value)),
    ...ALL_TREATMENTS.filter(t => !suggested.includes(t.value)),
  ]

  /* ── Toggle helpers ── */

  const toggleInjury = (val: InjuryType) => {
    const next = marker.injuries.includes(val)
      ? marker.injuries.filter(v => v !== val)
      : [...marker.injuries, val]
    updateMarker(marker.id, { injuries: next })
  }

  const toggleTreatment = (val: TreatmentCategory) => {
    const next = marker.treatments.includes(val)
      ? marker.treatments.filter(v => v !== val)
      : [...marker.treatments, val]
    updateMarker(marker.id, { treatments: next })
  }

  const toggleProcedure = (val: ProcedureType) => {
    const next = marker.procedures.includes(val)
      ? marker.procedures.filter(v => v !== val)
      : [...marker.procedures, val]
    updateMarker(marker.id, { procedures: next })
  }

  const togglePriority = (val: TriagePriority) => {
    updateMarker(marker.id, { priority: marker.priority === val ? '' : val })
  }

  /* ── Filtered lists ── */

  const filteredInjuries = INJURY_OPTIONS.filter(o => matchesFilter(o.label, filter))
  const filteredTreatments = sortedTreatments.filter(o => matchesFilter(o.label, filter))
  const filteredProcedures = PROCEDURE_OPTIONS.filter(o => matchesFilter(o.label, filter))
  const showPriority = !filter || matchesFilter('priority', filter) || matchesFilter('triage', filter)
  const showDateTime = !filter || matchesFilter('date', filter) || matchesFilter('time', filter)
  const showDetails = !filter || matchesFilter('gauge', filter) || matchesFilter('tourniquet', filter) || matchesFilter('dressing', filter)

  const hasTourniquet = marker.treatments.includes('tourniquet')
  const hasHemostatic = marker.treatments.includes('hemostatic')
  const hasIVIO = marker.procedures.length > 0

  return (
    <div className="py-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      {/* Region label */}
      {regionLabel && (
        <p className="px-4 pb-1 text-[9px] font-semibold text-themeredred/70 tracking-wider uppercase">
          {regionLabel}
        </p>
      )}

      {/* ── INJURIES ── */}
      {filteredInjuries.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-4 py-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marker.injuries.length > 0 ? 'bg-themegreen' : 'bg-tertiary/20'}`} />
            <span className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">
              Injuries{marker.injuries.length > 0 ? ` (${marker.injuries.length})` : ''}
            </span>
          </div>
          <div className="mx-3 rounded-xl border border-tertiary/10 overflow-hidden">
            {filteredInjuries.map((opt, i) => {
              const selected = marker.injuries.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleInjury(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors ${
                    selected ? 'bg-themegreen/5' : ''
                  } ${i > 0 ? 'border-t border-tertiary/5' : ''}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    selected ? 'bg-themegreen' : 'border border-tertiary/20'
                  }`}>
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  <span className={selected ? 'text-primary font-medium' : 'text-tertiary'}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TREATMENTS ── */}
      {filteredTreatments.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-4 py-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marker.treatments.length > 0 ? 'bg-themegreen' : 'bg-tertiary/20'}`} />
            <span className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">
              Treatments{marker.treatments.length > 0 ? ` (${marker.treatments.length})` : ''}
            </span>
          </div>
          <div className="mx-3 rounded-xl border border-tertiary/10 overflow-hidden">
            {filteredTreatments.map((opt, i) => {
              const selected = marker.treatments.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleTreatment(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors ${
                    selected ? 'bg-themegreen/5' : ''
                  } ${i > 0 ? 'border-t border-tertiary/5' : ''}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    selected ? 'bg-themegreen' : 'border border-tertiary/20'
                  }`}>
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  <span className={selected ? 'text-primary font-medium' : 'text-tertiary'}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PROCEDURES ── */}
      {filteredProcedures.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-4 py-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marker.procedures.length > 0 ? 'bg-themegreen' : 'bg-tertiary/20'}`} />
            <span className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase">
              Procedures{marker.procedures.length > 0 ? ` (${marker.procedures.length})` : ''}
            </span>
          </div>
          <div className="mx-3 rounded-xl border border-tertiary/10 overflow-hidden">
            {filteredProcedures.map((opt, i) => {
              const selected = marker.procedures.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleProcedure(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors ${
                    selected ? 'bg-themegreen/5' : ''
                  } ${i > 0 ? 'border-t border-tertiary/5' : ''}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    selected ? 'bg-themegreen' : 'border border-tertiary/20'
                  }`}>
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  <span className={selected ? 'text-primary font-medium' : 'text-tertiary'}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONDITIONAL DETAILS ── */}
      {showDetails && (hasIVIO || hasTourniquet || hasHemostatic) && (
        <div className="mx-3 mb-2 mt-1 space-y-2">
          {/* Gauge — shown when IV or IO selected */}
          {hasIVIO && (
            <div>
              <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase mb-1 px-1">Gauge</p>
              <input
                type="text"
                value={marker.gauge}
                onChange={(e) => updateMarker(marker.id, { gauge: e.target.value })}
                placeholder="Gauge (e.g. 18g)"
                className="w-full text-xs px-3 py-2 rounded-xl border border-tertiary/10 bg-themewhite outline-none focus:border-themeblue1/30 text-tertiary"
              />
            </div>
          )}

          {/* TQ Type + Category — shown when tourniquet selected */}
          {hasTourniquet && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase px-1">TQ Type</p>
              <div className="flex gap-1 px-1">
                {TQ_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateMarker(marker.id, { tqType: t })}
                    className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all ${
                      marker.tqType === t
                        ? 'bg-themeblue3 text-white'
                        : 'bg-tertiary/5 text-tertiary/60'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase px-1 pt-1">TQ Category</p>
              <div className="flex gap-1 px-1">
                {TQ_CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateMarker(marker.id, { tqCategory: c })}
                    className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all ${
                      marker.tqCategory === c
                        ? 'bg-themeblue3 text-white'
                        : 'bg-tertiary/5 text-tertiary/60'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dressing type — shown when hemostatic selected */}
          {hasHemostatic && (
            <div>
              <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase mb-1 px-1">Dressing Type</p>
              <div className="flex gap-1 px-1">
                {DRESSING_TYPES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateMarker(marker.id, { dressingType: d })}
                    className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all ${
                      marker.dressingType === d
                        ? 'bg-themeblue3 text-white'
                        : 'bg-tertiary/5 text-tertiary/60'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PRIORITY ── */}
      {showPriority && (
        <div className="mx-3 mb-2 mt-1">
          <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase mb-1.5 px-1">Priority</p>
          <div className="flex gap-1.5 px-1">
            {PRIORITY_OPTIONS.map(p => {
              const selected = marker.priority === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePriority(p.value as TriagePriority)}
                  className="w-9 h-9 rounded-full text-xs font-bold transition-all"
                  style={{
                    backgroundColor: selected ? p.color : undefined,
                    color: selected ? 'white' : p.color,
                    border: selected ? 'none' : `2px solid ${p.color}40`,
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DATE / TIME ── */}
      {showDateTime && (
        <div className="mx-3 mb-2 mt-1">
          <p className="text-[9px] font-semibold text-tertiary/50 tracking-wider uppercase mb-1.5 px-1">Date / Time</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <DatePickerInput
                value={marker.dateTime.slice(0, 10)}
                onChange={(date) => {
                  const time = marker.dateTime.slice(11, 16) || '00:00'
                  updateMarker(marker.id, { dateTime: `${date}T${time}` })
                }}
                placeholder="Date"
              />
            </div>
            <div className="flex-1">
              <PickerInput
                value={marker.dateTime.slice(11, 16)}
                onChange={(time) => {
                  const date = marker.dateTime.slice(0, 10)
                  updateMarker(marker.id, { dateTime: `${date}T${time}` })
                }}
                options={TIME_OPTIONS}
                placeholder="Time"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── DESCRIPTION ── */}
      {marker.description && (
        <div className="mx-4 mb-2">
          <p className="text-[10px] text-tertiary/40 italic">{marker.description}</p>
        </div>
      )}
    </div>
  )
})
