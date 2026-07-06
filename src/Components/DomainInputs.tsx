/**
 * Domain-specific inputs — NOT generic primitives. These carry medical / property
 * domain semantics (blood pressure, unit identification code, vehicle fuel level),
 * so they live in Components/ rather than Components/primitives/. Extracted from the
 * former FormInputs.tsx during the primitives-boundary migration (2026-07-05).
 * Generic inputs (TextInput, PickerInput, DatePickerInput, …) live in
 * @/Components/primitives/FormInputs.
 */
import { useRef, type KeyboardEvent } from 'react'

/** Paired systolic / diastolic entry. Stores a single 'sys/dia' string (diastolic
 *  may be 'p' for palpable). Same transparent / border-bottom family as TextInput —
 *  NOT a pill. Default renders a full labelled field row; pass `bare` to render only
 *  the inputs for embedding in a custom layout (e.g. VitalSignsCalculator cells). */
export const BloodPressureInput = ({
  value,
  onChange,
  label,
  hint,
  placeholderSys = '120',
  placeholderDia = '80',
  bare = false,
  inputClassName,
  containerClassName,
  separatorClassName,
}: {
  value: string
  onChange: (val: string) => void
  label?: string
  hint?: string | null
  placeholderSys?: string
  placeholderDia?: string
  bare?: boolean
  inputClassName?: string
  containerClassName?: string
  separatorClassName?: string
}) => {
  const sys = value.split('/')[0]?.trim() ?? ''
  const dia = value.split('/')[1]?.trim() ?? ''

  const sysInput = (
    <input
      type="text"
      inputMode="numeric"
      value={sys}
      onChange={(e) => onChange(`${e.target.value}/${dia}`)}
      placeholder={placeholderSys}
      className={inputClassName ?? 'w-14 text-right bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none'}
    />
  )
  const diaInput = (
    <input
      type="text"
      inputMode="numeric"
      value={dia}
      onChange={(e) => onChange(`${sys}/${e.target.value}`)}
      placeholder={placeholderDia}
      className={inputClassName ?? 'w-14 text-right bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none'}
    />
  )
  const sep = <span className={separatorClassName ?? 'text-tertiary px-0.5 shrink-0'}>/</span>

  // Bare: just the inputs, caller owns the wrapper/label (dense embeds).
  if (bare) {
    return (
      <div className={containerClassName ?? 'flex items-center gap-1'}>
        {sysInput}{sep}{diaInput}
      </div>
    )
  }

  // Default: full field row matching the TextInput family (border-bottom, no pill).
  return (
    <label className="block border-b border-primary/6 last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        {label && <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">{label}</span>}
        <div className={containerClassName ?? 'flex items-center flex-1 gap-1 justify-end'}>
          {sysInput}{sep}{diaInput}
        </div>
      </div>
      {hint && <span className="block px-4 pb-2 text-[9pt] font-medium text-themeyellow">{hint}</span>}
    </label>
  )
}

/* ── UIC Pin Input (6-digit auto-advance) ── */

export function UicPinInput({ value, onChange, spread, label, placeholder = 'UIC' }: { value: string; onChange: (v: string) => void; spread?: boolean; label?: string; placeholder?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = (value + '      ').slice(0, 6).split('')

  const handleChange = (i: number, char: string) => {
    const c = char.toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (!c) return
    const next = [...chars]
    next[i] = c
    onChange(next.join('').replace(/ /g, ''))
    if (i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...chars]
      if (next[i] !== ' ' && next[i] !== '') {
        next[i] = ' '
        onChange(next.join('').trim())
      } else if (i > 0) {
        next[i - 1] = ' '
        onChange(next.join('').trim())
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus()
    }
  }

  const empty = !value

  return (
    <label className="block border-b border-primary/6 last:border-b-0 cursor-text">
      <div className={`relative flex items-center px-4 py-3 ${spread ? 'gap-2' : 'gap-1.5'}`}>
        {empty && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base md:text-sm text-tertiary pointer-events-none">
            {label ?? placeholder}
          </span>
        )}
        {chars.map((c, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={c === ' ' ? '' : c}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-7 bg-transparent border-none text-center text-base md:text-sm font-mono text-primary focus:outline-none ${spread ? 'flex-1 min-w-0' : 'w-7'}`}
        />
        ))}
      </div>
    </label>
  )
}

/* ── Fuel Meter (vehicle fuel-level intake) ── */

/**
 * FuelMeter — a fuel-gauge intake: E ▮▮▮▯▯ F. Ten tappable segments set the level
 * in increments of 10 (10–100%); the "E" cap sets empty (0). null = not yet read.
 * Shared by the PMCS intake (PmcsSheet) and the PMCS record edit form (RecordPreview).
 */
export function FuelMeter({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const segments = Array.from({ length: 10 }, (_, i) => (i + 1) * 10)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-secondary">Fuel level</span>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {value == null ? '—' : `${value}%`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(0)}
          aria-label="Fuel empty"
          className="w-3.5 shrink-0 text-[9pt] font-bold text-tertiary active:scale-90 transition-transform"
        >
          E
        </button>
        <div className="flex-1 flex items-center gap-1">
          {segments.map((lvl) => {
            const filled = value != null && value >= lvl
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange(lvl)}
                aria-label={`Fuel ${lvl} percent`}
                className={`h-6 flex-1 rounded-md active:scale-95 transition-all ${filled ? 'bg-themeblue3' : 'bg-tertiary/12'}`}
              />
            )
          })}
        </div>
        <span className="w-3.5 shrink-0 text-[9pt] font-bold text-tertiary text-right">F</span>
      </div>
    </div>
  )
}
