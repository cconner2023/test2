import { useState, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Settings as SettingsIcon, Check, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { PreviewOverlay } from './PreviewOverlay'
import { Sheet } from './Sheet'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { MiniCalendar } from './Calendar/MiniCalendar'
import { SearchInput } from './SearchInput'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useAuth } from '../Hooks/useAuth'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../Hooks/useClinicGroupedMedics'
import { UserAvatar } from './Settings/UserAvatar'
import { getDisplayName } from '../Utilities/nameUtils'
import { CalendarClinicEditor } from './Calendar/CalendarClinicEditor'
import { SupervisorClinicFilterPanel, ClusterFilterPanel } from './SupervisorClinicSwitcher'
import { useSubClusters } from '../Hooks/useSubClusters'
import type { EventCategory } from '../Types/CalendarTypes'

const CATEGORY_GROUPS: { key: 'huddle' | 'calendar'; label: string; categories: EventCategory[] }[] = [
  { key: 'huddle',   label: 'Huddle',   categories: ['huddle', 'templated'] },
  { key: 'calendar', label: 'Calendar', categories: ['training', 'duty', 'range', 'appointment', 'mission', 'medevac', 'leave', 'other'] },
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
        events, personnelFilter, togglePersonnelFilter, togglePersonnelGroup, clearPersonnelFilter,
        monthLabel, viewMode, rosterSearchQuery, setRosterSearchQuery,
        selectedDate, setSelectedDate,
        hideWeekends,
        categoryFilter, setCategoryFilter,
    } = useCalendarStore(useShallow(s => ({
        events: s.events,
        personnelFilter: s.personnelFilter,
        togglePersonnelFilter: s.togglePersonnelFilter,
        togglePersonnelGroup: s.togglePersonnelGroup,
        clearPersonnelFilter: s.clearPersonnelFilter,
        monthLabel: s.monthLabel,
        viewMode: s.currentView,
        rosterSearchQuery: s.rosterSearchQuery,
        setRosterSearchQuery: s.setRosterSearchQuery,
        selectedDate: s.selectedDate,
        setSelectedDate: s.setSelectedDate,
        hideWeekends: s.hideWeekends,
        categoryFilter: s.categoryFilter,
        setCategoryFilter: s.setCategoryFilter,
    })))

    // The category filter only splits Huddle vs Calendar. With no huddle-band
    // events the split degenerates to "all events" — nothing to filter on — so
    // the panel is hidden entirely.
    const HUDDLE_CATEGORIES = CATEGORY_GROUPS.find(g => g.key === 'huddle')?.categories ?? []
    const hasHuddleEvents = events.some(e => HUDDLE_CATEGORIES.includes(e.category))
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
    const initialDate = useNavigationStore(s => s.calendarDrawerInitialDate)
    const clearInitialDate = useNavigationStore(s => s.clearCalendarDrawerInitialDate)

    // Snap to the staged initial date (or today) and trigger scroll whenever the drawer opens
    useEffect(() => {
        if (isVisible) {
            let key = initialDate
            if (!key) {
                const today = new Date()
                key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            }
            setSelectedDate(key)
            setScrollNonce(n => n + 1)
            if (initialDate) clearInitialDate()
        }
    }, [isVisible, initialDate, setSelectedDate, clearInitialDate])

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
    const { subClusters } = useSubClusters()
    // Collapsed sub-cluster groups in the grouped personnel tree (local UI state).
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
    const toggleGroupCollapse = (id: string) =>
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const handleMobileDateSelect = useCallback((dateKey: string) => {
        setSelectedDate(dateKey)
        setShowDatePopover(false)
    }, [setSelectedDate])

    // Per-view layout prefs (Weekends / Day layout / Troops cells + huddle-only)
    // now live on the calendar's view-config popover (re-tap the active view pill).
    // The settings drawer keeps only clinic-level config (supervisor).
    const layoutSection = isSupervisorRole ? (
        <div className="px-5 py-4">
            <CalendarClinicEditor variant="calendar" />
        </div>
    ) : null

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

    // Personnel filter sidebar panel — the supervisor cluster tree, reused. The
    // full clinic roster is grouped by sub-cluster (HQ/unassigned bucket for null
    // or stale ids); only groups with assigned people render. Tapping a group
    // header filters every member at once (this absorbs the old SubClusterFilter
    // panel — it's the same sub-unit scoping, one level up). Members toggle
    // individually; the chevron collapses a group.
    const HQ_GROUP_ID = '__hq__'
    const searchedMedics = ownClinicMedics.filter(medic => {
        const q = rosterSearchQuery.trim().toLowerCase()
        if (!q) return true
        return getDisplayName(medic).toLowerCase().includes(q)
            || (medic.credential?.toLowerCase().includes(q) ?? false)
    })
    const knownSubIds = new Set(subClusters.map(s => s.id))
    const groupOrder: { id: string; name: string }[] = [
        { id: HQ_GROUP_ID, name: 'HQ / Unassigned' },
        ...subClusters.map(s => ({ id: s.id, name: s.name })),
    ]
    const groupBuckets = new Map<string, typeof searchedMedics>(groupOrder.map(g => [g.id, []]))
    for (const m of searchedMedics) {
        const key = m.subClusterId && knownSubIds.has(m.subClusterId) ? m.subClusterId : HQ_GROUP_ID
        groupBuckets.get(key)!.push(m)
    }
    // Only group when the clinic actually defines sub-clusters; otherwise a flat list.
    const grouped = subClusters.length > 0
    const visibleGroups = groupOrder
        .map(g => ({ ...g, medics: groupBuckets.get(g.id)! }))
        .filter(g => g.medics.length > 0)

    const renderMedicRow = (medic: typeof searchedMedics[number]) => {
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
                <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
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
    }

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

            {/* Flat list when there are no sub-clusters to group by */}
            {!grouped && <div>{searchedMedics.map(renderMedicRow)}</div>}

            {/* Grouped (by sub-cluster) tree — group header filters the whole group */}
            {grouped && visibleGroups.map(group => {
                const ids = group.medics.map(m => m.id)
                const collapsed = collapsedGroups.has(group.id)
                const allSelected = ids.every(id => personnelFilter.includes(id))
                return (
                    <div key={group.id}>
                        <div className="flex items-center gap-2 py-2 px-4 bg-secondary/5 border-y border-primary/5">
                            <button
                                className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                                onClick={() => toggleGroupCollapse(group.id)}
                                aria-label={collapsed ? 'Expand group' : 'Collapse group'}
                            >
                                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button
                                onClick={() => togglePersonnelGroup(ids)}
                                className="flex items-center gap-2 flex-1 min-w-0 text-left active:scale-95 transition-transform"
                            >
                                <span className="text-[9pt] font-medium text-tertiary uppercase tracking-wide truncate flex-1">
                                    {group.name}
                                </span>
                                {allSelected && <Check size={13} className="text-themeblue2 shrink-0" />}
                            </button>
                        </div>
                        {!collapsed && group.medics.map(renderMedicRow)}
                    </div>
                )
            })}
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
                                {/* Settings gear holds clinic config (supervisor only);
                                    per-view layout prefs moved to the island view-config popover. */}
                                {isSupervisorRole && (
                                    <button
                                        data-tour="calendar-settings"
                                        onClick={() => setShowSettings(true)}
                                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 text-tertiary hover:text-primary"
                                        aria-label="Calendar settings"
                                        title="Calendar settings"
                                    >
                                        <SettingsIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="shrink-0">
                                <MiniCalendar
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                    events={events}
                                />
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <SupervisorClinicFilterPanel />
                                <ClusterFilterPanel />
                                {hasHuddleEvents && categoryFilterPanel}
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

                {/* Calendar settings — mobile Sheet + desktop popover, both share
                    content (map-settings standard for mobile settings icons). */}
                {isMobile ? (
                    <Sheet
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                        title="Calendar Settings"
                        height="fit"
                        maxHeight={60}
                        zIndex={1200}
                    >
                        <div data-tour="calendar-controls-drawer" className="pb-[max(1rem,var(--sab,0px))]">
                            {layoutSection}
                            <SupervisorClinicFilterPanel />
                            <ClusterFilterPanel />
                            {hasHuddleEvents && categoryFilterPanel}
                            {personnelFilterPanel}
                        </div>
                    </Sheet>
                ) : (
                    <PreviewOverlay
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                        anchorRect={null}
                        title="Calendar Settings"
                        maxWidth={360}
                        previewMaxHeight="70dvh"
                    >
                        <div data-tour="calendar-controls-drawer">
                            {layoutSection}
                        </div>
                    </PreviewOverlay>
                )}
            </div>
        </BaseDrawer>
    )
}
