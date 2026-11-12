/**
 * Domain-specific inputs — NOT generic primitives. These carry medical / property
 * domain semantics (blood pressure, unit identification code, vehicle fuel level),
 * so they live in Components/ rather than Components/primitives/. Extracted from the
 * former FormInputs.tsx during the primitives-boundary migration (2026-07-05).
 * Generic inputs (TextInput, PickerInput, DatePickerInput, …) live in
 * @/Components/primitives/FormInputs.
 */
import { useState, type KeyboardEvent } from 'react'

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

/* ── 6-char pin inputs (UIC, BRN) — one input over outlined cells ── */

/** Per-cell accepted class. Drives the filter and (when uniform) the iOS keyboard. */
type PinSlot = 'alnum' | 'alpha' | 'digit'

const SLOT_TEST: Record<PinSlot, RegExp> = {
  alnum: /^[0-9A-Z]$/,
  alpha: /^[A-Z]$/,
  digit: /^[0-9]$/,
}

/** Keep each typed/pasted char only if it fits the slot it would land in. */
function fitSlots(raw: string, slots: PinSlot[]): string {
  let out = ''
  for (const ch of raw.toUpperCase()) {
    if (out.length === slots.length) break
    if (SLOT_TEST[slots[out.length]].test(ch)) out += ch
  }
  return out
}

/**
 * A single native input (transparent, stretched over the row) drives a row of
 * outlined display cells. No per-cell inputs means no focus hopping: typing,
 * backspace, paste and autofill are all native, and the next cell lights up as
 * the active one.
 */
function CodePinInput({ slots, value, onChange, spread, label, placeholder, autoFocus, onComplete }: {
  slots: PinSlot[]
  value: string
  onChange: (v: string) => void
  spread?: boolean
  label?: string
  placeholder: string
  autoFocus?: boolean
  /** Fired on Enter once every cell is filled. */
  onComplete?: () => void
}) {
  const n = slots.length
  const [focused, setFocused] = useState(false)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && onComplete && value.length === n) {
      e.preventDefault()
      onComplete()
    }
  }

  return (
    <label className="block border-b border-primary/6 last:border-b-0 cursor-text">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 text-base md:text-sm text-tertiary">{label ?? placeholder}</span>
        <div className={`relative flex items-center ${spread ? 'flex-1 min-w-0 gap-2' : 'ml-auto gap-1.5'}`}>
          {slots.map((_, i) => {
            const c = value[i]
            const active = focused && i === Math.min(value.length, n - 1)
            return (
              <span
                key={i}
                aria-hidden
                className={`h-8 flex items-center justify-center rounded-md border text-base md:text-sm font-mono text-primary transition-colors ${active ? 'border-themeblue3' : c ? 'border-primary/30' : 'border-primary/15'} ${spread ? 'flex-1 min-w-0' : 'w-7'}`}
              >
                {c ?? ''}
              </span>
            )
          })}
          <input
            type="text"
            inputMode={slots.every(s => s === 'digit') ? 'numeric' : 'text'}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            aria-label={label ?? placeholder}
            onChange={(e) => onChange(fitSlots(e.target.value, slots))}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            // Hidden by colour, not opacity-0: iOS skips the keyboard scroll-to-reveal
            // for a transparent focused field, which left the row under the keyboard
            // in bottom sheets.
            className="absolute inset-0 w-full h-full text-transparent caret-transparent bg-transparent selection:bg-transparent border-0 focus:outline-none text-base cursor-text"
          />
        </div>
      </div>
    </label>
  )
}

const UIC_SLOTS: PinSlot[] = ['alnum', 'alnum', 'alnum', 'alnum', 'alnum', 'alnum']
/** BRN: two letters then four digits (AB1234). */
const BRN_SLOTS: PinSlot[] = ['alpha', 'alpha', 'digit', 'digit', 'digit', 'digit']
export const BRN_PATTERN = /^[A-Z]{2}[0-9]{4}$/

export function UicPinInput({ value, onChange, spread, label, placeholder = 'UIC' }: { value: string; onChange: (v: string) => void; spread?: boolean; label?: string; placeholder?: string }) {
  return <CodePinInput slots={UIC_SLOTS} value={value} onChange={onChange} spread={spread} label={label} placeholder={placeholder} />
}

export function BrnPinInput({ value, onChange, spread, label, placeholder = 'BRN', autoFocus, onComplete }: {
  value: string
  onChange: (v: string) => void
  spread?: boolean
  label?: string
  placeholder?: string
  autoFocus?: boolean
  onComplete?: () => void
}) {
  return <CodePinInput slots={BRN_SLOTS} value={value} onChange={onChange} spread={spread} label={label} placeholder={placeholder} autoFocus={autoFocus} onComplete={onComplete} />
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
