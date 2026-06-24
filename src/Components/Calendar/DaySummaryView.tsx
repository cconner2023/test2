import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, MapPin, ListChecks, CalendarOff } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { STATUS_META, toDateKey } from '../../Types/CalendarTypes'
import { useCategoryColors } from '../../Hooks/useCategoryColors'
import { snapshotHtml } from './menuPress'

interface DaySummaryViewProps {
  date: Date
  /** Events already filtered to this day and sorted by start_time (CalendarPanel.dayEvents). */
  events: CalendarEvent[]
  /** Resolve assignee ids → display records (CalendarPanel.resolveAssigned). */
  resolveAssigned: (ids: string[]) => { id: string; name: string }[]
  onSelectEvent: (id: string) => void
  onEventContextMenu?: (eventId: string, rect: DOMRect, html: string) => void
  onDayContextMenu?: (dateKey: string, rect: DOMRect) => void
  /** Mobile day navigation — when provided, renders the interactive header (mirrors DayView). */
  onPrevDay?: () => void
  onNextDay?: () => void
  onDateTap?: () => void
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Time-of-day bucket for grouping timed events into a readable huddle flow. */
function bucketOf(iso: string): 0 | 1 | 2 {
  const h = new Date(iso).getHours()
  if (h < 12) return 0
  if (h < 17) return 1
  return 2
}
const BUCKET_LABEL = ['Morning', 'Afternoon', 'Evening'] as const

/**
 * Day Summary — the flat, chronological agenda read-out for a single day (the
 * "huddle" view). Unlike DayView's spatial timeline, every event is a full-width
 * row carrying time · title · location · assignees · task progress, so a
 * supervisor can read the day top-to-bottom without anything getting cramped or
 * hidden behind an overlap. Reached via the Day pill → Summary option.
 */
export function DaySummaryView({
  date, events, resolveAssigned,
  onSelectEvent, onEventContextMenu, onDayContextMenu,
  onPrevDay, onNextDay, onDateTap,
}: DaySummaryViewProps) {
  const { resolve: resolveCategoryColor } = useCategoryColors()
  const dateKey = toDateKey(date)
  const hasNav = !!(onPrevDay && onNextDay)

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const allDay = useMemo(() => events.filter(e => e.all_day), [events])
  const timed = useMemo(() => events.filter(e => !e.all_day), [events])

  // Group timed events by time-of-day bucket, preserving the incoming chronological order.
  const timedBuckets = useMemo(() => {
    const groups: { label: string; items: CalendarEvent[] }[] = []
    for (const b of [0, 1, 2] as const) {
      const items = timed.filter(e => bucketOf(e.start_time) === b)
      if (items.length) groups.push({ label: BUCKET_LABEL[b], items })
    }
    return groups
  }, [timed])

  const renderRow = (event: CalendarEvent) => {
    const sm = STATUS_META[event.status]
    const assigned = resolveAssigned(event.assigned_to).map(a => a.name)
    const subs = event.subtasks ?? []
    const doneCount = subs.filter(s => !!s.done_at).length
    const timeText = event.all_day ? 'All day' : `${fmtTime(event.start_time)} – ${fmtTime(event.end_time)}`

    return (
      <button
        key={event.id}
        onClick={() => onSelectEvent(event.id)}
        onContextMenu={(ev) => {
          if (onEventContextMenu) {
            ev.preventDefault()
            ev.stopPropagation()
            onEventContextMenu(event.id, ev.currentTarget.getBoundingClientRect(), snapshotHtml(ev.currentTarget))
          }
        }}
        className={`w-full text-left flex items-stretch gap-2.5 px-3 py-2.5 rounded-xl bg-themewhite2 active:scale-[0.99] transition-all duration-150 ${sm.opacity}`}
      >
        <div className={`w-1 shrink-0 rounded-full ${resolveCategoryColor(event.category, event.color).solid}`} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[10pt] text-tertiary tabular-nums">{timeText}</span>
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold text-primary ${sm.strikethrough ? 'line-through' : ''}`}>
              {event.title || 'Untitled event'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10pt] text-tertiary">
              {event.location && (
                <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{event.location}</span>
                </span>
              )}
              <span className="min-w-0 max-w-full truncate">
                {assigned.length > 0 ? assigned.join(', ') : 'Unassigned'}
              </span>
              {subs.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListChecks size={11} className="shrink-0" />
                  <span>{doneCount} of {subs.length} done</span>
                </span>
              )}
            </div>
        </div>
      </button>
    )
  }

  return (
    <div data-tour="calendar-summary-view" className="flex flex-col h-full">
      {/* Sticky header — mirrors DayView for cross-view consistency */}
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
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 pb-24"
        onContextMenu={(e) => {
          if (onDayContextMenu) {
            e.preventDefault()
            onDayContextMenu(dateKey, e.currentTarget.getBoundingClientRect())
          }
        }}
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-tertiary">
            <CalendarOff className="w-6 h-6" />
            <p className="text-sm">No events scheduled</p>
          </div>
        ) : (
          <>
            {allDay.length > 0 && (
              <section className="space-y-1.5">
                <p className="px-1 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">All day</p>
                <div className="space-y-1.5">{allDay.map(renderRow)}</div>
              </section>
            )}
            {timedBuckets.map(group => (
              <section key={group.label} className="space-y-1.5">
                <p className="px-1 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{group.label}</p>
                <div className="space-y-1.5">{group.items.map(renderRow)}</div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
