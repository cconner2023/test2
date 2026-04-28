import { useState, useRef, useEffect, useCallback } from 'react'
import { Eye, EyeOff, ChevronDown, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { ActionButton } from './ActionButton'

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
}) => (
  <label className="block border-b border-primary/6 last:border-b-0">
    {currentValue && (
      <div className="px-4 pt-2 text-[10pt] text-tertiary">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder ?? label}
      maxLength={maxLength}
      required={required}
      className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
    />
    {hint && (
      <span className="block px-4 pb-2 text-[10pt] text-themeredred">{hint}</span>
    )}
  </label>
)

/* ── Picker Input (drawer/modal selection) ── */

type PickerOption = string | { value: string; label: string }

function getOptionValue(opt: PickerOption): string {
  return typeof opt === 'string' ? opt : opt.value
}

function getOptionLabel(opt: PickerOption): string {
  return typeof opt === 'string' ? opt : opt.label
}

export const PickerInput = ({
  value,
  onChange,
  options,
  placeholder,
  required = false,
  label,
}: {
  value: string
  onChange: (val: string) => void
  options: readonly PickerOption[]
  placeholder?: string
  required?: boolean
  label?: string
}) => {
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const displayValue = options.find((o) => getOptionValue(o) === value)
  const displayLabel = displayValue ? getOptionLabel(displayValue) : ''

  const handleSelect = useCallback((opt: PickerOption) => {
    onChange(getOptionValue(opt))
    close()
  }, [onChange, close])

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible(true)}
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

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={280}
        title={placeholder}
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={X} label="Cancel" onClick={close} />
          </div>
        }
      >
        <div className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label={placeholder}>
          {options.map((opt) => {
            const optVal = getOptionValue(opt)
            const optLbl = getOptionLabel(opt)
            const selected = optVal === value
            return (
              <button
                key={optVal}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3.5 py-2 text-sm hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between ${
                  selected ? 'text-themeblue2 font-medium' : 'text-primary'
                }`}
              >
                {optLbl}
                {selected && <Check size={16} className="shrink-0 text-themeblue2" />}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>
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
  const [visible, setVisible] = useState(false)
  const close = () => setVisible(false)

  const display = formatDisplay(value)

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible(true)}
          className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                     flex items-center justify-between gap-3 focus:outline-none ${
                       display ? 'text-primary' : 'text-tertiary'
                     }`}
        >
          <span className="truncate">{display || placeholder || 'Date'}</span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>

        <PreviewOverlay
          isOpen={visible}
          onClose={close}
          anchorRect={null}
          title={placeholder ?? 'Select Date'}
          footer={
            <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton icon={X} label="Cancel" onClick={close} />
            </div>
          }
        >
          <DatePickerCalendar
            value={value}
            onChange={onChange}
            onClose={close}
            minDate={minDate}
            maxDate={maxDate}
          />
        </PreviewOverlay>
      </div>
    </div>
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

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
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
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  hint?: React.ReactNode
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

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible(true)}
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

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={280}
        title={placeholder}
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={Check} label="Done" onClick={close} />
          </div>
        }
      >
        <div className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label={placeholder} aria-multiselectable="true">
          {options.map((opt) => {
            const optVal = getOptionValue(opt)
            const optLbl = getOptionLabel(opt)
            const selected = value.includes(optVal)
            return (
              <button
                key={optVal}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggleOption(opt)}
                className={`w-full text-left px-3.5 py-2 text-sm hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between ${
                  selected ? 'text-themeblue2 font-medium' : 'text-primary'
                }`}
              >
                {optLbl}
                {selected && <Check size={16} className="shrink-0 text-themeblue2" />}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>
    </div>
  )
}
