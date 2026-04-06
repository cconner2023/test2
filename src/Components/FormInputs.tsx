import { useState, useRef, useEffect, useCallback } from 'react'
import { Eye, EyeOff, ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useOverlay } from '../Hooks/useOverlay'

export const TextInput = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  required = false,
  type = 'text',
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
  currentValue?: string | null
  hint?: string | null
}) => (
  <label className="block">
    {label && (
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
        {label} {required && <span className="text-themeredred">*</span>}
      </span>
    )}
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className={`${label ? 'mt-1' : ''} w-full px-4 py-2.5 rounded-full text-primary text-sm
                 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none
                 transition-all duration-300 placeholder:text-tertiary/30`}
    />
    {hint && (
      <span className="mt-1 block text-xs text-themeredred">{hint}</span>
    )}
  </label>
)

export const SelectInput = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  currentValue,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[] | readonly { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  currentValue?: string | null
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-themeredred">*</span>}
    </span>
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors appearance-none"
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((opt) => {
        const isObj = typeof opt === 'object'
        const val = isObj ? opt.value : opt
        const lbl = isObj ? opt.label : opt
        return (
          <option key={val} value={val}>
            {lbl}
          </option>
        )
      })}
    </select>
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
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(visible, () => setVisible(false))

  const displayValue = options.find((o) => getOptionValue(o) === value)
  const displayLabel = displayValue ? getOptionLabel(displayValue) : ''

  const handleSelect = useCallback((opt: PickerOption) => {
    onChange(getOptionValue(opt))
    close()
  }, [onChange, close])

  return (
    <div>
      {label && (
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
          {label} {required && <span className="text-themeredred">*</span>}
        </span>
      )}
      <div className={`relative ${label ? 'mt-1' : ''}`}>
        <button
          type="button"
          onClick={() => setVisible(true)}
          className={`w-full px-4 py-2.5 rounded-full text-left text-sm
                     border border-themeblue3/10 shadow-xs bg-themewhite2
                     transition-all duration-200 flex items-center justify-between active:scale-[0.98] ${
                       value ? 'text-primary' : 'text-tertiary/30'
                     }`}
        >
          <span className="truncate">{displayLabel || placeholder || 'Select...'}</span>
          <ChevronDown size={16} className="shrink-0 ml-2 text-tertiary/40" />
        </button>
        {required && !value && (
          <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" required value="" onChange={() => {}} />
        )}
      </div>

      {mounted && (isMobile ? (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div
            className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
            style={{
              transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
              maxHeight: '50dvh',
            }}
            role="listbox"
            aria-label={placeholder}
            {...touchHandlers}
          >
            <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
              <div className="w-9 h-1 rounded-full bg-tertiary/25" />
            </div>
            <p className="px-5 pb-2 text-xs font-medium text-tertiary/50 uppercase tracking-wide">
              {placeholder}
            </p>
            <div className="px-3 pb-5 overflow-y-auto" style={{ maxHeight: 'calc(50dvh - 3.5rem)' }}>
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
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors active:scale-95 flex items-center justify-between ${
                      selected ? 'text-themeblue2 font-medium bg-themeblue2/5' : 'text-primary'
                    }`}
                  >
                    {optLbl}
                    {selected && <Check size={16} className="shrink-0 text-themeblue2" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-200 ${open ? 'opacity-15' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
              className={`bg-themewhite2 rounded-xl shadow-lg border border-primary/10 py-1.5 min-w-[200px] max-w-[260px] w-full pointer-events-auto transition-all duration-200 ease-out ${
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
              }`}
              role="listbox"
              aria-label={placeholder}
            >
              <p className="px-3.5 py-1.5 text-[10pt] font-medium text-tertiary/60 uppercase tracking-wider">
                {placeholder}
              </p>
              <div className="max-h-60 overflow-y-auto">
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
              <div className="h-px bg-tertiary/10 mx-2.5 my-1" />
              <button
                type="button"
                onClick={close}
                className="flex items-center w-full px-3.5 py-2 text-sm text-tertiary hover:bg-primary/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ))}
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
            className="p-1.5 rounded-full text-tertiary/60 active:scale-95 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-primary">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear(y => y + 1)}
            className="p-1.5 rounded-full text-tertiary/60 active:scale-95 transition-all"
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
          className="p-1.5 rounded-full text-tertiary/60 active:scale-95 transition-all"
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
          className="p-1.5 rounded-full text-tertiary/60 active:scale-95 transition-all"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="h-8 flex items-center justify-center text-[11px] font-medium text-tertiary/40">
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
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(visible, () => setVisible(false))

  const display = formatDisplay(value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={`w-full px-4 py-2.5 rounded-full text-left text-sm
                   border border-themeblue3/10 shadow-xs bg-themewhite2
                   transition-all duration-200 flex items-center justify-between active:scale-[0.98] ${
                     display ? 'text-primary' : 'text-tertiary/30'
                   }`}
      >
        <span className="truncate">{display || placeholder || 'Select date...'}</span>
        <ChevronDown size={16} className="shrink-0 ml-2 text-tertiary/40" />
      </button>

      {mounted && (isMobile ? (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div
            className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
            style={{
              transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
              maxHeight: '50dvh',
            }}
            {...touchHandlers}
          >
            <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
              <div className="w-9 h-1 rounded-full bg-tertiary/25" />
            </div>
            <p className="px-5 pb-1 text-xs font-medium text-tertiary/50 uppercase tracking-wide">
              {placeholder ?? 'Select Date'}
            </p>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(50dvh - 3.5rem)' }}>
              <DatePickerCalendar
                value={value}
                onChange={onChange}
                onClose={close}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-20' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
              className={`bg-themewhite rounded-3xl shadow-xl px-2 py-4 max-w-[320px] w-full pointer-events-auto transition-all duration-300 ease-out ${
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
              }`}
            >
              <p className="px-4 pb-2 text-xs font-medium text-tertiary/50 uppercase tracking-wide">
                {placeholder ?? 'Select Date'}
              </p>
              <DatePickerCalendar
                value={value}
                onChange={onChange}
                onClose={close}
                minDate={minDate}
                maxDate={maxDate}
              />
              <div className="px-4">
                <button
                  type="button"
                  onClick={close}
                  className="w-full py-2.5 rounded-full text-sm font-medium text-tertiary active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      ))}
    </div>
  )
}

/* ── UIC Pin Input (6-digit auto-advance) ── */

export function UicPinInput({ value, onChange, spread, label }: { value: string; onChange: (v: string) => void; spread?: boolean; label?: string }) {
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

  return (
    <div>
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className={`${label ? 'mt-1 ' : ''}${spread ? 'grid grid-cols-6 gap-2' : 'flex items-center gap-1.5'}`}>
        {!spread && !label && <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mr-1">UIC</span>}
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
          className={`h-10 text-center rounded-full border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm font-mono bg-themewhite dark:bg-themewhite3 text-primary transition-all duration-300 ${spread ? 'w-full' : 'w-8'}`}
        />
        ))}
      </div>
    </div>
  )
}

/* ── Code Input (auto-advance, auto-submit, configurable length) ── */

export function PinCodeInput({ onSubmit, error, disabled, label, length = 4 }: {
  onSubmit: (code: string) => void
  error?: string
  disabled?: boolean
  label?: string
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

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <p className={`text-xs ${error && shaking ? 'text-themeredred' : 'text-tertiary/60'}`}>{error && shaking ? error : label}</p>}
      <div className={`flex items-center gap-2 ${shaking ? 'animate-shake' : ''}`} onPaste={handlePaste}>
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
            className={`w-10 h-11 text-center rounded-xl border shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-lg font-mono bg-themewhite dark:bg-themewhite3 text-primary transition-all duration-300 disabled:opacity-50 ${
              error && shaking ? 'border-themeredred/40' : 'border-themeblue3/10'
            }`}
          />
        ))}
      </div>
    </div>
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
    <label className="block">
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className={`relative ${label ? 'mt-1' : ''}`}>
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-4 py-2.5 pr-10 rounded-full bg-themewhite dark:bg-themewhite3 text-primary text-sm
                     border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary/70 transition-colors"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint}
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
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(visible, () => setVisible(false))

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

  const optionList = (mobile: boolean) => options.map((opt) => {
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
        className={`w-full text-left ${mobile ? 'px-4 py-3 rounded-xl' : 'px-3.5 py-2'} text-sm transition-colors active:scale-95 flex items-center justify-between ${
          selected
            ? mobile ? 'text-themeblue2 font-medium bg-themeblue2/5' : 'text-themeblue2 font-medium'
            : 'text-primary'
        } ${mobile ? '' : 'hover:bg-primary/5 active:bg-primary/10'}`}
      >
        {optLbl}
        {selected && <Check size={16} className="shrink-0 text-themeblue2" />}
      </button>
    )
  })

  return (
    <div>
      {label && (
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
          {label} {required && <span className="text-themeredred">*</span>}
        </span>
      )}
      <div className={`relative ${label ? 'mt-1' : ''}`}>
        <button
          type="button"
          onClick={() => setVisible(true)}
          className={`w-full px-4 py-2.5 rounded-full text-left text-sm
                     border border-themeblue3/10 shadow-xs bg-themewhite2
                     transition-all duration-200 flex items-center justify-between active:scale-[0.98] ${
                       value.length > 0 ? 'text-primary' : 'text-tertiary/30'
                     }`}
        >
          <span className="truncate">{displayLabel || placeholder || 'Select...'}</span>
          <ChevronDown size={16} className="shrink-0 ml-2 text-tertiary/40" />
        </button>
        {required && value.length === 0 && (
          <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" required value="" onChange={() => {}} />
        )}
      </div>

      {mounted && (isMobile ? (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div
            className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
            style={{
              transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
              maxHeight: '50dvh',
            }}
            role="listbox"
            aria-label={placeholder}
            aria-multiselectable="true"
            {...touchHandlers}
          >
            <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
              <div className="w-9 h-1 rounded-full bg-tertiary/25" />
            </div>
            <p className="px-5 pb-2 text-xs font-medium text-tertiary/50 uppercase tracking-wide">
              {placeholder}
            </p>
            <div className="px-3 pb-3 overflow-y-auto" style={{ maxHeight: 'calc(50dvh - 5.5rem)' }}>
              {optionList(true)}
            </div>
            <div className="px-4 pb-5">
              <button
                type="button"
                onClick={close}
                className="w-full py-2.5 rounded-full text-sm font-medium bg-themeblue3 text-white active:scale-95 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-200 ${open ? 'opacity-15' : 'opacity-0'}`}
            style={{ pointerEvents: open ? 'auto' : 'none' }}
            onClick={close}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
              className={`bg-themewhite2 rounded-xl shadow-lg border border-primary/10 py-1.5 min-w-[200px] max-w-[260px] w-full pointer-events-auto transition-all duration-200 ease-out ${
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
              }`}
              role="listbox"
              aria-label={placeholder}
              aria-multiselectable="true"
            >
              <p className="px-3.5 py-1.5 text-[10pt] font-medium text-tertiary/60 uppercase tracking-wider">
                {placeholder}
              </p>
              <div className="max-h-60 overflow-y-auto">
                {optionList(false)}
              </div>
              <div className="h-px bg-tertiary/10 mx-2.5 my-1" />
              <button
                type="button"
                onClick={close}
                className="flex items-center justify-center w-full px-3.5 py-2 text-sm font-medium text-themeblue2 hover:bg-primary/5 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      ))}
    </div>
  )
}
