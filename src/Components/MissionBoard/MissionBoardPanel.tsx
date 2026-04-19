import { useCallback } from 'react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { MissionGantt } from './MissionGantt'
import { MissionMapCard } from './MissionMapCard'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'

interface MissionBoardPanelProps {
  /** True when rendered as full Column B on desktop — adds top padding and scroll container */
  standalone?: boolean
}

export function MissionBoardPanel({ standalone = false }: MissionBoardPanelProps) {
  const { isAuthenticated, isDevRole } = useAuth()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const selectEvent = useCalendarStore(s => s.selectEvent)
  const events = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)
  const { sendEvent: vaultSendEvent, deleteEvents: vaultDeleteEvents } = useCalendarVault()

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
    <div className={standalone ? 'h-full overflow-y-auto pt-3 pb-4' : 'pb-1'}>

      {/* Map card */}
      <div className="mb-2.5">
        <MissionMapCard onOpenMap={() => setShowMapOverlayDrawer(true)} />
      </div>

      {/* Gantt card */}
      <div className="mb-2.5">
        <MissionGantt onEventClick={handleEventClick} onOpenCalendar={() => setShowCalendarDrawer(true)} onStatusChange={handleStatusChange} />
      </div>

      {/* Divider — only when embedded above CategoryList */}
      {!standalone && (
        <div className="mt-4 mb-1 border-t border-themeblue3/8" />
      )}
    </div>
  )
}
