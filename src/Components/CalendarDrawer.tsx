import { useState, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, ListFilter, Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { RosterPane } from './Calendar/RosterPane'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../Hooks/useClinicGroupedMedics'
import { getInitials } from '../Utilities/nameUtils'

function formatMedicName(m: { rank?: string | null; firstName?: string | null; lastName?: string | null }): string {
    const parts: string[] = []
    if (m.rank) parts.push(m.rank)
    if (m.lastName) {
        let name = m.lastName
        if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
        parts.push(name)
    }
    return parts.join(' ') || 'Unknown'
}

interface CalendarDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function CalendarDrawer({ isVisible, onClose }: CalendarDrawerProps) {
    const isMobile = useIsMobile()

    const { selectedEventId, assignPersonnel, unassignPersonnel, events, personnelFilter, togglePersonnelFilter, clearPersonnelFilter, monthLabel } =
        useCalendarStore(useShallow(s => ({
            selectedEventId: s.selectedEventId,
            assignPersonnel: s.assignPersonnel,
            unassignPersonnel: s.unassignPersonnel,
            events: s.events,
            personnelFilter: s.personnelFilter,
            togglePersonnelFilter: s.togglePersonnelFilter,
            clearPersonnelFilter: s.clearPersonnelFilter,
            monthLabel: s.monthLabel,
        })))

    const [showPersonnelDrawer, setShowPersonnelDrawer] = useState(false)

    const { medics } = useClinicMedics()
    const { ownClinicMedics } = useClinicGroupedMedics(medics)

    const drawerRef = useRef<HTMLDivElement>(null)
    const touchStartY = useRef(0)
    const touchCurrentY = useRef(0)
    const isDragging = useRef(false)

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY
        touchCurrentY.current = e.touches[0].clientY
        isDragging.current = false
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const deltaY = e.touches[0].clientY - touchStartY.current
        touchCurrentY.current = e.touches[0].clientY
        if (deltaY > 10) {
            isDragging.current = true
            if (drawerRef.current) {
                drawerRef.current.style.transform = `translateY(${Math.max(0, deltaY)}px)`
            }
        }
    }, [])

    const handleTouchEnd = useCallback(() => {
        const deltaY = touchCurrentY.current - touchStartY.current
        if (drawerRef.current) {
            drawerRef.current.style.transform = ''
        }
        if (isDragging.current && deltaY > 100) {
            setShowPersonnelDrawer(false)
        }
        isDragging.current = false
    }, [])

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
            mobileFullScreen
            desktopWidth="w-[90%]"
            header={!isMobile ? {
                title: 'Calendar',
                badge: 'DEV',
            } : undefined}
        >
            <div className="flex flex-col h-full">
                {/* Mobile header — own safe-area-aware header like conversation view */}
                {isMobile && (
                    <div className="md:hidden sticky top-0 z-10 shrink-0 backdrop-blur-xs bg-transparent">
                        <div className="px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center justify-between">
                            <HeaderPill>
                                <PillButton icon={ListFilter} onClick={() => setShowPersonnelDrawer(true)} label="Filter" />
                            </HeaderPill>
                            <span className="text-sm font-semibold text-primary">
                                {monthLabel}
                            </span>
                            <HeaderPill>
                                <PillButton icon={X} onClick={onClose} label="Close" />
                            </HeaderPill>
                        </div>
                        <div className="grid grid-cols-7">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
                                <div key={i} className="text-center text-[10px] font-semibold text-tertiary/50 py-1 uppercase">
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-1 min-h-0 overflow-hidden relative">
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

                    {/* Personnel filter drawer — mobile */}
                    {isMobile && (
                        <>
                            <div
                                className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ${
                                    showPersonnelDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                }`}
                                onClick={() => setShowPersonnelDrawer(false)}
                            />
                            <div
                                ref={drawerRef}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={`fixed inset-x-0 bottom-0 z-40 bg-themewhite3 rounded-t-2xl shadow-xl transition-transform duration-300 ease-out ${
                                    showPersonnelDrawer ? 'translate-y-0' : 'translate-y-full'
                                }`}
                                style={{ maxHeight: '70vh' }}
                            >
                                <div className="flex justify-center py-3">
                                    <div className="w-10 h-1 rounded-full bg-tertiary/30" />
                                </div>
                                <div className="overflow-y-auto px-2 pb-[max(1rem,var(--sab,0px))]" style={{ maxHeight: 'calc(70vh - 48px)' }}>
                                    {ownClinicMedics.map(medic => {
                                        const isSelected = personnelFilter.includes(medic.id)
                                        return (
                                            <button
                                                key={medic.id}
                                                onClick={() => togglePersonnelFilter(medic.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 active:scale-[0.98] ${
                                                    isSelected ? 'bg-themeblue3/8' : ''
                                                }`}
                                            >
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                                                    isSelected ? 'bg-themeblue3 text-white' : 'bg-primary/8 text-secondary'
                                                }`}>
                                                    {getInitials(medic.firstName, medic.lastName)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-primary truncate">
                                                        {formatMedicName(medic)}
                                                    </p>
                                                    {medic.credential && (
                                                        <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <Check size={16} className="text-themeblue3 shrink-0" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </BaseDrawer>
    )
}
