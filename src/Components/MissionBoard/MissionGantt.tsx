import { useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, Play, CheckCircle2, Ban } from 'lucide-react'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { toDateKey, eventFallsOnDate } from '../../Types/CalendarTypes'
import type { CalendarEvent, EventCategory, EventStatus } from '../../Types/CalendarTypes'
import { MissionEventBar } from './MissionEventBar'
import { DatePickerCalendar } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useLongPress } from '../../Hooks/useLongPress'

// ─── Gantt constants ────────────────────────────────────────────────────────

const HOUR_WIDTH = 76
const EVENT_HEIGHT = 44
const EVENT_GAP = 6
const EVENT_ROW_HEIGHT = EVENT_HEIGHT + EVENT_GAP
const AXIS_HEIGHT = 28
const BODY_PAD_TOP = 2
const BODY_PAD_BOTTOM = 34  // clears the Open Calendar button
const DEFAULT_START = 6
const DEFAULT_END = 22

// ─── Task list constants ─────────────────────────────────────────────────────

const CATEGORY_STRIPE: Record<EventCategory, string> = {
  training: 'bg-themeyellow',
  duty:     'bg-themeredred',
  range:    'bg-themeblue2',
  appointment: 'bg-themeblue1',
  mission:  'bg-themegreen',
  other:    'bg-tertiary/50',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToHour(iso: string): number {
  const [h, m] = iso.slice(11, 16).split(':').map(Number)
  return h + m / 60
}

function formatHour(h: number): string {
  const hour = h % 24
  if (hour === 0) return '12AM'
  if (hour === 12) return '12PM'
  return hour > 12 ? `${hour - 12}PM` : `${hour}AM`
}

function formatTimeRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [h, m] = iso.slice(11, 16).split(':').map(Number)
    const hour = h % 24
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

function offsetDate(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function assignLanes(events: CalendarEvent[]): number[] {
  const sorted = [...events]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time))
  const laneEnds: number[] = []
  const result = new Array<number>(events.length)
  for (const { e, i } of sorted) {
    const start = timeToHour(e.start_time)
    let lane = laneEnds.findIndex(end => end <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = timeToHour(e.end_time)
    result[i] = lane
  }
  return result
}

// ─── Status context menu items ────────────────────────────────────────────────

function statusMenuItems(event: CalendarEvent, onStatusChange: (status: EventStatus) => void): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (event.status !== 'pending')     items.push({ key: 'pending',     label: 'Pending',  icon: Clock,        onAction: () => onStatusChange('pending') })
  if (event.status !== 'in_progress') items.push({ key: 'inprogress',  label: 'Active',   icon: Play,         onAction: () => onStatusChange('in_progress') })
  if (event.status !== 'completed')   items.push({ key: 'completed',   label: 'Done',     icon: CheckCircle2, onAction: () => onStatusChange('completed') })
  if (event.status !== 'cancelled')   items.push({ key: 'cancelled',   label: 'Cancel',   icon: Ban,          onAction: () => onStatusChange('cancelled'), destructive: true })
  return items
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; pill: string } | null> = {
  pending:     null,
  in_progress: { label: 'Active',     pill: 'text-themeblue1 bg-themeblue1/10' },
  completed:   { label: 'Done',       pill: 'text-themegreen bg-themegreen/10' },
  cancelled:   { label: 'Cancelled',  pill: 'text-themeredred bg-themeredred/10' },
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ event, onClick, onContextMenu }: { event: CalendarEvent; onClick: () => void; onContextMenu: (x: number, y: number) => void }) {
  const stripe = CATEGORY_STRIPE[event.category]
  const isDone   = event.status === 'completed' || event.status === 'cancelled'
  const isActive = event.status === 'in_progress'
  const meta     = STATUS_META[event.status] ?? null
  const longPress = useLongPress(onContextMenu)

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      {...longPress}
      className={`w-full flex items-stretch text-left rounded-lg overflow-hidden border border-themeblue3/10 active:scale-[0.99] ${
        isDone ? 'opacity-45' : 'opacity-100'
      }`}
    >
      <div className={`w-1 shrink-0 ${stripe} ${isActive ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0 px-2 py-1.5 bg-themewhite2 flex items-center gap-2">
        <span className="text-[10px] text-tertiary tabular-nums shrink-0">
          {formatTimeRange(event.start_time, event.end_time)}
        </span>
        <span className="flex-1 text-xs font-medium text-primary truncate">
          {event.title}
        </span>
        {event.location && (
          <span className="text-[10px] text-secondary truncate max-w-[72px] shrink-0">
            {event.location}
          </span>
        )}
        {meta && (
          <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${meta.pill}`}>
            {meta.label}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Gantt body ───────────────────────────────────────────────────────────────

interface GanttBodyProps {
  scrollRef: RefObject<HTMLDivElement>
  events: CalendarEvent[]
  userId: string | undefined
  onEventClick: (eventId: string) => void
  onEventContextMenu: (event: CalendarEvent, x: number, y: number) => void
  selectedDate: Date
}

function GanttBody({ scrollRef, events, userId, onEventClick, onEventContextMenu, selectedDate }: GanttBodyProps) {
  const earliestStart = Math.min(...events.map(e => timeToHour(e.start_time)))
  const latestEnd    = Math.max(...events.map(e => timeToHour(e.end_time)))
  const rangeStart   = Math.min(Math.floor(earliestStart), DEFAULT_START)
  const rangeEnd     = Math.max(Math.ceil(latestEnd), DEFAULT_END)
  const totalHours   = rangeEnd - rangeStart
  const totalWidth   = totalHours * HOUR_WIDTH

  const lanes      = assignLanes(events)
  const laneCount  = Math.max(...lanes) + 1
  const totalHeight = BODY_PAD_TOP + AXIS_HEIGHT + laneCount * EVENT_ROW_HEIGHT + EVENT_GAP + BODY_PAD_BOTTOM

  const now         = new Date()
  const isToday     = toDateKey(selectedDate) === toDateKey(new Date())
  const currentHour = now.getHours() + now.getMinutes() / 60
  const showNow     = isToday && currentHour >= rangeStart && currentHour <= rangeEnd
  const nowLeft     = (currentHour - rangeStart) * HOUR_WIDTH
  const hourMarks   = Array.from({ length: totalHours + 1 }, (_, i) => rangeStart + i)

  return (
    <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden" style={{ touchAction: 'pan-x' }}>
      <div className="relative select-none" style={{ width: totalWidth, height: totalHeight }}>

        {hourMarks.map(h => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-themeblue3/8"
            style={{ left: (h - rangeStart) * HOUR_WIDTH }}
          />
        ))}

        <div className="absolute left-0 flex" style={{ top: BODY_PAD_TOP, height: AXIS_HEIGHT }}>
          {hourMarks.map(h => (
            <div key={h} className="shrink-0 flex items-end pb-1 pl-1" style={{ width: HOUR_WIDTH }}>
              <span className="text-[9px] text-tertiary/60 leading-none font-medium">{formatHour(h)}</span>
            </div>
          ))}
        </div>

        {showNow && (
          <div
            className="absolute top-0 bottom-0 w-px bg-themeredred/60 z-10 pointer-events-none"
            style={{ left: nowLeft }}
          />
        )}

        {events.map((event, i) => {
          const startH = Math.max(timeToHour(event.start_time), rangeStart)
          const endH   = Math.min(timeToHour(event.end_time), rangeEnd)
          const left   = (startH - rangeStart) * HOUR_WIDTH
          const width  = Math.max((endH - startH) * HOUR_WIDTH, 40)
          const top    = BODY_PAD_TOP + AXIS_HEIGHT + lanes[i] * EVENT_ROW_HEIGHT + EVENT_GAP

          return (
            <MissionEventBar
              key={event.id}
              event={event}
              isAssigned={!!userId && event.assigned_to.includes(userId)}
              left={left}
              top={top}
              width={width}
              height={EVENT_HEIGHT}
              onClick={() => onEventClick(event.id)}
              onContextMenu={(x, y) => onEventContextMenu(event, x, y)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Combined card ────────────────────────────────────────────────────────────

interface MissionGanttProps {
  onEventClick: (eventId: string) => void
  onOpenCalendar: () => void
  onStatusChange: (eventId: string, status: EventStatus) => void
}

export function MissionGantt({ onEventClick, onOpenCalendar, onStatusChange }: MissionGanttProps) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const events     = useCalendarStore(s => s.events)
  const userId     = useAuthStore(s => s.user?.id)

  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [collapsed, setCollapsed]       = useState(false)
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [anchorRect, setAnchorRect]     = useState<DOMRect | null>(null)
  const [contextMenu, setContextMenu]   = useState<{ event: CalendarEvent; x: number; y: number } | null>(null)

  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(new Date())

  const allDayEvents = events.filter(e => eventFallsOnDate(e, dateKey))
  const myTasks = allDayEvents
    .filter(e => !!userId && e.assigned_to.includes(userId))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const activeTasks = myTasks.filter(e => e.status === 'pending' || e.status === 'in_progress')
  const doneTasks   = myTasks.filter(e => e.status === 'completed' || e.status === 'cancelled')

  const navigate = (dir: -1 | 1) => setSelectedDate(d => offsetDate(d, dir))

  const openPicker = () => {
    setAnchorRect(dateBtnRef.current?.getBoundingClientRect() ?? null)
    setPickerOpen(true)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2">

      {/* Header */}
      <div className="flex items-center px-2 py-2 border-b border-themeblue3/8">
        <div className="flex items-center gap-0.5">
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(-1)}>
            <ChevronLeft size={13} />
          </button>
          <button
            ref={dateBtnRef}
            className="text-xs font-medium text-primary py-0.5 px-1.5 rounded active:bg-themeblue2/10 whitespace-nowrap"
            onClick={openPicker}
          >
            {isToday ? 'Today' : formatDateLabel(selectedDate)}
          </button>
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(1)}>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="flex-1" />

        <button
          className="p-1 rounded active:bg-themeblue2/10 text-tertiary"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      <PreviewOverlay isOpen={pickerOpen} onClose={() => setPickerOpen(false)} anchorRect={anchorRect}>
        <DatePickerCalendar
          value={dateKey}
          onChange={(iso) => { setSelectedDate(new Date(iso + 'T00:00:00')); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      </PreviewOverlay>

      {!collapsed && (
        <div className="relative">

          {/* My tasks — top section */}
          {myTasks.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-secondary">No assigned tasks</div>
          ) : (
            <div className="flex flex-col px-2.5 pt-2 pb-2">
              {activeTasks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {activeTasks.map(event => (
                    <TaskRow key={event.id} event={event} onClick={() => onEventClick(event.id)} onContextMenu={(x, y) => setContextMenu({ event, x, y })} />
                  ))}
                </div>
              )}
              {activeTasks.length > 0 && doneTasks.length > 0 && (
                <div className="flex items-center gap-2 mt-2 mb-1.5">
                  <div className="flex-1 border-t border-themeblue3/10" />
                  <span className="text-[9px] font-medium text-tertiary/60 uppercase tracking-wide">Completed</span>
                  <div className="flex-1 border-t border-themeblue3/10" />
                </div>
              )}
              {doneTasks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {doneTasks.map(event => (
                    <TaskRow key={event.id} event={event} onClick={() => onEventClick(event.id)} onContextMenu={(x, y) => setContextMenu({ event, x, y })} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-themeblue3/10 mx-0" />

          {/* Clinic-wide gantt — bottom section */}
          {allDayEvents.length === 0 ? (
            <div className="flex items-center justify-center h-14 text-secondary text-xs">
              No missions
            </div>
          ) : (
            <GanttBody
              scrollRef={scrollRef}
              events={allDayEvents}
              userId={userId}
              onEventClick={onEventClick}
              onEventContextMenu={(event, x, y) => setContextMenu({ event, x, y })}
              selectedDate={selectedDate}
            />
          )}

          {/* Open Calendar — bottom-right, matches Open Map style */}
          <button
            onClick={onOpenCalendar}
            className="absolute bottom-2 right-2 z-10 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-themewhite/90 border border-themeblue3/15 text-themeblue1 shadow-xs active:scale-95 transition-transform"
          >
            Open Calendar
          </button>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={statusMenuItems(contextMenu.event, (status) => {
            onStatusChange(contextMenu.event.id, status)
            setContextMenu(null)
          })}
        />
      )}
    </div>
  )
}
