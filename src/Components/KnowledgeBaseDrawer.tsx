import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ChevronRight, RotateCcw, Pin } from 'lucide-react'
import { MobileSearchBar } from './MobileSearchBar'
import { BaseDrawer } from './BaseDrawer'
import { TrainingPanel, type TrainingView } from './Settings/TrainingPanel'
import { MedicationContent } from './MedicationContent'
import { ContentWrapper } from './Settings/ContentWrapper'
import { QuestionRow, WordListContent } from './ScreenerDrawer'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { VitalSignsCalculator } from './VitalSignsCalculator'
import { BurnCalculator } from './BurnCalculator'
import { BloodProductsReference } from './BloodProductsReference'
import { KBOverlay } from './KBOverlay'
import { KBItemContextMenu } from './KBItemContextMenu'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import { useShallow } from 'zustand/react/shallow'
import { kbCategories, kbGroupLabels, kbGroupOrder, type KBCategory } from '../Data/KnowledgeBaseCategories'
import { GAD7, PHQ2, MACE2, AUDITC } from '../Data/SpecTesting'
import { getScreenerMaxScore, isQuestionScored } from '../Data/SpecTesting'
import { stp68wTraining } from '../Data/TrainingTaskList'
import { getTaskData } from '../Data/TrainingData'
import { Check } from 'lucide-react'
import { UI_TIMING } from '../Utilities/constants'
import { BURN_CALCULATOR_ENABLED, BLOOD_PRODUCTS_ENABLED } from '../lib/featureFlags'
import type { subjectAreaArrayOptions } from '../Types/CatTypes'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'
import type { ScreenerConfig, ScreenerWordList } from '../Types/AlgorithmTypes'

type KBView =
    | 'home'
    | 'training'
    | 'training-detail'
    | 'medications'
    | 'medication-detail'
    | 'screener'
    | 'burn'

interface KnowledgeBaseDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialView?: string | null
    initialTaskId?: string | null
    initialMedication?: medListTypes | null
    initialScreenerId?: string | null
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
}: KnowledgeBaseDrawerProps) {
    const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false
    const [view, setView] = useState<KBView>('home')
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null)
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)
    const [activeScreener, setActiveScreener] = useState<ScreenerConfig | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [bloodOpen, setBloodOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

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
        if (category.id === 'blood-products') {
            setBloodOpen(true)
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
            case 'training':
            case 'medications':
            case 'screener':
            case 'burn':
                setView('home')
                setActiveScreener(null)
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
        setCalculatorOpen(false)
        setBloodOpen(false)
        setView('home')
        setSelectedTask(null)
        setSelectedMedication(null)
        setActiveScreener(null)
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
            case 'medications':
                return { title: tc3Mode ? 'TC3 Medications' : 'Medications', showBack: true, onBack: handleBack }
            case 'medication-detail':
                return { title: selectedMedication?.text || 'Medication', showBack: true, onBack: handleBack }
            case 'screener':
                return { title: activeScreener?.title || 'Screener', showBack: true, onBack: handleBack }
            case 'burn':
                return { title: 'Burn Assessment', showBack: true, onBack: handleBack }
            default:
                return { title: 'Knowledge Base' }
        }
    }, [view, selectedTask, selectedMedication, activeScreener, tc3Mode, handleBack])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            header={headerConfig}
            headerFaded={searchFocused}
            blurHeader
        >
            <ContentWrapper slideDirection={slideDirection} swipeHandlers={canSwipeBack ? swipeHandlers : undefined}>
                {view === 'home' && (
                    <MobileSearchBar value={searchQuery} onChange={setSearchQuery} onFocusChange={setSearchFocused} inheritScroll dataTour="kb-search">
                        <KBHome
                            onCategoryClick={handleCategoryClick}
                            searchQuery={searchQuery}
                            onSelectTask={handleSelectTask}
                            onMedicationSelect={handleMedicationSelect}
                            tc3Mode={tc3Mode}
                        />
                    </MobileSearchBar>
                )}
                {(view === 'training' || view === 'training-detail') && (
                    <MobileSearchBar value={searchQuery} onChange={setSearchQuery} enabled={view === 'training'} onFocusChange={setSearchFocused} inheritScroll>
                        <TrainingPanel
                            view={view as TrainingView}
                            selectedTask={selectedTask}
                            onSelectTask={handleSelectTask}
                            searchQuery={searchQuery}
                        />
                    </MobileSearchBar>
                )}
                {(view === 'medications' || view === 'medication-detail') && (
                    <MobileSearchBar value={searchQuery} onChange={setSearchQuery} enabled={view === 'medications'} onFocusChange={setSearchFocused} inheritScroll>
                        <MedicationContent
                            selectedMedication={selectedMedication}
                            onMedicationSelect={handleMedicationSelect}
                            tc3Mode={tc3Mode}
                            searchQuery={searchQuery}
                        />
                    </MobileSearchBar>
                )}
                {view === 'screener' && activeScreener && (
                    <MobileSearchBar value={searchQuery} onChange={setSearchQuery} enabled={false} onFocusChange={setSearchFocused} inheritScroll>
                        <StandaloneScreener screenerConfig={activeScreener} />
                    </MobileSearchBar>
                )}
                {view === 'burn' && (
                    <BurnCalculator />
                )}
            </ContentWrapper>

            {/* Overlay calculators/references — slide up on top of KB content */}
            <KBOverlay title="Vital Signs" isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)}>
                <VitalSignsCalculator />
            </KBOverlay>
<KBOverlay title="Blood Products" isOpen={bloodOpen} onClose={() => setBloodOpen(false)}>
                <BloodProductsReference />
            </KBOverlay>
        </BaseDrawer>
    )
}

// ── KB Search Result Types ────────────────────────────────────────────────────

type KBSearchResult = {
    type: 'category' | 'task' | 'medication'
    label: string
    subtitle: string
    badge: string
    badgeClass: string
    onSelect: () => void
}

// ── KB Home View ────────────────────────────────────────────────────────────

// Feature-gated IDs — hidden unless flag on or dev role
const GATED_KB_IDS: Record<string, boolean> = {
    burn: BURN_CALCULATOR_ENABLED,
    'blood-products': BLOOD_PRODUCTS_ENABLED,
}

function KBHome({
    onCategoryClick,
    searchQuery,
    onSelectTask,
    onMedicationSelect,
    tc3Mode,
}: {
    onCategoryClick: (cat: KBCategory) => void
    searchQuery: string
    onSelectTask: (task: subjectAreaArrayOptions) => void
    onMedicationSelect: (medication: medListTypes) => void
    tc3Mode: boolean
}) {
    const isDevRole = useAuthStore((s) => s.isDevRole)
    const { pinnedKB, togglePinKB } = useNavPreferencesStore(
        useShallow(s => ({ pinnedKB: s.pinnedKB, togglePinKB: s.togglePinKB }))
    )
    const [contextMenu, setContextMenu] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggered = useRef(false)

    // Filter categories by feature gates
    const visibleCategories = useMemo(() =>
        kbCategories.filter(cat => {
            const flag = GATED_KB_IDS[cat.id]
            if (flag === undefined) return true // not gated
            return flag || isDevRole
        }),
    [isDevRole])

    const grouped = useMemo(() => {
        const map = new Map<string, KBCategory[]>()
        for (const group of kbGroupOrder) {
            map.set(group, visibleCategories.filter(c => c.group === group))
        }
        return map
    }, [visibleCategories])

    // Build KB-scoped search index once
    const kbSearchIndex = useMemo(() => {
        const items: Omit<KBSearchResult, 'onSelect'>[] = []

        // KB categories
        visibleCategories.forEach(cat => {
            if (cat.comingSoon) return
            items.push({
                type: 'category',
                label: cat.label,
                subtitle: cat.description,
                badge: kbGroupLabels[cat.group],
                badgeClass: cat.group === 'screening'
                    ? 'bg-themegreen/15 text-themegreen'
                    : cat.group === 'calculators'
                    ? 'bg-themeblue2/15 text-themeblue2'
                    : 'bg-themewhite2 text-secondary',
            })
        })

        // Training tasks (deduplicated)
        const seenTaskIds = new Set<string>()
        stp68wTraining.forEach(level => {
            level.subjectArea.forEach((area, areaIdx) => {
                area.tasks.forEach((task, taskIdx) => {
                    if (seenTaskIds.has(task.id)) return
                    seenTaskIds.add(task.id)
                    items.push({
                        type: 'task',
                        label: task.title,
                        subtitle: `${task.id} · ${area.name}`,
                        badge: 'STP TASK',
                        badgeClass: 'bg-themewhite2 text-themeblue1',
                    })
                })
            })
        })

        // Medications
        const list = tc3Mode ? tc3MedList : medList
        list.forEach(med => {
            items.push({
                type: 'medication',
                label: med.icon,
                subtitle: med.text,
                badge: 'MEDICATION',
                badgeClass: 'bg-themeyellowlow/30 text-secondary',
            })
        })

        return items
    }, [tc3Mode, visibleCategories])

    // Filter results when searching
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return null

        return kbSearchIndex.filter(item =>
            item.label.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [searchQuery, kbSearchIndex])

    // Resolve click handlers for search results
    const handleResultClick = useCallback((result: typeof kbSearchIndex[0]) => {
        if (result.type === 'category') {
            const cat = visibleCategories.find(c => c.label === result.label)
            if (cat) onCategoryClick(cat)
        } else if (result.type === 'task') {
            const taskId = result.subtitle.split(' · ')[0]
            for (const level of stp68wTraining) {
                for (let areaIdx = 0; areaIdx < level.subjectArea.length; areaIdx++) {
                    const area = level.subjectArea[areaIdx]
                    const taskIdx = area.tasks.findIndex(t => t.id === taskId)
                    if (taskIdx !== -1) {
                        onSelectTask({
                            id: taskIdx,
                            icon: taskId,
                            text: area.tasks[taskIdx].title,
                            isParent: false,
                            parentId: areaIdx,
                        })
                        return
                    }
                }
            }
        } else if (result.type === 'medication') {
            const list = tc3Mode ? tc3MedList : medList
            const med = list.find(m => m.icon === result.label)
            if (med) onMedicationSelect(med)
        }
    }, [onCategoryClick, onSelectTask, onMedicationSelect, tc3Mode, visibleCategories])

    // ── Long-press handlers for context menu ──────────────────
    const handleTouchStart = useCallback((catId: string, e: React.TouchEvent) => {
        longPressTriggered.current = false
        const touch = e.touches[0]
        const pos = { x: touch.clientX, y: touch.clientY }
        longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true
            setContextMenu({ id: catId, position: pos })
        }, 500)
    }, [])

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [])

    const handleContextMenu = useCallback((catId: string, e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ id: catId, position: { x: e.clientX, y: e.clientY } })
    }, [])

    const handleCatClick = useCallback((cat: KBCategory) => {
        if (longPressTriggered.current) {
            longPressTriggered.current = false
            return
        }
        onCategoryClick(cat)
    }, [onCategoryClick])

    // ── Search results view ───────────────────────────────────
    if (searchResults) {
        if (searchResults.length === 0) {
            return (
                <div className="h-full flex items-center justify-center text-themeblue1">
                    <div className="text-center">
                        <p className="text-sm">No results for "{searchQuery}"</p>
                        <p className="text-xs mt-1 text-tertiary">Try different keywords</p>
                    </div>
                </div>
            )
        }

        return (
            <>
                <div className="px-3 py-2 text-xs text-tertiary border-b border-themewhite2">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((result, idx) => (
                    <button
                        key={`${result.type}-${result.label}-${idx}`}
                        className="flex items-start gap-3 w-full px-4 py-3 text-left border-b border-themewhite2/50 hover:bg-themewhite2 active:scale-95 transition-all cursor-pointer"
                        onClick={() => handleResultClick(result)}
                    >
                        <span className={`text-[8pt] px-2 py-1 rounded-md shrink-0 ${result.badgeClass}`}>
                            {result.badge}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary truncate">{result.label}</p>
                            <p className="text-[10px] text-themeblue1/70 mt-0.5">{result.subtitle}</p>
                        </div>
                    </button>
                ))}
            </>
        )
    }

    // ── Pinned items ──────────────────────────────────────────
    const pinnedItems = visibleCategories.filter(c => pinnedKB.includes(c.id) && !c.comingSoon)

    // ── Default category grid ─────────────────────────────────
    // Map category IDs to data-tour values; first screener gets 'kb-screener'
    const tourMap: Record<string, string> = {
        medications: 'kb-medications',
        stp: 'kb-stp',
        'vital-signs': 'kb-vitals',
        burn: 'kb-burn',
    }
    let firstScreenerTagged = false

    // Shared category button renderer
    const renderCatButton = (cat: KBCategory, idx: number, tourAttr?: string) => (
        <button
            key={cat.id}
            onClick={() => handleCatClick(cat)}
            disabled={cat.comingSoon}
            onContextMenu={!cat.comingSoon ? (e) => handleContextMenu(cat.id, e) : undefined}
            onTouchStart={!cat.comingSoon ? (e) => handleTouchStart(cat.id, e) : undefined}
            onTouchEnd={!cat.comingSoon ? handleTouchEnd : undefined}
            onTouchCancel={!cat.comingSoon ? handleTouchEnd : undefined}
            {...(tourAttr ? { 'data-tour': tourAttr } : {})}
            className={`flex items-center w-full px-4 py-3.5 text-left transition-all
                ${cat.comingSoon
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-themewhite2 active:scale-95 cursor-pointer'
                }
                ${idx > 0 ? 'border-t border-tertiary/8' : ''}
            `}
        >
            <cat.icon size={18} className={cat.comingSoon ? 'text-tertiary/40' : 'text-primary/70'} />
            <div className="flex-1 min-w-0 ml-3">
                <p className={`text-sm font-medium ${cat.comingSoon ? 'text-tertiary' : 'text-primary'}`}>
                    {cat.label}
                </p>
                <p className="text-[10px] text-tertiary/60">
                    {cat.description}
                </p>
            </div>
            {!cat.comingSoon && pinnedKB.includes(cat.id) && (
                <Pin size={12} className="text-themeblue2/40 shrink-0 mr-1" />
            )}
            {!cat.comingSoon && (
                <ChevronRight size={16} className="text-tertiary/30 shrink-0" />
            )}
        </button>
    )

    return (
        <div className="px-4 py-3 md:p-5" data-tour="kb-category-grid">
            {/* Pinned section */}
            {pinnedItems.length > 0 && (
                <div className="mb-4" data-tour="kb-pinned">
                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider px-2 mb-2">
                        PINNED
                    </p>
                    <div className="rounded-xl bg-themewhite2/50 overflow-hidden">
                        {pinnedItems.map((cat, idx) => renderCatButton(cat, idx))}
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
                            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider px-2 mb-2">
                                {kbGroupLabels[group]}
                            </p>
                            <div className="rounded-xl bg-themewhite2/50 overflow-hidden">
                                {items.map((cat, idx) => {
                                    let tourAttr = tourMap[cat.id]
                                    if (!tourAttr && cat.group === 'screening' && !cat.comingSoon && !firstScreenerTagged) {
                                        tourAttr = 'kb-screener'
                                        firstScreenerTagged = true
                                    }
                                    return renderCatButton(cat, idx, tourAttr)
                                })}
                            </div>
                        </div>
                    )
                })}

            {/* Context menu */}
            {contextMenu && (
                <KBItemContextMenu
                    isPinned={pinnedKB.includes(contextMenu.id)}
                    position={contextMenu.position}
                    onTogglePin={() => togglePinKB(contextMenu.id)}
                    onClose={() => setContextMenu(null)}
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
            <p className="text-xs text-secondary py-3 border-b border-tertiary/10">
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
                                    <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                                        {q.sectionHeader}
                                    </span>
                                    <div className="h-px flex-1 bg-tertiary/15" />
                                </div>
                            )}

                            {q.type === 'info' && (
                                <div className="px-1 py-2">
                                    <p className="text-[11px] text-secondary/80 leading-relaxed">
                                        {q.text}
                                    </p>
                                    {q.dynamicContent && selectedList && (
                                        <WordListContent type={q.dynamicContent} wordList={selectedList} />
                                    )}
                                </div>
                            )}

                            {q.type === 'check' && (
                                <div className="py-2 px-1">
                                    <p className="text-xs text-primary mb-1.5">{q.text}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {q.options?.map((opt, optIdx) => {
                                            const isSelected = ((baseResponses[qIdx] ?? 0) & (1 << optIdx)) !== 0
                                            return (
                                                <button
                                                    key={optIdx}
                                                    onClick={() => handleCheckToggle(qIdx, optIdx)}
                                                    className={`px-2.5 py-1.5 rounded-full text-[10px] transition-all ${
                                                        isSelected
                                                            ? 'bg-themeblue2/15 text-themeblue2 font-semibold ring-1 ring-themeblue2/30'
                                                            : 'bg-themewhite2 text-tertiary hover:bg-themewhite'
                                                    }`}
                                                >
                                                    {isSelected && <Check size={10} className="inline mr-1" />}
                                                    {opt}
                                                </button>
                                            )
                                        })}
                                    </div>
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
                                <div className={`mx-1 my-3 px-3 py-2.5 rounded-md text-xs font-medium text-center ${
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
                        <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
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
                    <p className="text-xs text-primary mb-1.5">
                        {screenerConfig.followUp.text}
                    </p>
                    <div className="flex gap-1">
                        {screenerConfig.followUp.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => setFollowUpIdx(idx)}
                                className={`flex-1 py-1.5 rounded text-[10px] leading-tight text-center transition-all ${
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
                                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Result</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
