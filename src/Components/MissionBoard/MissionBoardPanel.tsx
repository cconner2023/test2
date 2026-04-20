import { useCallback, useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { useAuthStore } from '../../stores/useAuthStore'
import { getOverlay } from '../../lib/mapOverlayService'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'
import { toDateKey, eventFallsOnDate } from '../../Types/CalendarTypes'
import { MissionMapCard } from './MissionMapCard'
import {
  TaskRow, statusMenuItems,
  formatDateLabel, offsetDate,
} from './MissionGantt'
import { DatePickerCalendar } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { ContextMenu } from '../ContextMenu'

const TASK_PREVIEW_LIMIT = 4

interface MissionBoardPanelProps {
  standalone?: boolean
}

export function MissionBoardPanel({ standalone = false }: MissionBoardPanelProps) {
  const { isAuthenticated, isDevRole } = useAuth()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const selectEvent = useCalendarStore(s => s.selectEvent)
  const events = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)
  const userId = useAuthStore(s => s.user?.id)
  const { sendEvent: vaultSendEvent, deleteEvents: vaultDeleteEvents } = useCalendarVault()

  const [missionOverlayFeatures, setMissionOverlayFeatures] = useState<OverlayFeature[]>([])
  const [missionOverlayId, setMissionOverlayId] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [contextMenu, setContextMenu] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null)

  const dateBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const overlayIds = Array.from(
      new Set(
        events
          .filter(e => e.structured_location?.overlay_id)
          .map(e => e.structured_location!.overlay_id!)
      )
    )
    if (overlayIds.length === 0) {
      setMissionOverlayFeatures([])
      setMissionOverlayId(undefined)
      return
    }
    let cancelled = false
    Promise.all(overlayIds.map(id => getOverlay(id))).then(results => {
      if (cancelled) return
      const allFeatures: OverlayFeature[] = []
      for (const result of results) {
        if (result.ok && result.data) allFeatures.push(...result.data.features)
      }
      setMissionOverlayFeatures(allFeatures)
      setMissionOverlayId(overlayIds[0])
    })
    return () => { cancelled = true }
  }, [events])

  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(new Date())
  const allDayEvents = events.filter(e => eventFallsOnDate(e, dateKey))
  const myTasks = allDayEvents
    .filter(e => !!userId && e.assigned_to.includes(userId))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const previewTasks = myTasks.slice(0, TASK_PREVIEW_LIMIT)
  const extraCount = Math.max(0, myTasks.length - TASK_PREVIEW_LIMIT)

  const navigate = (dir: -1 | 1) => setSelectedDate(d => offsetDate(d, dir))

  const openPicker = () => {
    setAnchorRect(dateBtnRef.current?.getBoundingClientRect() ?? null)
    setPickerOpen(true)
  }

  const handleEventClick = useCallback((eventId: string) => {
    selectEvent(eventId)
    setShowCalendarDrawer(true)
  }, [selectEvent, setShowCalendarDrawer])

  const handleStatusChange = useCallback((eventId: string, status: EventStatus) => {
    const event = events.find((e: CalendarEvent) => e.id === eventId)
    if (!event) return
    const updatedEvent: CalendarEvent = { ...event, status, updated_at: new Date().toISOString() }
    const oldOriginIds = event.originId ? [event.originId] : []
    if (oldOriginIds.length > 0) vaultDeleteEvents(oldOriginIds).catch(() => {})
    vaultSendEvent('c', updatedEvent).then(newOriginId => {
      if (newOriginId) updateEvent(eventId, { originId: newOriginId })
    }).catch(() => {})
    updateEvent(eventId, { status })
  }, [events, updateEvent, vaultSendEvent, vaultDeleteEvents])

  if (!isAuthenticated || !isDevRole) return null

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2">

      {/* Header */}
      <div className="flex items-center px-2 py-1.5 border-b border-themeblue3/8">
        <div className="flex items-center gap-0.5">
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(-1)}>
            <ChevronLeft size={13} />
          </button>
          <button
            ref={dateBtnRef}
            className="text-xs font-medium text-primary py-0.5 px-1 rounded active:bg-themeblue2/10 whitespace-nowrap"
            onClick={openPicker}
          >
            {isToday ? 'Today' : formatDateLabel(selectedDate)}
          </button>
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(1)}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Body: task list (left) + mini map (right) */}
      <div className="flex min-h-[110px]">

        {/* Task list */}
        <div className="flex-1 min-w-0 px-2.5 py-2 flex flex-col gap-1.5">
          {myTasks.length === 0 ? (
            <span className="text-xs text-secondary py-0.5">No tasks today</span>
          ) : (
            <>
              {previewTasks.map(event => (
                <TaskRow
                  key={event.id}
                  event={event}
                  onClick={() => handleEventClick(event.id)}
                  onContextMenu={(x, y) => setContextMenu({ event, x, y })}
                />
              ))}
              {extraCount > 0 && (
                <button
                  onClick={() => setShowCalendarDrawer(true)}
                  className="text-[10px] font-medium text-secondary text-left pl-2 py-0.5 active:text-themeblue1"
                >
                  +{extraCount} more
                </button>
              )}
            </>
          )}
        </div>

        {/* Mini map — QR-style framed thumbnail */}
        <div className="w-[128px] shrink-0 border-l border-themeblue3/10 p-1.5 bg-white dark:bg-themewhite2">
          <div className="w-full h-full rounded-lg overflow-hidden">
            <MissionMapCard
              overlayFeatures={missionOverlayFeatures}
              overlayId={missionOverlayId}
              onClick={() => setShowMapOverlayDrawer(true, missionOverlayId)}
            />
          </div>
        </div>
      </div>

      <PreviewOverlay isOpen={pickerOpen} onClose={() => setPickerOpen(false)} anchorRect={anchorRect}>
        <DatePickerCalendar
          value={dateKey}
          onChange={(iso) => { setSelectedDate(new Date(iso + 'T00:00:00')); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      </PreviewOverlay>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={statusMenuItems(contextMenu.event, (status) => {
            handleStatusChange(contextMenu.event.id, status)
            setContextMenu(null)
          })}
        />
      )}

      {!standalone && (
        <div className="mt-2 border-t border-themeblue3/8" />
      )}
    </div>
  )
}
