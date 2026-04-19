import { useCallback, useState, useEffect } from 'react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { getOverlay } from '../../lib/mapOverlayService'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
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

  const [missionOverlayFeatures, setMissionOverlayFeatures] = useState<OverlayFeature[]>([])
  const [missionOverlayId, setMissionOverlayId] = useState<string | undefined>(undefined)

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
        <MissionMapCard
          overlayFeatures={missionOverlayFeatures}
          overlayId={missionOverlayId}
          onOpenMap={() => setShowMapOverlayDrawer(true, missionOverlayId)}
        />
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
