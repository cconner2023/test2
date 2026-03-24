import { useState, useRef, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, ListFilter, Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { RosterPane } from './Calendar/RosterPane'
import { MiniCalendar } from './Calendar/MiniCalendar'
import { SearchInput } from './SearchInput'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../Hooks/useClinicGroupedMedics'
import { getInitials } from '../Utilities/nameUtils'
import { UserAvatar } from './Settings/UserAvatar'

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

    const {
        selectedEventId, assignPersonnel, unassignPersonnel,
        events, personnelFilter, togglePersonnelFilter, clearPersonnelFilter,
        monthLabel, viewMode, rosterSearchQuery, setRosterSearchQuery,
        selectedDate, setSelectedDate,
    } = useCalendarStore(useShallow(s => ({
        selectedEventId: s.selectedEventId,
        assignPersonnel: s.assignPersonnel,
        unassignPersonnel: s.unassignPersonnel,
        events: s.events,
        personnelFilter: s.personnelFilter,
        togglePersonnelFilter: s.togglePersonnelFilter,
        clearPersonnelFilter: s.clearPersonnelFilter,
        monthLabel: s.monthLabel,
        viewMode: s.currentView,
        rosterSearchQuery: s.rosterSearchQuery,
        setRosterSearchQuery: s.setRosterSearchQuery,
        selectedDate: s.selectedDate,
        setSelectedDate: s.setSelectedDate,
    })))

    const [scrollNonce, setScrollNonce] = useState(1)
    const [rightPanelOpen, setRightPanelOpen] = useState(false)

    // Reset to today and trigger scroll whenever the drawer opens
    useEffect(() => {
        if (isVisible) {
            const today = new Date()
            const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            setSelectedDate(key)
            setScrollNonce(n => n + 1)
        }
    }, [isVisible, setSelectedDate])

    const [showPersonnelDrawer, setShowPersonnelDrawer] = useState(false)
    const [searchFocused, setSearchFocused] = useState(false)
    const sidebarScrollRef = useRef<HTMLDivElement>(null)
    const searchWrapperRef = useRef<HTMLDivElement>(null)
    const searchInnerRef = useRef<HTMLDivElement>(null)
    const searchFocusedRef = useRef(false)
    searchFocusedRef.current = searchFocused
    const hasSearch = rosterSearchQuery.trim().length > 0
    const hasSearchRef = useRef(false)
    hasSearchRef.current = hasSearch

    const SEARCH_BAR_HEIGHT = 48

    // Scroll-collapse animation for search bar — matches ColumnA pattern
    useEffect(() => {
        const el = sidebarScrollRef.current
        const wrapper = searchWrapperRef.current
        if (!el || !wrapper) return

        let rafId: number | null = null
        const onScroll = () => {
            if (rafId !== null) return
            rafId = requestAnimationFrame(() => {
                rafId = null
                if (searchFocusedRef.current || hasSearchRef.current) {
                    wrapper.style.height = `${SEARCH_BAR_HEIGHT}px`
                    wrapper.style.opacity = '1'
                    if (searchInnerRef.current) searchInnerRef.current.style.transform = 'translateY(0px)'
                    return
                }
                const scrollTop = el.scrollTop
                const collapsed = Math.max(0, Math.min(scrollTop, SEARCH_BAR_HEIGHT))
                wrapper.style.height = `${SEARCH_BAR_HEIGHT - collapsed}px`
                wrapper.style.opacity = String(1 - (collapsed / SEARCH_BAR_HEIGHT) * 0.6)
                if (searchInnerRef.current) {
                    searchInnerRef.current.style.transform = `translateY(${-collapsed}px)`
                }
            })
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => { el.removeEventListener('scroll', onScroll); if (rafId !== null) cancelAnimationFrame(rafId) }
    }, [isMobile, viewMode])

    // Keep search bar expanded when focused or has value
    useEffect(() => {
        if (!searchWrapperRef.current) return
        if (hasSearch || searchFocused) {
            searchWrapperRef.current.style.height = `${SEARCH_BAR_HEIGHT}px`
            searchWrapperRef.current.style.opacity = '1'
        }
    }, [hasSearch, searchFocused])

    const handleSearchFocus = useCallback(() => {
        setSearchFocused(true)
        sidebarScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const handleSearchBlur = useCallback(() => {
        if (!hasSearchRef.current) {
            setSearchFocused(false)
            // Let the scroll position re-collapse the bar naturally
            const el = sidebarScrollRef.current
            const wrapper = searchWrapperRef.current
            if (el && wrapper) {
                const collapsed = Math.max(0, Math.min(el.scrollTop, SEARCH_BAR_HEIGHT))
                wrapper.style.height = `${SEARCH_BAR_HEIGHT - collapsed}px`
                wrapper.style.opacity = String(1 - (collapsed / SEARCH_BAR_HEIGHT) * 0.6)
            }
        }
    }, [])

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

    // Personnel filter sidebar panel — matches SupervisorTree pattern
    const personnelFilterPanel = (
        <div className="flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-t border-primary/10 flex items-center justify-between">
                <p className="text-xs font-medium text-tertiary/70 uppercase tracking-wide">Filter Personnel</p>
                {ownClinicMedics.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary/70 font-medium">
                        {personnelFilter.length > 0 ? `${personnelFilter.length}/${ownClinicMedics.length}` : ownClinicMedics.length}
                    </span>
                )}
            </div>

            {/* All Personnel — clears filter to show all events */}
            <button
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                    personnelFilter.length === 0
                        ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                        : 'hover:bg-secondary/5'
                }`}
                onClick={clearPersonnelFilter}
            >
                <span className="text-xs font-medium text-primary truncate flex-1">All Personnel</span>
            </button>

            {/* Personnel list */}
            <div>
                {ownClinicMedics.map(medic => {
                    const isSelected = personnelFilter.includes(medic.id)
                    return (
                        <button
                            key={medic.id}
                            onClick={() => togglePersonnelFilter(medic.id)}
                            className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                                isSelected
                                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                                    : 'hover:bg-secondary/5'
                            }`}
                        >
                            <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-primary truncate">
                                    {formatMedicName(medic)}
                                </p>
                                {medic.credential && (
                                    <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
                                )}
                            </div>
                            {isSelected && (
                                <Check size={14} className="text-themeblue3 shrink-0" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            mobileFullScreen
            desktopWidth="w-[90%]"
            header={!isMobile ? {
                title: 'Calendar',
            } : undefined}
        >
            <div className="relative h-full">
                {/* Mobile header — floats over content for scroll-behind blur */}
                {isMobile && (
                    <div className="md:hidden absolute top-0 inset-x-0 z-10 backdrop-blur-sm bg-transparent">
                        <div className="px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center justify-between">
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
                        {viewMode === 'month' && (
                            <div className="grid grid-cols-7">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
                                    <div key={i} className="text-center text-[10px] font-semibold text-tertiary/50 py-1 uppercase">
                                        {label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex absolute inset-0 overflow-hidden">
                    {/* Contextual sidebar — desktop only, hidden for troops-to-task (has its own personnel column) */}
                    {!isMobile && viewMode !== 'troops' && (
                        <div ref={sidebarScrollRef} className={`shrink-0 overflow-y-auto border-r border-primary/10 transition-all duration-300 ${rightPanelOpen ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-60'}`}>
                            <div
                                ref={searchWrapperRef}
                                className="overflow-hidden transition-[height,opacity] duration-200"
                                style={{ height: SEARCH_BAR_HEIGHT }}
                            >
                                <div ref={searchInnerRef} className="px-3 pt-2 pb-1"
                                    onFocusCapture={handleSearchFocus}
                                    onBlurCapture={handleSearchBlur}
                                >
                                    <SearchInput
                                        value={rosterSearchQuery}
                                        onChange={setRosterSearchQuery}
                                        placeholder="Search personnel"
                                    />
                                </div>
                            </div>
                            <MiniCalendar
                                selectedDate={selectedDate}
                                onSelectDate={setSelectedDate}
                                events={events}
                            />
                            {personnelFilterPanel}
                            {viewMode === 'day' && (
                                <div className="border-t border-primary/10">
                                    <RosterPane
                                        onAssignToEvent={handleRosterAssign}
                                        assignableEventId={selectedEventId}
                                        compact
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Schedule — right pane (or full width on mobile) */}
                    <div className="flex-1 min-w-0">
                        <CalendarPanel onBack={onClose} scrollNonce={scrollNonce} onPanelStateChange={setRightPanelOpen} />
                    </div>

                    {/* Personnel filter drawer — mobile */}
                    {isMobile && (
                        <>
                            <div
                                className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ${showPersonnelDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                    }`}
                                onClick={() => setShowPersonnelDrawer(false)}
                            />
                            <div
                                ref={drawerRef}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={`fixed inset-x-0 bottom-0 z-40 bg-themewhite3 rounded-t-2xl shadow-xl transition-transform duration-300 ease-out ${showPersonnelDrawer ? 'translate-y-0' : 'translate-y-full'
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
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 active:scale-[0.98] ${isSelected ? 'bg-themeblue3/8' : ''
                                                    }`}
                                            >
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isSelected ? 'bg-themeblue3 text-white' : 'bg-primary/8 text-secondary'
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
