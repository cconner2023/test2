import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT_PX, toLocalISOString, toDateKey } from '../../Types/CalendarTypes'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onSelectEvent: (id: string) => void
  onMoveEvent: (eventId: string, newStartTime: string) => void
}

interface ActiveDrag {
  eventId: string
  startY: number
  currentY: number
  originalTop: number
  scrollOffset: number
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}00`
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

function getEventPosition(event: CalendarEvent, dateKey: string) {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

  // Use local date from stored strings (they're already local ISO, no Z suffix)
  const startDateKey = event.start_time.slice(0, 10)
  const endDateKey = event.end_time.slice(0, 10)

  let startMinutes = start.getHours() * 60 + start.getMinutes()
  let endMinutes = end.getHours() * 60 + end.getMinutes()

  // Clamp multi-day events to the visible day
  if (startDateKey < dateKey) startMinutes = DAY_START_HOUR * 60
  if (endDateKey > dateKey) endMinutes = DAY_END_HOUR * 60

  // Handle same-day events where end is midnight (0:00) — treat as end of day
  if (endDateKey === dateKey && endMinutes === 0 && startMinutes > 0) endMinutes = DAY_END_HOUR * 60

  startMinutes = Math.max(startMinutes, DAY_START_HOUR * 60)
  endMinutes = Math.min(endMinutes, DAY_END_HOUR * 60)

  const top = ((startMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX, 24)

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

export function DayView({ date, events, onSelectEvent, onMoveEvent }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ActiveDrag | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClickRef = useRef(false)
  const touchStartYRef = useRef(0)

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
    <div className="flex flex-col h-full">
      {/* Spacer for mobile floating header */}
      <div className="h-[calc(var(--sat,0px)+3.5rem)] md:hidden shrink-0" />
      <p className="px-3 py-2 text-xs font-medium text-tertiary/50 uppercase tracking-wider border-b border-primary/10">
        {dateLabel}
      </p>

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

      <div
        ref={scrollRef}
        className={`flex-1 ${isDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        <div className="relative" style={{ height: totalHeight }}>
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

            return (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEventClick(event.id)}
                onTouchStart={(e) => handleTouchStart(event.id, top, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEventClick(event.id) }}
                className={`absolute rounded-lg border px-2 py-1 overflow-hidden text-left select-none cursor-pointer
                  ${CATEGORY_BG_MAP[event.category]}
                  ${isBeingDragged
                    ? 'shadow-xl z-30 scale-[1.02]'
                    : 'transition-all duration-200 active:scale-[0.98]'
                  }
                  ${isDimmed ? 'opacity-50' : 'opacity-100'}
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
                <p className="text-xs font-semibold truncate leading-tight">{event.title}</p>
                {height > 36 && (
                  <p className="text-[10px] opacity-70 truncate">
                    {new Date(event.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')}
                  </p>
                )}
                {height > 52 && event.location && (
                  <p className="text-[10px] opacity-60 truncate">{event.location}</p>
                )}
              </div>
            )
          })}

          {isDragging && dragEventId !== null && (
            <div
              className="absolute left-2 bg-themeblue3 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-lg z-30 pointer-events-none"
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
