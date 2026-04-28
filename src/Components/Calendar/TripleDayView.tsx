import { useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, STATUS_META, DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT_PX, toDateKey, eventFallsOnDate, formatShortDayLabel } from '../../Types/CalendarTypes'
import { formatHour, getEventPosition, resolveOverlaps } from './timeGrid'

interface TripleDayViewProps {
  date: Date
  events: CalendarEvent[]
  onSelectEvent: (id: string) => void
  onEventContextMenu?: (eventId: string, x: number, y: number) => void
  onDayContextMenu?: (dateKey: string, x: number, y: number) => void
  onPrevDay?: () => void
  onNextDay?: () => void
  onDateTap?: () => void
}

const TIME_GUTTER_WIDTH = 48

interface ColumnData {
  date: Date
  dateKey: string
  label: string
  isToday: boolean
  allDay: CalendarEvent[]
  positioned: ReturnType<typeof resolveOverlaps>
}

export function TripleDayView({ date, events, onSelectEvent, onEventContextMenu, onDayContextMenu, onPrevDay, onNextDay, onDateTap }: TripleDayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const hours = useMemo(() => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i), [])
  const totalHeight = hours.length * HOUR_HEIGHT_PX
  const todayKey = useMemo(() => toDateKey(new Date()), [])

  const columns = useMemo<ColumnData[]>(() => {
    const offsets = [-1, 0, 1]
    return offsets.map(offset => {
      const d = new Date(date)
      d.setDate(d.getDate() + offset)
      const dateKey = toDateKey(d)
      const dayEvents = events.filter(e => eventFallsOnDate(e, dateKey))
      return {
        date: d,
        dateKey,
        label: formatShortDayLabel(d),
        isToday: dateKey === todayKey,
        allDay: dayEvents.filter(e => e.all_day),
        positioned: resolveOverlaps(dayEvents, dateKey),
      }
    })
  }, [date, events, todayKey])

  const nowMarkerTop = useMemo(() => {
    const now = new Date()
    const nowKey = toDateKey(now)
    const colIndex = columns.findIndex(c => c.dateKey === nowKey)
    if (colIndex === -1) return null
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes < DAY_START_HOUR * 60 || minutes > DAY_END_HOUR * 60) return null
    return {
      top: ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX,
      colIndex,
    }
  }, [columns])

  // Auto-scroll: to current time if today is visible, else 0600
  useEffect(() => {
    if (!scrollRef.current) return
    const visibleToday = columns.some(c => c.dateKey === todayKey)
    const now = new Date()
    const scrollToHour = visibleToday ? Math.max(0, now.getHours() - 1) : 6
    scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT_PX
  }, [columns, todayKey])

  const maxAllDay = Math.max(0, ...columns.map(c => c.allDay.length))

  return (
    <div data-tour="calendar-triple-day-view" className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-themewhite3">
          {(onPrevDay && onNextDay) ? (
            <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
              <button
                onClick={onPrevDay}
                className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onDateTap}
                className="text-[10pt] font-medium text-tertiary uppercase tracking-wider hover:text-primary transition-colors active:scale-95"
              >
                {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </button>
              <button
                onClick={onNextDay}
                className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          <div
            className="grid border-b border-primary/10"
            style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(3, minmax(0, 1fr))` }}
          >
            <div />
            {columns.map(col => (
              <div
                key={col.dateKey}
                className={`text-center text-[10pt] font-medium py-2 border-l border-primary/10 ${
                  col.isToday ? 'text-themeblue3 bg-themeblue3/5' : 'text-tertiary'
                }`}
              >
                {col.label}
              </div>
            ))}
          </div>
          {maxAllDay > 0 && (
            <div
              className="grid border-b border-primary/10"
              style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(3, minmax(0, 1fr))` }}
            >
              <div />
              {columns.map(col => (
                <div key={col.dateKey} className="px-1 py-1 space-y-1 border-l border-primary/10 min-h-[28px]">
                  {col.allDay.map(e => (
                    <button
                      key={e.id}
                      onClick={() => onSelectEvent(e.id)}
                      onContextMenu={(ev) => {
                        if (onEventContextMenu) {
                          ev.preventDefault()
                          onEventContextMenu(e.id, ev.clientX, ev.clientY)
                        }
                      }}
                      className={`w-full text-left text-[9pt] font-normal px-1.5 py-0.5 rounded border ${CATEGORY_BG_MAP[e.category]} ${STATUS_META[e.status].opacity} active:scale-95 transition-all duration-200 truncate ${STATUS_META[e.status].strikethrough ? 'line-through' : ''}`}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(3, minmax(0, 1fr))`,
            height: totalHeight,
          }}
        >
          {/* Time gutter */}
          <div className="relative">
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute left-2 text-[9pt] font-mono text-tertiary bg-themewhite3 px-0.5"
                style={{ top: i * HOUR_HEIGHT_PX - 6 }}
              >
                {formatHour(h)}
              </span>
            ))}
          </div>

          {/* Columns */}
          {columns.map((col, ci) => (
            <div
              key={col.dateKey}
              className="relative border-l border-primary/10"
              onContextMenu={(e) => {
                if (onDayContextMenu) {
                  e.preventDefault()
                  onDayContextMenu(col.dateKey, e.clientX, e.clientY)
                }
              }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-primary/5"
                  style={{ top: i * HOUR_HEIGHT_PX }}
                />
              ))}

              {nowMarkerTop && nowMarkerTop.colIndex === ci && (
                <div className="absolute left-0 right-2 z-20" style={{ top: nowMarkerTop.top }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-themeredred shrink-0" />
                    <div className="flex-1 h-px bg-themeredred" />
                  </div>
                </div>
              )}

              {col.positioned.map(({ event, top, height, col: lane, totalCols }) => {
                const leftPct = (lane / totalCols) * 100
                const widthPct = 100 / totalCols - 1
                const sm = STATUS_META[event.status]
                return (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectEvent(event.id)}
                    onContextMenu={(e) => {
                      if (onEventContextMenu) {
                        e.preventDefault()
                        onEventContextMenu(event.id, e.clientX, e.clientY)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectEvent(event.id)
                    }}
                    className={`absolute rounded-lg border px-1.5 py-0.5 overflow-hidden text-left select-none cursor-pointer transition-all duration-200 active:scale-[0.98]
                      ${CATEGORY_BG_MAP[event.category]} ${sm.opacity}`}
                    style={{
                      top,
                      height: Math.max(height, 24),
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                  >
                    {sm.pulse && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-themeblue1 animate-pulse shrink-0" />
                    )}
                    <p className={`text-[9pt] font-normal truncate leading-tight ${sm.strikethrough ? 'line-through opacity-70' : ''}`}>
                      {event.title}
                    </p>
                    {height > 32 && (
                      <p className="text-[8pt] opacity-70 truncate">
                        {new Date(event.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
