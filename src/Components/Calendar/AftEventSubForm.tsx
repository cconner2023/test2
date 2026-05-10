import { useMemo } from 'react'
import { Dumbbell } from 'lucide-react'
import { TextInput, PickerInput } from '../FormInputs'
import {
  scoreAftEventByBracket,
  scoreAltEventByBracket,
  aftTotal,
  parseMmss,
  formatMmss,
  AFT_REVISION_ID,
  type AftEvent,
  type AltEvent,
  type AgeBracket,
  type AftScale,
  type AftResult,
  type AftTarget,
} from '../../lib/aft/scoring'

type CardioEvent = 'run2mi' | AltEvent

const BRACKET_OPTIONS: { value: AgeBracket; label: string }[] = [
  { value: '17-21',   label: '17–21' },
  { value: '22-26',   label: '22–26' },
  { value: '27-31',   label: '27–31' },
  { value: '32-36',   label: '32–36' },
  { value: '37-41',   label: '37–41' },
  { value: '42-46',   label: '42–46' },
  { value: '47-51',   label: '47–51' },
  { value: '52-56',   label: '52–56' },
  { value: '57-61',   label: '57–61' },
  { value: 'over-62', label: '62+' },
]

const SCALE_OPTIONS: { value: AftScale; label: string }[] = [
  { value: 'mc', label: 'Male / Combat MOS' },
  { value: 'f',  label: 'Female (non-combat)' },
]

const CARDIO_OPTIONS: { value: CardioEvent; label: string }[] = [
  { value: 'run2mi',    label: '2-Mile Run' },
  { value: 'walk2_5mi', label: '2.5-mile Walk (alt)' },
  { value: 'bike12k',   label: '12 km Bike (alt)' },
  { value: 'swim1k',    label: '1 km Swim (alt)' },
  { value: 'row5k',     label: '5 km Row (alt)' },
]

interface Props {
  result: AftResult | null
  target: AftTarget | null
  onResultChange: (next: AftResult) => void
  onTargetChange: (next: AftTarget | null) => void
}

function emptyResult(): AftResult {
  return {
    bracket: '17-21',
    scale: 'mc',
    mdl_lbs: null,
    hrp_reps: null,
    sdc_sec: null,
    plk_sec: null,
    run2mi_sec: null,
    alt_event: null,
    alt_time_sec: null,
    revision_id: AFT_REVISION_ID,
  }
}

function parseNum(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = parseFloat(t)
  return Number.isNaN(n) ? null : n
}

function parseTime(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const sec = parseMmss(t)
  return Number.isNaN(sec) ? null : sec
}

export function AftEventSubForm({ result, target: _target, onResultChange, onTargetChange: _onTargetChange }: Props) {
  // Hydrate display strings from canonical numeric result.
  const r = result ?? null
  const ready = r != null && r.bracket != null && r.scale != null

  const cardioEvent: CardioEvent = r?.alt_event ?? 'run2mi'
  const isAlt = cardioEvent !== 'run2mi'

  // Helper to emit a patch onto the result object.
  const patch = (delta: Partial<AftResult>) => {
    const base = result ?? emptyResult()
    onResultChange({ ...base, ...delta })
  }

  const perStrength = useMemo(() => {
    if (!ready || !r) return null
    const events: { key: AftEvent; label: string; raw: number | null | undefined }[] = [
      { key: 'mdl', label: '3-Rep Max Deadlift', raw: r.mdl_lbs },
      { key: 'hrp', label: 'Hand-Release Pushups', raw: r.hrp_reps },
      { key: 'sdc', label: 'Sprint / Drag / Carry', raw: r.sdc_sec },
      { key: 'plk', label: 'Plank', raw: r.plk_sec },
    ]
    return events.map(ev => {
      if (ev.raw == null) return { ...ev, points: null as number | null }
      const s = scoreAftEventByBracket(ev.key, ev.raw, r.bracket, r.scale)
      return { ...ev, points: s.points }
    })
  }, [ready, r])

  const cardioResult = useMemo(() => {
    if (!ready || !r) return null
    if (isAlt) {
      if (r.alt_time_sec == null || r.alt_event == null) return null
      const x = scoreAltEventByBracket(r.alt_event, r.alt_time_sec, r.bracket, r.scale)
      return { kind: 'alt' as const, passing: x.passing }
    }
    if (r.run2mi_sec == null) return null
    const x = scoreAftEventByBracket('run2mi', r.run2mi_sec, r.bracket, r.scale)
    return { kind: 'run' as const, points: x.points, passing: x.passing }
  }, [ready, r, isAlt])

  const totals = useMemo(() => {
    if (!perStrength || !cardioResult) return null
    if (!perStrength.every(e => e.points != null)) return null
    const arr = perStrength.map(e => ({ event: e.key, points: e.points as number }))
    if (cardioResult.kind === 'run') arr.push({ event: 'run2mi' as AftEvent, points: cardioResult.points })
    const t = aftTotal(arr)
    return { total: t.total, allPassing: t.allPassing && cardioResult.passing, isAlt }
  }, [perStrength, cardioResult, isAlt])

  // Display strings — controlled inputs derive from the canonical numeric result.
  const display = {
    mdl: r?.mdl_lbs?.toString() ?? '',
    hrp: r?.hrp_reps?.toString() ?? '',
    sdc: r?.sdc_sec != null ? formatMmss(r.sdc_sec) : '',
    plk: r?.plk_sec != null ? formatMmss(r.plk_sec) : '',
    cardio: isAlt
      ? (r?.alt_time_sec != null ? formatMmss(r.alt_time_sec) : '')
      : (r?.run2mi_sec != null ? formatMmss(r.run2mi_sec) : ''),
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {/* Side-by-side subject pickers */}
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0">
            <PickerInput
              value={r?.bracket ?? ''}
              onChange={(v) => patch({ bracket: v as AgeBracket })}
              options={BRACKET_OPTIONS}
              placeholder="Age category"
            />
          </div>
          <div className="flex-1 min-w-0 border-l border-primary/6">
            <PickerInput
              value={r?.scale ?? ''}
              onChange={(v) => patch({ scale: v as AftScale })}
              options={SCALE_OPTIONS}
              placeholder="Scoring scale"
            />
          </div>
        </div>

        {/* Strength + core events */}
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={display.mdl}
              onChange={(v) => patch({ mdl_lbs: parseNum(v) })}
              placeholder="3-Rep Max Deadlift — lbs (e.g. 250)"
              inputMode="numeric"
            />
          </div>
          <PointsCell points={perStrength?.find(e => e.key === 'mdl')?.points ?? null} />
        </div>
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={display.hrp}
              onChange={(v) => patch({ hrp_reps: parseNum(v) })}
              placeholder="Hand-Release Pushups — reps (e.g. 35)"
              inputMode="numeric"
            />
          </div>
          <PointsCell points={perStrength?.find(e => e.key === 'hrp')?.points ?? null} />
        </div>
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={display.sdc}
              onChange={(v) => patch({ sdc_sec: parseTime(v) })}
              placeholder="Sprint / Drag / Carry — mm:ss (e.g. 1:45)"
              inputMode="text"
            />
          </div>
          <PointsCell points={perStrength?.find(e => e.key === 'sdc')?.points ?? null} />
        </div>
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={display.plk}
              onChange={(v) => patch({ plk_sec: parseTime(v) })}
              placeholder="Plank — mm:ss (e.g. 2:30)"
              inputMode="text"
            />
          </div>
          <PointsCell points={perStrength?.find(e => e.key === 'plk')?.points ?? null} />
        </div>

        {/* Cardio mode picker */}
        <PickerInput
          value={cardioEvent}
          onChange={(v) => {
            const next = v as CardioEvent
            if (next === 'run2mi') {
              patch({ alt_event: null, alt_time_sec: null })
            } else {
              patch({ alt_event: next as AltEvent, run2mi_sec: null })
            }
          }}
          options={CARDIO_OPTIONS}
          placeholder="Cardio event"
        />

        {/* Cardio time + result */}
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={display.cardio}
              onChange={(v) => {
                const sec = parseTime(v)
                if (isAlt) patch({ alt_time_sec: sec })
                else patch({ run2mi_sec: sec })
              }}
              placeholder={isAlt ? 'Time mm:ss (go / no-go)' : '2-mile time mm:ss (e.g. 16:30)'}
              inputMode="text"
            />
          </div>
          <div className="border-l border-primary/6 px-4 flex items-center justify-center min-w-[5rem] tabular-nums">
            {cardioResult == null ? (
              <span className="text-[10pt] text-tertiary">—</span>
            ) : cardioResult.kind === 'run' ? (
              <span className={`text-base md:text-sm font-semibold ${cardioResult.points >= 60 ? 'text-themegreen' : 'text-themeredred'}`}>
                {cardioResult.points}
              </span>
            ) : (
              <span className={`text-base md:text-sm font-semibold ${cardioResult.passing ? 'text-themegreen' : 'text-themeredred'}`}>
                {cardioResult.passing ? 'PASS' : 'NO-GO'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      {totals && (
        <div className={`rounded-2xl overflow-hidden border ${totals.allPassing ? 'border-themegreen/30 bg-themegreen/5' : 'border-themeredred/30 bg-themeredred/5'}`}>
          <div className="px-4 py-3 flex items-center gap-3">
            <Dumbbell size={20} className={totals.allPassing ? 'text-themegreen' : 'text-themeredred'} />
            <div className="flex-1 min-w-0">
              <p className="text-[10pt] text-tertiary">{totals.isAlt ? 'Total (4 events + cardio go/no-go)' : 'Total (5 events)'}</p>
              <p className={`text-xl font-bold tabular-nums ${totals.allPassing ? 'text-themegreen' : 'text-themeredred'}`}>
                {totals.total}{totals.isAlt ? '' : ' / 500'}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-[10pt] font-semibold ${totals.allPassing ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/15 text-themeredred'}`}>
              {totals.allPassing ? 'PASS' : 'FAIL'}
            </div>
          </div>
        </div>
      )}

      <p className="px-2 text-[9pt] text-tertiary">
        AFT scoring effective {AFT_REVISION_ID}. Sub-60 in any event is a fail per AR 350-1.
      </p>
    </div>
  )
}

function PointsCell({ points }: { points: number | null }) {
  return (
    <div className="border-l border-primary/6 px-4 flex items-center justify-center min-w-[5rem] tabular-nums">
      {points == null ? (
        <span className="text-[10pt] text-tertiary">—</span>
      ) : (
        <span className={`text-base md:text-sm font-semibold ${points >= 60 ? 'text-themegreen' : 'text-themeredred'}`}>
          {points}
        </span>
      )}
    </div>
  )
}
