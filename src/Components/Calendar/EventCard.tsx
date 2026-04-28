import { Clock, MapPin } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta } from '../../Types/CalendarTypes'

interface EventCardProps {
  event: CalendarEvent
  onSelect: (id: string) => void
  onContextMenu?: (eventId: string, x: number, y: number) => void
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return 'All day'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function EventCard({ event, onSelect, onContextMenu }: EventCardProps) {
  const cat = getCategoryMeta(event.category)

  return (
    <button
      onClick={() => onSelect(event.id)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault()
          onContextMenu(event.id, e.clientX, e.clientY)
        }
      }}
      className="w-full text-left rounded-xl border border-primary/10 bg-themewhite p-3 transition-all duration-200 hover:border-primary/20 active:scale-95"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${cat.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{event.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[10pt] text-tertiary">
              <Clock size={12} />
              {formatTime(event.start_time, event.all_day)}
              {!event.all_day && (
                <> – {formatTime(event.end_time, false)}</>
              )}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 text-[10pt] text-tertiary truncate">
                <MapPin size={12} />
                {event.location}
              </span>
            )}
          </div>
          {event.status === 'in_progress' && (
            <span className="inline-block mt-1 text-[9pt] font-semibold text-themeblue1 bg-themeblue1/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
              Active
            </span>
          )}
          {event.status === 'completed' && (
            <span className="inline-block mt-1 text-[9pt] font-semibold text-themegreen bg-themegreen/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
              Done
            </span>
          )}
          {event.status === 'cancelled' && (
            <span className="inline-block mt-1 text-[9pt] font-semibold text-themeredred bg-themeredred/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
              Cancelled
            </span>
          )}
        </div>
        <span className="text-[9pt] font-medium text-tertiary uppercase shrink-0">
          {cat.label}
        </span>
      </div>
    </button>
  )
}
