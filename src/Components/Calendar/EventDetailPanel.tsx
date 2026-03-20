import { Pencil, X, CalendarPlus } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta } from '../../Types/CalendarTypes'
import { HeaderPill, PillButton } from '../HeaderPill'
import { UserAvatar } from '../Settings/UserAvatar'
import { shareSingleEvent } from '../../lib/calendarExport'

interface AssignedPerson {
  id: string
  initials: string
  name: string
  avatarId?: string | null
  firstName?: string | null
  lastName?: string | null
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
  hideHeader?: boolean
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete: _onDelete, assignedNames = [], linkedPropertyItems = [], hideHeader }: EventDetailPanelProps) {
  const cat = getCategoryMeta(event.category)

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 shrink-0">
          <div />
          <HeaderPill>
            <PillButton icon={Pencil} iconSize={16} onClick={() => onEdit(event.id)} label="Edit" />
            <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
          </HeaderPill>
        </div>
      )}

      <div className={`${hideHeader ? '' : 'flex-1 overflow-y-auto'} px-4 py-4 space-y-4`}>
        {/* Event card */}
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${cat.color}`} />
            <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{cat.label}</span>
          </div>

          <h2 className="text-lg font-bold text-primary">{event.title}</h2>

          <div className="space-y-2 text-sm">
            <p className="text-primary">
              {formatDateTime(event.start_time, event.all_day)}
              {!event.all_day && (
                <span className="text-tertiary"> — {formatDateTime(event.end_time, false)}</span>
              )}
            </p>

            {event.location && (
              <p className="text-secondary">{event.location}</p>
            )}

            {event.uniform && (
              <p className="text-secondary">{event.uniform}</p>
            )}

            {event.report_time && (
              <p className="text-secondary">Report: {event.report_time}</p>
            )}
          </div>

          {event.description && (
            <div className="pt-3 border-t border-primary/8">
              <p className="text-sm text-secondary whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>

        {/* Personnel card */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Personnel</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
              {assignedNames.length}
            </span>
          </div>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {assignedNames.length === 0 ? (
              <p className="text-sm text-tertiary px-4 py-4">Unassigned</p>
            ) : (
              assignedNames.map((person) => (
                <div key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar
                    avatarId={person.avatarId}
                    firstName={person.firstName}
                    lastName={person.lastName}
                    className="w-10 h-10"
                  />
                  <span className="text-sm font-medium text-primary">{person.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Equipment card */}
        {linkedPropertyItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Equipment</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                {linkedPropertyItems.length}
              </span>
            </div>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {linkedPropertyItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{item.name}</p>
                    {item.nsn && <p className="text-[10px] text-tertiary">{item.nsn}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add to phone calendar */}
        <button
          onClick={() => shareSingleEvent(event).catch(() => {})}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-themeblue3/20 bg-themewhite2 text-sm font-medium text-themeblue3 active:scale-95 transition-all duration-200"
        >
          <CalendarPlus className="w-4 h-4" />
          Add to Phone Calendar
        </button>

        <div className="h-16 shrink-0" />
      </div>
    </div>
  )
}
