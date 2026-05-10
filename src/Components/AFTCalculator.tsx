import { useMemo, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { TextInput, PickerInput } from './FormInputs'
import {
  scoreAftEventByBracket,
  scoreAltEventByBracket,
  aftTotal,
  parseMmss,
  AFT_REVISION_ID,
  type AftEvent,
  type AltEvent,
  type AgeBracket,
  type AftScale,
} from '../lib/aft/scoring'

interface EventRow {
  key: AftEvent
  label: string
  unit: 'lbs' | 'reps' | 'time'
  placeholder: string
  inputMode: 'numeric' | 'decimal' | 'text'
}

const STRENGTH_AND_CORE: EventRow[] = [
  { key: 'mdl',    label: '3-Rep Max Deadlift',   unit: 'lbs',  placeholder: 'lbs (e.g. 250)',     inputMode: 'numeric' },
  { key: 'hrp',    label: 'Hand-Release Pushups', unit: 'reps', placeholder: 'reps (e.g. 35)',     inputMode: 'numeric' },
  { key: 'sdc',    label: 'Sprint / Drag / Carry', unit: 'time', placeholder: 'mm:ss (e.g. 1:45)', inputMode: 'text' },
  { key: 'plk',    label: 'Plank',                unit: 'time', placeholder: 'mm:ss (e.g. 2:30)', inputMode: 'text' },
]

type CardioEvent = 'run2mi' | AltEvent

const CARDIO_OPTIONS: { value: CardioEvent; label: string }[] = [
  { value: 'run2mi',    label: '2-Mile Run' },
  { value: 'walk2_5mi', label: '2.5-mile Walk (alt)' },
  { value: 'bike12k',   label: '12 km Bike (alt)' },
  { value: 'swim1k',    label: '1 km Swim (alt)' },
  { value: 'row5k',     label: '5 km Row (alt)' },
]

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

function parseRaw(unit: EventRow['unit'], value: string): number | null {
  if (!value.trim()) return null
  if (unit === 'time') {
    const sec = parseMmss(value)
    return Number.isNaN(sec) ? null : sec
  }
  const n = parseFloat(value)
  return Number.isNaN(n) ? null : n
}

export function AFTCalculator() {
  const [bracket, setBracket] = useState<AgeBracket | ''>('')
  const [scale, setScale] = useState<AftScale | ''>('')
  const [raw, setRaw] = useState<Record<AftEvent, string>>({ mdl: '', hrp: '', sdc: '', plk: '', run2mi: '' })
  const [cardioEvent, setCardioEvent] = useState<CardioEvent>('run2mi')
  const [cardioTime, setCardioTime] = useState('')

  const ready = bracket !== '' && scale !== ''
  const isAlt = cardioEvent !== 'run2mi'

  const perStrength = useMemo(() => {
    if (!ready) return null
    return STRENGTH_AND_CORE.map(ev => {
      const rawValue = parseRaw(ev.unit, raw[ev.key])
      if (rawValue == null) return { ...ev, points: null as number | null }
      const r = scoreAftEventByBracket(ev.key, rawValue, bracket as AgeBracket, scale as AftScale)
      return { ...ev, points: r.points }
    })
  }, [ready, bracket, scale, raw])

  const cardioResult = useMemo(() => {
    if (!ready) return null
    const sec = parseMmss(cardioTime)
    if (Number.isNaN(sec)) return null
    if (isAlt) {
      const r = scoreAltEventByBracket(cardioEvent as AltEvent, sec, bracket as AgeBracket, scale as AftScale)
      return { kind: 'alt' as const, passing: r.passing }
    }
    const r = scoreAftEventByBracket('run2mi', sec, bracket as AgeBracket, scale as AftScale)
    return { kind: 'run' as const, points: r.points, passing: r.passing }
  }, [ready, bracket, scale, cardioTime, cardioEvent, isAlt])

  const totals = useMemo(() => {
    if (!perStrength) return null
    const allFilled = perStrength.every(e => e.points != null) && cardioResult != null
    if (!allFilled) return null
    const arr = perStrength.map(e => ({ event: e.key, points: e.points as number }))
    if (cardioResult.kind === 'run') {
      arr.push({ event: 'run2mi', points: cardioResult.points })
    }
    const t = aftTotal(arr)
    const allPassing = t.allPassing && cardioResult.passing
    return { total: t.total, allPassing, isAlt }
  }, [perStrength, cardioResult, isAlt])

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Single card: subject pickers, 4 strength/core events, cardio picker + time row */}
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {/* Side-by-side subject pickers */}
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0">
            <PickerInput
              value={bracket}
              onChange={(v) => setBracket(v as AgeBracket)}
              options={BRACKET_OPTIONS}
              placeholder="Age category"
            />
          </div>
          <div className="flex-1 min-w-0 border-l border-primary/6">
            <PickerInput
              value={scale}
              onChange={(v) => setScale(v as AftScale)}
              options={SCALE_OPTIONS}
              placeholder="Scoring scale"
            />
          </div>
        </div>

        {/* Strength + core events */}
        {STRENGTH_AND_CORE.map(ev => {
          const row = perStrength?.find(p => p.key === ev.key)
          const points = row?.points ?? null
          return (
            <div key={ev.key} className="flex items-stretch">
              <div className="flex-[2] min-w-0">
                <TextInput
                  value={raw[ev.key]}
                  onChange={(v) => setRaw(r => ({ ...r, [ev.key]: v }))}
                  placeholder={`${ev.label} — ${ev.placeholder}`}
                  inputMode={ev.inputMode}
                />
              </div>
              <div className="border-l border-primary/6 px-4 flex items-center justify-center min-w-[5rem] tabular-nums">
                {points == null ? (
                  <span className="text-[10pt] text-tertiary">—</span>
                ) : (
                  <span className={`text-base md:text-sm font-semibold ${points >= 60 ? 'text-themegreen' : 'text-themeredred'}`}>
                    {points}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* Cardio picker — acts as the visual break + mode switch */}
        <PickerInput
          value={cardioEvent}
          onChange={(v) => setCardioEvent(v as CardioEvent)}
          options={CARDIO_OPTIONS}
          placeholder="Cardio event"
        />

        {/* Cardio time + result */}
        <div className="flex items-stretch">
          <div className="flex-[2] min-w-0">
            <TextInput
              value={cardioTime}
              onChange={setCardioTime}
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
