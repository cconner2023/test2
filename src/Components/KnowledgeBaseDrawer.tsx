import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ChevronRight, RotateCcw, Pin, Pill, BookOpen, MoreHorizontal, GraduationCap, type LucideIcon } from 'lucide-react'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { SearchCancelButton, SearchDropdownCard, SearchDropdownGroup } from '@/Components/primitives/SearchDropdown'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { TrainingPanel, buildAllTasksByCategory, type TrainingView } from './Settings/TrainingPanel'
import { MedicationContent } from './MedicationContent'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { QuestionRow, WordListContent } from './ScreenerDrawer'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { VitalSignsCalculator, type VitalSignsCalculatorHandle } from './VitalSignsCalculator'
import { BurnCalculator } from './BurnCalculator'
import { HeatCategoryCalculator } from './HeatCategoryCalculator'
import { NineLineKB, NineLineExport, hasContent as nineLineHasContent } from './Reports/NineLineKB'
import { AddFab } from '@/Components/primitives/AddFab'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { DatePickerCalendar } from '@/Components/primitives/FormInputs'
import { PreviewOverlay } from './PreviewOverlay'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import { useShallow } from 'zustand/react/shallow'
import { kbCategories, kbGroupLabels, kbGroupOrder, type KBCategory } from '../Data/KnowledgeBaseCategories'
import { GAD7, PHQ2, MACE2, AUDITC } from '../Data/SpecTesting'
import { getScreenerMaxScore, isQuestionScored } from '../Data/SpecTesting'
import { stp68wTraining } from '../Data/TrainingTaskList'
import { getTaskData } from '../Data/TrainingData'
import { getIctlTaskData } from '../Data/ICTLContent'
import { IctlPanel, buildIctlByArea, type IctlView } from './Settings/IctlPanel'
import { TcccModulePanel, type TcccView } from './Settings/TcccModulePanel'
import { getTcccModule, tcccModules } from '../Data/TcccModules'
import { Check } from 'lucide-react'
import { UI_TIMING } from '../Utilities/constants'
import { BURN_CALCULATOR_ENABLED } from '../lib/featureFlags'
import type { subjectAreaArrayOptions } from '../Types/CatTypes'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'
import type { ScreenerConfig, ScreenerWordList } from '../Types/AlgorithmTypes'
import type { MedevacRequest } from '../Types/MedevacTypes'
import { useMedevacStore } from '../stores/useMedevacStore'

type KBView =
    | 'home'
    | 'training'
    | 'training-detail'
    | 'ictl'
    | 'ictl-detail'
    | 'tccc'
    | 'tccc-detail'
    | 'medications'
    | 'medication-detail'
    | 'screener'
    | 'burn'
    | 'heat-category'
    | 'report-9line'
    | 'report-9line-review'

interface KnowledgeBaseDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialView?: string | null
    initialTaskId?: string | null
    initialMedication?: medListTypes | null
    initialScreenerId?: string | null
    initialMedevacReq?: MedevacRequest | null
}

const screenerMap: Record<string, ScreenerConfig> = {
    gad7: GAD7,
    phq2: PHQ2,
    mace2: MACE2,
    auditc: AUDITC,
}

export function KnowledgeBaseDrawer({
    isVisible,
    onClose,
    initialView,
    initialTaskId,
    initialMedication,
    initialScreenerId,
    initialMedevacReq,
}: KnowledgeBaseDrawerProps) {
    // TC3-scoped KB options are parked until TC3's drawer refactor is fine-tuned;
    // the KB always uses the standard medication list for now. Re-wire to the TC3
    // drawer's active state when the TC3 KB surface is reintroduced.
    const tc3Mode = false
    const { pinnedKB, togglePinKB } = useNavPreferencesStore(
        useShallow(s => ({ pinnedKB: s.pinnedKB, togglePinKB: s.togglePinKB }))
    )
    const [view, setView] = useState<KBView>('home')
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null)
    const [selectedIctlTaskId, setSelectedIctlTaskId] = useState<string | null>(null)
    const [selectedTcccKey, setSelectedTcccKey] = useState<string | null>(null)
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)
    const [activeScreener, setActiveScreener] = useState<ScreenerConfig | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [lmpPicker, setLmpPicker] = useState(false)
    const [vitals, setVitals] = useState<Record<string, string>>({})
    const vsRef = useRef<VitalSignsCalculatorHandle>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const medevacReq = useMedevacStore(s => s.req)
    const setMedevacReq = useMedevacStore(s => s.setReq)
    const resetMedevacReq = useMedevacStore(s => s.resetReq)

    const searchScope: KBSearchScope | null = (SEARCH_SCOPES as readonly string[]).includes(view) ? view as KBSearchScope : null
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRowRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const cancelSearch = useCallback(() => {
        setSearchQuery('')
        setSearchOpen(false)
        searchInputRef.current?.blur()
    }, [])

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchOpen(false) }, [view])

    // Tap/click outside the search row (input + dropdown) dismisses the dropdown;
    // the query survives so re-focusing reopens it.
    useEffect(() => {
        if (!searchOpen) return
        const onDown = (e: PointerEvent) => {
            if (!searchRowRef.current?.contains(e.target as Node)) setSearchOpen(false)
        }
        document.addEventListener('pointerdown', onDown)
        return () => document.removeEventListener('pointerdown', onDown)
    }, [searchOpen])

    // ── Deep-link / initial view handling ───────────────────────
    useEffect(() => {
        if (!isVisible) return
        if (initialView === 'training') {
            setView('training')
            setSlideDirection('')
        } else if (initialView === 'training-detail' && initialTaskId) {
            const resolved = resolveTaskById(initialTaskId)
            if (resolved) {
                setSelectedTask(resolved)
                setView('training-detail')
                setSlideDirection('')
            } else {
                setView('training')
                setSlideDirection('')
            }
        } else if (initialView === 'medications') {
            setView('medications')
            setSlideDirection('')
        } else if (initialView === 'medication-detail' && initialMedication) {
            setSelectedMedication(initialMedication)
            setView('medication-detail')
            setSlideDirection('')
        } else if (initialView === 'screener' && initialScreenerId && screenerMap[initialScreenerId]) {
            setActiveScreener(screenerMap[initialScreenerId])
            setView('screener')
            setSlideDirection('')
        } else if (initialView === 'burn') {
            setView('burn')
            setSlideDirection('')
        } else if (initialView === 'calculator' && initialScreenerId === 'vital-signs') {
            setCalculatorOpen(true)
            setSlideDirection('')
        } else if (initialView === 'report-9line' && initialMedevacReq) {
            setMedevacReq(initialMedevacReq)
            setView('report-9line')
            setSlideDirection('')
        } else {
            setView('home')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible])

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    // ── Category click from KB home ─────────────────────────────
    const handleCategoryClick = useCallback((category: KBCategory) => {
        if (category.comingSoon) return

        if (category.id === 'vital-signs') {
            setCalculatorOpen(true)
            return
        }
        if (category.id === 'burn') {
            handleSlideAnimation('left')
            setView('burn')
            return
        }
        if (category.id === 'heat-category') {
            handleSlideAnimation('left')
            setView('heat-category')
            return
        }
        handleSlideAnimation('left')
        switch (category.id) {
            case 'medications':
                setView('medications')
                setSelectedMedication(null)
                break
            case 'stp':
                setView('training')
                setSelectedTask(null)
                break
            case 'ictl':
                setView('ictl')
                setSelectedIctlTaskId(null)
                break
            case 'tccc':
                setView('tccc')
                setSelectedTcccKey(null)
                break
            case '9-line':   setView('report-9line');  break
            default:
                if (screenerMap[category.id]) {
                    setActiveScreener(screenerMap[category.id])
                    setView('screener')
                }
                break
        }
    }, [handleSlideAnimation])

    // ── Training task selection ──────────────────────────────────
    const handleSelectTask = useCallback((task: subjectAreaArrayOptions) => {
        setSelectedTask(task)
        handleSlideAnimation('left')
        setView('training-detail')
    }, [handleSlideAnimation])

    // ── ICTL task selection ──────────────────────────────────────
    const handleSelectIctlTask = useCallback((taskId: string) => {
        setSelectedIctlTaskId(taskId)
        handleSlideAnimation('left')
        setView('ictl-detail')
    }, [handleSlideAnimation])

    // ── TCCC module selection (from the TCCC list or an ICTL deep-link) ──
    const handleSelectTcccModule = useCallback((moduleKey: string) => {
        setSelectedTcccKey(moduleKey)
        handleSlideAnimation('left')
        setView('tccc-detail')
    }, [handleSlideAnimation])

    // ── Medication selection ─────────────────────────────────────
    const handleMedicationSelect = useCallback((medication: medListTypes) => {
        setSelectedMedication(medication)
        handleSlideAnimation('left')
        setView('medication-detail')
    }, [handleSlideAnimation])

    // ── Back navigation ─────────────────────────────────────────
    const handleBack = useCallback(() => {
        setSearchQuery('')
        handleSlideAnimation('right')
        switch (view) {
            case 'training-detail':
                setView('training')
                setSelectedTask(null)
                break
            case 'ictl-detail':
                setView('ictl')
                setSelectedIctlTaskId(null)
                break
            case 'tccc-detail':
                setView('tccc')
                setSelectedTcccKey(null)
                break
            case 'report-9line-review':
                setView('report-9line')
                break
            case 'training':
            case 'ictl':
            case 'tccc':
            case 'medications':
            case 'screener':
            case 'burn':
            case 'heat-category':
            case 'report-9line':
                setView('home')
                setActiveScreener(null)
                if (view === 'report-9line') resetMedevacReq()
                break
            case 'medication-detail':
                setView('medications')
                setSelectedMedication(null)
                break
            default:
                setView('home')
        }
    }, [view, handleSlideAnimation])

    // ── Close handler ───────────────────────────────────────────
    const handleClose = useCallback(() => {
        setSearchQuery('')
        setSearchOpen(false)
        setCalculatorOpen(false)
        setView('home')
        setSelectedTask(null)
        setSelectedIctlTaskId(null)
        setSelectedTcccKey(null)
        setSelectedMedication(null)
        setActiveScreener(null)
        resetMedevacReq()
        setSlideDirection('')
        onClose()
    }, [onClose])

    // ── Swipe back ──────────────────────────────────────────────
    const canSwipeBack = view !== 'home'
    const swipeHandlers = useSwipeBack(
        useMemo(() => canSwipeBack ? handleBack : undefined, [canSwipeBack, handleBack]),
        canSwipeBack,
    )

    // ── Header config ───────────────────────────────────────────
    const headerConfig = useMemo(() => {
        switch (view) {
            case 'training':
                return { title: 'STP 8-68W13-SM-TG', showBack: true, onBack: handleBack }
            case 'training-detail':
                return { title: selectedTask?.text || 'Task', showBack: true, onBack: handleBack }
            case 'ictl':
                return { title: '68W SL1 ICTL', showBack: true, onBack: handleBack }
            case 'ictl-detail':
                return { title: (selectedIctlTaskId ? getIctlTaskData(selectedIctlTaskId)?.title : null) || 'Task', showBack: true, onBack: handleBack }
            case 'tccc':
                return { title: 'TCCC', showBack: true, onBack: handleBack }
            case 'tccc-detail':
                return { title: (selectedTcccKey ? getTcccModule(selectedTcccKey)?.name : null) || 'TCCC Module', showBack: true, onBack: handleBack }
            case 'medications':
                return { title: tc3Mode ? 'TC3 Medications' : 'Medications', showBack: true, onBack: handleBack }
            case 'medication-detail': {
                const pinId = selectedMedication ? 'med:' + selectedMedication.icon : null
                const isPinned = pinId ? pinnedKB.includes(pinId) : false
                return {
                    title: selectedMedication?.text || 'Medication',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: pinId ? (
                        <HeaderPill>
                            <PillButton
                                icon={Pin}
                                label={isPinned ? 'Unpin' : 'Pin'}
                                onClick={() => togglePinKB(pinId)}
                                circleBg={isPinned ? 'bg-themeblue2 text-white' : undefined}
                            />
                        </HeaderPill>
                    ) : undefined,
                }
            }
            case 'screener':
                return { title: activeScreener?.title || 'Screener', showBack: true, onBack: handleBack }
            case 'burn':
                return { title: 'Burn Assessment', showBack: true, onBack: handleBack }
            case 'heat-category':
                return { title: 'Heat Category', showBack: true, onBack: handleBack }
            case 'report-9line':
                return { title: '9-Line MEDEVAC', showBack: true, onBack: handleBack }
            case 'report-9line-review':
                return { title: 'Export', showBack: true, onBack: handleBack }
            default:
                return { title: 'Knowledge Base' }
        }
    }, [view, selectedTask, selectedIctlTaskId, selectedTcccKey, selectedMedication, activeScreener, tc3Mode, handleBack, pinnedKB, togglePinKB])

    return (
        <BaseDrawer
            desktopPosition="left"
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            header={headerConfig}
            glassHeader
            scrollResetKey={view}
            desktopSize="half"
        >
            <ContentWrapper slideDirection={slideDirection} swipeHandlers={canSwipeBack ? swipeHandlers : undefined}>
                {/* Search template (home + every browse list): results lift as a
                    dropdown card under the row, scoped to the current view, and
                    overlay the list — the list itself never swaps or filters. */}
                {searchScope && (
                        <div ref={searchRowRef} className="relative z-30 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <SearchInput
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={(v) => { setSearchQuery(v); setSearchOpen(true) }}
                                        onFocus={() => setSearchOpen(true)}
                                        onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); searchInputRef.current?.blur() } }}
                                        placeholder={SEARCH_PLACEHOLDER[searchScope]}
                                        hideClear
                                    />
                                </div>
                                {(searchOpen || searchQuery) && <SearchCancelButton onClick={cancelSearch} />}
                            </div>
                            {searchOpen && searchQuery.trim() && (
                                <div className="absolute left-3 right-3 top-full z-40">
                                    <KBSearchDropdown
                                        scope={searchScope}
                                        query={searchQuery}
                                        tc3Mode={tc3Mode}
                                        onCategoryClick={handleCategoryClick}
                                        onSelectTask={handleSelectTask}
                                        onSelectIctlTask={handleSelectIctlTask}
                                        onSelectTcccModule={handleSelectTcccModule}
                                        onMedicationSelect={handleMedicationSelect}
                                    />
                                </div>
                            )}
                        </div>
                )}
                {view === 'home' && (
                    <KBHome
                        onCategoryClick={handleCategoryClick}
                        onSelectTask={handleSelectTask}
                        onMedicationSelect={handleMedicationSelect}
                        tc3Mode={tc3Mode}
                    />
                )}
                {(view === 'training' || view === 'training-detail') && (
                    <TrainingPanel
                        view={view as TrainingView}
                        selectedTask={selectedTask}
                        onSelectTask={handleSelectTask}
                    />
                )}
                {(view === 'ictl' || view === 'ictl-detail') && (
                    <IctlPanel
                        view={view as IctlView}
                        selectedTaskId={selectedIctlTaskId}
                        onSelectTask={handleSelectIctlTask}
                        onOpenTccc={handleSelectTcccModule}
                    />
                )}
                {(view === 'tccc' || view === 'tccc-detail') && (
                    <TcccModulePanel
                        view={view as TcccView}
                        selectedModuleKey={selectedTcccKey}
                        onSelectModule={handleSelectTcccModule}
                    />
                )}
                {(view === 'medications' || view === 'medication-detail') && (
                    <MedicationContent
                        selectedMedication={selectedMedication}
                        onMedicationSelect={handleMedicationSelect}
                        tc3Mode={tc3Mode}
                    />
                )}
                {view === 'screener' && activeScreener && (
                    <StandaloneScreener screenerConfig={activeScreener} />
                )}
                {view === 'burn' && (
                    <BurnCalculator />
                )}
                {view === 'heat-category' && (
                    <HeatCategoryCalculator />
                )}
                {view === 'report-9line' && (
                    <NineLineKB
                        req={medevacReq}
                        onChange={setMedevacReq}
                    />
                )}
                {view === 'report-9line-review' && (
                    <NineLineExport
                        req={medevacReq}
                        onClear={() => { resetMedevacReq(); handleSlideAnimation('right'); setView('report-9line') }}
                    />
                )}
            </ContentWrapper>

            {/* 9-line BottomIsland — persistent W/P (wartime/peacetime) mode switcher,
                with the "Review" FAB nested in the island's fab slot (calendar pattern).
                Sibling of ContentWrapper so it anchors to the drawer panel and stays put
                while the form scrolls. The Review action is gated on form content; the
                mode tabs are always available. Glass footer feathers scroll behind it. */}
            {view === 'report-9line' && (
                <BottomIsland
                    glass
                    z="z-20"
                    ariaLabel="MEDEVAC mode"
                    activeId={medevacReq.mode}
                    onSelect={(id) => setMedevacReq({ ...medevacReq, mode: id as typeof medevacReq.mode })}
                    stops={[
                        { id: 'wartime', title: 'Wartime', icon: <span className="text-[11pt] font-bold">W</span> },
                        { id: 'peacetime', title: 'Peacetime', icon: <span className="text-[11pt] font-bold">P</span> },
                    ]}
                    fab={nineLineHasContent(medevacReq) ? (
                        <AddFab
                            icon={ChevronRight}
                            label="Review"
                            onClick={() => { handleSlideAnimation('left'); setView('report-9line-review') }}
                            className="absolute right-4"
                        />
                    ) : undefined}
                />
            )}

            {/* Overlay calculators/references */}
            <PreviewOverlay
                isOpen={calculatorOpen}
                onClose={() => { setCalculatorOpen(false); setLmpPicker(false) }}
                anchorRect={null}
                title={lmpPicker ? 'LMP' : 'Conversions'}
                onBack={lmpPicker ? () => setLmpPicker(false) : undefined}
                maxWidth={390}
                footer={lmpPicker ? undefined : (
                    <FooterPill>
                        <ActionButton icon={RotateCcw} label="Clear" onClick={() => vsRef.current?.reset()} />
                    </FooterPill>
                )}
            >
                {lmpPicker ? (
                    <div className="py-1">
                        <DatePickerCalendar
                            value={vitals.lmp || ''}
                            onChange={(v) => setVitals(prev => ({ ...prev, lmp: v }))}
                            onClose={() => setLmpPicker(false)}
                            maxDate={new Date().toISOString().slice(0, 10)}
                        />
                    </div>
                ) : (
                    <VitalSignsCalculator
                        ref={vsRef}
                        value={vitals}
                        onChange={setVitals}
                        onRequestLmpPicker={() => setLmpPicker(true)}
                        conversionOnly
                    />
                )}
            </PreviewOverlay>
        </BaseDrawer>
    )
}

// ── KB search dropdown ────────────────────────────────────────────────────────
// Lifted card under the KB home search row (shared SearchDropdown primitive).
// Rows match the main search dropdown: tinted icon circle + title + subtitle.

// Views that carry the search row; the dropdown searches only that view's scope.
const SEARCH_SCOPES = ['home', 'training', 'ictl', 'tccc', 'medications'] as const
type KBSearchScope = typeof SEARCH_SCOPES[number]

const SEARCH_PLACEHOLDER: Record<KBSearchScope, string> = {
    home: 'Search knowledge base',
    training: 'Search STP tasks',
    ictl: 'Search ICTL tasks',
    tccc: 'Search TCCC modules',
    medications: 'Search medications',
}

type KBSearchEntry = {
    key: string
    label: string
    subtitle: string
    icon: LucideIcon
    tint: string
    select: () => void
}
type KBSearchGroupData = { title: string; items: KBSearchEntry[] }

const KB_GROUP_TINT: Record<string, string> = {
    screening: 'bg-themegreen/15 text-themegreen',
    calculators: 'bg-themeblue2/15 text-themeblue2',
}
const TASK_TINT = 'bg-themeblue3/10 text-themeblue1'
const MED_TINT = 'bg-themeyellowlow/30 text-secondary'

const KB_RESULT_ROW = 'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-themewhite2 active:bg-themewhite2 transition-colors'
const KB_RESULT_GROUP_LIMIT = 25

function KBSearchDropdown({
    scope,
    query,
    tc3Mode,
    onCategoryClick,
    onSelectTask,
    onSelectIctlTask,
    onSelectTcccModule,
    onMedicationSelect,
}: {
    scope: KBSearchScope
    query: string
    tc3Mode: boolean
    onCategoryClick: (cat: KBCategory) => void
    onSelectTask: (task: subjectAreaArrayOptions) => void
    onSelectIctlTask: (taskId: string) => void
    onSelectTcccModule: (moduleKey: string) => void
    onMedicationSelect: (medication: medListTypes) => void
}) {
    // Unfiltered index for the current scope; groups mirror the list underneath.
    // Coming-soon entries are left out — a result row always opens something.
    const index = useMemo<KBSearchGroupData[]>(() => {
        const medEntries = (): KBSearchEntry[] => (tc3Mode ? tc3MedList : medList).map(med => ({
            key: `med-${med.icon}`, label: med.icon, subtitle: med.text,
            icon: Pill, tint: MED_TINT, select: () => onMedicationSelect(med),
        }))
        const stpGroups = (): KBSearchGroupData[] => Array.from(buildAllTasksByCategory()).map(([area, tasks]) => ({
            title: area,
            items: tasks.filter(t => getTaskData(t.taskId)).map(t => ({
                key: `task-${t.taskId}`, label: t.title, subtitle: `${t.taskId} · ${area}`,
                icon: GraduationCap, tint: TASK_TINT, select: () => onSelectTask(t.option),
            })),
        }))

        switch (scope) {
            case 'training':
                return stpGroups()
            case 'ictl':
                return Array.from(buildIctlByArea()).map(([area, tasks]) => ({
                    title: area,
                    items: tasks.filter(t => getIctlTaskData(t.taskId)).map(t => ({
                        key: `ictl-${t.taskId}`, label: t.title, subtitle: t.taskId,
                        icon: BookOpen, tint: TASK_TINT, select: () => onSelectIctlTask(t.taskId),
                    })),
                }))
            case 'tccc':
                return [{
                    title: 'TCCC Modules',
                    items: tcccModules.filter(m => !m.pending).map(m => ({
                        key: `tccc-${m.key}`, label: m.name, subtitle: m.module ?? 'TCCC',
                        icon: BookOpen, tint: TASK_TINT, select: () => onSelectTcccModule(m.key),
                    })),
                }]
            case 'medications':
                return [{ title: 'Medications', items: medEntries() }]
            case 'home': {
                const categories = kbCategories
                    .filter(cat => !cat.comingSoon && GATED_KB_IDS[cat.id] !== false)
                    .map(cat => ({
                        key: `cat-${cat.id}`, label: cat.label,
                        subtitle: `${kbGroupLabels[cat.group]} · ${cat.description}`,
                        icon: cat.icon, tint: KB_GROUP_TINT[cat.group] ?? 'bg-themeblue3/15 text-themeblue1',
                        select: () => onCategoryClick(cat),
                    }))
                return [
                    { title: 'Knowledge Base', items: categories },
                    { title: 'Medications', items: medEntries() },
                    {
                        title: 'STP Tasks',
                        // A task can sit in more than one subject area — list it once.
                        items: Array.from(new Map(stpGroups().flatMap(g => g.items).map(e => [e.key, e])).values()),
                    },
                ]
            }
        }
    }, [scope, tc3Mode, onCategoryClick, onSelectTask, onSelectIctlTask, onSelectTcccModule, onMedicationSelect])

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const match = (e: KBSearchEntry) => e.label.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q)
        return index
            .map(g => ({ title: g.title, items: g.items.filter(match) }))
            .filter(g => g.items.length > 0)
    }, [query, index])

    return (
        <SearchDropdownCard ariaLabel="Knowledge base search results">
            {groups.length === 0 ? (
                <div className="px-4 py-6 text-center">
                    <p className="text-[10pt] text-primary">No results for "{query.trim()}"</p>
                    <p className="text-[9pt] text-tertiary mt-1">Try different keywords</p>
                </div>
            ) : groups.map(g => (
                <SearchDropdownGroup
                    key={g.title}
                    title={g.title}
                    trailing={<span className="text-[9pt] text-tertiary">{g.items.length}</span>}
                >
                    {g.items.slice(0, KB_RESULT_GROUP_LIMIT).map(e => {
                        const Icon = e.icon
                        return (
                            <button key={e.key} type="button" onClick={e.select} className={KB_RESULT_ROW}>
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${e.tint}`}>
                                    <Icon size={18} />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[11pt] text-primary truncate">{e.label}</span>
                                    <span className="block text-[9pt] text-tertiary truncate mt-0.5">{e.subtitle}</span>
                                </span>
                            </button>
                        )
                    })}
                </SearchDropdownGroup>
            ))}
        </SearchDropdownCard>
    )
}

// ── Liftable KB row ───────────────────────────────────────────────────────────
// Desktop: hover reveals an ellipsis; right-click. Mobile: long-press. All three
// snapshot the row's rect + markup and feed the shared LiftedRowMenu twin-lift.
function KBRow({
    menuId,
    onLift,
    onClick,
    className,
    disabled,
    children,
}: {
    menuId: string | null
    onLift: (id: string, el: HTMLElement) => void
    onClick: () => void
    className: string
    disabled?: boolean
    children: React.ReactNode
}) {
    const btnRef = useRef<HTMLButtonElement>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fired = useRef(false)

    const lift = useCallback(() => {
        if (!menuId || !btnRef.current) return
        fired.current = true
        onLift(menuId, btnRef.current)
    }, [menuId, onLift])

    const clearTimer = useCallback(() => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
    }, [])

    return (
        <div className="relative group">
            <button
                ref={btnRef}
                disabled={disabled}
                onClick={() => { if (fired.current) { fired.current = false; return } onClick() }}
                onContextMenu={menuId ? (e) => { e.preventDefault(); lift() } : undefined}
                onTouchStart={menuId ? () => { fired.current = false; clearTimer(); timer.current = setTimeout(lift, 500) } : undefined}
                onTouchEnd={menuId ? clearTimer : undefined}
                onTouchMove={menuId ? clearTimer : undefined}
                onTouchCancel={menuId ? clearTimer : undefined}
                className={className}
            >
                {children}
            </button>
            {menuId && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); lift() }}
                    aria-label="Actions"
                    className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full
                               hover:bg-primary/10 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <MoreHorizontal size={14} className="text-tertiary" />
                </button>
            )}
        </div>
    )
}

// ── KB Home View ────────────────────────────────────────────────────────────

// Feature-gated IDs — hidden when the flag is off.
const GATED_KB_IDS: Record<string, boolean> = {
    burn: BURN_CALCULATOR_ENABLED,
}

function KBHome({
    onCategoryClick,
    onSelectTask,
    onMedicationSelect,
    tc3Mode,
}: {
    onCategoryClick: (cat: KBCategory) => void
    onSelectTask: (task: subjectAreaArrayOptions) => void
    onMedicationSelect: (medication: medListTypes) => void
    tc3Mode: boolean
}) {
    const { pinnedKB, togglePinKB } = useNavPreferencesStore(
        useShallow(s => ({ pinnedKB: s.pinnedKB, togglePinKB: s.togglePinKB }))
    )
    const [lifted, setLifted] = useState<{ id: string; rect: DOMRect; html: string } | null>(null)

    // Snapshot the pressed row (rect + markup) for the twin-lift float. Strip the
    // inter-row separator so the cloned single row reads clean on its white card.
    const handleLift = useCallback((id: string, el: HTMLElement) => {
        setLifted({ id, rect: el.getBoundingClientRect(), html: el.outerHTML.replace(/border-t border-tertiary\/8/g, '') })
    }, [])

    // Filter categories by feature gates
    const visibleCategories = useMemo(() =>
        kbCategories.filter(cat => {
            const flag = GATED_KB_IDS[cat.id]
            return flag === undefined ? true : flag
        }),
    [])

    const grouped = useMemo(() => {
        const map = new Map<string, KBCategory[]>()
        for (const group of kbGroupOrder) {
            map.set(group, visibleCategories.filter(c => c.group === group))
        }
        return map
    }, [visibleCategories])

    // Pinned items
    const { pinnedMeds, pinnedTasks } = useMemo(() => {
        const list = tc3Mode ? tc3MedList : medList
        const meds: medListTypes[] = []
        const tasks: subjectAreaArrayOptions[] = []
        for (const id of pinnedKB) {
            if (id.startsWith('med:')) {
                const med = list.find(m => m.icon === id.slice(4))
                if (med) meds.push(med)
            } else if (id.startsWith('task:')) {
                const task = resolveTaskById(id.slice(5))
                if (task) tasks.push(task)
            }
        }
        return { pinnedMeds: meds, pinnedTasks: tasks }
    }, [pinnedKB, tc3Mode])

    // ── Pinned items (categories, individual meds, individual tasks) ──
    const pinnedCategories = visibleCategories.filter(c => pinnedKB.includes(c.id) && !c.comingSoon)
    const hasPinnedItems = pinnedCategories.length > 0 || pinnedMeds.length > 0 || pinnedTasks.length > 0

    // ── Default category grid ─────────────────────────────────
    // Shared category button renderer
    const renderCatButton = (cat: KBCategory, idx: number) => (
        <KBRow
            key={cat.id}
            menuId={cat.comingSoon ? null : cat.id}
            disabled={cat.comingSoon}
            onLift={handleLift}
            onClick={() => onCategoryClick(cat)}
            className={`flex items-center w-full px-4 py-3.5 text-left transition-all
                ${cat.comingSoon
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-themewhite2 active:scale-95 cursor-pointer'
                }
                ${idx > 0 ? 'border-t border-tertiary/8' : ''}
            `}
        >
            <cat.icon size={18} className={`shrink-0 ${cat.comingSoon ? 'text-tertiary' : 'text-primary'}`} />
            <div className="flex-1 min-w-0 ml-3">
                <p className={`text-sm font-medium ${cat.comingSoon ? 'text-tertiary' : 'text-primary'}`}>
                    {cat.label}
                </p>
                <p className="text-[9pt] text-tertiary">
                    {cat.description}
                </p>
            </div>
            {!cat.comingSoon && pinnedKB.includes(cat.id) && (
                <Pin size={12} className="text-themeblue2/40 shrink-0 mr-1" />
            )}
            {!cat.comingSoon && (
                <ChevronRight size={16} className="text-tertiary shrink-0 md:group-hover:opacity-0 transition-opacity" />
            )}
        </KBRow>
    )

    return (
        <div className="px-4 py-3 md:p-5">
            {/* Pinned section */}
            {hasPinnedItems && (
                <div className="mb-4">
                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider px-2 mb-2">
                        PINNED
                    </p>
                    <div className="rounded-xl bg-themewhite2/50 overflow-hidden">
                        {pinnedCategories.map((cat, idx) => renderCatButton(cat, idx))}
                        {pinnedMeds.map((med, idx) => (
                            <KBRow
                                key={`pin-med-${med.icon}`}
                                menuId={'med:' + med.icon}
                                onLift={handleLift}
                                onClick={() => onMedicationSelect(med)}
                                className={`flex items-center w-full px-4 py-3.5 text-left transition-all
                                    hover:bg-themewhite2 active:scale-95 cursor-pointer
                                    ${(pinnedCategories.length + idx) > 0 ? 'border-t border-tertiary/8' : ''}`}
                            >
                                <Pill size={18} className="shrink-0 text-primary" />
                                <div className="flex-1 min-w-0 ml-3">
                                    <p className="text-sm font-medium text-primary">{med.icon}</p>
                                    <p className="text-[9pt] text-tertiary">{med.text}</p>
                                </div>
                                <Pin size={12} className="text-themeblue2/40 shrink-0 mr-1" />
                                <ChevronRight size={16} className="text-tertiary shrink-0 md:group-hover:opacity-0 transition-opacity" />
                            </KBRow>
                        ))}
                        {pinnedTasks.map((task, idx) => (
                            <KBRow
                                key={`pin-task-${task.icon}`}
                                menuId={'task:' + task.icon}
                                onLift={handleLift}
                                onClick={() => onSelectTask(task)}
                                className={`flex items-center w-full px-4 py-3.5 text-left transition-all
                                    hover:bg-themewhite2 active:scale-95 cursor-pointer
                                    ${(pinnedCategories.length + pinnedMeds.length + idx) > 0 ? 'border-t border-tertiary/8' : ''}`}
                            >
                                <BookOpen size={18} className="shrink-0 text-primary" />
                                <div className="flex-1 min-w-0 ml-3">
                                    <p className="text-sm font-medium text-primary">{task.text}</p>
                                    <p className="text-[9pt] text-tertiary font-mono">{task.icon}</p>
                                </div>
                                <Pin size={12} className="text-themeblue2/40 shrink-0 mr-1" />
                                <ChevronRight size={16} className="text-tertiary shrink-0 md:group-hover:opacity-0 transition-opacity" />
                            </KBRow>
                        ))}
                    </div>
                </div>
            )}

            {kbGroupOrder.map(group => {
                    const allItems = grouped.get(group)
                    if (!allItems?.length) return null
                    // Filter pinned items out of their normal groups
                    const items = allItems.filter(c => !pinnedKB.includes(c.id))
                    if (!items.length) return null
                    return (
                        <div key={group} className="mb-4">
                            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider px-2 mb-2">
                                {kbGroupLabels[group]}
                            </p>
                            <div className="rounded-xl bg-themewhite2/50 overflow-hidden">
                                {items.map((cat, idx) => renderCatButton(cat, idx))}
                            </div>
                        </div>
                    )
                })}

            {/* Twin-lift context menu (mobile long-press / desktop right-click + hover ellipsis) */}
            {lifted && (
                <LiftedRowMenu
                    isOpen={!!lifted}
                    anchorRect={lifted.rect}
                    row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                    items={[{
                        key: 'pin',
                        label: pinnedKB.includes(lifted.id) ? 'Unpin' : 'Pin',
                        icon: Pin,
                        onAction: () => togglePinKB(lifted.id),
                    }]}
                    onClose={() => setLifted(null)}
                    layout="list"
                />
            )}
        </div>
    )
}

// ── Standalone Screener ─────────────────────────────────────────────────────

function StandaloneScreener({ screenerConfig }: { screenerConfig: ScreenerConfig }) {
    const ext = screenerConfig.conditionalExtension
    const extendedScreener = ext?.screener

    const [baseResponses, setBaseResponses] = useState<(number | null)[]>(
        () => screenerConfig.questions.map(() => null)
    )
    const [extResponses, setExtResponses] = useState<(number | null)[]>(
        () => extendedScreener && ext ? extendedScreener.questions.slice(ext.carryOverQuestions).map(() => null) : []
    )
    const [followUpIdx, setFollowUpIdx] = useState<number | null>(null)

    const [selectedListIdx] = useState(() => {
        if (!screenerConfig.wordLists?.length) return 0
        return Math.floor(Math.random() * screenerConfig.wordLists.length)
    })
    const selectedList: ScreenerWordList | undefined = screenerConfig.wordLists?.[selectedListIdx]

    const baseScore = useMemo(
        () => baseResponses.reduce<number>((sum, v, i) => {
            const q = screenerConfig.questions[i]
            if (!q || !isQuestionScored(q)) return sum
            return sum + (v ?? 0)
        }, 0),
        [baseResponses, screenerConfig.questions],
    )

    const showExtension = ext && baseScore >= ext.threshold
    const extScore = useMemo(() => {
        if (!showExtension) return 0
        return baseScore + extResponses.reduce<number>((sum, v) => sum + (v ?? 0), 0)
    }, [showExtension, baseScore, extResponses])

    const currentScreener = showExtension && extendedScreener ? extendedScreener : screenerConfig
    const currentScore = showExtension ? extScore : baseScore
    const maxScore = getScreenerMaxScore(currentScreener)

    const gate = screenerConfig.gate
    const gateOpen = useMemo(() => {
        if (!gate) return true
        const required = baseResponses[gate.requiredIndex] === 1
        const anyOf = gate.anyOfIndices.some(i => baseResponses[i] === 1)
        return required && anyOf
    }, [gate, baseResponses])

    const gateEvaluated = !gate || baseResponses[gate.requiredIndex] !== null

    const interpretation = useMemo(
        () => currentScreener.interpretations.find(
            interp => currentScore >= interp.minScore && currentScore <= interp.maxScore,
        )?.label ?? '',
        [currentScreener.interpretations, currentScore],
    )

    const baseComplete = baseResponses.every((v, i) => {
        const q = screenerConfig.questions[i]
        if (!q) return true
        if (q.type === 'check' || q.type === 'info') return true
        if (gate && !gateOpen && i >= gate.gatedFromIndex) return true
        return v !== null
    })
    const extComplete = !showExtension || extResponses.every(v => v !== null)
    const followUpComplete = !screenerConfig.followUp || followUpIdx !== null
    const allComplete = baseComplete && extComplete && followUpComplete

    const handleBaseResponse = useCallback((qIdx: number, value: number) => {
        setBaseResponses(prev => {
            const next = [...prev]
            next[qIdx] = value
            return next
        })
    }, [])

    const handleCheckToggle = useCallback((qIdx: number, optIdx: number) => {
        setBaseResponses(prev => {
            const next = [...prev]
            const current = next[qIdx] ?? 0
            next[qIdx] = current ^ (1 << optIdx)
            return next
        })
    }, [])

    const handleExtResponse = useCallback((qIdx: number, value: number) => {
        setExtResponses(prev => {
            const next = [...prev]
            next[qIdx] = value
            return next
        })
    }, [])

    const handleRetake = useCallback(() => {
        setBaseResponses(screenerConfig.questions.map(() => null))
        if (extendedScreener && ext) {
            setExtResponses(extendedScreener.questions.slice(ext.carryOverQuestions).map(() => null))
        }
        setFollowUpIdx(null)
    }, [screenerConfig, extendedScreener, ext])

    return (
        <div className="px-4 pb-6">
            {/* Instruction */}
            <p className="text-[10pt] text-secondary py-3 border-b border-tertiary/10">
                {screenerConfig.instruction}
            </p>


            {/* Questions */}
            <div className="mt-3">
                {screenerConfig.questions.map((q, qIdx) => {
                    if (gate && !gateOpen && qIdx >= gate.gatedFromIndex) return null

                    return (
                        <div key={qIdx}>
                            {q.sectionHeader && (
                                <div className="flex items-center gap-2 mt-4 mb-2 px-1">
                                    <div className="h-px flex-1 bg-tertiary/15" />
                                    <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">
                                        {q.sectionHeader}
                                    </span>
                                    <div className="h-px flex-1 bg-tertiary/15" />
                                </div>
                            )}

                            {q.type === 'info' && (
                                <div className="px-1 py-2">
                                    <p className="text-[9pt] text-secondary leading-relaxed">
                                        {q.text}
                                    </p>
                                    {q.dynamicContent && selectedList && (
                                        <WordListContent type={q.dynamicContent} wordList={selectedList} />
                                    )}
                                </div>
                            )}

                            {q.type === 'check' && (
                                <div className="py-2 px-1">
                                    <p className="text-[10pt] text-primary mb-1.5">{q.text}</p>
                                    <ChipBar layout="wrap">
                                        {q.options?.map((opt, optIdx) => {
                                            const isSelected = ((baseResponses[qIdx] ?? 0) & (1 << optIdx)) !== 0
                                            return (
                                                <Chip
                                                    key={optIdx}
                                                    active={isSelected}
                                                    onClick={() => handleCheckToggle(qIdx, optIdx)}
                                                >
                                                    {isSelected && <Check size={10} className="inline mr-1" />}
                                                    {opt}
                                                </Chip>
                                            )
                                        })}
                                    </ChipBar>
                                </div>
                            )}

                            {q.type !== 'info' && q.type !== 'check' && (
                                <QuestionRow
                                    index={qIdx + 1}
                                    text={q.text}
                                    scaleOptions={q.scaleOptions ?? screenerConfig.scaleOptions}
                                    value={baseResponses[qIdx]}
                                    onChange={(v) => handleBaseResponse(qIdx, v)}
                                />
                            )}

                            {gate && qIdx === gate.gatedFromIndex - 1 && gateEvaluated && (
                                <div className={`mx-1 my-3 px-3 py-2.5 rounded-md text-[10pt] font-medium text-center ${
                                    gateOpen
                                        ? 'bg-themegreen/10 text-themegreen border border-themegreen/20'
                                        : 'bg-themeyellow/15 text-secondary border border-themeyellow/30'
                                }`}>
                                    {gateOpen ? gate.positiveMessage : gate.negativeMessage}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Conditional extension (PHQ-2 → PHQ-9) */}
            {showExtension && extendedScreener && ext && (
                <div className="mt-4 animate-cardAppearIn">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="h-px flex-1 bg-themeyellow/30" />
                        <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">
                            Extended to {extendedScreener.title}
                        </span>
                        <div className="h-px flex-1 bg-themeyellow/30" />
                    </div>
                    <div className="space-y-1">
                        {extendedScreener.questions.slice(ext.carryOverQuestions).map((q, qIdx) => (
                            <QuestionRow
                                key={`ext-${qIdx}`}
                                index={ext.carryOverQuestions + qIdx + 1}
                                text={q.text}
                                scaleOptions={q.scaleOptions ?? extendedScreener.scaleOptions}
                                value={extResponses[qIdx]}
                                onChange={(v) => handleExtResponse(qIdx, v)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Follow-up question (GAD-7 difficulty) */}
            {screenerConfig.followUp && (
                <div className="py-2 px-1 mt-2 border-t border-tertiary/10">
                    <p className="text-[10pt] text-primary mb-1.5">
                        {screenerConfig.followUp.text}
                    </p>
                    <div className="flex gap-1">
                        {screenerConfig.followUp.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => setFollowUpIdx(idx)}
                                className={`flex-1 py-1.5 rounded text-[9pt] leading-tight text-center transition-all ${
                                    followUpIdx === idx
                                        ? 'bg-themeblue2/15 text-themeblue2 font-semibold ring-1 ring-themeblue2/30'
                                        : 'bg-themewhite2 text-tertiary hover:bg-themewhite'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results card */}
            {allComplete && (
                <div className="mt-5 animate-cardAppearIn">
                    {(() => {
                        const aboveThreshold = currentScreener.invertThreshold
                            ? currentScore <= currentScreener.threshold
                            : currentScore >= currentScreener.threshold
                        return (
                            <div className={`rounded-xl p-4 border ${
                                aboveThreshold
                                    ? 'bg-themeyellow/10 border-themeyellow/25'
                                    : 'bg-themegreen/10 border-themegreen/20'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Result</p>
                                    <span className={`text-[10pt] px-2 py-0.5 rounded-full font-medium ${
                                        aboveThreshold
                                            ? 'bg-themeyellow/20 text-secondary'
                                            : 'bg-themegreen/15 text-themegreen'
                                    }`}>
                                        {interpretation}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-primary">
                                    {currentScore}<span className="text-sm font-normal text-tertiary">/{maxScore}</span>
                                </p>
                                <button
                                    onClick={handleRetake}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-themewhite2 text-tertiary hover:bg-themewhite active:scale-95 transition-all"
                                >
                                    <RotateCcw size={14} />
                                    Retake
                                </button>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveTaskById(taskId: string): subjectAreaArrayOptions | null {
    if (!getTaskData(taskId)) return null
    for (let levelIdx = 0; levelIdx < stp68wTraining.length; levelIdx++) {
        const level = stp68wTraining[levelIdx]
        for (let areaIdx = 0; areaIdx < level.subjectArea.length; areaIdx++) {
            const area = level.subjectArea[areaIdx]
            const taskIdx = area.tasks.findIndex(t => t.id === taskId)
            if (taskIdx !== -1) {
                const task = area.tasks[taskIdx]
                return {
                    id: taskIdx,
                    icon: task.id,
                    text: task.title,
                    isParent: false,
                    parentId: areaIdx,
                } as subjectAreaArrayOptions
            }
        }
    }
    return null
}
