import { ArrowLeft, Pencil, Trash2, Clock, MapPin, Shirt, AlertTriangle } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta } from '../../Types/CalendarTypes'

interface EventDetailPanelProps {
  event: CalendarEvent
  onBack: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function EventDetailPanel({ event, onBack, onEdit, onDelete }: EventDetailPanelProps) {
  const cat = getCategoryMeta(event.category)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(event.id)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all duration-200"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Category badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-2.5 w-2.5 rounded-full ${cat.color}`} />
          <span className="text-xs font-medium text-tertiary uppercase">{cat.label}</span>
          {event.status === 'cancelled' && (
            <span className="text-[10px] font-medium text-themeredred bg-themeredred/10 rounded px-1.5 py-0.5">
              CANCELLED
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-primary mb-4">{event.title}</h2>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-tertiary mt-0.5 shrink-0" />
            <div className="text-sm text-primary">
              <p>{formatDateTime(event.start_time, event.all_day)}</p>
              {!event.all_day && (
                <p className="text-tertiary">to {formatDateTime(event.end_time, false)}</p>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-tertiary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">{event.location}</p>
            </div>
          )}

          {event.uniform && (
            <div className="flex items-start gap-3">
              <Shirt size={16} className="text-tertiary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">{event.uniform}</p>
            </div>
          )}

          {event.report_time && (
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-tertiary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">Report: {event.report_time}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="mt-5 pt-4 border-t border-primary/10">
            <p className="text-xs font-medium text-tertiary uppercase mb-2">Notes</p>
            <p className="text-sm text-secondary whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
