import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, toDateKey } from '../../Types/CalendarTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { UserAvatar } from '../Settings/UserAvatar'
import { useIsMobile } from '../../Hooks/useIsMobile'

interface TroopsToTaskViewProps {
  date: Date
  events: CalendarEvent[]
  medics: ClinicMedic[]
  onSelectEvent: (id: string) => void
  onAssign: (eventId: string, userId: string) => void
  onUnassign: (eventId: string, userId: string) => void
  onDateChange: (date: Date) => void
}

const HOUR_COL_WIDTH = 80
const HOURS_PER_DAY = 24
const DAY_WIDTH = HOURS_PER_DAY * HOUR_COL_WIDTH // 1920px
const NAME_COL_WIDTH = 180
const DAYS_BUFFER = 7 // 7 before + 7 after = 15 days
const LOAD_THRESHOLD = 2 // days from edge before loading more
const LANE_HEIGHT = 24
const LANE_GAP = 2
const ROW_PAD = 4 // top + bottom padding inside row

function formatName(m: ClinicMedic): string {
  const parts: string[] = []
  if (m.rank) parts.push(m.rank)
  if (m.lastName) {
    let name = m.lastName
    if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

interface DaySlot {
  date: Date
  dateKey: string
  label: string // "Mon, Mar 22"
}

function generateDays(centerDate: Date, before: number, after: number): DaySlot[] {
  const days: DaySlot[] = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(centerDate)
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

/** Position an event block relative to the timeline origin (first day, hour 0) */
function getEventPosition(event: CalendarEvent, days: DaySlot[]) {
  const firstDayMs = days[0].date.getTime()
  const lastDayEndMs = days[days.length - 1].date.getTime() + 24 * 60 * 60 * 1000

  const startMs = Math.max(new Date(event.start_time).getTime(), firstDayMs)
  const endMs = Math.min(new Date(event.end_time).getTime(), lastDayEndMs)

  if (endMs <= firstDayMs || startMs >= lastDayEndMs) return null

  const startHoursFromOrigin = (startMs - firstDayMs) / (1000 * 60 * 60)
  const endHoursFromOrigin = (endMs - firstDayMs) / (1000 * 60 * 60)

  const left = startHoursFromOrigin * HOUR_COL_WIDTH
  const width = Math.max((endHoursFromOrigin - startHoursFromOrigin) * HOUR_COL_WIDTH, 30)

  return { left, width }
}

interface PositionedEvent {
  event: CalendarEvent
  left: number
  width: number
  lane: number
}

/** Assign non-overlapping lanes to events, sorted by start time */
function assignLanes(assignments: CalendarEvent[], days: DaySlot[]): PositionedEvent[] {
  const positioned: PositionedEvent[] = []

  for (const event of assignments) {
    const pos = getEventPosition(event, days)
    if (!pos) continue
    positioned.push({ event, left: pos.left, width: pos.width, lane: 0 })
  }

  // Sort by left position, then wider events first
  positioned.sort((a, b) => a.left - b.left || b.width - a.width)

  // Greedy lane assignment: track the right edge of each lane
  const laneEnds: number[] = []
  for (const item of positioned) {
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] > item.left) lane++
    item.lane = lane
    if (lane >= laneEnds.length) laneEnds.push(item.left + item.width)
    else laneEnds[lane] = item.left + item.width
  }

  return positioned
}

export function TroopsToTaskView({ date, events, medics, onSelectEvent, onDateChange }: TroopsToTaskViewProps) {
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const dayMarkerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [days, setDays] = useState(() => generateDays(date, DAYS_BUFFER, DAYS_BUFFER))
  const [visibleDateLabel, setVisibleDateLabel] = useState('')
  const initialScrollDone = useRef(false)
  const [nowLineX, setNowLineX] = useState<number | null>(null)

  // Compute the horizontal pixel position of "now" relative to the timeline origin
  const computeNowX = useCallback(() => {
    const now = new Date()
    const nowKey = toDateKey(now)
    const dayIndex = days.findIndex(d => d.dateKey === nowKey)
    if (dayIndex < 0) return null
    const fractionalHours = now.getHours() + now.getMinutes() / 60
    return dayIndex * DAY_WIDTH + fractionalHours * HOUR_COL_WIDTH
  }, [days])

  // Update now-line every 60 seconds
  useEffect(() => {
    const update = () => setNowLineX(computeNowX())
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [computeNowX])

  const totalWidth = NAME_COL_WIDTH + days.length * DAY_WIDTH

  // Filter to timed events that fall within our buffered range
  const visibleEvents = useMemo(() => {
    const firstKey = days[0].dateKey
    const lastKey = days[days.length - 1].dateKey
    return events.filter(e => {
      const eStart = e.start_time.slice(0, 10)
      const eEnd = e.end_time.slice(0, 10)
      return eEnd >= firstKey && eStart <= lastKey
    })
  }, [events, days])

  // Assignments per medic — lane-resolved
  const medicLanes = useMemo(() => {
    const raw = new Map<string, CalendarEvent[]>()
    for (const medic of medics) raw.set(medic.id, [])
    for (const event of visibleEvents) {
      for (const userId of event.assigned_to) {
        const existing = raw.get(userId) ?? []
        existing.push(event)
        raw.set(userId, existing)
      }
    }
    const map = new Map<string, PositionedEvent[]>()
    for (const [id, evts] of raw) {
      map.set(id, assignLanes(evts, days))
    }
    return map
  }, [medics, visibleEvents, days])

  const unassignedLanes = useMemo(() =>
    assignLanes(visibleEvents.filter(e => e.assigned_to.length === 0), days),
    [visibleEvents, days]
  )

  // Scroll to current time on mount (or selected date center if not today)
  useEffect(() => {
    if (initialScrollDone.current) return
    const el = scrollRef.current
    if (!el) return

    const viewportWidth = el.clientWidth - NAME_COL_WIDTH
    const now = new Date()
    const todayKey = toDateKey(now)
    const todayIndex = days.findIndex(d => d.dateKey === todayKey)

    if (todayIndex >= 0) {
      // Center on current time within today
      const fractionalHours = now.getHours() + now.getMinutes() / 60
      const nowX = todayIndex * DAY_WIDTH + fractionalHours * HOUR_COL_WIDTH
      const sl = Math.max(0, nowX - viewportWidth / 2)
      el.scrollLeft = sl
      el.style.setProperty('--sl', String(sl))
      initialScrollDone.current = true
    } else {
      // Fallback: center on the selected date
      const dayIndex = days.findIndex(d => d.dateKey === toDateKey(date))
      if (dayIndex >= 0) {
        const dayLeft = dayIndex * DAY_WIDTH
        const sl = Math.max(0, dayLeft - viewportWidth / 2 + DAY_WIDTH / 2)
        el.scrollLeft = sl
        el.style.setProperty('--sl', String(sl))
        initialScrollDone.current = true
      }
    }
  }, [days, date])

  // Re-center when date changes externally (nav buttons)
  const prevDateRef = useRef(toDateKey(date))
  useEffect(() => {
    const newKey = toDateKey(date)
    if (newKey === prevDateRef.current) return
    prevDateRef.current = newKey

    const el = scrollRef.current
    if (!el) return

    let dayIndex = days.findIndex(d => d.dateKey === newKey)
    if (dayIndex < 0) {
      // Date outside buffer — regenerate
      setDays(generateDays(date, DAYS_BUFFER, DAYS_BUFFER))
      return
    }

    const dayLeft = dayIndex * DAY_WIDTH
    const viewportWidth = el.clientWidth - NAME_COL_WIDTH
    el.scrollTo({ left: Math.max(0, dayLeft - viewportWidth / 2 + DAY_WIDTH / 2), behavior: 'smooth' })
  }, [date, days])

  // IntersectionObserver to detect which day is visible → update label
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const dateKey = entry.target.getAttribute('data-day-key')
            const day = days.find(d => d.dateKey === dateKey)
            if (day) setVisibleDateLabel(day.label)
          }
        }
      },
      {
        root: el,
        rootMargin: '0px -60% 0px -30%',
        threshold: 0,
      }
    )

    dayMarkerRefs.current.forEach(marker => observer.observe(marker))
    return () => observer.disconnect()
  }, [days])

  // Infinite scroll — load more days at edges
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    // Drive sticky event titles via CSS custom property (no React re-renders)
    el.style.setProperty('--sl', String(el.scrollLeft))

    const { scrollLeft, scrollWidth, clientWidth } = el
    const dayPixelWidth = DAY_WIDTH

    // Near left edge — prepend days
    if (scrollLeft < dayPixelWidth * LOAD_THRESHOLD) {
      const firstDay = days[0].date
      const newFirst = new Date(firstDay)
      newFirst.setDate(newFirst.getDate() - DAYS_BUFFER)
      const newDays = generateDays(newFirst, 0, DAYS_BUFFER - 1)
      setDays(prev => [...newDays, ...prev])
      // Maintain scroll position
      requestAnimationFrame(() => {
        el.scrollLeft += newDays.length * DAY_WIDTH
      })
    }

    // Near right edge — append days
    if (scrollLeft + clientWidth > scrollWidth - dayPixelWidth * LOAD_THRESHOLD) {
      const lastDay = days[days.length - 1].date
      const newFirst = new Date(lastDay)
      newFirst.setDate(newFirst.getDate() + 1)
      const newDays = generateDays(newFirst, 0, DAYS_BUFFER - 1)
      setDays(prev => [...prev, ...newDays])
    }
  }, [days])

  const prevDay = useCallback(() => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    onDateChange(d)
  }, [date, onDateChange])

  const nextDay = useCallback(() => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    onDateChange(d)
  }, [date, onDateChange])

  const jumpToToday = useCallback(() => {
    onDateChange(new Date())
  }, [onDateChange])

  const dateNavLabel = visibleDateLabel || date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const setDayRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) dayMarkerRefs.current.set(key, el)
    else dayMarkerRefs.current.delete(key)
  }, [])

  return (
    <div
      data-tour="calendar-troops-view"
      ref={scrollRef}
      className="touch-pan-xy h-full min-h-0 min-w-0 overflow-auto overscroll-contain"
      onScroll={handleScroll}
    >
      <div className="relative" style={{ minWidth: totalWidth, display: 'grid', gridTemplateRows: `auto repeat(${medics.length + (unassignedLanes.length > 0 ? 1 : 0)}, auto) 1fr` }}>
        {/* Current time indicator — vertical red line spanning all rows */}
        {nowLineX !== null && (
          <div
            className="absolute top-0 bottom-0 z-[3] pointer-events-none"
            style={{ left: NAME_COL_WIDTH + nowLineX }}
          >
            <div className="relative h-full">
              <div className="absolute top-0 w-2 h-2 -translate-x-1/2 rounded-full bg-themeredred" />
              <div className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-themeredred" />
            </div>
          </div>
        )}

        {/* Time header with day boundaries */}
        <div className="sticky top-0 z-10 flex items-end backdrop-blur-xs bg-transparent border-b border-primary/10">
          {/* Date nav in personnel column */}
          <div className="sticky left-0 z-20 shrink-0 border-r border-primary/10 flex items-center justify-between px-1.5 py-1 bg-themewhite3" style={{ width: NAME_COL_WIDTH }}>
            <button onClick={prevDay} className="w-6 h-6 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={jumpToToday} className="text-[9pt] font-semibold text-primary hover:text-themeblue3 transition-colors active:scale-95 truncate" title="Jump to today">
              {dateNavLabel}
            </button>
            <button onClick={nextDay} className="w-6 h-6 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hour labels with day dividers */}
          {days.map((day, dayIdx) => (
            <div key={day.dateKey} className="flex shrink-0" ref={(el) => setDayRef(day.dateKey, el)} data-day-key={day.dateKey}>
              {Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                <div
                  key={h}
                  className={`px-1 py-1.5 ${
                    h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                  }`}
                  style={{ width: HOUR_COL_WIDTH }}
                >
                  {h === 0 ? (
                    <span className="text-[9pt] font-semibold text-primary">{day.label}</span>
                  ) : (
                    <span className="text-[9pt] font-mono text-tertiary">{String(h).padStart(2, '0')}00</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Personnel rows */}
        {medics.map(medic => {
          const positioned = medicLanes.get(medic.id) ?? []
          const laneCount = positioned.length > 0 ? Math.max(...positioned.map(p => p.lane)) + 1 : 1
          const rowHeight = Math.max(ROW_PAD * 2 + laneCount * (LANE_HEIGHT + LANE_GAP), 52)
          return (
            <div key={medic.id} className="relative flex border-b border-primary/5" style={{ height: rowHeight }}>
              <div className={`sticky left-0 z-[5] shrink-0 flex items-center border-r border-primary/10 bg-themewhite3 ${isMobile ? 'gap-3 px-3' : 'gap-2 px-2'}`} style={{ width: NAME_COL_WIDTH }}>
                <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className={isMobile ? 'w-10 h-10' : 'w-7 h-7'} />
                <div className="min-w-0">
                  <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{formatName(medic)}</p>
                  {medic.credential && (
                    <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 relative">
                {/* Hour grid lines with day dividers */}
                {days.map((day, dayIdx) => (
                  Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={`${day.dateKey}-${h}`}
                      className={`absolute top-0 bottom-0 ${
                        h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                      }`}
                      style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                    />
                  ))
                )).flat()}

                {/* Event blocks — stacked in lanes */}
                {positioned.map(({ event, left, width, lane }) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className={`absolute rounded border text-left overflow-hidden transition-all duration-150 active:scale-[0.98] ${CATEGORY_BG_MAP[event.category]}`}
                    style={{
                      left,
                      width,
                      top: ROW_PAD + lane * (LANE_HEIGHT + LANE_GAP),
                      height: LANE_HEIGHT,
                    }}
                  >
                    <p
                      className="absolute inset-y-0 right-0 text-[9pt] font-normal truncate px-1.5"
                      style={{
                        left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                        lineHeight: `${LANE_HEIGHT}px`,
                      }}
                    >
                      {event.title}
                      {width > 80 && (
                        <span className="text-[9pt] md:text-[9pt] opacity-60 ml-1.5">
                          {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {/* Unassigned events row */}
        {unassignedLanes.length > 0 && (() => {
          const laneCount = Math.max(...unassignedLanes.map(p => p.lane)) + 1
          const rowHeight = Math.max(ROW_PAD * 2 + laneCount * (LANE_HEIGHT + LANE_GAP), 52)
          return (
            <div className="relative flex border-b border-primary/5 bg-themeredred/3" style={{ height: rowHeight }}>
              <div className={`sticky left-0 z-[5] shrink-0 flex items-center gap-2 border-r border-primary/10 bg-themeredred/5 ${isMobile ? 'px-3' : 'px-2'}`} style={{ width: NAME_COL_WIDTH }}>
                <span className="text-[9pt] font-semibold text-themeredred">UNASSIGNED</span>
              </div>
              <div className="flex-1 relative">
                {days.map((day, dayIdx) => (
                  Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={`${day.dateKey}-${h}`}
                      className={`absolute top-0 bottom-0 ${
                        h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                      }`}
                      style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                    />
                  ))
                )).flat()}

                {unassignedLanes.map(({ event, left, width, lane }) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className="absolute rounded border-2 border-dashed overflow-hidden transition-all duration-150 active:scale-[0.98] border-themeredred/30 bg-themeredred/5 text-themeredred"
                    style={{
                      left,
                      width,
                      top: ROW_PAD + lane * (LANE_HEIGHT + LANE_GAP),
                      height: LANE_HEIGHT,
                    }}
                  >
                    <p
                      className="absolute inset-y-0 right-0 text-[9pt] font-normal truncate px-1.5"
                      style={{
                        left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                        lineHeight: `${LANE_HEIGHT}px`,
                      }}
                    >
                      {event.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Bottom padding */}
        <div className="h-20" />
      </div>
    </div>
  )
}
