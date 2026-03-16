import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Users, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { RosterPane } from './Calendar/RosterPane'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useIsMobile } from '../Hooks/useIsMobile'

interface CalendarDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function CalendarDrawer({ isVisible, onClose }: CalendarDrawerProps) {
    const isMobile = useIsMobile()

    const { selectedEventId, assignPersonnel, unassignPersonnel, events, showRosterMobile, setShowRosterMobile } =
        useCalendarStore(useShallow(s => ({
            selectedEventId: s.selectedEventId,
            assignPersonnel: s.assignPersonnel,
            unassignPersonnel: s.unassignPersonnel,
            events: s.events,
            showRosterMobile: s.showRosterMobile,
            setShowRosterMobile: s.setShowRosterMobile,
        })))

    const handleRosterAssign = useCallback((userId: string) => {
        if (!selectedEventId) return
        const event = events.find(e => e.id === selectedEventId)
        if (!event) return
        if (event.assigned_to.includes(userId)) {
            unassignPersonnel(selectedEventId, userId)
        } else {
            assignPersonnel(selectedEventId, userId)
        }
    }, [selectedEventId, events, assignPersonnel, unassignPersonnel])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            desktopWidth="w-[90%]"
            mobileFullScreen
            header={{
                title: 'Calendar',
                badge: 'DEV',
                rightContent: isMobile ? (
                    <button
                        onClick={() => setShowRosterMobile(!showRosterMobile)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                            showRosterMobile ? 'bg-themeblue3 text-white' : 'text-tertiary hover:bg-primary/5'
                        }`}
                    >
                        <Users size={16} />
                    </button>
                ) : undefined,
            }}
        >
            <div className="flex h-full overflow-hidden relative">
                {/* Roster — desktop: left pane */}
                {!isMobile && (
                    <div className="w-[280px] shrink-0">
                        <RosterPane
                            onAssignToEvent={handleRosterAssign}
                            assignableEventId={selectedEventId}
                        />
                    </div>
                )}

                {/* Schedule — right pane (or full width on mobile) */}
                <div className="flex-1 min-w-0">
                    <CalendarPanel onBack={onClose} />
                </div>

                {/* Roster — mobile: slide-up sheet */}
                {isMobile && (
                    <div
                        className={`absolute inset-x-0 bottom-0 z-20 bg-themewhite3 rounded-t-2xl shadow-lg border-t border-primary/10 transition-transform duration-300 ease-out ${
                            showRosterMobile ? 'translate-y-0' : 'translate-y-full'
                        }`}
                        style={{ height: '60%' }}
                    >
                        {/* Sheet handle */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-1 rounded-full bg-tertiary/20 mx-auto" />
                            </div>
                            <button
                                onClick={() => setShowRosterMobile(false)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="h-[calc(100%-40px)]">
                            <RosterPane
                                onAssignToEvent={handleRosterAssign}
                                assignableEventId={selectedEventId}
                                compact
                            />
                        </div>
                    </div>
                )}
            </div>
        </BaseDrawer>
    )
}
