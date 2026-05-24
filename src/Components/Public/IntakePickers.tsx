/**
 * Public-bundle copy of the calendar / time-input primitives.
 *
 * The anon intake bundle cannot import from src/Components/ (non-Public),
 * src/Hooks/, or anything that drags in PreviewOverlay / useIsMobile / etc.
 *
 * - `DatePickerCalendar` and `TimeInput` are lifted verbatim from
 *   src/Components/FormInputs.tsx (TimeInput minus its useIsMobile branch).
 * - `IntakeOverlay` reproduces PreviewOverlay's visual identity (portal +
 *   dim backdrop + centered scale-in card + bottom X dismiss) without the
 *   BaseOverlay / SearchInput / ActionButton dependency surface.
 * - `DateTimeRow` is the EventForm-style "[Date] | [Time]" row but routes
 *   each trigger through IntakeOverlay so the picker pops as a modal card,
 *   matching the main app's primitive UX exactly.
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react'

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

function formatDate(iso: string): string {
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

/** Format HHMM military -> "HH:MM" wall-clock display. */
function formatTime(hhmm: string): string {
  if (!hhmm || hhmm.length !== 4) return ''
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
}

/** 30-min military preset options: "0000", "0030", … "2330". Mirrors
 *  src/Types/CalendarTypes.ts MILITARY_TIME_OPTIONS — inlined so the anon
 *  bundle doesn't drag in CalendarTypes' MissionTypes/MedevacTypes graph. */
const MILITARY_TIME_OPTIONS: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}${m}`
})

/** Combine a date (YYYY-MM-DD) + military time (HHMM) into a Date in local TZ. */
export function combineDateTime(date: string, hhmm: string): Date | null {
  if (!date || !hhmm || hhmm.length !== 4) return null
  const [y, m, d] = date.split('-').map(Number)
  const hh = parseInt(hhmm.slice(0, 2), 10)
  const mm = parseInt(hhmm.slice(2), 10)
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm)
}

/** Free-form 4-digit military time input (0000–2359). Borderless to match the
 *  surrounding form-row style. Lifted from FormInputs.tsx TimeInput minus the
 *  useIsMobile sizing branch. */
export const TimeInput = ({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (val: string) => void
  label?: string
}) => {
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-primary/6 last:border-0">
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
        className="flex-1 text-right bg-transparent text-base text-primary placeholder:text-tertiary focus:outline-none font-mono tracking-wider tabular-nums"
      />
    </div>
  )
}

/** Lifted verbatim from FormInputs.tsx DatePickerCalendar. Pure: no main-app
 *  deps. Renders a month-grid + month-zoom-out picker. */
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

/** Minimal mount/open animation hook — reproduces the public surface of
 *  src/Hooks/useOverlay used by BaseOverlay (mounted/open + 300ms exit
 *  matching the fade/scale transitions). Drag-to-dismiss is omitted; the
 *  intake form's two overlays both have explicit dismiss controls. */
function useOverlayMount(visible: boolean) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
      return
    }
    setOpen(false)
    const t = setTimeout(() => setMounted(false), 300)
    return () => clearTimeout(t)
  }, [visible])

  return { mounted, open }
}

/** Portal-based centered modal mirroring PreviewOverlay's visual identity:
 *  dim backdrop (opacity 0.8), scale-in card (cubic-bezier(0.34, 1.56, 0.64, 1)),
 *  bg-themewhite rounded-2xl shell, bottom-right X dismiss in its own pill.
 *  Z-tier sits at 95 (above this bundle's Shell at z-30, no other overlays
 *  exist on the anon page). */
function IntakeOverlay({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const { mounted, open } = useOverlayMount(isOpen)
  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 ${open ? 'opacity-80' : 'opacity-0'}`}
        style={{ zIndex: 95, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none px-6 py-10"
        style={{ zIndex: 110 }}
      >
        <div
          className="pointer-events-auto w-full max-h-full"
          style={{
            maxWidth: 340,
            transform: open ? 'scale(1)' : 'scale(0.88)',
            opacity: open ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
          }}
        >
          <div className="flex flex-col gap-2 min-h-0">
            <div className="bg-themewhite rounded-2xl overflow-hidden min-h-0">
              {children}
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-themewhite text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

/** EventForm-style "[Date] | [Time]" row. Each trigger opens a PreviewOverlay-
 *  style modal (IntakeOverlay) containing the matching picker — the same UX as
 *  the main-app DatePickerInput / PickerInput-of-times pairing. */
export function DateTimeRow({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
  minDate,
}: {
  /** ISO YYYY-MM-DD */
  date: string
  /** Military HHMM */
  time: string
  onDateChange: (val: string) => void
  onTimeChange: (val: string) => void
  label: string
  minDate?: string
}) {
  const [open, setOpen] = useState<'date' | 'time' | null>(null)

  const dateLabel = formatDate(date)
  const timeLabel = formatTime(time)

  return (
    <>
      <div className="flex items-stretch border-b border-primary/6">
        <button
          type="button"
          onClick={() => setOpen('date')}
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-left flex items-center justify-between gap-3 focus:outline-none"
        >
          <span className="truncate">
            <span className="text-[9pt] text-tertiary uppercase tracking-widest mr-1.5">{label}</span>
            <span className={`text-base md:text-sm ${dateLabel ? 'text-primary' : 'text-tertiary'}`}>
              {dateLabel || 'Date'}
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>
        <button
          type="button"
          onClick={() => setOpen('time')}
          className="w-24 shrink-0 border-l border-primary/6 bg-transparent px-4 py-3 text-left flex items-center justify-between gap-2 focus:outline-none"
        >
          <span className={`text-base md:text-sm font-mono tabular-nums ${timeLabel ? 'text-primary' : 'text-tertiary'}`}>
            {timeLabel || 'HH:MM'}
          </span>
          <ChevronDown size={14} className="shrink-0 text-tertiary" />
        </button>
      </div>

      <IntakeOverlay isOpen={open === 'date'} onClose={() => setOpen(null)}>
        <DatePickerCalendar
          value={date}
          onChange={onDateChange}
          onClose={() => setOpen(null)}
          minDate={minDate}
        />
      </IntakeOverlay>

      <IntakeOverlay isOpen={open === 'time'} onClose={() => setOpen(null)}>
        <TimeInput
          value={time}
          onChange={(v) => { onTimeChange(v); setOpen(null) }}
          label={label}
        />
        <div className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label={`${label} time`}>
          {MILITARY_TIME_OPTIONS.map((opt) => {
            const selected = opt === time
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onTimeChange(opt); setOpen(null) }}
                className={`w-full text-left px-4 py-2.5 text-sm font-mono tabular-nums transition-colors active:scale-[0.99]
                  ${selected ? 'bg-themeblue3/10 text-primary font-semibold' : 'text-primary hover:bg-themewhite2/60'}`}
              >
                {formatTime(opt)}
              </button>
            )
          })}
        </div>
      </IntakeOverlay>
    </>
  )
}
