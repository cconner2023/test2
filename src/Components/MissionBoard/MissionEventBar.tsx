import { Package } from 'lucide-react'
import type { CalendarEvent, EventCategory } from '../../Types/CalendarTypes'

const CATEGORY_STRIPE: Record<EventCategory, string> = {
  training: 'bg-themeyellow',
  duty: 'bg-themeredred',
  range: 'bg-themeblue2',
  appointment: 'bg-themeblue1',
  mission: 'bg-themegreen',
  other: 'bg-tertiary/50',
}

interface MissionEventBarProps {
  event: CalendarEvent
  isAssigned: boolean
  width: number
  left: number
  top: number
  height: number
  onClick: () => void
}

export function MissionEventBar({ event, isAssigned, width, left, top, height, onClick }: MissionEventBarProps) {
  const stripe = CATEGORY_STRIPE[event.category]
  const isCompleted = event.status === 'completed' || event.status === 'cancelled'
  const isActive = event.status === 'in_progress'

  return (
    <button
      className={`absolute flex items-stretch rounded overflow-hidden text-left active:scale-[0.98] transition-opacity ${
        isCompleted ? 'opacity-40' : 'opacity-100'
      } ${isAssigned ? 'ring-2 ring-themeblue1 ring-inset' : ''}`}
      style={{ left, top, width: Math.max(width - 2, 36), height }}
      onClick={onClick}
    >
      <div className={`w-1 shrink-0 ${stripe} ${isActive ? 'animate-pulse' : ''}`} />
      <div className={`flex-1 min-w-0 px-1.5 flex flex-col justify-center gap-px border-y border-r border-themeblue3/10 ${isAssigned ? 'bg-themeblue1/8' : 'bg-themewhite2'}`}>
        <span className="text-[11px] font-medium text-primary truncate leading-none">
          {event.title}
        </span>
        {(event.location || event.property_item_ids.length > 0) && (
          <span className="flex items-center gap-1 text-[9px] text-secondary truncate leading-none">
            {event.location && (
              <span className="truncate">{event.location}</span>
            )}
            {event.property_item_ids.length > 0 && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Package size={8} />
                {event.property_item_ids.length}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  )
}
