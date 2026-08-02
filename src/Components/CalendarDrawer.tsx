import { useState, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Settings as SettingsIcon, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { PreviewOverlay } from './PreviewOverlay'
import { Sheet } from '@/Components/primitives/Sheet'
import { CalendarPanel } from './Calendar/CalendarPanel'
import { MiniCalendar } from './Calendar/MiniCalendar'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { PersonnelRow, PersonnelGroupBand, PersonnelCheck } from '@/Components/primitives/PersonnelRow'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
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
    // now live on the calendar's view-config popover (island "view options" button).
    // The settings drawer keeps only clinic-level config (supervisor).
    const layoutSection = isSupervisorRole ? (
        <div className="px-5 py-4">
            <CalendarClinicEditor variant="calendar" />
        </div>
    ) : null

    // Category filter panel — list-item UI matching personnelFilterPanel
    const categoryFilterPanel = (
        <div className="flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-t border-primary/10">
                <p className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">Filter Categories</p>
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

    // Personnel filter sidebar panel — literally the supervisor rail's rows now,
    // via PersonnelRow / PersonnelGroupBand rather than by resemblance. The
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
            <PersonnelRow
                key={medic.id}
                avatar={<UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />}
                name={getDisplayName(medic)}
                sub={medic.credential}
                selected={isSelected}
                onClick={() => togglePersonnelFilter(medic.id)}
                trailing={isSelected ? <PersonnelCheck /> : undefined}
            />
        )
    }

    const personnelFilterPanel = (
        <div className="flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-t border-primary/10">
                <p className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">Filter Personnel</p>
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
                        <PersonnelGroupBand
                            label={group.name}
                            expanded={!collapsed}
                            onToggle={() => toggleGroupCollapse(group.id)}
                            onSelect={() => togglePersonnelGroup(ids)}
                            trailing={allSelected ? <PersonnelCheck size={13} /> : undefined}
                        />
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
                            <PillButton icon={SettingsIcon} onClick={() => setShowSettings(true)} label="Settings" />
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
                    {/* Contextual sidebar — desktop only, hidden for troops-to-task (has its own personnel column).
                        Collapses (slides out left) when the schedule opens its right pane. */}
                    {!isMobile && viewMode !== 'troops' && (
                        <SlideRevealPane
                            open={!rightPanelOpen}
                            side="left"
                            width={240}
                            keepMounted
                            className="border-r border-primary/10"
                        >
                            <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1">
                                <div className="flex-1 min-w-0">
                                    <SearchInput
                                        value={rosterSearchQuery}
                                        onChange={setRosterSearchQuery}
                                        placeholder="Search personnel"
                                    />
                                </div>
                                {/* Settings gear holds clinic config (supervisor only);
                                    per-view layout prefs moved to the island "view options" button. */}
                                {isSupervisorRole && (
                                    <button
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
                        </SlideRevealPane>
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
                        {/* Fixed pad only — the Sheet owns var(--sab) now that it
                            sits flush to the bottom edge; repeating it double-counts. */}
                        <div className="pb-4">
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
                        <div>
                            {layoutSection}
                        </div>
                    </PreviewOverlay>
                )}
            </div>
        </BaseDrawer>
    )
}
