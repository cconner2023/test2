import { useState, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Settings as SettingsIcon, Check, ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Square, Columns3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { PreviewOverlay } from './PreviewOverlay'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { MiniCalendar } from './Calendar/MiniCalendar'
import { SearchInput } from './SearchInput'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useAuth } from '../Hooks/useAuth'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../Hooks/useClinicGroupedMedics'
import { UserAvatar } from './Settings/UserAvatar'
import { getDisplayName } from '../Utilities/nameUtils'
import { ActionPill } from './ActionPill'
import { CalendarClinicEditor } from './Calendar/CalendarClinicEditor'
import type { EventCategory } from '../Types/CalendarTypes'

const CATEGORY_GROUPS: { key: 'huddle' | 'calendar' | 'tasks'; label: string; categories: EventCategory[] }[] = [
  { key: 'huddle',   label: 'Huddle',   categories: ['huddle', 'templated'] },
  { key: 'calendar', label: 'Calendar', categories: ['training', 'duty', 'range', 'appointment', 'mission', 'medevac', 'leave', 'other'] },
  { key: 'tasks',    label: 'Tasks',    categories: ['task'] },
]
const ALL_FILTERABLE_CATEGORIES: EventCategory[] = CATEGORY_GROUPS.flatMap(g => g.categories)

interface CalendarDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function CalendarDrawer({ isVisible, onClose }: CalendarDrawerProps) {
    const isMobile = useIsMobile()
    const { isSupervisorRole } = useAuth()

    const {
        events, personnelFilter, togglePersonnelFilter, clearPersonnelFilter,
        monthLabel, viewMode, rosterSearchQuery, setRosterSearchQuery,
        selectedDate, setSelectedDate,
        daySpan, setDaySpan, hideWeekends, setHideWeekends,
        categoryFilter, setCategoryFilter,
    } = useCalendarStore(useShallow(s => ({
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
        daySpan: s.daySpan,
        setDaySpan: s.setDaySpan,
        hideWeekends: s.hideWeekends,
        setHideWeekends: s.setHideWeekends,
        categoryFilter: s.categoryFilter,
        setCategoryFilter: s.setCategoryFilter,
    })))

    const categoryActiveSet = categoryFilter === null ? new Set(ALL_FILTERABLE_CATEGORIES) : new Set(categoryFilter)
    const isCategoryGroupOn = (cats: EventCategory[]) => cats.some(c => categoryActiveSet.has(c))
    const toggleCategoryGroup = (cats: EventCategory[]) => {
        const next = new Set(categoryActiveSet)
        if (isCategoryGroupOn(cats)) {
            for (const c of cats) next.delete(c)
        } else {
            for (const c of cats) next.add(c)
        }
        const arr = ALL_FILTERABLE_CATEGORIES.filter(c => next.has(c))
        setCategoryFilter(arr.length === ALL_FILTERABLE_CATEGORIES.length ? null : arr)
    }

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

    // Tour events — open/close the mobile settings drawer programmatically
    useEffect(() => {
        const openHandler = () => setShowSettings(true)
        const closeHandler = () => setShowSettings(false)
        window.addEventListener('tour:calendar-open-controls', openHandler)
        window.addEventListener('tour:calendar-close-controls', closeHandler)
        return () => {
            window.removeEventListener('tour:calendar-open-controls', openHandler)
            window.removeEventListener('tour:calendar-close-controls', closeHandler)
        }
    }, [])

    const [showDatePopover, setShowDatePopover] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [controlsDisplayMonth, setControlsDisplayMonth] = useState(() => {
        const [y, m] = selectedDate.split('-').map(Number)
        return new Date(y, m - 1, 1)
    })

    const controlsMonthLabel = controlsDisplayMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    })

    const controlsPrevMonth = useCallback(() => {
        setControlsDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    }, [])

    const controlsNextMonth = useCallback(() => {
        setControlsDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    }, [])

    const controlsMonthNav = (
        <div className="flex items-center gap-3 flex-1 justify-center">
            <button
                onClick={controlsPrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-primary min-w-[120px] text-center">
                {controlsMonthLabel}
            </span>
            <button
                onClick={controlsNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    )

    const { medics } = useClinicMedics()
    const { ownClinicMedics } = useClinicGroupedMedics(medics)

    const handleMobileDateSelect = useCallback((dateKey: string) => {
        setSelectedDate(dateKey)
        setShowDatePopover(false)
    }, [setSelectedDate])

    // Layout prefs — two cards, each with icon-action-item toggle (mirrors ThemePickerPanel light/dark toggle)
    const renderIconToggleCard = <T extends string | number | boolean>(
        label: string,
        tagline: string,
        options: { value: T; icon: LucideIcon; ariaLabel: string }[],
        current: T,
        onPick: (v: T) => void,
    ) => (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-themeblue3/10 bg-themewhite2">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">{label}</p>
                <p className="text-[9pt] text-tertiary mt-0.5">{tagline}</p>
            </div>
            <ActionPill className="shrink-0">
                {options.map(opt => {
                    const isActive = current === opt.value
                    const Icon = opt.icon
                    return (
                        <button
                            key={String(opt.value)}
                            onClick={() => onPick(opt.value)}
                            aria-label={opt.ariaLabel}
                            aria-pressed={isActive}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isActive
                                    ? 'bg-themeblue2 text-white'
                                    : 'bg-themeblue2/8 text-primary'
                            }`}
                        >
                            <Icon size={16} />
                        </button>
                    )
                })}
            </ActionPill>
        </div>
    )

    const layoutSection = (
        <div className="px-5 py-4 space-y-3">
            {renderIconToggleCard<boolean>(
                'Weekends',
                hideWeekends ? 'Mon — Fri' : 'Mon — Sun',
                [
                    { value: false, icon: CalendarDays, ariaLabel: 'Show weekends' },
                    { value: true, icon: CalendarOff, ariaLabel: 'Hide weekends' },
                ],
                hideWeekends,
                setHideWeekends,
            )}
            {renderIconToggleCard<typeof daySpan>(
                'Day view',
                daySpan === 3 ? 'Three days at a time' : 'One day at a time',
                [
                    { value: 1, icon: Square, ariaLabel: 'Single day' },
                    { value: 3, icon: Columns3, ariaLabel: 'Triple day' },
                ],
                daySpan,
                setDaySpan,
            )}
            {isSupervisorRole && <CalendarClinicEditor />}
        </div>
    )

    // Category filter panel — list-item UI matching personnelFilterPanel
    const categoryFilterPanel = (
        <div data-tour="calendar-category-filter" className="flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-t border-primary/10">
                <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Filter Categories</p>
            </div>

            {/* All Categories — clears filter to null */}
            <button
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                    categoryFilter === null
                        ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                        : 'hover:bg-secondary/5'
                }`}
                onClick={() => setCategoryFilter(null)}
            >
                <span className="text-[10pt] font-medium text-primary truncate flex-1">All Categories</span>
            </button>

            {/* Group rows */}
            <div>
                {CATEGORY_GROUPS.map(g => {
                    const isSelected = isCategoryGroupOn(g.categories)
                    return (
                        <button
                            key={g.key}
                            onClick={() => toggleCategoryGroup(g.categories)}
                            className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                                isSelected
                                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                                    : 'hover:bg-secondary/5'
                            }`}
                        >
                            <span className="text-[10pt] font-medium text-primary truncate flex-1">{g.label}</span>
                            {isSelected && (
                                <Check size={14} className="text-themeblue2 shrink-0" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )

    // Personnel filter sidebar panel — matches SupervisorTree pattern
    const personnelFilterPanel = (
        <div data-tour="calendar-personnel-filter" className="flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-t border-primary/10">
                <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Filter Personnel</p>
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
                <span className="text-[10pt] font-medium text-primary truncate flex-1">All Personnel</span>
            </button>

            {/* Personnel list */}
            <div>
                {ownClinicMedics
                    .filter(medic => {
                        const q = rosterSearchQuery.trim().toLowerCase()
                        if (!q) return true
                        return getDisplayName(medic).toLowerCase().includes(q)
                            || (medic.credential?.toLowerCase().includes(q) ?? false)
                    })
                    .map(medic => {
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
                                <p className="text-[10pt] font-medium text-primary truncate">
                                    {getDisplayName(medic)}
                                </p>
                                {medic.credential && (
                                    <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                                )}
                            </div>
                            {isSelected && (
                                <Check size={14} className="text-themeblue2 shrink-0" />
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
            header={{
                title: isMobile ? '' : 'Calendar',
                rightContentFill: isMobile,
                rightContent: isMobile ? (
                    <div className="flex items-center w-full gap-2">
                        <HeaderPill>
                            <PillButton data-tour="calendar-mobile-filter" icon={SettingsIcon} onClick={() => setShowSettings(true)} label="Settings" />
                        </HeaderPill>
                        <button
                            onClick={() => setShowDatePopover(true)}
                            className="flex-1 text-center text-sm font-semibold text-primary active:opacity-70 transition-opacity"
                        >
                            {monthLabel}
                        </button>
                        <HeaderPill>
                            <PillButton icon={X} onClick={onClose} label="Close" />
                        </HeaderPill>
                    </div>
                ) : undefined,
                hideDefaultClose: isMobile,
                extraRow: isMobile && viewMode === 'month' ? (
                    <div
                        className="grid"
                        style={{ gridTemplateColumns: `repeat(${hideWeekends ? 5 : 7}, minmax(0, 1fr))` }}
                    >
                        {(hideWeekends ? ['M', 'T', 'W', 'T', 'F'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((label, i) => (
                            <div key={i} className="text-center text-[9pt] font-semibold text-tertiary py-1 uppercase">
                                {label}
                            </div>
                        ))}
                    </div>
                ) : undefined,
            }}
            scrollDisabled
        >
            <div className="relative h-full">
                <div className="flex absolute inset-0 overflow-hidden">
                    {/* Contextual sidebar — desktop only, hidden for troops-to-task (has its own personnel column) */}
                    {!isMobile && viewMode !== 'troops' && (
                        <div data-tour="calendar-desktop-sidebar" className={`shrink-0 flex flex-col border-r border-primary/10 transition-all duration-300 ${rightPanelOpen ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-60'}`}>
                            <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1">
                                <div className="flex-1 min-w-0">
                                    <SearchInput
                                        value={rosterSearchQuery}
                                        onChange={setRosterSearchQuery}
                                        placeholder="Search personnel"
                                    />
                                </div>
                                <button
                                    data-tour="calendar-settings"
                                    onClick={() => setShowSettings(true)}
                                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                                        hideWeekends || daySpan !== 1
                                            ? 'bg-themeblue3/10 text-themeblue3'
                                            : 'text-tertiary hover:text-primary'
                                    }`}
                                    aria-label="Calendar settings"
                                    title="Calendar settings"
                                >
                                    <SettingsIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="shrink-0">
                                <MiniCalendar
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                    events={events}
                                />
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                {categoryFilterPanel}
                                {personnelFilterPanel}
                            </div>
                        </div>
                    )}

                    {/* Schedule — right pane (or full width on mobile) */}
                    <div className="flex-1 min-w-0">
                        <CalendarPanel onBack={onClose} scrollNonce={scrollNonce} onPanelStateChange={setRightPanelOpen} onOpenControls={() => setShowDatePopover(true)} />
                    </div>

                </div>

                {/* Mobile date popover — anchored to the month label in the header */}
                <PreviewOverlay
                    isOpen={showDatePopover}
                    onClose={() => setShowDatePopover(false)}
                    anchorRect={null}
                    maxWidth={340}
                >
                    <div className="flex items-center justify-between px-3 py-2">
                        {controlsMonthNav}
                    </div>
                    <div className="px-1 pb-2">
                        <MiniCalendar
                            selectedDate={selectedDate}
                            onSelectDate={handleMobileDateSelect}
                            events={events}
                            hideHeader
                            displayMonth={controlsDisplayMonth}
                            onDisplayMonthChange={setControlsDisplayMonth}
                        />
                    </div>
                </PreviewOverlay>

                {/* Calendar settings — mobile drawer + desktop popover, both share content */}
                {isMobile ? (
                    <BaseDrawer
                        isVisible={showSettings}
                        onClose={() => setShowSettings(false)}
                        mobileOnly
                        fullHeight="75dvh"
                        zIndex="z-50"
                        header={{ title: 'Calendar Settings', hideDefaultClose: false }}
                    >
                        <div data-tour="calendar-controls-drawer" className="pb-[max(1rem,var(--sab,0px))]">
                            {layoutSection}
                            {categoryFilterPanel}
                            {personnelFilterPanel}
                        </div>
                    </BaseDrawer>
                ) : (
                    <PreviewOverlay
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                        anchorRect={null}
                        title="Calendar Settings"
                        maxWidth={360}
                    >
                        <div data-tour="calendar-controls-drawer" className="max-h-[70vh] overflow-y-auto">
                            {layoutSection}
                        </div>
                    </PreviewOverlay>
                )}
            </div>
        </BaseDrawer>
    )
}
