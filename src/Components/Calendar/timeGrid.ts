import type { CalendarEvent } from '../../Types/CalendarTypes'
import { DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT_PX } from '../../Types/CalendarTypes'

export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}00`
}

export function getEventPosition(event: CalendarEvent, dateKey: string) {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const startDateKey = event.start_time.slice(0, 10)
  const endDateKey = event.end_time.slice(0, 10)

  let startMinutes = start.getHours() * 60 + start.getMinutes()
  let endMinutes = end.getHours() * 60 + end.getMinutes()

  if (startDateKey < dateKey) startMinutes = DAY_START_HOUR * 60
  if (endDateKey > dateKey) endMinutes = DAY_END_HOUR * 60
  if (endDateKey === dateKey && endMinutes === 0 && startMinutes > 0) endMinutes = DAY_END_HOUR * 60

  startMinutes = Math.max(startMinutes, DAY_START_HOUR * 60)
  endMinutes = Math.min(endMinutes, DAY_END_HOUR * 60)

  const top = ((startMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX, 24)
  return { top, height }
}

export interface PositionedEvent {
  event: CalendarEvent
  top: number
  height: number
  col: number
  totalCols: number
}

export function resolveOverlaps(events: CalendarEvent[], dateKey: string): PositionedEvent[] {
  const positioned = events
    .filter(e => !e.all_day)
    .map(e => ({ event: e, ...getEventPosition(e, dateKey) }))
    .sort((a, b) => a.top - b.top)

  const columns: PositionedEvent[] = []
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
