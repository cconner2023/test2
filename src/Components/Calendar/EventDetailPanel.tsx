import { Pencil, X, Clock, MapPin, Shirt, AlertTriangle, Users, Package } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta } from '../../Types/CalendarTypes'
import { HeaderPill, PillButton } from '../HeaderPill'

interface AssignedPerson {
  id: string
  initials: string
  name: string
}

interface LinkedPropertyItem {
  id: string
  name: string
  nsn: string | null
}

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  assignedNames?: AssignedPerson[]
  linkedPropertyItems?: LinkedPropertyItem[]
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete: _onDelete, assignedNames = [], linkedPropertyItems = [] }: EventDetailPanelProps) {
  const cat = getCategoryMeta(event.category)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
        <div />
        <HeaderPill>
          <PillButton icon={Pencil} iconSize={16} onClick={() => onEdit(event.id)} label="Edit" />
          <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
        </HeaderPill>
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

          {/* Assigned To */}
          <div className="flex items-start gap-3">
            <Users size={16} className="text-tertiary mt-0.5 shrink-0" />
            {assignedNames.length === 0 ? (
              <p className="text-sm text-tertiary">Unassigned</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {assignedNames.map((person) => (
                  <div key={person.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-themeblue3 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {person.initials}
                    </div>
                    <span className="text-sm text-primary">{person.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Linked Equipment */}
        {linkedPropertyItems.length > 0 && (
          <div className="mt-5 pt-4 border-t border-primary/10">
            <p className="text-xs font-medium text-tertiary uppercase mb-2">Equipment</p>
            <div className="space-y-1.5">
              {linkedPropertyItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/5">
                  <Package size={16} className="text-tertiary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-primary truncate">{item.name}</p>
                    {item.nsn && <p className="text-[10px] text-tertiary">{item.nsn}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
