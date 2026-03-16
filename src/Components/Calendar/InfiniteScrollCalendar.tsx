import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta, toDateKey } from '../../Types/CalendarTypes'

interface InfiniteScrollCalendarProps {
  events: CalendarEvent[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onMonthChange: (monthLabel: string) => void
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKS_BUFFER = 26
const LOAD_THRESHOLD = 4
const MULTI_DAY_ROW_H = 18

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

interface MultiDaySpan {
  event: CalendarEvent
  startCol: number
  endCol: number
  row: number
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

function layoutMultiDaySpans(events: CalendarEvent[], weekDays: DayData[]): MultiDaySpan[] {
  const weekStart = weekDays[0].dateKey
  const weekEnd = weekDays[6].dateKey
  const spanning = events.filter(e => {
    if (!isMultiDay(e)) return false
    const eStart = e.start_time.slice(0, 10)
    const eEnd = e.end_time.slice(0, 10)
    return eStart <= weekEnd && eEnd >= weekStart
  })

  const rows: MultiDaySpan[][] = []

  for (const event of spanning) {
    const eStart = event.start_time.slice(0, 10)
    const eEnd = event.end_time.slice(0, 10)
    const startCol = Math.max(0, weekDays.findIndex(d => d.dateKey >= eStart))
    let endCol = weekDays.findIndex(d => d.dateKey > eEnd)
    if (endCol === -1) endCol = 7
    endCol = Math.min(endCol, 7)

    let placed = false
    for (let r = 0; r < rows.length; r++) {
      const conflict = rows[r].some(s => !(endCol <= s.startCol || startCol >= s.endCol))
      if (!conflict) {
        const span = { event, startCol, endCol, row: r }
        rows[r].push(span)
        placed = true
        break
      }
    }
    if (!placed) {
      const row = rows.length
      rows.push([{ event, startCol, endCol, row }])
    }
  }

  return rows.flat()
}

// ── components ──────────────────────────────────────────────────────

function EventPill({ event }: { event: CalendarEvent }) {
  const cat = getCategoryMeta(event.category)
  return (
    <div className="flex items-center gap-0.5 rounded px-1 py-px text-[9px] leading-tight truncate">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.color}`} />
      <span className="truncate text-secondary/80">{event.title}</span>
    </div>
  )
}

function MultiDayBar({ span, colCount }: { span: MultiDaySpan; colCount: number }) {
  const cat = getCategoryMeta(span.event.category)
  const leftPct = (span.startCol / colCount) * 100
  const widthPct = ((span.endCol - span.startCol) / colCount) * 100

  return (
    <div
      className={`absolute h-[16px] rounded-sm px-1.5 flex items-center z-[2] ${cat.color} text-white text-[9px] font-medium truncate`}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: span.row * MULTI_DAY_ROW_H,
      }}
    >
      {span.event.title}
    </div>
  )
}

// ── main ────────────────────────────────────────────────────────────

export function InfiniteScrollCalendar({
  events,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: InfiniteScrollCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [weeks, setWeeks] = useState(() => generateWeeks(new Date(), WEEKS_BUFFER, WEEKS_BUFFER))
  const initialScrollDone = useRef(false)
  const today = useMemo(() => toDateKey(new Date()), [])
  const selectedKey = toDateKey(selectedDate)

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

  const multiDayEvents = useMemo(() => events.filter(isMultiDay), [events])

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
              const label = new Date(midDay.year, midDay.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
  }, [weeks])

  const setWeekRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) weekRefs.current.set(key, el)
    else weekRefs.current.delete(key)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-primary/10 bg-themewhite3/80 backdrop-blur-sm sticky top-0 z-10">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className={`text-center text-[10px] font-semibold text-tertiary/50 py-1.5 uppercase ${
            i < 6 ? 'border-r border-primary/8' : ''
          }`}>
            {label}
          </div>
        ))}
      </div>

      {/* Scrollable weeks */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {weeks.map((week) => {
          const isFirstOfMonth = week.days.some(d => d.day === 1)
          const monthBoundary = isFirstOfMonth ? week.days.find(d => d.day === 1) : null
          const spans = layoutMultiDaySpans(multiDayEvents, week.days)
          const multiDayRows = spans.length > 0 ? Math.max(...spans.map(s => s.row)) + 1 : 0
          const multiDayHeight = multiDayRows * MULTI_DAY_ROW_H

          return (
            <div
              key={week.key}
              ref={(el) => setWeekRef(week.key, el)}
              data-week-key={week.key}
            >
              {/* Month divider */}
              {monthBoundary && (
                <div className="px-3 pt-3 pb-1 border-b border-primary/8">
                  <span className="text-xs font-bold text-primary/60 uppercase tracking-wider">
                    {new Date(monthBoundary.year, monthBoundary.month).toLocaleDateString('en-US', { month: 'long' })}
                  </span>
                </div>
              )}

              {/* Multi-day overlay region */}
              {multiDayHeight > 0 && (
                <div className="relative border-b border-primary/5" style={{ height: multiDayHeight + 4, paddingTop: 2 }}>
                  {spans.map(span => (
                    <MultiDayBar key={`${span.event.id}-${span.startCol}`} span={span} colCount={7} />
                  ))}
                </div>
              )}

              {/* Week row — day cells as bordered boxes */}
              <div className="grid grid-cols-7 border-b border-primary/8">
                {week.days.map((day, i) => {
                  const isToday = day.dateKey === today
                  const isSelected = day.dateKey === selectedKey
                  const dayEvents = eventsByDate.get(day.dateKey) ?? []

                  return (
                    <button
                      key={day.dateKey}
                      onClick={() => onSelectDate(day.date)}
                      className={`flex flex-col items-start px-0.5 py-1 min-h-[76px] transition-all duration-150 hover:bg-primary/3 active:scale-[0.97] ${
                        i < 6 ? 'border-r border-primary/8' : ''
                      }`}
                    >
                      {/* Day number */}
                      <div className="flex items-center justify-start w-full mb-0.5">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full ${
                          isSelected
                            ? 'bg-themeblue3 text-white'
                            : isToday
                              ? 'bg-themeblue3/15 text-themeblue3'
                              : day.month === selectedDate.getMonth()
                                ? 'text-primary'
                                : 'text-tertiary/30'
                        }`}>
                          {day.day}
                        </span>
                      </div>

                      {/* Single-day event pills */}
                      <div className="w-full space-y-px overflow-hidden">
                        {dayEvents.slice(0, 2).map(event => (
                          <EventPill key={event.id} event={event} />
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] text-tertiary/50 pl-1">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
