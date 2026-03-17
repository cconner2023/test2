import { useMemo } from 'react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, DAY_START_HOUR, DAY_END_HOUR } from '../../Types/CalendarTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { getInitials } from '../../Utilities/nameUtils'

interface TroopsToTaskViewProps {
  date: Date
  events: CalendarEvent[]
  medics: ClinicMedic[]
  onSelectEvent: (id: string) => void
  onAssign: (eventId: string, userId: string) => void
  onUnassign: (eventId: string, userId: string) => void
}

const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR
const HOUR_COL_WIDTH = 80
const NAME_COL_WIDTH = 180

function formatName(m: ClinicMedic): string {
  const parts: string[] = []
  if (m.rank) parts.push(m.rank)
  if (m.lastName) {
    let name = m.lastName
    if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

function getBlockStyle(event: CalendarEvent, dateKey: string, nameWidth: number) {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

  let startMin = start.getHours() * 60 + start.getMinutes()
  let endMin = end.getHours() * 60 + end.getMinutes()

  if (start.toISOString().slice(0, 10) < dateKey) startMin = DAY_START_HOUR * 60
  if (end.toISOString().slice(0, 10) > dateKey) endMin = DAY_END_HOUR * 60

  startMin = Math.max(startMin, DAY_START_HOUR * 60)
  endMin = Math.min(endMin, DAY_END_HOUR * 60)

  const dayStartMin = DAY_START_HOUR * 60
  const left = nameWidth + ((startMin - dayStartMin) / 60) * HOUR_COL_WIDTH
  const width = Math.max(((endMin - startMin) / 60) * HOUR_COL_WIDTH, 30)

  return { left, width }
}

export function TroopsToTaskView({ date, events, medics, onSelectEvent }: TroopsToTaskViewProps) {
  const dateKey = date.toISOString().slice(0, 10)
  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i), [])
  const nameWidth = NAME_COL_WIDTH
  const totalWidth = nameWidth + TOTAL_HOURS * HOUR_COL_WIDTH

  const timedEvents = useMemo(() =>
    events.filter(e => !e.all_day),
    [events]
  )

  const medicAssignments = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const medic of medics) {
      map.set(medic.id, [])
    }
    for (const event of timedEvents) {
      for (const userId of event.assigned_to) {
        const existing = map.get(userId) ?? []
        existing.push(event)
        map.set(userId, existing)
      }
    }
    return map
  }, [medics, timedEvents])

  const unassignedEvents = useMemo(() =>
    timedEvents.filter(e => e.assigned_to.length === 0),
    [timedEvents]
  )

  const MIN_ROW_HEIGHT = 64

  return (
    <div className="h-full min-w-0 overflow-auto">
      <div className="grid min-h-full" style={{ minWidth: totalWidth, gridTemplateRows: `auto repeat(${medics.length + (unassignedEvents.length > 0 ? 1 : 0)}, 1fr) auto` }}>
          {/* Time header */}
          <div className="sticky top-0 z-10 flex items-end backdrop-blur-xs bg-transparent border-b border-primary/10">
            <div className="shrink-0 border-r border-primary/10 px-2 py-1.5" style={{ width: NAME_COL_WIDTH }}>
              <span className="text-[10px] font-semibold text-tertiary/50 uppercase">Personnel</span>
            </div>
            {hours.map(h => (
              <div key={h} className="border-r border-primary/5 px-1 py-1.5" style={{ width: HOUR_COL_WIDTH }}>
                <span className="text-[10px] font-mono text-tertiary/40">
                  {String(h).padStart(2, '0')}00
                </span>
              </div>
            ))}
          </div>

          {/* Personnel rows */}
          {medics.map(medic => {
            const assignments = medicAssignments.get(medic.id) ?? []
            return (
              <div key={medic.id} className="relative flex border-b border-primary/5" style={{ minHeight: MIN_ROW_HEIGHT }}>
                <div className="sticky left-0 z-[5] shrink-0 flex items-center gap-3 px-3 border-r border-primary/10 bg-themewhite3" style={{ width: NAME_COL_WIDTH }}>
                  <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center text-sm font-semibold text-secondary shrink-0">
                    {getInitials(medic.firstName, medic.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{formatName(medic)}</p>
                    {medic.credential && (
                      <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative">
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-r border-primary/5"
                      style={{ left: (h - DAY_START_HOUR) * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                    />
                  ))}

                  {assignments.map(event => {
                    const { left, width } = getBlockStyle(event, dateKey, nameWidth)
                    const adjustedLeft = left - nameWidth
                    return (
                      <button
                        key={event.id}
                        onClick={() => onSelectEvent(event.id)}
                        className={`absolute top-1 bottom-1 rounded border text-left px-1.5 overflow-hidden transition-all duration-150 active:scale-[0.98] ${CATEGORY_BG_MAP[event.category]}`}
                        style={{ left: adjustedLeft, width }}
                      >
                        <p className="text-[10px] font-semibold truncate leading-tight">{event.title}</p>
                        {width > 60 && (
                          <p className="text-[9px] opacity-60 truncate">
                            {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Unassigned events row */}
          {unassignedEvents.length > 0 && (
            <div className="relative flex border-b border-primary/5 bg-themeredred/3" style={{ minHeight: MIN_ROW_HEIGHT }}>
              <div className="sticky left-0 z-[5] shrink-0 flex items-center gap-2 px-2 border-r border-primary/10 bg-themeredred/5" style={{ width: NAME_COL_WIDTH }}>
                <span className="text-[10px] font-semibold text-themeredred">UNASSIGNED</span>
              </div>
              <div className="flex-1 relative">
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-r border-primary/5"
                    style={{ left: (h - DAY_START_HOUR) * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                  />
                ))}
                {unassignedEvents.map(event => {
                  const { left, width } = getBlockStyle(event, dateKey, nameWidth)
                  const adjustedLeft = left - nameWidth
                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent(event.id)}
                      className="absolute top-1 bottom-1 rounded border-2 border-dashed px-1.5 overflow-hidden transition-all duration-150 active:scale-[0.98] border-themeredred/30 bg-themeredred/5 text-themeredred"
                      style={{ left: adjustedLeft, width }}
                    >
                      <p className="text-[10px] font-semibold truncate leading-tight">{event.title}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Bottom padding so last row can scroll above the island */}
          <div className="h-20" />
      </div>
    </div>
  )
}
