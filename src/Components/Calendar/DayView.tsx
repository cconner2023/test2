import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta, STATUS_META, DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT_PX, toLocalISOString, toDateKey } from '../../Types/CalendarTypes'
import { formatHour, getEventPosition, resolveOverlaps } from './timeGrid'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onSelectEvent: (id: string) => void
  onMoveEvent: (eventId: string, newStartTime: string) => void
  onEventContextMenu?: (eventId: string, x: number, y: number) => void
  onDayContextMenu?: (dateKey: string, x: number, y: number) => void
  /** Mobile day navigation — when provided, renders interactive header */
  onPrevDay?: () => void
  onNextDay?: () => void
  onDateTap?: () => void
}

interface ActiveDrag {
  eventId: string
  startY: number
  currentY: number
  originalTop: number
  scrollOffset: number
}

function minutesToTop(minutes: number): number {
  return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
}

function topToMinutes(top: number): number {
  return (top / HOUR_HEIGHT_PX) * 60 + DAY_START_HOUR * 60
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

function formatSnappedTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}

export function DayView({ date, events, onSelectEvent, onMoveEvent, onEventContextMenu, onDayContextMenu, onPrevDay, onNextDay, onDateTap }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ActiveDrag | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClickRef = useRef(false)
  const touchStartYRef = useRef(0)
  const dayLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [dragTop, setDragTop] = useState(0)
  const [dragEventId, setDragEventId] = useState<string | null>(null)

  const dateKey = toDateKey(date)
  const hours = useMemo(() => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i), [])
  const totalHeight = hours.length * HOUR_HEIGHT_PX

  // Auto-scroll: to current time if today, or 0600 otherwise
  useEffect(() => {
    if (!scrollRef.current) return
    const now = new Date()
    const isToday = now.toISOString().slice(0, 10) === dateKey
    const scrollToHour = isToday ? Math.max(0, now.getHours() - 1) : 6
    scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT_PX
  }, [dateKey])

  const allDayEvents = useMemo(() => events.filter(e => e.all_day), [events])
  const timedEvents = useMemo(() => resolveOverlaps(events, dateKey), [events, dateKey])

  const nowMarkerTop = useMemo(() => {
    const now = new Date()
    if (toDateKey(now) !== dateKey) return null
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes < DAY_START_HOUR * 60 || minutes > DAY_END_HOUR * 60) return null
    return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
  }, [dateKey])

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const hasNav = !!(onPrevDay && onNextDay)

  const snappedMinutes = useMemo(() => {
    if (!isDragging) return 0
    const raw = topToMinutes(dragTop)
    return Math.max(
      DAY_START_HOUR * 60,
      Math.min(DAY_END_HOUR * 60 - 15, snapMinutes(raw))
    )
  }, [isDragging, dragTop])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const endDrag = useCallback(() => {
    cancelLongPress()
    dragRef.current = null
    setIsDragging(false)
    setDragEventId(null)
  }, [cancelLongPress])

  const handleTouchStart = useCallback((eventId: string, originalTop: number, e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartYRef.current = touch.clientY
    const scrollOffset = scrollRef.current?.scrollTop ?? 0

    dragRef.current = {
      eventId,
      startY: touch.clientY,
      currentY: touch.clientY,
      originalTop,
      scrollOffset,
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      if (!dragRef.current) return
      setDragEventId(eventId)
      setDragTop(originalTop)
      setIsDragging(true)
    }, 300)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const dy = Math.abs(touch.clientY - touchStartYRef.current)

    if (longPressTimerRef.current !== null) {
      if (dy > 10) cancelLongPress()
      return
    }

    if (!isDragging || !dragRef.current) return

    e.preventDefault()

    const delta = touch.clientY - dragRef.current.startY
    const newTop = Math.max(0, Math.min(totalHeight - 24, dragRef.current.originalTop + delta))
    dragRef.current.currentY = touch.clientY
    setDragTop(newTop)
  }, [isDragging, totalHeight, cancelLongPress])

  const handleTouchEnd = useCallback(() => {
    cancelLongPress()

    if (!isDragging || !dragRef.current) {
      endDrag()
      return
    }

    const { eventId } = dragRef.current
    const clampedMinutes = Math.max(
      DAY_START_HOUR * 60,
      Math.min(DAY_END_HOUR * 60 - 15, snapMinutes(topToMinutes(dragTop)))
    )

    const newStart = new Date(date)
    newStart.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0)
    const iso = toLocalISOString(newStart)

    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false }, 50)

    onMoveEvent(eventId, iso)
    endDrag()
  }, [isDragging, dragTop, date, onMoveEvent, endDrag, cancelLongPress])

  const handleEventClick = useCallback((eventId: string) => {
    if (suppressClickRef.current) return
    onSelectEvent(eventId)
  }, [onSelectEvent])

  return (
    <div data-tour="calendar-day-view" className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 ${isDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        <div className="sticky top-0 z-10 bg-themewhite3">
          {hasNav ? (
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
                {dateLabel}
              </button>
              <button
                onClick={onNextDay}
                className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="px-3 py-2 text-[10pt] font-medium text-tertiary uppercase tracking-wider border-b border-primary/10">
              {dateLabel}
            </p>
          )}

          {allDayEvents.length > 0 && (
            <div className="px-3 py-2 border-b border-primary/10 space-y-1">
              {allDayEvents.map(e => {
                const cat = getCategoryMeta(e.category)
                const sm = STATUS_META[e.status]
                return (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e.id)}
                    onContextMenu={(ev) => {
                      if (onEventContextMenu) {
                        ev.preventDefault()
                        onEventContextMenu(e.id, ev.clientX, ev.clientY)
                      }
                    }}
                    className={`w-full text-left rounded flex items-stretch gap-1 overflow-hidden bg-primary/5 ${sm.opacity} active:scale-95 transition-all duration-200`}
                  >
                    <div className={`w-0.5 shrink-0 rounded-full ${cat.solidColor}`} />
                    <span className={`flex-1 truncate text-[10pt] text-primary py-1 pr-2 ${sm.strikethrough ? 'line-through' : ''}`}>{e.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div
          className="relative"
          style={{ height: totalHeight }}
          onContextMenu={(e) => {
            if (onDayContextMenu) {
              e.preventDefault()
              onDayContextMenu(dateKey, e.clientX, e.clientY)
            }
          }}
          onTouchStart={(e) => {
            if (!onDayContextMenu) return
            // Only start day long-press if not touching an event (events handle their own)
            if ((e.target as HTMLElement).closest('[role="button"]')) return
            const touch = e.touches[0]
            const lp = { timer: setTimeout(() => {
              lp.fired = true
              onDayContextMenu(dateKey, touch.clientX, touch.clientY)
            }, 500), fired: false }
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
              dayLongPressRef.current = null
            }
          }}
        >
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-primary/5"
              style={{ top: i * HOUR_HEIGHT_PX }}
            >
              <span className="absolute -top-2.5 left-2 text-[9pt] font-mono text-tertiary bg-themewhite3 px-0.5">
                {formatHour(h)}
              </span>
            </div>
          ))}

          {nowMarkerTop !== null && (
            <div className="absolute left-10 right-2 z-20" style={{ top: nowMarkerTop }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-themeredred shrink-0" />
                <div className="flex-1 h-px bg-themeredred" />
              </div>
            </div>
          )}

          {timedEvents.map(({ event, top, height, col, totalCols }) => {
            const leftPct = 12 + (col / totalCols) * 84
            const widthPct = 84 / totalCols - 1
            const isBeingDragged = isDragging && dragEventId === event.id
            const isDimmed = isDragging && dragEventId !== event.id
            const resolvedTop = isBeingDragged ? minutesToTop(snappedMinutes) : top
            const sm = STATUS_META[event.status]
            const cat = getCategoryMeta(event.category)

            return (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEventClick(event.id)}
                onContextMenu={(e) => {
                  if (onEventContextMenu) {
                    e.preventDefault()
                    onEventContextMenu(event.id, e.clientX, e.clientY)
                  }
                }}
                onTouchStart={(e) => handleTouchStart(event.id, top, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEventClick(event.id) }}
                className={`absolute rounded-lg overflow-hidden flex items-stretch gap-1 text-left select-none cursor-pointer bg-primary/5
                  ${isBeingDragged
                    ? 'shadow-xl z-30 scale-[1.02]'
                    : 'transition-all duration-200 active:scale-[0.98]'
                  }
                  ${isDimmed ? 'opacity-50' : sm.opacity}
                `}
                style={{
                  top: resolvedTop,
                  height: Math.max(height, 24),
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  touchAction: isDragging && isBeingDragged ? 'none' : 'auto',
                  transition: isBeingDragged ? 'none' : undefined,
                }}
              >
                <div className={`w-0.5 shrink-0 rounded-full ${cat.solidColor}`} />
                <div className="flex-1 min-w-0 px-1.5 py-1 relative">
                  {sm.pulse && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-themeblue1 animate-pulse shrink-0" />
                  )}
                  <p className={`text-[10pt] font-normal truncate leading-tight text-primary ${sm.strikethrough ? 'line-through opacity-70' : ''}`}>{event.title}</p>
                  {height > 36 && (
                    <p className="text-[9pt] text-tertiary truncate">
                      {new Date(event.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')}
                    </p>
                  )}
                  {height > 52 && event.location && (
                    <p className="text-[9pt] text-tertiary truncate">{event.location}</p>
                  )}
                </div>
              </div>
            )
          })}

          {isDragging && dragEventId !== null && (
            <div
              className="absolute left-2 bg-themeblue3 text-white text-[9pt] font-mono px-1.5 py-0.5 rounded shadow-lg z-30 pointer-events-none"
              style={{ top: minutesToTop(snappedMinutes) - 20 }}
            >
              {formatSnappedTime(snappedMinutes)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
