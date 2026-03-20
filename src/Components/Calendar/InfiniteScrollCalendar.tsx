import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta, toDateKey } from '../../Types/CalendarTypes'
import { useLongPressDrag } from '../../Hooks/useLongPressDrag'

interface InfiniteScrollCalendarProps {
  events: CalendarEvent[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onMonthChange: (monthLabel: string) => void
  onMoveEvent: (eventId: string, targetDateKey: string) => void
  onSelectEvent: (id: string) => void
}

const WEEKS_BUFFER = 26
const LOAD_THRESHOLD = 4

interface WeekData {
  key: string
  days: DayData[]
}

interface DayData {
  date: Date
  dateKey: string
  day: number
  month: number
  year: number
}

// ── helpers ─────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function generateWeeks(centerDate: Date, countBefore: number, countAfter: number): WeekData[] {
  const monday = getMonday(centerDate)
  const weeks: WeekData[] = []

  for (let w = -countBefore; w <= countAfter; w++) {
    const weekStart = new Date(monday)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const days: DayData[] = []

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + d)
      days.push({
        date,
        dateKey: toDateKey(date),
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
      })
    }

    weeks.push({ key: toDateKey(weekStart), days })
  }

  return weeks
}

function isMultiDay(event: CalendarEvent): boolean {
  return event.start_time.slice(0, 10) !== event.end_time.slice(0, 10)
}

// ── multi-day spanning layout ────────────────────────────────────────

interface MultiDaySegment {
  event: CalendarEvent
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
}

function computeMultiDaySegments(week: WeekData, multiDayEvents: CalendarEvent[]): MultiDaySegment[] {
  const weekStartKey = week.days[0].dateKey
  const weekEndKey = week.days[6].dateKey
  const seen = new Set<string>()
  const segments: MultiDaySegment[] = []

  for (const event of multiDayEvents) {
    if (seen.has(event.id)) continue
    const es = event.start_time.slice(0, 10)
    const ee = event.end_time.slice(0, 10)
    if (ee < weekStartKey || es > weekEndKey) continue
    seen.add(event.id)

    const startCol = es < weekStartKey ? 0 : week.days.findIndex(d => d.dateKey >= es)
    const endCol = ee > weekEndKey ? 6 : week.days.findIndex(d => d.dateKey >= ee)
    const sc = startCol === -1 ? 0 : startCol
    const ec = endCol === -1 ? 6 : endCol

    segments.push({
      event, startCol: sc, span: ec - sc + 1, lane: 0,
      isStart: es >= weekStartKey, isEnd: ee <= weekEndKey,
    })
  }

  segments.sort((a, b) => a.startCol - b.startCol || b.span - a.span)

  const laneEnds: number[] = []
  for (const seg of segments) {
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] >= seg.startCol) lane++
    seg.lane = lane
    if (lane >= laneEnds.length) laneEnds.push(seg.startCol + seg.span - 1)
    else laneEnds[lane] = seg.startCol + seg.span - 1
  }

  return segments
}

const LANE_HEIGHT = 20

// ── components ──────────────────────────────────────────────────────

interface EventPillProps {
  event: CalendarEvent
  eventId: string
  onTap: (id: string) => void
  isDragging: boolean
  dragHandlers: ReturnType<ReturnType<typeof useLongPressDrag>['getDragHandlers']>
}

function EventPill({ event, eventId, onTap, isDragging, dragHandlers }: EventPillProps) {
  const cat = getCategoryMeta(event.category)
  return (
    <div
      {...dragHandlers}
      onClick={(e) => {
        e.stopPropagation()
        onTap(eventId)
      }}
      className={`flex items-center gap-0.5 rounded px-1 py-px text-[9px] leading-tight truncate transition-opacity duration-150 cursor-pointer ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.color}`} />
      <span className="truncate text-secondary/80">{event.title}</span>
    </div>
  )
}

// ── main ────────────────────────────────────────────────────────────

export function InfiniteScrollCalendar({
  events,
  selectedDate,
  onSelectDate,
  onMonthChange,
  onMoveEvent,
  onSelectEvent,
}: InfiniteScrollCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [weeks, setWeeks] = useState(() => generateWeeks(new Date(), WEEKS_BUFFER, WEEKS_BUFFER))
  const initialScrollDone = useRef(false)
  const today = useMemo(() => toDateKey(new Date()), [])
  const selectedKey = toDateKey(selectedDate)
  const justDroppedRef = useRef(false)

  const { dragState, getDragHandlers } = useLongPressDrag({
    onDrop: (eventId, targetDateKey) => {
      justDroppedRef.current = true
      onMoveEvent(eventId, targetDateKey)
      requestAnimationFrame(() => {
        justDroppedRef.current = false
      })
    },
  })

  const ghostEvent = useMemo(
    () => events.find(e => e.id === dragState.draggedEventId) ?? null,
    [events, dragState.draggedEventId]
  )

  const multiDayEvents = useMemo(() => events.filter(isMultiDay), [events])

  const multiDayByWeek = useMemo(() => {
    const map = new Map<string, MultiDaySegment[]>()
    if (multiDayEvents.length === 0) return map
    for (const week of weeks) {
      const segments = computeMultiDaySegments(week, multiDayEvents)
      if (segments.length > 0) map.set(week.key, segments)
    }
    return map
  }, [weeks, multiDayEvents])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      if (isMultiDay(event)) continue
      const key = event.start_time.slice(0, 10)
      const existing = map.get(key) ?? []
      existing.push(event)
      map.set(key, existing)
    }
    return map
  }, [events])

  // Scroll to current week on mount
  useEffect(() => {
    if (initialScrollDone.current) return
    const todayWeekKey = weeks.find(w => w.days.some(d => d.dateKey === today))?.key
    if (todayWeekKey) {
      const el = weekRefs.current.get(todayWeekKey)
      if (el && scrollRef.current) {
        const containerTop = scrollRef.current.getBoundingClientRect().top
        const elTop = el.getBoundingClientRect().top
        scrollRef.current.scrollTop += elTop - containerTop - 80
        initialScrollDone.current = true
      }
    }
  }, [weeks, today])

  // Detect visible month for header
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const weekKey = entry.target.getAttribute('data-week-key')
            const week = weeks.find(w => w.key === weekKey)
            if (week) {
              const midDay = week.days[3]
              const label = new Date(midDay.year, midDay.month).toLocaleDateString('en-US', { month: 'long' })
              onMonthChange(label)
            }
          }
        }
      },
      {
        root: container,
        rootMargin: '-40% 0px -55% 0px',
        threshold: 0,
      }
    )

    weekRefs.current.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [weeks, onMonthChange])

  // Load more weeks when approaching edges
  const handleScroll = useCallback(() => {
    if (dragState.isDragging) return
    const container = scrollRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const weekHeight = scrollHeight / weeks.length

    if (scrollTop < weekHeight * LOAD_THRESHOLD) {
      const firstWeek = weeks[0]
      const firstDate = new Date(firstWeek.days[0].date)
      firstDate.setDate(firstDate.getDate() - 7 * WEEKS_BUFFER)
      const newWeeks = generateWeeks(firstDate, 0, WEEKS_BUFFER - 1)
      setWeeks(prev => [...newWeeks, ...prev])
      requestAnimationFrame(() => {
        container.scrollTop += weekHeight * newWeeks.length
      })
    }

    if (scrollTop + clientHeight > scrollHeight - weekHeight * LOAD_THRESHOLD) {
      const lastWeek = weeks[weeks.length - 1]
      const lastDate = new Date(lastWeek.days[6].date)
      lastDate.setDate(lastDate.getDate() + 1)
      const newWeeks = generateWeeks(lastDate, 0, WEEKS_BUFFER - 1)
      setWeeks(prev => [...prev, ...newWeeks])
    }
  }, [weeks, dragState.isDragging])

  const setWeekRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) weekRefs.current.set(key, el)
    else weekRefs.current.delete(key)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable weeks */}
      <div
        ref={scrollRef}
        className={`flex-1 ${dragState.isDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}
        onScroll={handleScroll}
      >
        {/* Spacer for mobile floating header (header row + day-of-week row) */}
        <div className="h-[calc(var(--sat,0px)+5rem)] md:hidden shrink-0" />
        {weeks.map((week) => {
          const weekMultiDay = multiDayByWeek.get(week.key) ?? []
          const laneCount = weekMultiDay.length > 0 ? Math.max(...weekMultiDay.map(s => s.lane)) + 1 : 0
          const DAY_NUM_HEIGHT = 30 // py-1 (4) + h-6 (24) + mb-0.5 (2)

          return (
            <div
              key={week.key}
              ref={(el) => setWeekRef(week.key, el)}
              data-week-key={week.key}
              className="relative"
            >
              {/* Multi-day bars — absolutely positioned over day cells */}
              {weekMultiDay.map(seg => {
                const cat = getCategoryMeta(seg.event.category)
                const isDrag = dragState.draggedEventId === seg.event.id
                return (
                  <div
                    key={seg.event.id}
                    {...getDragHandlers(seg.event.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(seg.event.id)
                    }}
                    className={`absolute z-[2] flex items-center ${cat.color} text-white text-[9px] font-medium px-1.5 truncate cursor-pointer active:scale-[0.98] transition-all duration-150 ${
                      seg.isStart ? 'rounded-l' : ''
                    } ${seg.isEnd ? 'rounded-r' : ''} ${isDrag ? 'opacity-30' : ''}`}
                    style={{
                      top: DAY_NUM_HEIGHT + seg.lane * LANE_HEIGHT + 1,
                      left: `${(seg.startCol / 7) * 100}%`,
                      width: `${(seg.span / 7) * 100}%`,
                      height: LANE_HEIGHT - 2,
                    }}
                  >
                    <span className="truncate">{seg.event.title}</span>
                  </div>
                )
              })}

              <div className="grid grid-cols-7 border-b border-primary/8">
                {week.days.map((day, i) => {
                  const isToday = day.dateKey === today
                  const isSelected = day.dateKey === selectedKey
                  const isDropTarget = dragState.dropTargetDate === day.dateKey
                  const dayEvents = eventsByDate.get(day.dateKey) ?? []

                  return (
                    <div
                      key={day.dateKey}
                      role="button"
                      tabIndex={0}
                      data-drop-date={day.dateKey}
                      onClick={() => {
                        if (justDroppedRef.current) return
                        onSelectDate(day.date)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (!justDroppedRef.current) onSelectDate(day.date)
                        }
                      }}
                      className={`flex flex-col items-start px-0.5 py-1 min-h-[88px] transition-all duration-150 hover:bg-primary/3 active:scale-[0.97] cursor-pointer ${
                        i < 6 ? 'border-r border-primary/8' : ''
                      } ${isDropTarget ? 'ring-2 ring-themeblue3 ring-inset bg-themeblue3/5' : ''}`}
                    >
                      <div className="flex items-center justify-start w-full mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full ${
                          isSelected
                            ? 'bg-themeblue3 text-white'
                            : isToday
                              ? 'bg-themeblue3/15 text-themeblue3'
                              : day.day === 1
                                ? 'text-primary font-bold'
                                : day.month === selectedDate.getMonth()
                                  ? 'text-primary'
                                  : 'text-tertiary/30'
                        }`}>
                          {day.day}
                        </span>
                      </div>

                      {/* Spacer for multi-day lanes so single-day pills sit below */}
                      {laneCount > 0 && <div style={{ height: laneCount * LANE_HEIGHT }} />}

                      <div className="w-full space-y-px overflow-hidden">
                        {dayEvents.slice(0, 3).map(event => (
                          <EventPill
                            key={event.id}
                            event={event}
                            eventId={event.id}
                            onTap={onSelectEvent}
                            isDragging={dragState.draggedEventId === event.id}
                            dragHandlers={getDragHandlers(event.id)}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-tertiary/50 pl-1">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Drag ghost */}
      {dragState.isDragging && ghostEvent && createPortal(
        <div
          className={`fixed pointer-events-none z-[9999] px-2 py-1 rounded shadow-lg text-[11px] font-medium text-white flex items-center gap-1 opacity-90 -translate-x-1/2 -translate-y-full`}
          style={{
            left: dragState.ghostX,
            top: dragState.ghostY - 8,
            backgroundColor: 'var(--color-themeblue3, #1d4ed8)',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${getCategoryMeta(ghostEvent.category).color}`}
          />
          {ghostEvent.title}
        </div>,
        document.body
      )}
    </div>
  )
}
