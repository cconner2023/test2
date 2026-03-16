import { useMemo, useRef } from 'react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT_PX } from '../../Types/CalendarTypes'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onSelectEvent: (id: string) => void
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}00`
}

function getEventPosition(event: CalendarEvent, dateKey: string) {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

  let startMinutes = start.getHours() * 60 + start.getMinutes()
  let endMinutes = end.getHours() * 60 + end.getMinutes()

  if (start.toISOString().slice(0, 10) < dateKey) startMinutes = DAY_START_HOUR * 60
  if (end.toISOString().slice(0, 10) > dateKey) endMinutes = DAY_END_HOUR * 60

  startMinutes = Math.max(startMinutes, DAY_START_HOUR * 60)
  endMinutes = Math.min(endMinutes, DAY_END_HOUR * 60)

  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
  const top = ((startMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
  const height = Math.max(((endMinutes - startMinutes) / totalMinutes) * totalMinutes / 60 * HOUR_HEIGHT_PX, 24)

  return { top, height }
}

function resolveOverlaps(events: CalendarEvent[], dateKey: string) {
  const positioned = events
    .filter(e => !e.all_day)
    .map(e => ({ event: e, ...getEventPosition(e, dateKey) }))
    .sort((a, b) => a.top - b.top)

  const columns: { event: CalendarEvent; top: number; height: number; col: number; totalCols: number }[] = []
  const groups: typeof positioned[] = []

  for (const item of positioned) {
    let placed = false
    for (const group of groups) {
      const lastInGroup = group[group.length - 1]
      if (item.top < lastInGroup.top + lastInGroup.height) {
        group.push(item)
        placed = true
        break
      }
    }
    if (!placed) groups.push([item])
  }

  for (const group of groups) {
    const totalCols = group.length
    group.forEach((item, i) => {
      columns.push({ ...item, col: i, totalCols })
    })
  }

  return columns
}

export function DayView({ date, events, onSelectEvent }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dateKey = date.toISOString().slice(0, 10)
  const hours = useMemo(() => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i), [])
  const totalHeight = hours.length * HOUR_HEIGHT_PX

  const allDayEvents = useMemo(() => events.filter(e => e.all_day), [events])
  const timedEvents = useMemo(() => resolveOverlaps(events, dateKey), [events, dateKey])

  const nowMarkerTop = useMemo(() => {
    const now = new Date()
    if (now.toISOString().slice(0, 10) !== dateKey) return null
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes < DAY_START_HOUR * 60 || minutes > DAY_END_HOUR * 60) return null
    return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
  }, [dateKey])

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full">
      <p className="px-3 py-2 text-xs font-medium text-tertiary/50 uppercase tracking-wider border-b border-primary/10">
        {dateLabel}
      </p>

      {/* All day events */}
      {allDayEvents.length > 0 && (
        <div className="px-3 py-2 border-b border-primary/10 space-y-1">
          {allDayEvents.map(e => (
            <button
              key={e.id}
              onClick={() => onSelectEvent(e.id)}
              className={`w-full text-left text-xs font-medium px-2 py-1 rounded border ${CATEGORY_BG_MAP[e.category]} active:scale-95 transition-all duration-200 truncate`}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: totalHeight }}>
          {/* Hour lines */}
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-primary/5"
              style={{ top: i * HOUR_HEIGHT_PX }}
            >
              <span className="absolute -top-2.5 left-2 text-[10px] font-mono text-tertiary/40 bg-themewhite3 px-0.5">
                {formatHour(h)}
              </span>
            </div>
          ))}

          {/* Now marker */}
          {nowMarkerTop !== null && (
            <div className="absolute left-10 right-2 z-20" style={{ top: nowMarkerTop }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-themeredred shrink-0" />
                <div className="flex-1 h-px bg-themeredred" />
              </div>
            </div>
          )}

          {/* Event blocks */}
          {timedEvents.map(({ event, top, height, col, totalCols }) => {
            const leftPct = 12 + (col / totalCols) * 84
            const widthPct = 84 / totalCols - 1

            return (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className={`absolute rounded-lg border px-2 py-1 overflow-hidden text-left transition-all duration-200 active:scale-[0.98] ${CATEGORY_BG_MAP[event.category]}`}
                style={{
                  top,
                  height: Math.max(height, 24),
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
              >
                <p className="text-xs font-semibold truncate leading-tight">{event.title}</p>
                {height > 36 && (
                  <p className="text-[10px] opacity-70 truncate">
                    {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                )}
                {height > 52 && event.location && (
                  <p className="text-[10px] opacity-60 truncate">{event.location}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
