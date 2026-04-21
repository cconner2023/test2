import { type RefObject, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Clock, Play, CheckCircle2, Ban } from 'lucide-react'
import { toDateKey } from '../../Types/CalendarTypes'
import type { CalendarEvent, EventCategory, EventStatus } from '../../Types/CalendarTypes'
import { MissionEventBar } from './MissionEventBar'
import { type ContextMenuItem } from '../ContextMenu'
import { useLongPress } from '../../Hooks/useLongPress'

// ─── Gantt constants ────────────────────────────────────────────────────────

const HOUR_WIDTH = 76
const EVENT_HEIGHT = 44
const EVENT_GAP = 6
const EVENT_ROW_HEIGHT = EVENT_HEIGHT + EVENT_GAP
const AXIS_HEIGHT = 28
const BODY_PAD_TOP = 2
const BODY_PAD_BOTTOM = 8
const DEFAULT_START = 6
const DEFAULT_END = 22

// ─── Multi-day constants ─────────────────────────────────────────────────────

const DAY_WIDTH = (DEFAULT_END - DEFAULT_START) * HOUR_WIDTH   // 16h × 76px = 1216px
const DAYS_BUFFER = 7
const LOAD_THRESHOLD = 2

interface DaySlot {
  date: Date
  dateKey: string
  label: string
}

function generateDays(center: Date, before: number, after: number): DaySlot[] {
  const days: DaySlot[] = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(center)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    days.push({
      date: d,
      dateKey: toDateKey(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    })
  }
  return days
}

/** Lane assignment using absolute timestamps — events on different days at same clock time don't collide. */
function assignLanesAbs(events: CalendarEvent[]): number[] {
  const sorted = [...events]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time))
  const laneEnds: number[] = []
  const result = new Array<number>(events.length)
  for (const { e, i } of sorted) {
    const startMs = new Date(e.start_time).getTime()
    const endMs   = new Date(e.end_time).getTime()
    let lane = laneEnds.findIndex(end => end <= startMs)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = endMs
    result[i] = lane
  }
  return result
}

// ─── Task list constants ─────────────────────────────────────────────────────

export const CATEGORY_STRIPE: Record<EventCategory, string> = {
  training: 'bg-themeyellow',
  duty:     'bg-themeredred',
  range:    'bg-themeblue2',
  appointment: 'bg-themeblue1',
  mission:  'bg-themegreen',
  other:    'bg-tertiary/50',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function timeToHour(iso: string): number {
  const [h, m] = iso.slice(11, 16).split(':').map(Number)
  return h + m / 60
}

function formatHour(h: number): string {
  return `${String(h % 24).padStart(2, '0')}00`
}

export function formatTimeRange(start: string, end: string): string {
  const fmt = (iso: string) => iso.slice(11, 13) + iso.slice(14, 16)
  return `${fmt(start)}–${fmt(end)}`
}

export function offsetDate(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function assignLanes(events: CalendarEvent[]): number[] {
  const sorted = [...events]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time))
  const laneEnds: number[] = []
  const result = new Array<number>(events.length)
  for (const { e, i } of sorted) {
    const start = timeToHour(e.start_time)
    let lane = laneEnds.findIndex(end => end <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = timeToHour(e.end_time)
    result[i] = lane
  }
  return result
}

// ─── Status context menu items ────────────────────────────────────────────────

export function statusMenuItems(event: CalendarEvent, onStatusChange: (status: EventStatus) => void): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (event.status !== 'pending')     items.push({ key: 'pending',     label: 'Pending',  icon: Clock,        onAction: () => onStatusChange('pending') })
  if (event.status !== 'in_progress') items.push({ key: 'inprogress',  label: 'Active',   icon: Play,         onAction: () => onStatusChange('in_progress') })
  if (event.status !== 'completed')   items.push({ key: 'completed',   label: 'Done',     icon: CheckCircle2, onAction: () => onStatusChange('completed') })
  if (event.status !== 'cancelled')   items.push({ key: 'cancelled',   label: 'Cancel',   icon: Ban,          onAction: () => onStatusChange('cancelled'), destructive: true })
  return items
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const STATUS_META: Record<string, { label: string; pill: string } | null> = {
  pending:     null,
  in_progress: { label: 'Active',     pill: 'text-themeblue1 bg-themeblue1/10' },
  completed:   { label: 'Done',       pill: 'text-themegreen bg-themegreen/10' },
  cancelled:   { label: 'Cancelled',  pill: 'text-themeredred bg-themeredred/10' },
}

// ─── Task row ─────────────────────────────────────────────────────────────────

const STATUS_CIRCLE: Partial<Record<string, string>> = {
  in_progress: 'bg-themeblue1',
  completed:   'bg-themegreen',
  cancelled:   'bg-themeredred',
}

export function TaskRow({ event, onClick, onContextMenu }: { event: CalendarEvent; onClick: () => void; onContextMenu: (x: number, y: number) => void }) {
  const stripe = CATEGORY_STRIPE[event.category]
  const isDone   = event.status === 'completed' || event.status === 'cancelled'
  const isActive = event.status === 'in_progress'
  const circleColor = STATUS_CIRCLE[event.status]
  const longPress = useLongPress(onContextMenu)

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      {...longPress}
      className={`w-full flex items-stretch text-left rounded-lg overflow-hidden border border-themeblue3/10 active:scale-[0.99] ${
        isDone ? 'opacity-45' : 'opacity-100'
      }`}
    >
      <div className={`w-1 shrink-0 ${stripe} ${isActive ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0 px-2 py-1.5 bg-themewhite2 flex items-center gap-2">
        {circleColor && (
          <div className={`w-2 h-2 rounded-full shrink-0 ${circleColor}`} />
        )}
        <span className="text-[9pt] text-secondary tabular-nums shrink-0">
          {formatTimeRange(event.start_time, event.end_time)}
        </span>
        <span className="flex-1 text-xs font-medium text-primary truncate">
          {event.title}
        </span>
      </div>
    </button>
  )
}

// ─── Gantt body ───────────────────────────────────────────────────────────────

interface GanttBodyProps {
  scrollRef: RefObject<HTMLDivElement | null>
  events: CalendarEvent[]
  userId: string | undefined
  onEventClick: (eventId: string) => void
  onEventContextMenu: (event: CalendarEvent, x: number, y: number) => void
  selectedDate: Date
  onDateChange?: (date: Date) => void
}

export function GanttBody({ scrollRef, events, userId, onEventClick, onEventContextMenu, selectedDate, onDateChange }: GanttBodyProps) {
  const [days, setDays] = useState(() => generateDays(selectedDate, DAYS_BUFFER, DAYS_BUFFER))
  const initialScrollDone = useRef(false)
  const pendingScrollDateRef = useRef<Date | null>(null)
  const lastReportedKeyRef = useRef(toDateKey(selectedDate))
  const daysRef = useRef(days)
  daysRef.current = days

  const hourMarks = Array.from({ length: DEFAULT_END - DEFAULT_START + 1 }, (_, i) => DEFAULT_START + i)
  const totalWidth = days.length * DAY_WIDTH

  const firstKey = days[0].dateKey
  const lastKey  = days[days.length - 1].dateKey
  const visibleEvents = events.filter(e => {
    const k = e.start_time.slice(0, 10)
    return k >= firstKey && k <= lastKey
  })

  const lanes = assignLanesAbs(visibleEvents)
  const laneCount = visibleEvents.length > 0 ? Math.max(...lanes) + 1 : 1
  const totalHeight = BODY_PAD_TOP + AXIS_HEIGHT + laneCount * EVENT_ROW_HEIGHT + EVENT_GAP + BODY_PAD_BOTTOM

  const now = new Date()
  const todayKey = toDateKey(now)
  const todayIndex = days.findIndex(d => d.dateKey === todayKey)
  const currentHour = now.getHours() + now.getMinutes() / 60
  const nowLeft = todayIndex >= 0 ? todayIndex * DAY_WIDTH + (currentHour - DEFAULT_START) * HOUR_WIDTH : -1

  // Initial scroll + scroll-position correction after buffer regeneration
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pending = pendingScrollDateRef.current
    if (pending) {
      const di = days.findIndex(d => d.dateKey === toDateKey(pending))
      if (di >= 0) {
        el.scrollLeft = di * DAY_WIDTH
        pendingScrollDateRef.current = null
        initialScrollDone.current = true
      }
      return
    }
    if (!initialScrollDone.current) {
      const di = days.findIndex(d => d.dateKey === toDateKey(selectedDate))
      if (di >= 0) {
        el.scrollLeft = di * DAY_WIDTH
        initialScrollDone.current = true
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  // External navigation: scroll gantt when selectedDate changes from outside
  useEffect(() => {
    if (!initialScrollDone.current) return
    const key = toDateKey(selectedDate)
    if (key === lastReportedKeyRef.current) return
    lastReportedKeyRef.current = key
    const el = scrollRef.current
    if (!el) return
    const dayIndex = daysRef.current.findIndex(d => d.dateKey === key)
    if (dayIndex < 0) {
      pendingScrollDateRef.current = selectedDate
      setDays(generateDays(selectedDate, DAYS_BUFFER, DAYS_BUFFER))
      initialScrollDone.current = false
      return
    }
    el.scrollTo({ left: dayIndex * DAY_WIDTH, behavior: 'smooth' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Scroll listener: track visible date + extend buffer near edges
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const sl = el.scrollLeft
      const dayIndex = Math.max(0, Math.min(Math.floor(sl / DAY_WIDTH), daysRef.current.length - 1))
      const day = daysRef.current[dayIndex]
      if (!day) return
      const key = day.dateKey
      if (key !== lastReportedKeyRef.current) {
        lastReportedKeyRef.current = key
        onDateChange?.(day.date)
      }
      // Extend buffer near right edge
      if (dayIndex > daysRef.current.length - 1 - LOAD_THRESHOLD) {
        setDays(prev => {
          const last = prev[prev.length - 1]
          const next = new Date(last.date)
          next.setDate(next.getDate() + 1)
          const extra = generateDays(next, 0, DAYS_BUFFER - 1)
          return [...prev, ...extra]
        })
      }
      // Regenerate buffer near left edge
      if (dayIndex < LOAD_THRESHOLD) {
        const targetDay = daysRef.current[dayIndex]
        pendingScrollDateRef.current = targetDay.date
        setDays(generateDays(targetDay.date, DAYS_BUFFER, DAYS_BUFFER))
      }
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef, onDateChange])

  return (
    <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden" style={{ touchAction: 'pan-x' }}>
      <div className="relative select-none" style={{ width: totalWidth, height: totalHeight }}>

        {/* Hour grid lines */}
        {days.map((_, di) =>
          hourMarks.map(h => (
            <div
              key={`${di}-${h}`}
              className="absolute top-0 bottom-0 border-l border-themeblue3/8"
              style={{ left: di * DAY_WIDTH + (h - DEFAULT_START) * HOUR_WIDTH }}
            />
          ))
        )}

        {/* Day separator lines */}
        {days.map((_, di) => di > 0 && (
          <div
            key={`dsep-${di}`}
            className="absolute top-0 bottom-0 w-px bg-themeblue3/25 z-10 pointer-events-none"
            style={{ left: di * DAY_WIDTH }}
          />
        ))}

        {/* Axis: date label + hour marks per day */}
        {days.map((day, di) => (
          <div
            key={`axis-${di}`}
            className="absolute overflow-hidden"
            style={{ left: di * DAY_WIDTH, top: BODY_PAD_TOP, width: DAY_WIDTH, height: AXIS_HEIGHT }}
          >
            <span className="absolute top-0.5 left-1 text-[9pt] md:text-[9pt] font-semibold text-themeblue2/70 leading-none z-10 pointer-events-none">
              {day.label}
            </span>
            <div className="absolute bottom-0 left-0 flex">
              {hourMarks.map(h => (
                <div key={h} className="shrink-0 flex items-end pb-0.5 pl-1" style={{ width: HOUR_WIDTH }}>
                  <span className="text-[9pt] md:text-[9pt] text-tertiary leading-none">{formatHour(h)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Now line */}
        {nowLeft >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-themeredred/60 z-20 pointer-events-none"
            style={{ left: nowLeft }}
          />
        )}

        {/* Events */}
        {visibleEvents.map((event, i) => {
          const eventDayKey = event.start_time.slice(0, 10)
          const dayIndex = days.findIndex(d => d.dateKey === eventDayKey)
          if (dayIndex < 0) return null
          const startH = Math.max(timeToHour(event.start_time), DEFAULT_START)
          const endH   = Math.min(timeToHour(event.end_time), DEFAULT_END)
          const left   = dayIndex * DAY_WIDTH + (startH - DEFAULT_START) * HOUR_WIDTH
          const width  = Math.max((endH - startH) * HOUR_WIDTH, 40)
          const top    = BODY_PAD_TOP + AXIS_HEIGHT + lanes[i] * EVENT_ROW_HEIGHT + EVENT_GAP
          return (
            <MissionEventBar
              key={event.id}
              event={event}
              isAssigned={!!userId && event.assigned_to.includes(userId)}
              left={left}
              top={top}
              width={width}
              height={EVENT_HEIGHT}
              onClick={() => onEventClick(event.id)}
              onContextMenu={(x, y) => onEventContextMenu(event, x, y)}
            />
          )
        })}
      </div>
    </div>
  )
}

