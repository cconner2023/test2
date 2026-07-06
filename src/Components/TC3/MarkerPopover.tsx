import { memo } from 'react'
import { Check } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { getValidTreatments, getRegionLabel } from '../../Utilities/bodyRegionMap'
import { SectionHeader } from '@/Components/primitives/Section'
import { DatePickerInput, PickerInput } from '@/Components/primitives/FormInputs'
import type {
  TC3Marker,
  InjuryType,
  TreatmentCategory,
  ProcedureType,
} from '../../Types/TC3Types'
import { TourniquetEditor, DressingEditor } from './TreatmentEditors'

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

/* ── Shared row list ─────────────────────────────────────────────────────── */

function SelectList<T extends string>({
  options,
  selected,
  onToggle,
  accentClass,
}: {
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (val: T) => void
  accentClass: string
}) {
  return (
    <div>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-themeblue2/5 transition-colors border-b border-primary/6 last:border-0"
          >
            <span className={`text-sm flex-1 ${isSelected ? 'font-medium text-primary' : 'text-tertiary'}`}>
              {opt.label}
            </span>
            {isSelected && <Check size={14} className={`shrink-0 ${accentClass.replace('bg-', 'text-')}`} />}
          </button>
        )
      })}
    </div>
  )
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface MarkerPopoverProps {
  marker: TC3Marker
  filter: string
  clearFilter: () => void
}

export const MarkerPopover = memo(function MarkerPopover({ marker, filter }: MarkerPopoverProps) {
  const updateMarker = useTC3Store((s) => s.updateMarker)
  // Canonical treatment rows + their editors. The pin nests INTO these rows
  // (type/category/time), which are the single source of truth — also editable
  // from the MARCH section. sync no longer overwrites their detail.
  const tourniquets = useTC3Store((s) => s.card.march.massiveHemorrhage.tourniquets)
  const hemostatics = useTC3Store((s) => s.card.march.massiveHemorrhage.hemostatics)

  const regionLabel = marker.bodyRegion ? getRegionLabel(marker.bodyRegion) : ''
  // Hard-scope by region × injury type. Always keep any already-selected treatment
  // visible so it stays removable even if the injury edit made it invalid.
  const valid = getValidTreatments(marker.bodyRegion, marker.injuries)
  const shownKinds = new Set<TreatmentCategory>([...valid, ...marker.treatments])
  const sortedTreatments = ALL_TREATMENTS.filter(t => shownKinds.has(t.value))

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

  const filteredInjuries = INJURY_OPTIONS.filter(o => matchesFilter(o.label, filter))
  const filteredTreatments = sortedTreatments.filter(o => matchesFilter(o.label, filter))
  const filteredProcedures = PROCEDURE_OPTIONS.filter(o => matchesFilter(o.label, filter))
  const showDateTime = !filter || matchesFilter('date', filter) || matchesFilter('time', filter)
  const showDetails = !filter || matchesFilter('gauge', filter) || matchesFilter('tourniquet', filter) || matchesFilter('dressing', filter)

  const hasTourniquet = marker.treatments.includes('tourniquet')
  const hasHemostatic = marker.treatments.includes('hemostatic')
  const hasIVIO = marker.procedures.length > 0

  // The canonical rows this pin is bound to (created by the store on toggle).
  const linkedTQ = hasTourniquet ? tourniquets.find(t => t.injuryId === marker.id) : undefined
  const linkedDressing = hasHemostatic ? hemostatics.find(h => h.injuryId === marker.id) : undefined

  return (
    <div className="py-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>

      {/* Region label */}
      {regionLabel && (
        <div className="px-4 pb-1">
          <SectionHeader>{regionLabel}</SectionHeader>
        </div>
      )}

      {/* ── INJURIES ── */}
      {filteredInjuries.length > 0 && (
        <div className="mb-3">
          <div className="px-4 pb-1.5">
            <SectionHeader>Injuries</SectionHeader>
          </div>
          <SelectList
            options={filteredInjuries}
            selected={marker.injuries}
            onToggle={toggleInjury}
            accentClass="bg-themeredred"
          />
        </div>
      )}

      {/* ── TREATMENTS ── */}
      {filteredTreatments.length > 0 && (
        <div className="mb-3">
          <div className="px-4 pb-1.5">
            <SectionHeader>Treatments</SectionHeader>
          </div>
          <SelectList
            options={filteredTreatments}
            selected={marker.treatments}
            onToggle={toggleTreatment}
            accentClass="bg-themegreen"
          />
        </div>
      )}

      {/* ── PROCEDURES ── */}
      {filteredProcedures.length > 0 && (
        <div className="mb-3">
          <div className="px-4 pb-1.5">
            <SectionHeader>Procedures</SectionHeader>
          </div>
          <SelectList
            options={filteredProcedures}
            selected={marker.procedures}
            onToggle={toggleProcedure}
            accentClass="bg-themeblue3"
          />
        </div>
      )}

      {/* ── CONDITIONAL DETAILS ── */}
      {showDetails && (hasIVIO || hasTourniquet || hasHemostatic) && (
        <div className="mx-3 mb-3 mt-1 space-y-3">

          {hasIVIO && (
            <div className="flex items-center justify-between border-b border-primary/6 px-1 py-2">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Gauge</span>
              <input
                type="text"
                value={marker.gauge}
                onChange={(e) => updateMarker(marker.id, { gauge: e.target.value })}
                placeholder="e.g. 18g"
                className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-[10pt]"
              />
            </div>
          )}

          {/* Tourniquet + dressing reuse the SAME editors as the MARCH section
              overlay (TreatmentEditors.tsx). Location is off — the pin already
              owns this region. */}
          {linkedTQ && (
            <div className="space-y-1">
              <div className="px-1"><SectionHeader>Tourniquet</SectionHeader></div>
              <TourniquetEditor id={linkedTQ.id} showLocation={false} />
            </div>
          )}

          {linkedDressing && (
            <div className="space-y-1">
              <div className="px-1"><SectionHeader>Dressing</SectionHeader></div>
              <DressingEditor id={linkedDressing.id} showLocation={false} />
            </div>
          )}
        </div>
      )}

      {/* ── DATE / TIME ── */}
      {showDateTime && (
        <div className="mx-3 mb-2 mt-1">
          <div className="px-1 pb-1.5">
            <SectionHeader>Date / Time</SectionHeader>
          </div>
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
          <p className="text-[9pt] text-tertiary italic">{marker.description}</p>
        </div>
      )}
    </div>
  )
})
