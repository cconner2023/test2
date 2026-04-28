import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { CATEGORY_BG_MAP, PROVIDER_HUDDLE_TASK_ID, toDateKey, formatShortDayLabel } from '../../Types/CalendarTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { UserAvatar } from '../Settings/UserAvatar'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { ClinicRoom } from '../../lib/adminService'
import type { ClinicHuddleTask } from '../../lib/supervisorService'
import { DatePickerCalendar } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { getDisplayName } from '../../Utilities/nameUtils'

interface TroopsToTaskViewProps {
  date: Date
  events: CalendarEvent[]
  medics: ClinicMedic[]
  rooms: ClinicRoom[]
  /** Supervisor-defined huddle stations, sorted by sort_order. One band row per task. */
  huddleTasks: ClinicHuddleTask[]
  onSelectEvent: (id: string) => void
  onAssign: (eventId: string, userId: string) => void
  onUnassign: (eventId: string, userId: string) => void
  onDateChange: (date: Date) => void
  /** Called from the huddle band's "+" buttons. taskId pre-selects a station for the new event. */
  onNewHuddleEvent?: (forDateKey: string, taskId?: string) => void
  /**
   * Tap-to-assign a medic to a huddle row. taskId is either a huddle task id or
   * PROVIDER_HUDDLE_TASK_ID for the providers section. providerId is set when the
   * row belongs to a specific provider — the medic should be paired with that
   * provider's existing event (or a new one created for them), not added as a
   * standalone provider entry. Caller is responsible for
   * duplicate detection + confirmation modal.
   */
  onAssignMedicToHuddle?: (medicId: string, taskId: string, forDateKey: string, providerId?: string) => void
}

const HOUR_COL_WIDTH = 80
const HOURS_PER_DAY = 24
const DAY_WIDTH = HOURS_PER_DAY * HOUR_COL_WIDTH // 1920px
const NAME_COL_WIDTH = 180
const DAYS_BUFFER = 7 // 7 before + 7 after = 15 days
const LOAD_THRESHOLD = 2 // days from edge before loading more
const LANE_HEIGHT = 24
const LANE_HEIGHT_HUDDLE = 32
const LANE_GAP = 2
const ROW_PAD = 4 // top + bottom padding inside row
const TIME_HEADER_HEIGHT = 28 // px — used to offset the sticky huddle band

interface DaySlot {
  date: Date
  dateKey: string
  label: string // "Mon, Mar 22"
}

function generateDays(centerDate: Date, before: number, after: number): DaySlot[] {
  const days: DaySlot[] = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(centerDate)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    days.push({
      date: d,
      dateKey: toDateKey(d),
      label: formatShortDayLabel(d),
    })
  }
  return days
}

/** Position an event block relative to the timeline origin (first day, hour 0) */
function getEventPosition(event: CalendarEvent, days: DaySlot[]) {
  const firstDayMs = days[0].date.getTime()
  const lastDayEndMs = days[days.length - 1].date.getTime() + 24 * 60 * 60 * 1000

  const startMs = Math.max(new Date(event.start_time).getTime(), firstDayMs)
  const endMs = Math.min(new Date(event.end_time).getTime(), lastDayEndMs)

  if (endMs <= firstDayMs || startMs >= lastDayEndMs) return null

  const startHoursFromOrigin = (startMs - firstDayMs) / (1000 * 60 * 60)
  const endHoursFromOrigin = (endMs - firstDayMs) / (1000 * 60 * 60)

  const left = startHoursFromOrigin * HOUR_COL_WIDTH
  const width = Math.max((endHoursFromOrigin - startHoursFromOrigin) * HOUR_COL_WIDTH, 30)

  return { left, width }
}

interface PositionedEvent {
  event: CalendarEvent
  left: number
  width: number
  lane: number
}

/** Assign non-overlapping lanes to events, sorted by start time */
function assignLanes(assignments: CalendarEvent[], days: DaySlot[]): PositionedEvent[] {
  const positioned: PositionedEvent[] = []

  for (const event of assignments) {
    const pos = getEventPosition(event, days)
    if (!pos) continue
    positioned.push({ event, left: pos.left, width: pos.width, lane: 0 })
  }

  // Sort by left position, then wider events first
  positioned.sort((a, b) => a.left - b.left || b.width - a.width)

  // Greedy lane assignment: track the right edge of each lane
  const laneEnds: number[] = []
  for (const item of positioned) {
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] > item.left) lane++
    item.lane = lane
    if (lane >= laneEnds.length) laneEnds.push(item.left + item.width)
    else laneEnds[lane] = item.left + item.width
  }

  return positioned
}

export function TroopsToTaskView({ date, events, medics, rooms, huddleTasks, onSelectEvent, onDateChange, onNewHuddleEvent, onAssignMedicToHuddle }: TroopsToTaskViewProps) {
  const isMobile = useIsMobile()
  const [armedMedicId, setArmedMedicId] = useState<string | null>(null)
  const armedMedic = useMemo(
    () => (armedMedicId ? medics.find(m => m.id === armedMedicId) ?? null : null),
    [armedMedicId, medics],
  )

  // Esc cancels the armed-medic state
  useEffect(() => {
    if (!armedMedicId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmedMedicId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armedMedicId])
  const scrollRef = useRef<HTMLDivElement>(null)
  const dayMarkerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [days, setDays] = useState(() => generateDays(date, DAYS_BUFFER, DAYS_BUFFER))
  const [visibleDateLabel, setVisibleDateLabel] = useState('')
  const [visibleDateKey, setVisibleDateKey] = useState(() => toDateKey(date))
  const initialScrollDone = useRef(false)
  const [nowLineX, setNowLineX] = useState<number | null>(null)

  // Compute the horizontal pixel position of "now" relative to the timeline origin
  const computeNowX = useCallback(() => {
    const now = new Date()
    const nowKey = toDateKey(now)
    const dayIndex = days.findIndex(d => d.dateKey === nowKey)
    if (dayIndex < 0) return null
    const fractionalHours = now.getHours() + now.getMinutes() / 60
    return dayIndex * DAY_WIDTH + fractionalHours * HOUR_COL_WIDTH
  }, [days])

  // Update now-line every 60 seconds
  useEffect(() => {
    const update = () => setNowLineX(computeNowX())
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [computeNowX])

  const totalWidth = NAME_COL_WIDTH + days.length * DAY_WIDTH

  // Filter to timed events that fall within our buffered range
  const visibleEvents = useMemo(() => {
    const firstKey = days[0].dateKey
    const lastKey = days[days.length - 1].dateKey
    return events.filter(e => {
      const eStart = e.start_time.slice(0, 10)
      const eEnd = e.end_time.slice(0, 10)
      return eEnd >= firstKey && eStart <= lastKey
    })
  }, [events, days])

  // Huddle events render in their own band, not in medic lanes — exclude them here
  const nonHuddleEvents = useMemo(
    () => visibleEvents.filter(e => e.category !== 'huddle'),
    [visibleEvents],
  )

  // Assignments per medic — lane-resolved
  const medicLanes = useMemo(() => {
    const raw = new Map<string, CalendarEvent[]>()
    for (const medic of medics) raw.set(medic.id, [])
    for (const event of nonHuddleEvents) {
      for (const userId of event.assigned_to) {
        const existing = raw.get(userId) ?? []
        existing.push(event)
        raw.set(userId, existing)
      }
    }
    const map = new Map<string, PositionedEvent[]>()
    for (const [id, evts] of raw) {
      map.set(id, assignLanes(evts, days))
    }
    return map
  }, [medics, nonHuddleEvents, days])

  const unassignedLanes = useMemo(() =>
    assignLanes(nonHuddleEvents.filter(e => e.assigned_to.length === 0), days),
    [nonHuddleEvents, days]
  )

  // ── Huddle band — sectioned: providers row(s) + one row per supervisor-defined task ──

  /**
   * Huddle events split by where they render in the band:
   *   - providerEvents: no `huddle_task_id`, ≥1 assignee with provider role.
   *     Render under each on-shift provider's row (left = provider name/badge,
   *     right = paired medic chip(s)).
   *   - taskEvents: have a `huddle_task_id`. Render in that station's row.
   *   - Orphan huddle events (no task_id, no provider assignee) fall through to
   *     the "Other huddle" lane so nothing silently disappears.
   */
  const { providerEvents, taskEvents, orphanHuddleEvents } = useMemo(() => {
    const providerOnly: CalendarEvent[] = []
    const tasked: CalendarEvent[] = []
    const orphan: CalendarEvent[] = []
    const localMedicById = new Map<string, ClinicMedic>()
    for (const m of medics) localMedicById.set(m.id, m)
    for (const e of visibleEvents) {
      if (e.category !== 'huddle') continue
      if (e.huddle_task_id === PROVIDER_HUDDLE_TASK_ID) {
        providerOnly.push(e)
        continue
      }
      if (e.huddle_task_id) {
        tasked.push(e)
        continue
      }
      // Legacy: null huddle_task_id with a provider assignee — treat as provider event.
      const hasProvider = e.assigned_to.some(id => {
        const m = localMedicById.get(id)
        return !!m && (m.roles ?? []).includes('provider')
      })
      if (hasProvider) providerOnly.push(e)
      else orphan.push(e)
    }
    return { providerEvents: providerOnly, taskEvents: tasked, orphanHuddleEvents: orphan }
  }, [visibleEvents, medics])

  /**
   * All provider huddle events lane-stacked into a single "PROVIDER" row.
   * Row height expands with the number of overlapping events regardless of
   * how many users hold the provider role.
   */
  const providerLanesAll = useMemo(
    () => assignLanes(providerEvents, days),
    [providerEvents, days],
  )

  /** Per-task huddle event lanes — keyed by task id. */
  const taskLanes = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>()
    for (const task of huddleTasks) {
      const evts = taskEvents.filter(e => e.huddle_task_id === task.id)
      map.set(task.id, assignLanes(evts, days))
    }
    return map
  }, [huddleTasks, taskEvents, days])

  /** Lane-stacked orphan huddle events (no task, no provider). */
  const orphanHuddleLanes = useMemo(
    () => assignLanes(orphanHuddleEvents, days),
    [orphanHuddleEvents, days],
  )

  const medicById = useMemo(() => {
    const map = new Map<string, ClinicMedic>()
    for (const m of medics) map.set(m.id, m)
    return map
  }, [medics])

  /**
   * Provider-role medic IDs who are assigned to at least one huddle event
   * intersecting the currently visible day. Drives the "Provider" badge swap
   * in the personnel row — a provider only reads as a provider on days they
   * actually have a huddle.
   */
  const activeProviderIdsForVisibleDay = useMemo(() => {
    const set = new Set<string>()
    for (const e of visibleEvents) {
      if (e.category !== 'huddle') continue
      if (e.start_time.slice(0, 10) > visibleDateKey) continue
      if (e.end_time.slice(0, 10) < visibleDateKey) continue
      for (const id of e.assigned_to) {
        const m = medicById.get(id)
        if (m && (m.roles ?? []).includes('provider')) set.add(id)
      }
    }
    return set
  }, [visibleEvents, visibleDateKey, medicById])

  // Scroll to current time on mount (or selected date center if not today)
  useEffect(() => {
    if (initialScrollDone.current) return
    const el = scrollRef.current
    if (!el) return

    const viewportWidth = el.clientWidth - NAME_COL_WIDTH
    const now = new Date()
    const todayKey = toDateKey(now)
    const todayIndex = days.findIndex(d => d.dateKey === todayKey)

    if (todayIndex >= 0) {
      // Center on current time within today
      const fractionalHours = now.getHours() + now.getMinutes() / 60
      const nowX = todayIndex * DAY_WIDTH + fractionalHours * HOUR_COL_WIDTH
      const sl = Math.max(0, nowX - viewportWidth / 2)
      el.scrollLeft = sl
      el.style.setProperty('--sl', String(sl))
      initialScrollDone.current = true
    } else {
      // Fallback: center on the selected date
      const dayIndex = days.findIndex(d => d.dateKey === toDateKey(date))
      if (dayIndex >= 0) {
        const dayLeft = dayIndex * DAY_WIDTH
        const sl = Math.max(0, dayLeft - viewportWidth / 2 + DAY_WIDTH / 2)
        el.scrollLeft = sl
        el.style.setProperty('--sl', String(sl))
        initialScrollDone.current = true
      }
    }
  }, [days, date])

  // Re-center when date changes externally (nav buttons)
  const prevDateRef = useRef(toDateKey(date))
  useEffect(() => {
    const newKey = toDateKey(date)
    if (newKey === prevDateRef.current) return
    prevDateRef.current = newKey

    const el = scrollRef.current
    if (!el) return

    let dayIndex = days.findIndex(d => d.dateKey === newKey)
    if (dayIndex < 0) {
      // Date outside buffer — regenerate
      setDays(generateDays(date, DAYS_BUFFER, DAYS_BUFFER))
      return
    }

    const dayLeft = dayIndex * DAY_WIDTH
    const viewportWidth = el.clientWidth - NAME_COL_WIDTH
    el.scrollTo({ left: Math.max(0, dayLeft - viewportWidth / 2 + DAY_WIDTH / 2), behavior: 'smooth' })
  }, [date, days])

  // IntersectionObserver to detect which day is visible → update label
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const dateKey = entry.target.getAttribute('data-day-key')
            const day = days.find(d => d.dateKey === dateKey)
            if (day) {
              setVisibleDateLabel(day.label)
              setVisibleDateKey(day.dateKey)
            }
          }
        }
      },
      {
        root: el,
        rootMargin: '0px -60% 0px -30%',
        threshold: 0,
      }
    )

    dayMarkerRefs.current.forEach(marker => observer.observe(marker))
    return () => observer.disconnect()
  }, [days])

  // Infinite scroll — load more days at edges
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    // Drive sticky event titles via CSS custom property (no React re-renders)
    el.style.setProperty('--sl', String(el.scrollLeft))

    const { scrollLeft, scrollWidth, clientWidth } = el
    const dayPixelWidth = DAY_WIDTH

    // Near left edge — prepend days
    if (scrollLeft < dayPixelWidth * LOAD_THRESHOLD) {
      const firstDay = days[0].date
      const newFirst = new Date(firstDay)
      newFirst.setDate(newFirst.getDate() - DAYS_BUFFER)
      const newDays = generateDays(newFirst, 0, DAYS_BUFFER - 1)
      setDays(prev => [...newDays, ...prev])
      // Maintain scroll position
      requestAnimationFrame(() => {
        el.scrollLeft += newDays.length * DAY_WIDTH
      })
    }

    // Near right edge — append days
    if (scrollLeft + clientWidth > scrollWidth - dayPixelWidth * LOAD_THRESHOLD) {
      const lastDay = days[days.length - 1].date
      const newFirst = new Date(lastDay)
      newFirst.setDate(newFirst.getDate() + 1)
      const newDays = generateDays(newFirst, 0, DAYS_BUFFER - 1)
      setDays(prev => [...prev, ...newDays])
    }
  }, [days])

  const prevDay = useCallback(() => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    onDateChange(d)
  }, [date, onDateChange])

  const nextDay = useCallback(() => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    onDateChange(d)
  }, [date, onDateChange])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const openPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPickerAnchor(e.currentTarget.getBoundingClientRect())
    setPickerOpen(true)
  }, [])
  const handlePickerChange = useCallback((iso: string) => {
    onDateChange(new Date(iso + 'T00:00:00'))
    setPickerOpen(false)
  }, [onDateChange])

  const dateNavLabel = visibleDateLabel || date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const setDayRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) dayMarkerRefs.current.set(key, el)
    else dayMarkerRefs.current.delete(key)
  }, [])

  return (
    <div
      data-tour="calendar-troops-view"
      ref={scrollRef}
      className="touch-pan-xy h-full min-h-0 min-w-0 overflow-auto overscroll-contain"
      onScroll={handleScroll}
    >
      <div className="relative" style={{ minWidth: totalWidth, display: 'grid', gridTemplateRows: `auto auto repeat(${medics.length + (unassignedLanes.length > 0 ? 1 : 0)}, auto) 1fr` }}>
        {/* Current time indicator — vertical red line spanning content rows (excludes trailing 1fr footer) */}
        {nowLineX !== null && (
          <div
            className="absolute top-0 bottom-0 z-[11] pointer-events-none"
            style={{ left: NAME_COL_WIDTH + nowLineX, gridRow: '1 / -2' }}
          >
            <div className="relative h-full">
              <div className="absolute top-0 w-2 h-2 -translate-x-1/2 rounded-full bg-themeredred" />
              <div className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-themeredred" />
            </div>
          </div>
        )}

        {/* Time header with day boundaries */}
        <div className="sticky top-0 z-10 flex items-end backdrop-blur-xs bg-transparent border-b border-primary/10">
          {/* Date nav in personnel column */}
          <div className="sticky left-0 z-20 shrink-0 border-r border-primary/10 flex items-center justify-between px-1.5 py-1 bg-themewhite3" style={{ width: NAME_COL_WIDTH }}>
            <button onClick={prevDay} className="w-6 h-6 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={openPicker} className="text-[9pt] font-semibold text-primary hover:text-themeblue2 transition-colors active:scale-95 truncate" title="Pick a date">
              {dateNavLabel}
            </button>
            <button onClick={nextDay} className="w-6 h-6 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hour labels with day dividers */}
          {days.map((day, dayIdx) => (
            <div key={day.dateKey} className="flex shrink-0" ref={(el) => setDayRef(day.dateKey, el)} data-day-key={day.dateKey}>
              {Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                <div
                  key={h}
                  className={`px-1 py-1.5 ${
                    h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                  }`}
                  style={{ width: HOUR_COL_WIDTH }}
                >
                  {h === 0 ? (
                    <span className="text-[9pt] font-semibold text-primary">{day.label}</span>
                  ) : (
                    <span className="text-[9pt] font-mono text-tertiary">{String(h).padStart(2, '0')}00</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Huddle band — sticky under the time header, sectioned into Providers + Tasks rows */}
        <div
          data-tour="calendar-huddle-band"
          className="flex flex-col border-b border-themeblue3/20 bg-themewhite3"
        >
          {/* Provider row — single "PROVIDER" lane that expands height with all on-shift provider huddle events. */}
          {(() => {
            const positioned = providerLanesAll
            const laneCount = positioned.length > 0 ? Math.max(...positioned.map(p => p.lane)) + 1 : 1
            const rowHeight = ROW_PAD * 2 + laneCount * (LANE_HEIGHT_HUDDLE + LANE_GAP)
            const isDropTarget = !!armedMedicId && !!onAssignMedicToHuddle
            const handleRowClick = isDropTarget
              ? () => {
                  onAssignMedicToHuddle!(armedMedicId!, PROVIDER_HUDDLE_TASK_ID, visibleDateKey || toDateKey(date))
                  setArmedMedicId(null)
                }
              : onNewHuddleEvent
                ? () => onNewHuddleEvent(visibleDateKey || toDateKey(date), PROVIDER_HUDDLE_TASK_ID)
                : undefined
            return (
              <div
                className={`relative flex border-b border-themeblue3/10 transition-colors ${
                  isDropTarget ? 'bg-themeblue3/15 ring-1 ring-inset ring-themeblue3 cursor-pointer animate-pulse' : ''
                }`}
                style={{ height: rowHeight }}
                onClick={handleRowClick}
                role={handleRowClick ? 'button' : undefined}
                title={isDropTarget ? `Assign ${armedMedic?.lastName ?? ''} to provider huddle` : 'Tap to add provider huddle'}
              >
                <div
                  className="sticky left-0 z-[7] shrink-0 flex items-center px-2 border-r border-primary/10 bg-themewhite3"
                  style={{ width: NAME_COL_WIDTH }}
                >
                  <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary truncate">Provider</span>
                </div>
                <div className="flex-1 relative">
                  {days.map((day, dayIdx) => (
                    Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                      <div
                        key={`${day.dateKey}-${h}`}
                        className={`absolute top-0 bottom-0 ${
                          h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                        }`}
                        style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                      />
                    ))
                  )).flat()}
                  {positioned.map(({ event, left, width, lane }) => {
                    const assignees = event.assigned_to
                      .map(id => medicById.get(id))
                      .filter((m): m is ClinicMedic => !!m)
                    const provider = assignees.find(m => (m.roles ?? []).includes('provider')) ?? assignees[0]
                    const partners = assignees.filter(m => m.id !== provider?.id)
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectEvent(event.id) }}
                        className="absolute rounded-md bg-themeblue3/15 border border-themeblue3/40 hover:bg-themeblue3/25 transition-colors text-left overflow-hidden"
                        style={{
                          left,
                          width,
                          top: ROW_PAD + lane * (LANE_HEIGHT_HUDDLE + LANE_GAP),
                          height: LANE_HEIGHT_HUDDLE,
                        }}
                        title={provider ? `${getDisplayName(provider)}${partners.length ? ' + ' + partners.map(p => getDisplayName(p)).join(', ') : ''}` : 'Provider huddle'}
                      >
                        <div
                          className="absolute inset-y-0 right-0 flex items-center gap-1.5 px-1"
                          style={{
                            left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                          }}
                        >
                          {provider ? (
                            <>
                              <UserAvatar avatarId={provider.avatarId} firstName={provider.firstName} lastName={provider.lastName} className="w-6 h-6 shrink-0 ring-1 ring-themeblue3/50" />
                              <span className="text-[9pt] font-medium text-primary truncate">{getDisplayName(provider)}</span>
                            </>
                          ) : (
                            <span className="text-[9pt] italic text-tertiary truncate">unassigned</span>
                          )}
                          {partners.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-1 shrink-0 pl-1 border-l border-themeblue3/30">
                              <UserAvatar avatarId={p.avatarId} firstName={p.firstName} lastName={p.lastName} className="w-6 h-6 shrink-0" />
                              <span className="text-[9pt] text-primary truncate">{getDisplayName(p)}</span>
                            </span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Task rows — one per supervisor-defined station. Tap-armed medic drops here; empty tap creates a new huddle. */}
          {huddleTasks.map(task => {
            const positioned = taskLanes.get(task.id) ?? []
            const laneCount = positioned.length > 0 ? Math.max(...positioned.map(p => p.lane)) + 1 : 1
            const rowHeight = ROW_PAD * 2 + laneCount * (LANE_HEIGHT_HUDDLE + LANE_GAP)
            const isDropTarget = !!armedMedicId && !!onAssignMedicToHuddle
            const handleRowClick = isDropTarget
              ? () => {
                  onAssignMedicToHuddle!(armedMedicId!, task.id, visibleDateKey || toDateKey(date))
                  setArmedMedicId(null)
                }
              : onNewHuddleEvent
                ? () => onNewHuddleEvent(visibleDateKey || toDateKey(date), task.id)
                : undefined
            return (
              <div
                key={task.id}
                className={`relative flex border-b border-themeblue3/10 transition-colors ${
                  isDropTarget ? 'bg-themeblue3/15 ring-1 ring-inset ring-themeblue3 cursor-pointer animate-pulse' : ''
                }`}
                style={{ height: rowHeight }}
                onClick={handleRowClick}
                role={handleRowClick ? 'button' : undefined}
                title={isDropTarget ? `Assign ${armedMedic?.lastName ?? ''} to ${task.name}` : `Tap to assign someone to ${task.name}`}
              >
                <div
                  className="sticky left-0 z-[7] shrink-0 flex items-center px-2 border-r border-primary/10 bg-themewhite3"
                  style={{ width: NAME_COL_WIDTH }}
                >
                  <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary truncate">{task.name}</span>
                </div>
                <div className="flex-1 relative">
                  {days.map((day, dayIdx) => (
                    Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                      <div
                        key={`${day.dateKey}-${h}`}
                        className={`absolute top-0 bottom-0 ${
                          h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                        }`}
                        style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                      />
                    ))
                  )).flat()}
                  {positioned.map(({ event, left, width, lane }) => {
                    const assignees = event.assigned_to
                      .map(id => medicById.get(id))
                      .filter((m): m is ClinicMedic => !!m)
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectEvent(event.id) }}
                        className="absolute rounded-md bg-themeblue3/15 border border-themeblue3/40 hover:bg-themeblue3/25 transition-colors text-left overflow-hidden"
                        style={{
                          left,
                          width,
                          top: ROW_PAD + lane * (LANE_HEIGHT_HUDDLE + LANE_GAP),
                          height: LANE_HEIGHT_HUDDLE,
                        }}
                        title={assignees.length ? assignees.map(m => getDisplayName(m)).join(', ') : 'unassigned'}
                      >
                        <div
                          className="absolute inset-y-0 right-0 flex items-center gap-1.5 px-1"
                          style={{
                            left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                          }}
                        >
                          {assignees.length === 0 ? (
                            <span className="text-[9pt] italic text-tertiary truncate">unassigned</span>
                          ) : (
                            assignees.map((m, i) => (
                              <span key={m.id} className={`inline-flex items-center gap-1 shrink-0 ${i > 0 ? 'pl-1 border-l border-themeblue3/30' : ''}`}>
                                <UserAvatar avatarId={m.avatarId} firstName={m.firstName} lastName={m.lastName} className={`w-6 h-6 shrink-0 ${(m.roles ?? []).includes('provider') ? 'ring-1 ring-themeblue3/50' : ''}`} />
                                <span className="text-[9pt] text-primary truncate">{getDisplayName(m)}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Orphan huddle events — fallback so unconfigured rows don't disappear silently */}
          {orphanHuddleLanes.length > 0 && (() => {
            const laneCount = Math.max(...orphanHuddleLanes.map(p => p.lane)) + 1
            const rowHeight = ROW_PAD * 2 + laneCount * (LANE_HEIGHT_HUDDLE + LANE_GAP)
            return (
              <div className="relative flex border-b border-themeblue3/10" style={{ height: rowHeight }}>
                <div className="sticky left-0 z-[7] shrink-0 flex items-center px-2 border-r border-primary/10 bg-themewhite3" style={{ width: NAME_COL_WIDTH }}>
                  <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary truncate">Other huddle</span>
                </div>
                <div className="flex-1 relative">
                  {days.map((day, dayIdx) => (
                    Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                      <div
                        key={`${day.dateKey}-${h}`}
                        className={`absolute top-0 bottom-0 ${
                          h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                        }`}
                        style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                      />
                    ))
                  )).flat()}
                  {orphanHuddleLanes.map(({ event, left, width, lane }) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event.id)}
                      className="absolute rounded-md border bg-themeblue3/10 border-themeblue3/30 hover:bg-themeblue3/20 transition-colors text-left overflow-hidden flex items-center gap-1.5 px-1.5"
                      style={{
                        left,
                        width,
                        top: ROW_PAD + lane * (LANE_HEIGHT_HUDDLE + LANE_GAP),
                        height: LANE_HEIGHT_HUDDLE,
                      }}
                    >
                      <span className="text-[9pt] text-primary truncate">{event.title || 'Huddle'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Personnel rows */}
        {medics.map(medic => {
          const positioned = medicLanes.get(medic.id) ?? []
          const laneCount = positioned.length > 0 ? Math.max(...positioned.map(p => p.lane)) + 1 : 1
          const rowHeight = Math.max(ROW_PAD * 2 + laneCount * (LANE_HEIGHT + LANE_GAP), 52)
          const isArmed = armedMedicId === medic.id
          const canArm = !!onAssignMedicToHuddle
          return (
            <div key={medic.id} className="relative flex border-b border-primary/5" style={{ height: rowHeight }}>
              <div
                className={`sticky left-0 z-[5] shrink-0 flex items-center border-r border-primary/10 transition-colors ${isMobile ? 'gap-3 px-3' : 'gap-2 px-2'} ${
                  isArmed ? 'bg-themeblue3/20 ring-1 ring-inset ring-themeblue3' : 'bg-themewhite3'
                } ${canArm ? 'cursor-pointer' : ''}`}
                style={{ width: NAME_COL_WIDTH }}
                onClick={canArm ? () => setArmedMedicId(prev => prev === medic.id ? null : medic.id) : undefined}
                role={canArm ? 'button' : undefined}
                title={canArm ? (isArmed ? 'Tap a huddle row to assign — Esc to cancel' : 'Tap, then tap a huddle row to assign') : undefined}
              >
                <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className={isMobile ? 'w-10 h-10' : 'w-7 h-7'} />
                <div className="min-w-0">
                  <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{getDisplayName(medic)}</p>
                  {activeProviderIdsForVisibleDay.has(medic.id) ? (
                    <p className="text-[9pt] text-themeblue3 font-medium truncate">Provider</p>
                  ) : medic.credential ? (
                    <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 relative">
                {/* Hour grid lines with day dividers */}
                {days.map((day, dayIdx) => (
                  Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={`${day.dateKey}-${h}`}
                      className={`absolute top-0 bottom-0 ${
                        h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                      }`}
                      style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                    />
                  ))
                )).flat()}

                {/* Event blocks — stacked in lanes */}
                {positioned.map(({ event, left, width, lane }) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className={`absolute rounded border text-left overflow-hidden transition-all duration-150 active:scale-[0.98] ${CATEGORY_BG_MAP[event.category]}`}
                    style={{
                      left,
                      width,
                      top: ROW_PAD + lane * (LANE_HEIGHT + LANE_GAP),
                      height: LANE_HEIGHT,
                    }}
                  >
                    <p
                      className="absolute inset-y-0 right-0 text-[9pt] font-normal truncate px-1.5"
                      style={{
                        left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                        lineHeight: `${LANE_HEIGHT}px`,
                      }}
                    >
                      {event.title}
                      {width > 80 && (
                        <span className="text-[9pt] md:text-[9pt] opacity-60 ml-1.5">
                          {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {/* Unassigned events row */}
        {unassignedLanes.length > 0 && (() => {
          const laneCount = Math.max(...unassignedLanes.map(p => p.lane)) + 1
          const rowHeight = Math.max(ROW_PAD * 2 + laneCount * (LANE_HEIGHT + LANE_GAP), 52)
          return (
            <div className="relative flex border-b border-primary/5 bg-themeredred/3" style={{ height: rowHeight }}>
              <div className={`sticky left-0 z-[5] shrink-0 flex items-center gap-2 border-r border-primary/10 bg-themeredred/5 ${isMobile ? 'px-3' : 'px-2'}`} style={{ width: NAME_COL_WIDTH }}>
                <span className="text-[9pt] font-semibold text-themeredred">UNASSIGNED</span>
              </div>
              <div className="flex-1 relative">
                {days.map((day, dayIdx) => (
                  Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={`${day.dateKey}-${h}`}
                      className={`absolute top-0 bottom-0 ${
                        h === 0 ? 'border-l-2 border-l-primary/20' : 'border-l border-l-primary/5'
                      }`}
                      style={{ left: dayIdx * DAY_WIDTH + h * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                    />
                  ))
                )).flat()}

                {unassignedLanes.map(({ event, left, width, lane }) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className="absolute rounded border-2 border-dashed overflow-hidden transition-all duration-150 active:scale-[0.98] border-themeredred/30 bg-themeredred/5 text-themeredred"
                    style={{
                      left,
                      width,
                      top: ROW_PAD + lane * (LANE_HEIGHT + LANE_GAP),
                      height: LANE_HEIGHT,
                    }}
                  >
                    <p
                      className="absolute inset-y-0 right-0 text-[9pt] font-normal truncate px-1.5"
                      style={{
                        left: `clamp(0px, calc(var(--sl, 0) * 1px - ${left}px), ${Math.max(0, width - 40)}px)`,
                        lineHeight: `${LANE_HEIGHT}px`,
                      }}
                    >
                      {event.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Bottom padding */}
        <div className="h-20" />
      </div>

      <PreviewOverlay
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        anchorRect={pickerAnchor}
        title="Jump to date"
      >
        <DatePickerCalendar
          value={toDateKey(date)}
          onChange={handlePickerChange}
          onClose={() => setPickerOpen(false)}
        />
      </PreviewOverlay>
    </div>
  )
}
