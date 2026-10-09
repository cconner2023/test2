import { useState, useRef, useEffect, useCallback, useContext, type ReactNode } from 'react'
import { Eye, EyeOff, ChevronDown, Check, ChevronLeft, ChevronRight, Keyboard } from 'lucide-react'
import { PreviewOverlay } from '@/Components/PreviewOverlay'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { useIsMobile } from '@/Hooks/useIsMobile'
import { useStack } from '@/Components/primitives/useStack'
import { StackNavContext, type StackScreen } from '@/Components/stackNav'

/** Free-form 4-digit military time input (0000–2359). Borderless / transparent, matches form-row style.
 *  Current selected value is shown as the placeholder hint, not the input value, so users can type fresh
 *  digits without having to clear an already-filled field first. */
export const TimeInput = ({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (val: string) => void
  label?: string
}) => {
  const isMobile = useIsMobile()
  const [draft, setDraft] = useState('')

  const commit = () => {
    const digits = draft.replace(/\D/g, '').slice(0, 4)
    if (digits.length === 0) return
    const padded = digits.padStart(4, '0')
    let hh = parseInt(padded.slice(0, 2), 10)
    let mm = parseInt(padded.slice(2), 10)
    if (hh > 23) hh = 23
    if (mm > 59) mm = 59
    const norm = `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`
    setDraft('')
    onChange(norm)
  }

  return (
    <div className={`flex items-center justify-between border-b border-primary/6 last:border-0 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
      {label && (
        <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">{label}</span>
      )}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        placeholder={value || 'HHMM'}
        maxLength={4}
        className={`flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none font-mono tracking-wider tabular-nums ${isMobile ? 'text-base' : 'text-xs'}`}
      />
    </div>
  )
}

export const TextInput = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  required = false,
  type = 'text',
  inputMode,
  currentValue,
  hint,
  autoComplete,
  name,
  bare = false,
  inputRef,
  onKeyDown,
  inputClassName,
  ariaLabel,
  autoFocus,
  multiline = false,
  rows = 3,
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: string
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
  currentValue?: string | null
  hint?: string | null
  /** Password managers and iOS Safari autofill only engage on a recognised token —
   *  pass `username` / `email` / `new-password` etc. on any credential field. */
  autoComplete?: string
  name?: string
  /** Render just the input (no self-row label/border) for embedding in a custom layout (e.g. an inline-add row with trailing buttons). */
  bare?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Override the input className for dense embeds (mirrors BloodPressureInput). Pair with `bare`. */
  inputClassName?: string
  /** Accessible name for label-less `bare` embeds (e.g. a numeric cell with no visible label). */
  ariaLabel?: string
  autoFocus?: boolean
}) => {
  const input = (
    <input
      ref={inputRef}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      name={name}
      placeholder={placeholder ?? label}
      maxLength={maxLength}
      required={required}
      aria-label={ariaLabel}
      className={inputClassName ?? 'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none'}
    />
  )

  // Bare: just the input, caller owns the wrapper/row (dense embeds like inline-add rows).
  if (bare) return input

  return (
    <label className="block border-b border-primary/6 last:border-b-0">
      {currentValue && (
        <div className="px-4 pt-2 text-[10pt] text-tertiary">
          Current: <span className="font-medium">{currentValue}</span>
        </div>
      )}
      {input}
      {hint && (
        <span className="block px-4 pb-2 text-[10pt] text-themeredred">{hint}</span>
      )}
    </label>
  )
}

/* ── Text Area (multi-line free text) ── */

/** Multi-line sibling of `TextInput`. Same self-rowing 9-line spec (border-b row,
 *  placeholder-is-the-label, iOS-zoom-safe `text-base md:text-sm`) — it is just taller.
 *  Use this for plain multi-line form fields. Reach for `ExpandableInput` ONLY when the
 *  field wants text-expander / template machinery (note editors), and leave chat
 *  composers alone — those are a different contract (`chat-input-bar` + send sibling). */
export const TextArea = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  required = false,
  rows,
  hint,
  bare = false,
  inputRef,
  onKeyDown,
  inputClassName,
  ariaLabel,
  autoFocus,
  autoGrow = false,
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  /** Visible rows — the field's resting height. Omit for the browser default (2);
   *  ignored once `autoGrow` takes over. */
  rows?: number
  hint?: string | null
  /** Render just the textarea (no self-row label/border) for embedding in a custom layout. */
  bare?: boolean
  inputRef?: React.Ref<HTMLTextAreaElement>
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** Override the textarea className for dense embeds. Pair with `bare`. */
  inputClassName?: string
  /** Accessible name for label-less `bare` embeds. */
  ariaLabel?: string
  autoFocus?: boolean
  /** Grow to fit content instead of scrolling inside a fixed height (long-form notes). */
  autoGrow?: boolean
}) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  // Merge the caller's ref with the one autoGrow needs to measure scrollHeight.
  const setRefs = useCallback((el: HTMLTextAreaElement | null) => {
    innerRef.current = el
    if (typeof inputRef === 'function') inputRef(el)
    else if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
  }, [inputRef])

  useEffect(() => {
    if (!autoGrow) return
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, autoGrow])

  const textarea = (
    <textarea
      ref={setRefs}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      placeholder={placeholder ?? label}
      maxLength={maxLength}
      required={required}
      aria-label={ariaLabel}
      className={inputClassName ?? `w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none leading-6${autoGrow ? ' overflow-hidden' : ''}`}
    />
  )

  if (bare) return textarea

  return (
    <label className="block border-b border-primary/6 last:border-b-0">
      {textarea}
      {hint && (
        <span className="block px-4 pb-2 text-[10pt] text-themeredred">{hint}</span>
      )}
    </label>
  )
}

/* ── Blood Pressure Input (systolic / diastolic) ── */


/* ── Picker Input (drawer/modal selection) ── */

type PickerOption = string | { value: string; label: string }

function getOptionValue(opt: PickerOption): string {
  return typeof opt === 'string' ? opt : opt.value
}

function getOptionLabel(opt: PickerOption): string {
  return typeof opt === 'string' ? opt : opt.label
}

/**
 * Shared option-row list for PickerInput / MultiPickerInput / the morphed-in
 * stack screens — single source so the nested-overlay fallback and the drill-down
 * screen render byte-identical rows.
 */
const PickerRows = ({ options, isSelected, onSelect, ariaLabel, multi }: {
  options: readonly PickerOption[]
  isSelected: (val: string) => boolean
  onSelect: (opt: PickerOption) => void
  ariaLabel?: string
  multi?: boolean
}) => (
  <div className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label={ariaLabel} aria-multiselectable={multi || undefined}>
    {options.map((opt) => {
      const optVal = getOptionValue(opt)
      const optLbl = getOptionLabel(opt)
      const selected = isSelected(optVal)
      return (
        <button
          key={optVal}
          type="button"
          role="option"
          aria-selected={selected}
          onClick={() => onSelect(opt)}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between ${
            selected ? 'text-themeblue2 font-medium' : 'text-primary'
          }`}
        >
          {optLbl}
          {selected && <Check size={16} className="shrink-0 text-themeblue2" />}
        </button>
      )
    })}
  </div>
)

/**
 * A searchable option list — a filter box above the shared rows. Kept self-contained so it
 * owns its own query state (a stackNav pushed screen freezes its render at push time, so the
 * filter can't live in the host). Case-insensitive substring match on the option LABEL.
 */
const SearchablePickerList = ({ options, value, onSelect, placeholder }: {
  options: readonly PickerOption[]
  value: string
  onSelect: (opt: PickerOption) => void
  placeholder?: string
}) => {
  const isMobile = useIsMobile()
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? options.filter((o) => getOptionLabel(o).toLowerCase().includes(q.trim().toLowerCase()))
    : options
  return (
    <>
      <div className="border-b border-primary/6 px-4 py-2.5">
        <input
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          // Desktop only: on the mobile morph this list mounts inside the Sheet the
          // instant the picker row is tapped, and an autoFocus'd input pops the iOS
          // keyboard over a tap-to-select list the user never asked to type into.
          // Desktop keeps autoFocus (popover, physical keyboard, type-to-filter).
          autoFocus={!isMobile}
          className="w-full bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
        />
      </div>
      {filtered.length > 0 ? (
        <PickerRows options={filtered} isSelected={(v) => v === value} onSelect={onSelect} ariaLabel={placeholder} />
      ) : (
        <p className="px-4 py-3 text-sm text-tertiary">No matches</p>
      )}
    </>
  )
}

export const PickerInput = ({
  value,
  onChange,
  options = [],
  placeholder,
  required = false,
  label,
  header,
  searchable = false,
}: {
  value: string
  onChange: (val: string) => void
  options?: readonly PickerOption[]
  placeholder?: string
  required?: boolean
  label?: string
  header?: ReactNode
  /** Render a filter box above the rows — for long lists (LIN / location pickers). */
  searchable?: boolean
}) => {
  // Inside an OverlayStack, drill down (morph the card) instead of stacking our own
  // overlay; outside one, fall back to the nested PreviewOverlay below.
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const displayValue = options.find((o) => getOptionValue(o) === value)
  const displayLabel = displayValue ? getOptionLabel(displayValue) : ''

  const list = (onSelect: (opt: PickerOption) => void) => (
    <>
      {header && <div className="border-b border-primary/6">{header}</div>}
      {searchable ? (
        <SearchablePickerList options={options} value={value} onSelect={onSelect} placeholder={placeholder} />
      ) : (
        <PickerRows options={options} isSelected={(v) => v === value} onSelect={onSelect} ariaLabel={placeholder} />
      )}
    </>
  )

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title: placeholder,
        render: (_p, nav) => list((opt) => { onChange(getOptionValue(opt)); nav.pop() }),
      })
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={open}
          className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                     flex items-center justify-between gap-3 focus:outline-none ${
                       value ? 'text-primary' : 'text-tertiary'
                     }`}
        >
          <span className="truncate">{displayLabel || placeholder || label || 'Select...'}</span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>
        {required && !value && (
          <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" required value="" onChange={() => {}} />
        )}
      </div>

      {!stackNav && (
        <PreviewOverlay
          isOpen={visible}
          onClose={close}
          anchorRect={null}
          maxWidth={280}
          title={placeholder}
        >
          {list((opt) => { onChange(getOptionValue(opt)); close() })}
        </PreviewOverlay>
      )}
    </div>
  )
}

/* ── Date Picker Input ── */

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function parseIso(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()} ${String(d.getFullYear()).slice(2)}`
}

function calendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

export function DatePickerCalendar({
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
}: {
  value: string
  onChange: (val: string) => void
  onClose: () => void
  minDate?: string
  maxDate?: string
}) {
  const today = new Date()
  const selected = parseIso(value)
  const initial = selected ?? today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [zoom, setZoom] = useState<'days' | 'months'>('days')

  const minD = parseIso(minDate ?? '')
  const maxD = parseIso(maxDate ?? '')

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }, [viewMonth])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  const days = calendarDays(viewYear, viewMonth)

  const isOutOfRange = (d: Date) => {
    if (minD && d < minD) return true
    if (maxD && d > maxD) return true
    return false
  }

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()

  const isSelected = (d: Date) =>
    selected !== null &&
    d.getFullYear() === selected.getFullYear() &&
    d.getMonth() === selected.getMonth() &&
    d.getDate() === selected.getDate()

  if (zoom === 'months') {
    return (
      <div className="px-4 pt-2 pb-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewYear(y => y - 1)}
            className="p-1.5 rounded-full text-tertiary active:scale-95 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-primary">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear(y => y + 1)}
            className="p-1.5 rounded-full text-tertiary active:scale-95 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((m, i) => {
            const isCurrent = viewYear === today.getFullYear() && i === today.getMonth()
            const isActive = i === viewMonth && viewYear === initial.getFullYear()
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setViewMonth(i); setZoom('days') }}
                className={`py-2.5 rounded-xl text-sm transition-all active:scale-95
                  ${isActive ? 'bg-themeblue3 text-white font-semibold' : isCurrent ? 'bg-themeblue3/10 text-primary font-medium' : 'text-primary'}
                `}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-5">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-full text-tertiary active:scale-95 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setZoom('months')}
          className="text-sm font-semibold text-primary active:scale-95 transition-all px-2 py-1 rounded-lg"
        >
          {MONTHS[viewMonth]} {viewYear}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-full text-tertiary active:scale-95 transition-all"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="h-8 flex items-center justify-center text-[9pt] font-medium text-tertiary">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          if (!d) return <div key={i} />
          const oob = isOutOfRange(d)
          const sel = isSelected(d)
          const tod = isToday(d)
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                disabled={oob}
                onClick={() => { onChange(toIso(d)); onClose() }}
                className={`h-9 w-9 text-sm transition-all active:scale-95
                  ${oob ? 'opacity-30 pointer-events-none' : ''}
                  ${sel ? 'bg-themeblue3 text-white font-semibold rounded-full' : tod ? 'bg-themeblue3 text-white font-medium rounded-lg' : 'text-primary rounded-full'}
                `}
              >
                {d.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Typed DD / MM / YYYY entry — the "input mode" screen the calendar morphs into.
 * Owns its own state (a pushed stack screen is frozen at push time). Auto-advances
 * field to field and commits the moment a complete, valid date is typed (or on Enter);
 * an invalid / out-of-range date shows an inline error instead of committing.
 */
function DateManualEntry({ value, onCommit, minDate, maxDate }: {
  value: string
  onCommit: (iso: string) => void
  minDate?: string
  maxDate?: string
}) {
  const current = parseIso(value)
  const [dd, setDd] = useState('')
  const [mm, setMm] = useState('')
  const [yyyy, setYyyy] = useState('')
  const [error, setError] = useState('')
  const dRef = useRef<HTMLInputElement>(null)
  const mRef = useRef<HTMLInputElement>(null)
  const yRef = useRef<HTMLInputElement>(null)

  const tryCommit = (d: string, m: string, y: string) => {
    if (!d || !m || y.length !== 4) { setError('Enter day, month and 4-digit year'); return }
    const day = parseInt(d, 10)
    const month = parseInt(m, 10)
    const year = parseInt(y, 10)
    const date = new Date(year, month - 1, day)
    if (month < 1 || month > 12 || day < 1 || date.getMonth() !== month - 1) {
      setError('Not a valid date'); return
    }
    const minD = parseIso(minDate ?? '')
    const maxD = parseIso(maxDate ?? '')
    if ((minD && date < minD) || (maxD && date > maxD)) {
      setError(`Must be between ${minDate ? formatDisplay(minDate) : '…'} and ${maxDate ? formatDisplay(maxDate) : '…'}`)
      return
    }
    onCommit(toIso(date))
  }

  const field = (
    ref: React.RefObject<HTMLInputElement | null>,
    val: string,
    set: (v: string) => void,
    len: number,
    hint: string,
    next: React.RefObject<HTMLInputElement | null> | null,
    prev: React.RefObject<HTMLInputElement | null> | null,
    label: string,
  ) => (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      value={val}
      placeholder={hint}
      maxLength={len}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, len)
        set(digits)
        setError('')
        if (digits.length === len) {
          if (next) next.current?.focus()
          else tryCommit(dd, mm, digits)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && !val && prev) prev.current?.focus()
        if (e.key === 'Enter') { e.preventDefault(); tryCommit(dd, mm, yyyy) }
      }}
      className={`${len === 4 ? 'w-20' : 'w-12'} bg-transparent text-center text-2xl font-semibold text-primary
                  placeholder:text-tertiary/50 focus:outline-none border-b-2 border-primary/10 focus:border-themeblue3 py-1 transition-colors`}
    />
  )

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col items-center">
      <div className="flex items-end gap-2">
        {field(dRef, dd, setDd, 2, current ? pad(current.getDate()) : 'DD', mRef, null, 'Day')}
        <span className="text-2xl text-tertiary pb-1.5">/</span>
        {field(mRef, mm, setMm, 2, current ? pad(current.getMonth() + 1) : 'MM', yRef, dRef, 'Month')}
        <span className="text-2xl text-tertiary pb-1.5">/</span>
        {field(yRef, yyyy, setYyyy, 4, current ? String(current.getFullYear()) : 'YYYY', null, mRef, 'Year')}
      </div>
      <div className="flex gap-2 mt-1.5 text-[9pt] font-medium text-tertiary uppercase tracking-widest">
        <span className="w-12 text-center">Day</span>
        <span className="w-3" />
        <span className="w-12 text-center">Month</span>
        <span className="w-3" />
        <span className="w-20 text-center">Year</span>
      </div>
      {error && <p className="mt-3 text-xs text-themeredred">{error}</p>}
      {/* Focus after mount, not autoFocus — the morph slides this in, and the user
          explicitly asked to type, so popping the keyboard here is intended. */}
      <FocusOnMount target={dRef} />
    </div>
  )
}

function FocusOnMount({ target }: { target: React.RefObject<HTMLInputElement | null> }) {
  useEffect(() => { target.current?.focus() }, [target])
  return null
}

/** Header action on the calendar screen — morphs into typed entry. */
const ManualDateButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
    aria-label="Type date"
  >
    <Keyboard size={16} />
  </button>
)

export const DatePickerInput = ({
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minDate?: string
  maxDate?: string
}) => {
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)
  const close = () => setVisible(false)

  const display = formatDisplay(value)
  const title = placeholder ?? 'Select Date'

  const manualScreen = (done: () => void): StackScreen => ({
    title: 'Enter Date',
    render: () => (
      <DateManualEntry
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        onCommit={(iso) => { onChange(iso); done() }}
      />
    ),
  })

  // Standalone (no enclosing stack): drive our own two-screen stack inside the
  // PreviewOverlay so calendar → typed entry still morphs the card in place.
  const local = useStack({
    isOpen: visible,
    initial: { key: 'calendar' },
    screens: {
      calendar: {
        title,
        headerActions: (_p, nav) => <ManualDateButton onClick={() => nav.pushScreen(manualScreen(close))} />,
        render: () => (
          <DatePickerCalendar value={value} onChange={onChange} onClose={close} minDate={minDate} maxDate={maxDate} />
        ),
      },
    },
  })

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title,
        // Commit from typed entry pops both the entry and the calendar screens.
        headerActions: (_p, nav) => (
          <ManualDateButton onClick={() => nav.pushScreen(manualScreen(() => { nav.pop(); nav.pop() }))} />
        ),
        render: (_p, nav) => (
          <DatePickerCalendar value={value} onChange={onChange} onClose={nav.pop} minDate={minDate} maxDate={maxDate} />
        ),
      })
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={open}
          className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                     flex items-center justify-between gap-3 focus:outline-none ${
                       display ? 'text-primary' : 'text-tertiary'
                     }`}
        >
          <span className="truncate">{display || placeholder || 'Date'}</span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>

        {!stackNav && (
          <PreviewOverlay
            isOpen={visible}
            onClose={close}
            anchorRect={null}
            title={local.title}
            onBack={local.onBack}
            headerActions={local.headerActions}
          >
            {local.body()}
          </PreviewOverlay>
        )}
      </div>
    </div>
  )
}


/* ── Code Input (auto-advance, auto-submit, configurable length) ── */

export function PinCodeInput({ onSubmit, error, disabled, label, placeholder, length = 4 }: {
  onSubmit: (code: string) => void
  error?: string
  disabled?: boolean
  label?: string
  placeholder?: string
  length?: number
}) {
  const lastIdx = length - 1
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [digits, setDigits] = useState(() => Array(length).fill(''))
  const [shaking, setShaking] = useState(false)
  const submitted = useRef(false)

  // Shake + clear on error after submission
  useEffect(() => {
    if (!submitted.current || !error) return
    submitted.current = false
    setShaking(true)
    setTimeout(() => {
      setShaking(false)
      setDigits(Array(length).fill(''))
      refs.current[0]?.focus()
    }, 400)
  }, [error, length])

  const handleChange = (i: number, char: string) => {
    if (disabled) return
    const c = char.replace(/[^0-9]/g, '')
    if (!c) return
    const next = [...digits]
    next[i] = c
    setDigits(next)
    if (i < lastIdx) {
      refs.current[i + 1]?.focus()
    } else if (next.every(d => d)) {
      submitted.current = true
      onSubmit(next.join(''))
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) {
        next[i] = ''
        setDigits(next)
      } else if (i > 0) {
        next[i - 1] = ''
        setDigits(next)
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < lastIdx) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    pasted.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    if (pasted.length === length) {
      submitted.current = true
      onSubmit(next.join(''))
    } else {
      refs.current[Math.min(pasted.length, lastIdx)]?.focus()
    }
  }

  const empty = digits.every(d => !d)

  return (
    <label className="block border-b border-primary/6 last:border-b-0 cursor-text">
      <div className="px-4 py-3">
        {label && <p className={`mb-1 text-[10pt] ${error && shaking ? 'text-themeredred' : 'text-tertiary'}`}>{error && shaking ? error : label}</p>}
        <div className={`relative flex items-center gap-2 ${shaking ? 'animate-shake' : ''}`} onPaste={handlePaste}>
          {empty && placeholder && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-base md:text-sm text-tertiary pointer-events-none">
              {placeholder}
            </span>
          )}
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              disabled={disabled}
              className="flex-1 min-w-0 h-7 bg-transparent border-none text-center text-base md:text-sm font-mono text-primary focus:outline-none disabled:opacity-50"
            />
          ))}
        </div>
      </div>
    </label>
  )
}

/* ── Password Input ── */

export const PasswordInput = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  inputRef,
  hint,
  name,
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  hint?: React.ReactNode
  name?: string
}) => {
  const [show, setShow] = useState(false)

  return (
    <label className="block border-b border-primary/6 last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          autoComplete={autoComplete}
          name={name}
          disabled={disabled}
          className="flex-1 bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="shrink-0 text-tertiary hover:text-tertiary transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && (
        <span className="block px-4 pb-2 text-[10pt] text-themeredred">{hint}</span>
      )}
    </label>
  )
}

/* ── Multi-Select Picker (modal with checkmarks) ── */

/**
 * The drill-down body for MultiPickerInput. A pushed stack screen is frozen at push
 * time, so it can't read the host's live `value` for checkmarks — instead it owns a
 * local selection seeded from `initial` and commits every toggle through `onChange`
 * (which stays in sync with the host). Done = pop, handled by the screen's footer.
 */
function MultiSelectScreen({ options, initial, onChange, placeholder }: {
  options: readonly PickerOption[]
  initial: string[]
  onChange: (val: string[]) => void
  placeholder?: string
}) {
  const [sel, setSel] = useState<string[]>(initial)
  const toggle = (opt: PickerOption) => {
    const v = getOptionValue(opt)
    const next = sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v]
    setSel(next)
    onChange(next)
  }
  return <PickerRows options={options} isSelected={(v) => sel.includes(v)} onSelect={toggle} ariaLabel={placeholder} multi />
}

export const MultiPickerInput = ({
  value,
  onChange,
  options,
  placeholder,
  required = false,
  label,
}: {
  value: string[]
  onChange: (val: string[]) => void
  options: readonly PickerOption[]
  placeholder?: string
  required?: boolean
  label?: string
}) => {
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const displayLabel = value.length > 0
    ? options
        .filter(o => value.includes(getOptionValue(o)))
        .map(o => getOptionLabel(o))
        .join(', ')
    : ''

  const toggleOption = useCallback((opt: PickerOption) => {
    const optVal = getOptionValue(opt)
    if (value.includes(optVal)) {
      onChange(value.filter(v => v !== optVal))
    } else {
      onChange([...value, optVal])
    }
  }, [value, onChange])

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title: placeholder,
        rightFooter: (_p, nav) => (
          <FooterPill side="right">
            <ActionButton icon={Check} label="Done" onClick={nav.pop} />
          </FooterPill>
        ),
        render: () => <MultiSelectScreen options={options} initial={value} onChange={onChange} placeholder={placeholder} />,
      })
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={open}
          className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                     flex items-center justify-between gap-3 focus:outline-none ${
                       value.length > 0 ? 'text-primary' : 'text-tertiary'
                     }`}
        >
          <span className="truncate">{displayLabel || placeholder || label || 'Select...'}</span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>
        {required && value.length === 0 && (
          <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" required value="" onChange={() => {}} />
        )}
      </div>

      {!stackNav && (
        <PreviewOverlay
          isOpen={visible}
          onClose={close}
          anchorRect={null}
          maxWidth={280}
          title={placeholder}
          rightFooter={
            <FooterPill side="right">
              <ActionButton icon={Check} label="Done" onClick={close} />
            </FooterPill>
          }
        >
          <PickerRows options={options} isSelected={(v) => value.includes(v)} onSelect={toggleOption} ariaLabel={placeholder} multi />
        </PreviewOverlay>
      )}
    </div>
  )
}

