import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta, STATUS_META, toDateKey } from '../../Types/CalendarTypes'
import { useLongPressDrag } from '../../Hooks/useLongPressDrag'
import { useCalendarStore } from '../../stores/useCalendarStore'

interface InfiniteScrollCalendarProps {
  events: CalendarEvent[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onMonthChange: (monthLabel: string) => void
  onMoveEvent: (eventId: string, targetDateKey: string) => void
  onSelectEvent: (id: string) => void
  onEventContextMenu?: (eventId: string, x: number, y: number) => void
  onDayContextMenu?: (dateKey: string, x: number, y: number) => void
  scrollTargetDate?: string
  scrollNonce?: number
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

function generateWeeks(centerDate: Date, countBefore: number, countAfter: number, hideWeekends: boolean): WeekData[] {
  const monday = getMonday(centerDate)
  const weeks: WeekData[] = []
  const dayCount = hideWeekends ? 5 : 7

  for (let w = -countBefore; w <= countAfter; w++) {
    const weekStart = new Date(monday)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const days: DayData[] = []

    for (let d = 0; d < dayCount; d++) {
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
  const lastIdx = week.days.length - 1
  const weekStartKey = week.days[0].dateKey
  const weekEndKey = week.days[lastIdx].dateKey
  const seen = new Set<string>()
  const segments: MultiDaySegment[] = []

  for (const event of multiDayEvents) {
    if (seen.has(event.id)) continue
    const es = event.start_time.slice(0, 10)
    const ee = event.end_time.slice(0, 10)
    if (ee < weekStartKey || es > weekEndKey) continue
    seen.add(event.id)

    const startCol = es < weekStartKey ? 0 : week.days.findIndex(d => d.dateKey >= es)
    const endCol = ee > weekEndKey ? lastIdx : week.days.findIndex(d => d.dateKey >= ee)
    const sc = startCol === -1 ? 0 : startCol
    const ec = endCol === -1 ? lastIdx : endCol

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
  onContextMenu?: (eventId: string, x: number, y: number) => void
  isDragging: boolean
  dragHandlers: ReturnType<ReturnType<typeof useLongPressDrag>['getDragHandlers']>
}

function EventPill({ event, eventId, onTap, onContextMenu, isDragging, dragHandlers }: EventPillProps) {
  const cat = getCategoryMeta(event.category)
  const sm = STATUS_META[event.status]
  return (
    <div
      {...dragHandlers}
      onClick={(e) => {
        e.stopPropagation()
        onTap(eventId)
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu(eventId, e.clientX, e.clientY)
        }
      }}
      className={`w-full rounded flex items-center gap-1 overflow-hidden text-[9pt] md:text-[9pt] leading-tight font-normal transition-opacity duration-150 cursor-pointer active:scale-95 bg-primary/5 ${isDragging ? 'opacity-30' : sm.opacity} ${sm.pulse ? 'animate-pulse' : ''}`}
      style={{ height: LANE_HEIGHT - 2 }}
    >
      <div className={`w-0.5 self-stretch shrink-0 rounded-full ${cat.solidColor}`} />
      <span className={`truncate text-primary pr-0.5 ${sm.strikethrough ? 'line-through' : ''}`}>{event.title}</span>
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
  onEventContextMenu,
  onDayContextMenu,
  scrollTargetDate,
  scrollNonce,
}: InfiniteScrollCalendarProps) {
  const hideWeekends = useCalendarStore(s => s.hideWeekends)
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const dayLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout>; dateKey: string; fired: boolean } | null>(null)
  const [weeks, setWeeks] = useState(() => generateWeeks(new Date(), WEEKS_BUFFER, WEEKS_BUFFER, hideWeekends))
  const [rowMinHeight, setRowMinHeight] = useState(88)

  // Regenerate weeks when hideWeekends toggles, anchored on the currently selected date
  useEffect(() => {
    setWeeks(generateWeeks(selectedDate, WEEKS_BUFFER, WEEKS_BUFFER, hideWeekends))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideWeekends])

  // Dynamically size rows so ~5 weeks fill the visible area
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height
      if (h > 0) setRowMinHeight(Math.max(88, Math.floor(h / 5)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
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

  // Read live DOM measurements — no stale closure values
  const scrollToDate = useCallback((dateKey: string) => {
    const targetWeek = weeks.find(w => w.days.some(d => d.dateKey === dateKey))
    if (targetWeek) {
      const el = weekRefs.current.get(targetWeek.key)
      if (el && scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight
        const rowHeight = el.offsetHeight
        // Measure actual spacer/header overlay height from the DOM
        const isMobileView = window.innerWidth < 768
        const spacer = isMobileView ? (scrollRef.current.firstElementChild as HTMLElement) : null
        const headerHeight = spacer?.offsetHeight ?? 0
        const visibleHeight = containerHeight - headerHeight
        const centerOffset = Math.max(0, (visibleHeight - rowHeight) / 2) + headerHeight
        scrollRef.current.scrollTop = el.offsetTop - centerOffset
      }
    } else {
      const targetDate = new Date(dateKey + 'T00:00:00')
      setWeeks(generateWeeks(targetDate, WEEKS_BUFFER, WEEKS_BUFFER, hideWeekends))
    }
  }, [weeks, hideWeekends])

  // Scroll on mount — delayed so ResizeObserver can update rowMinHeight,
  // React re-renders rows with correct heights, and DOM measurements are stable.
  const mountScrollDoneRef = useRef(false)
  const [scrollReady, setScrollReady] = useState(false)
  useEffect(() => {
    if (!scrollTargetDate) return
    const timer = setTimeout(() => {
      scrollToDate(scrollTargetDate)
      mountScrollDoneRef.current = true
      // Reveal after scroll position is set
      requestAnimationFrame(() => setScrollReady(true))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll when target date or nonce changes AFTER initial mount scroll
  useEffect(() => {
    if (!scrollTargetDate || !mountScrollDoneRef.current) return
    requestAnimationFrame(() => scrollToDate(scrollTargetDate))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTargetDate, scrollNonce])

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
              const midDay = week.days[Math.floor(week.days.length / 2)]
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
      const newWeeks = generateWeeks(firstDate, 0, WEEKS_BUFFER - 1, hideWeekends)
      setWeeks(prev => [...newWeeks, ...prev])
      requestAnimationFrame(() => {
        container.scrollTop += weekHeight * newWeeks.length
      })
    }

    if (scrollTop + clientHeight > scrollHeight - weekHeight * LOAD_THRESHOLD) {
      const lastWeek = weeks[weeks.length - 1]
      const lastDate = new Date(lastWeek.days[lastWeek.days.length - 1].date)
      lastDate.setDate(lastDate.getDate() + 1)
      const newWeeks = generateWeeks(lastDate, 0, WEEKS_BUFFER - 1, hideWeekends)
      setWeeks(prev => [...prev, ...newWeeks])
    }
  }, [weeks, dragState.isDragging, hideWeekends])

  const setWeekRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) weekRefs.current.set(key, el)
    else weekRefs.current.delete(key)
  }, [])

  return (
    <div data-tour="calendar-month-grid" className="flex flex-col h-full">
      {/* Scrollable weeks */}
      <div
        ref={scrollRef}
        className={`flex-1 relative transition-opacity duration-300 ${scrollReady ? 'opacity-100' : 'opacity-0'} ${dragState.isDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}
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
                const sm = STATUS_META[seg.event.status]
                const colCount = week.days.length
                return (
                  <div
                    key={seg.event.id}
                    {...getDragHandlers(seg.event.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(seg.event.id)
                    }}
                    onContextMenu={(e) => {
                      if (onEventContextMenu) {
                        e.preventDefault()
                        e.stopPropagation()
                        onEventContextMenu(seg.event.id, e.clientX, e.clientY)
                      }
                    }}
                    className={`absolute z-[2] flex items-center overflow-hidden text-[9pt] md:text-[9pt] font-normal cursor-pointer active:scale-[0.98] transition-all duration-150 bg-primary/5 ${
                      seg.isStart ? 'rounded-l' : ''
                    } ${seg.isEnd ? 'rounded-r' : ''} ${isDrag ? 'opacity-30' : sm.opacity} ${sm.pulse ? 'animate-pulse' : ''}`}
                    style={{
                      top: DAY_NUM_HEIGHT + seg.lane * LANE_HEIGHT + 1,
                      left: `${(seg.startCol / colCount) * 100}%`,
                      width: `${(seg.span / colCount) * 100}%`,
                      height: LANE_HEIGHT - 2,
                    }}
                  >
                    <div className={`w-0.5 self-stretch shrink-0 ${seg.isStart ? 'rounded-l' : ''} ${cat.solidColor}`} />
                    <span className={`truncate text-primary px-1 ${sm.strikethrough ? 'line-through' : ''}`}>{seg.event.title}</span>
                  </div>
                )
              })}

              <div
                className="grid border-b border-primary/8"
                style={{ gridTemplateColumns: `repeat(${week.days.length}, minmax(0, 1fr))` }}
              >
                {week.days.map((day, i) => {
                  const lastCol = week.days.length - 1
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
                        if (dayLongPressRef.current?.fired) return
                        onSelectDate(day.date)
                      }}
                      onContextMenu={(e) => {
                        if (onDayContextMenu) {
                          e.preventDefault()
                          e.stopPropagation()
                          onDayContextMenu(day.dateKey, e.clientX, e.clientY)
                        }
                      }}
                      onTouchStart={(e) => {
                        if (!onDayContextMenu) return
                        const touch = e.touches[0]
                        const lp = { timer: setTimeout(() => {
                          lp.fired = true
                          onDayContextMenu(day.dateKey, touch.clientX, touch.clientY)
                        }, 500), dateKey: day.dateKey, fired: false }
                        dayLongPressRef.current = lp
                      }}
                      onTouchMove={() => {
                        if (dayLongPressRef.current) {
                          clearTimeout(dayLongPressRef.current.timer)
                          dayLongPressRef.current = null
                        }
                      }}
                      onTouchEnd={() => {
                        if (dayLongPressRef.current) {
                          clearTimeout(dayLongPressRef.current.timer)
                          if (dayLongPressRef.current.fired) {
                            // Suppress the click that follows
                            setTimeout(() => { dayLongPressRef.current = null }, 50)
                          } else {
                            dayLongPressRef.current = null
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (!justDroppedRef.current) onSelectDate(day.date)
                        }
                      }}
                      style={{ minHeight: rowMinHeight }}
                      className={`flex flex-col items-start px-0.5 py-1 transition-all duration-150 hover:bg-primary/3 active:scale-[0.97] cursor-pointer ${
                        i < lastCol ? 'border-r border-primary/8' : ''
                      } ${isDropTarget ? 'ring-2 ring-themeblue3 ring-inset bg-themeblue3/5' : ''} ${
                        isToday && !isDropTarget && !isSelected ? 'bg-themeblue3/8 border border-themeblue2/30' : ''
                      } ${isSelected && !isDropTarget ? 'bg-themeblue3/20 border border-themeblue2/30' : ''}`}
                    >
                      <div className="flex items-center justify-start gap-1 w-full mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-[10pt] font-semibold rounded-full ${
                          day.day === 1
                            ? 'text-primary font-bold'
                            : day.month === selectedDate.getMonth()
                              ? 'text-primary'
                              : 'text-tertiary'
                        }`}>
                          {day.day}
                        </span>
                        {day.day === 1 && (
                          <span className="text-[9pt] font-bold text-primary uppercase tracking-wide">
                            {new Date(day.year, day.month).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        )}
                      </div>

                      {/* Spacer for multi-day lanes so single-day pills sit below */}
                      {laneCount > 0 && <div style={{ height: laneCount * LANE_HEIGHT }} />}

                      <div className="w-full space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map(event => (
                          <EventPill
                            key={event.id}
                            event={event}
                            eventId={event.id}
                            onTap={onSelectEvent}
                            onContextMenu={onEventContextMenu}
                            isDragging={dragState.draggedEventId === event.id}
                            dragHandlers={getDragHandlers(event.id)}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9pt] md:text-[9pt] text-tertiary pl-1">+{dayEvents.length - 3}</span>
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
          className={`fixed pointer-events-none z-[9999] px-2 py-1 rounded shadow-lg text-[9pt] font-medium text-primary flex items-center gap-1.5 opacity-90 -translate-x-1/2 -translate-y-full bg-themewhite border border-primary/10`}
          style={{
            left: dragState.ghostX,
            top: dragState.ghostY - 8,
          }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${getCategoryMeta(ghostEvent.category).solidColor}`}
          />
          {ghostEvent.title}
        </div>,
        document.body
      )}
    </div>
  )
}
