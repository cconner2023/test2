import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { toDateKey, eventFallsOnDate } from '../../Types/CalendarTypes'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { MissionEventBar } from './MissionEventBar'
import { DatePickerCalendar } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'

const HOUR_WIDTH = 76        // px per hour
const EVENT_HEIGHT = 44
const EVENT_GAP = 6
const EVENT_ROW_HEIGHT = EVENT_HEIGHT + EVENT_GAP
const AXIS_HEIGHT = 28
const BODY_PAD_TOP = 2       // px between header border and time axis
const BODY_PAD_BOTTOM = 34   // px below last event row (clears the Open Calendar button)
const DEFAULT_START = 6      // 0600
const DEFAULT_END = 22       // 2200

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

function offsetDate(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Greedy lane assignment — stacks overlapping events into parallel rows */
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

interface MissionGanttProps {
  onEventClick: (eventId: string) => void
  onOpenCalendar: () => void
}

export function MissionGantt({ onEventClick, onOpenCalendar }: MissionGanttProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const events = useCalendarStore(s => s.events)
  const userId = useAuthStore(s => s.user?.id)

  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(new Date())

  const dayEvents = events.filter(e => eventFallsOnDate(e, dateKey))

  const navigate = (dir: -1 | 1) => {
    setSelectedDate(d => offsetDate(d, dir))
  }

  const openPicker = () => {
    setAnchorRect(dateBtnRef.current?.getBoundingClientRect() ?? null)
    setPickerOpen(true)
  }

  const handlePickerChange = (iso: string) => {
    setSelectedDate(new Date(iso + 'T00:00:00'))
    setPickerOpen(false)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2">

      {/* Header — date navigation */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-themeblue3/8">
        <button
          className="p-1 rounded active:bg-themeblue2/10 text-tertiary"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={13} />
        </button>
        <button
          ref={dateBtnRef}
          className="flex-1 text-center text-xs font-medium text-primary py-0.5 rounded active:bg-themeblue2/10"
          onClick={openPicker}
        >
          {isToday ? 'Today' : formatDateLabel(selectedDate)}
        </button>
        <button
          className="p-1 rounded active:bg-themeblue2/10 text-tertiary"
          onClick={() => navigate(1)}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <PreviewOverlay
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        anchorRect={anchorRect}
      >
        <DatePickerCalendar
          value={dateKey}
          onChange={handlePickerChange}
          onClose={() => setPickerOpen(false)}
        />
      </PreviewOverlay>

      {/* Gantt body */}
      {dayEvents.length === 0 ? (
        <div className="flex items-center justify-center h-12 text-secondary text-xs">
          No missions
        </div>
      ) : (
        <GanttBody
          scrollRef={scrollRef}
          events={dayEvents}
          userId={userId}
          onEventClick={onEventClick}
          onOpenCalendar={onOpenCalendar}
          selectedDate={selectedDate}
        />
      )}
    </div>
  )
}

interface GanttBodyProps {
  scrollRef: React.RefObject<HTMLDivElement>
  events: CalendarEvent[]
  userId: string | undefined
  onEventClick: (eventId: string) => void
  onOpenCalendar: () => void
  selectedDate: Date
}

function GanttBody({ scrollRef, events, userId, onEventClick, onOpenCalendar, selectedDate }: GanttBodyProps) {
  const earliestStart = Math.min(...events.map(e => timeToHour(e.start_time)))
  const latestEnd = Math.max(...events.map(e => timeToHour(e.end_time)))
  const rangeStart = Math.min(Math.floor(earliestStart), DEFAULT_START)
  const rangeEnd = Math.max(Math.ceil(latestEnd), DEFAULT_END)
  const totalHours = rangeEnd - rangeStart
  const totalWidth = totalHours * HOUR_WIDTH

  const lanes = assignLanes(events)
  const laneCount = Math.max(...lanes) + 1
  const totalHeight = BODY_PAD_TOP + AXIS_HEIGHT + laneCount * EVENT_ROW_HEIGHT + EVENT_GAP + BODY_PAD_BOTTOM

  const now = new Date()
  const isToday = toDateKey(selectedDate) === toDateKey(new Date())
  const currentHour = now.getHours() + now.getMinutes() / 60
  const showNow = isToday && currentHour >= rangeStart && currentHour <= rangeEnd
  const nowLeft = (currentHour - rangeStart) * HOUR_WIDTH

  const hourMarks = Array.from({ length: totalHours + 1 }, (_, i) => rangeStart + i)

  return (
    <div className="relative">
      <button
        onClick={onOpenCalendar}
        className="absolute bottom-2 right-2 z-10 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-themewhite/90 border border-themeblue3/15 text-themeblue1 shadow-xs active:scale-95 transition-transform"
      >
        Open Calendar
      </button>
    <div
      ref={scrollRef}
      className="overflow-x-auto overflow-y-hidden"
      style={{ touchAction: 'pan-x' }}
    >
      <div className="relative select-none" style={{ width: totalWidth, height: totalHeight }}>

        {/* Hour grid lines */}
        {hourMarks.map(h => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-themeblue3/8"
            style={{ left: (h - rangeStart) * HOUR_WIDTH }}
          />
        ))}

        {/* Time axis labels */}
        <div className="absolute left-0 flex" style={{ top: BODY_PAD_TOP, height: AXIS_HEIGHT }}>
          {hourMarks.map(h => (
            <div key={h} className="shrink-0 flex items-end pb-1 pl-1" style={{ width: HOUR_WIDTH }}>
              <span className="text-[9px] text-tertiary/60 leading-none font-medium">
                {formatHour(h)}
              </span>
            </div>
          ))}
        </div>

        {/* Current time indicator */}
        {showNow && (
          <div
            className="absolute top-0 bottom-0 w-px bg-themeredred/60 z-10 pointer-events-none"
            style={{ left: nowLeft }}
          />
        )}

        {/* Event bars */}
        {events.map((event, i) => {
          const startH = Math.max(timeToHour(event.start_time), rangeStart)
          const endH = Math.min(timeToHour(event.end_time), rangeEnd)
          const left = (startH - rangeStart) * HOUR_WIDTH
          const width = Math.max((endH - startH) * HOUR_WIDTH, 40)
          const top = BODY_PAD_TOP + AXIS_HEIGHT + lanes[i] * EVENT_ROW_HEIGHT + EVENT_GAP

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
            />
          )
        })}
      </div>
    </div>
    </div>
  )
}
