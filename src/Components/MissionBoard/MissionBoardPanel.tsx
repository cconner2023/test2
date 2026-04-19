import { useCallback } from 'react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { MissionGantt } from './MissionGantt'
import { MissionMapCard } from './MissionMapCard'

interface MissionBoardPanelProps {
  /** True when rendered as full Column B on desktop — adds top padding and scroll container */
  standalone?: boolean
}

export function MissionBoardPanel({ standalone = false }: MissionBoardPanelProps) {
  const { isAuthenticated, isDevRole } = useAuth()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const selectEvent = useCalendarStore(s => s.selectEvent)

  const handleEventClick = useCallback((eventId: string) => {
    selectEvent(eventId)
    setShowCalendarDrawer(true)
  }, [selectEvent, setShowCalendarDrawer])

  if (!isAuthenticated || !isDevRole) return null

  return (
    <div className={standalone ? 'h-full overflow-y-auto pt-3 pb-4' : 'pb-1'}>

      {/* Map card */}
      <div className="mb-2.5">
        <MissionMapCard onOpenMap={() => setShowMapOverlayDrawer(true)} />
      </div>

      {/* Gantt card */}
      <MissionGantt onEventClick={handleEventClick} onOpenCalendar={() => setShowCalendarDrawer(true)} />

      {/* Divider — only when embedded above CategoryList */}
      {!standalone && (
        <div className="mt-4 mb-1 border-t border-themeblue3/8" />
      )}
    </div>
  )
}
