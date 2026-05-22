import { useMemo } from 'react'
import { Calendar as CalendarIcon, Check } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { useCalendarStore } from '../../stores/useCalendarStore'
import type { CalendarEvent } from '../../Types/CalendarTypes'

interface OverlayEventPickerProps {
  isOpen: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  /** Currently linked event (if any) — shown with an active ring; selecting it is a no-op. (Single-pick mode.) */
  currentEventId?: string | null
  /** Called with the chosen event. Caller is responsible for writing the link. (Single-pick mode.) */
  onPick?: (event: CalendarEvent) => void
  /**
   * Multi-pick mode: when provided, picker stays open after a tap and renders
   * each row as a toggle reflecting whether the event id is in this set.
   * Mutually exclusive with onPick — caller picks one mode.
   */
  linkedEventIds?: Set<string>
  /** Multi-pick mode: called with (event, willLink) on each toggle. */
  onToggle?: (event: CalendarEvent, willLink: boolean) => void
  /** Multi-pick mode: replaces the popover title (defaults to "Link to event"). */
  title?: string
  /** Container the popover should be scoped to (typically the map drawer). */
  containerRef?: React.RefObject<HTMLElement | null>
  /** Z bump when launching inside another overlay. */
  zIndex?: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatWhen(startIso: string): string {
  const start = new Date(startIso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)
  const deltaDays = Math.round((startDay.getTime() - today.getTime()) / MS_PER_DAY)
  const time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (deltaDays === 0) return `Today · ${time}`
  if (deltaDays === 1) return `Tomorrow · ${time}`
  if (deltaDays === -1) return `Yesterday · ${time}`
  const date = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${date} · ${time}`
}

export function OverlayEventPicker({
  isOpen,
  onClose,
  anchorRect,
  currentEventId,
  onPick,
  linkedEventIds,
  onToggle,
  title,
  containerRef,
  zIndex,
}: OverlayEventPickerProps) {
  const isMulti = !!linkedEventIds && !!onToggle
  const events = useCalendarStore(s => s.events)

  // Future + recent past (last 7 days) — upcoming first, then recent past below.
  const candidates = useMemo(() => {
    const cutoff = Date.now() - 7 * MS_PER_DAY
    return events
      .filter(e => new Date(e.start_time).getTime() >= cutoff)
      .sort((a, b) => {
        const aFuture = new Date(a.start_time).getTime() >= Date.now()
        const bFuture = new Date(b.start_time).getTime() >= Date.now()
        if (aFuture && !bFuture) return -1
        if (!aFuture && bFuture) return 1
        return a.start_time.localeCompare(b.start_time)
      })
  }, [events])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title={title ?? (isMulti ? 'Linked events' : 'Link to event')}
      maxWidth={360}
      searchPlaceholder="Search events…"
      containerRef={containerRef}
      zIndex={zIndex}
      preview={(filter) => {
        const q = filter.trim().toLowerCase()
        const filtered = q
          ? candidates.filter(e =>
              e.title.toLowerCase().includes(q)
              || e.category.toLowerCase().includes(q)
              || (e.location ?? '').toLowerCase().includes(q))
          : candidates

        if (filtered.length === 0) {
          return (
            <div className="px-4 py-6 text-center text-[10pt] text-tertiary">
              {q ? 'No events match' : 'No upcoming or recent events'}
            </div>
          )
        }

        return (
          <ul className="flex flex-col">
            {filtered.map(e => {
              const isLinked = isMulti
                ? linkedEventIds!.has(e.id)
                : e.id === currentEventId
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMulti) {
                        onToggle!(e, !isLinked)
                      } else if (onPick) {
                        onPick(e); onClose()
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-primary/6 last:border-0 active:scale-[0.99] transition-all ${isLinked ? 'bg-themeblue3/8' : 'hover:bg-secondary/5'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isLinked ? 'bg-themeblue3 text-themewhite' : 'bg-themewhite2 text-tertiary'}`}>
                      <CalendarIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10pt] font-medium text-primary truncate">{e.title || 'Untitled'}</div>
                      <div className="text-[9pt] text-tertiary truncate">
                        {formatWhen(e.start_time)} · {e.category}
                      </div>
                    </div>
                    {isMulti && isLinked && (
                      <Check size={14} className="text-themeblue3 shrink-0" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      }}
    />
  )
}
