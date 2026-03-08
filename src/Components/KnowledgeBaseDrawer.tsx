import { useState, useCallback, useMemo, useEffect } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { TrainingPanel, type TrainingView } from './Settings/TrainingPanel'
import { MedicationContent } from './MedicationContent'
import { ContentWrapper } from './Settings/ContentWrapper'
import { QuestionRow, WordListContent } from './ScreenerDrawer'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useAuthStore } from '../stores/useAuthStore'
import { kbCategories, kbGroupLabels, kbGroupOrder, type KBCategory } from '../Data/KnowledgeBaseCategories'
import { GAD7, PHQ2, MACE2 } from '../Data/SpecTesting'
import { getScreenerMaxScore, isQuestionScored } from '../Data/SpecTesting'
import { stp68wTraining } from '../Data/TrainingTaskList'
import { getTaskData } from '../Data/TrainingData'
import { Check } from 'lucide-react'
import { UI_TIMING } from '../Utilities/constants'
import type { subjectAreaArrayOptions } from '../Types/CatTypes'
import type { medListTypes } from '../Data/MedData'
import type { ScreenerConfig, ScreenerWordList } from '../Types/AlgorithmTypes'

type KBView =
    | 'home'
    | 'training'
    | 'training-detail'
    | 'medications'
    | 'medication-detail'
    | 'screener'

interface KnowledgeBaseDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialView?: string | null
    initialTaskId?: string | null
    initialMedication?: medListTypes | null
}

const screenerMap: Record<string, ScreenerConfig> = {
    gad7: GAD7,
    phq2: PHQ2,
    mace2: MACE2,
}

export function KnowledgeBaseDrawer({
    isVisible,
    onClose,
    initialView,
    initialTaskId,
    initialMedication,
}: KnowledgeBaseDrawerProps) {
    const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false
    const [view, setView] = useState<KBView>('home')
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null)
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)
    const [activeScreener, setActiveScreener] = useState<ScreenerConfig | null>(null)
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

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
        handleSlideAnimation('right')
        switch (view) {
            case 'training-detail':
                setView('training')
                setSelectedTask(null)
                break
            case 'training':
            case 'medications':
            case 'screener':
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
                return { title: 'STP 68W Training', showBack: true, onBack: handleBack }
            case 'training-detail':
                return { title: selectedTask?.text || 'Task', showBack: true, onBack: handleBack }
            case 'medications':
                return { title: tc3Mode ? 'TC3 Medications' : 'Medications', showBack: true, onBack: handleBack }
            case 'medication-detail':
                return { title: selectedMedication?.text || 'Medication', showBack: true, onBack: handleBack }
            case 'screener':
                return { title: activeScreener?.title || 'Screener', showBack: true, onBack: handleBack }
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
        >
            <ContentWrapper slideDirection={slideDirection} swipeHandlers={canSwipeBack ? swipeHandlers : undefined}>
                {view === 'home' && (
                    <KBHome onCategoryClick={handleCategoryClick} />
                )}
                {(view === 'training' || view === 'training-detail') && (
                    <TrainingPanel
                        view={view as TrainingView}
                        selectedTask={selectedTask}
                        onSelectTask={handleSelectTask}
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
            </ContentWrapper>
        </BaseDrawer>
    )
}

// ── KB Home View ────────────────────────────────────────────────────────────

function KBHome({ onCategoryClick }: { onCategoryClick: (cat: KBCategory) => void }) {
    const grouped = useMemo(() => {
        const map = new Map<string, KBCategory[]>()
        for (const group of kbGroupOrder) {
            map.set(group, kbCategories.filter(c => c.group === group))
        }
        return map
    }, [])

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                {kbGroupOrder.map(group => {
                    const items = grouped.get(group)
                    if (!items?.length) return null
                    return (
                        <div key={group} className="mb-4">
                            <p className="text-xs font-semibold text-tertiary uppercase tracking-wide px-2 mb-2">
                                {kbGroupLabels[group]}
                            </p>
                            <div className="rounded-xl bg-themewhite2/50 overflow-hidden">
                                {items.map((cat, idx) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => onCategoryClick(cat)}
                                        disabled={cat.comingSoon}
                                        className={`flex items-center w-full px-4 py-3.5 text-left transition-all
                                            ${cat.comingSoon
                                                ? 'opacity-40 cursor-not-allowed'
                                                : 'hover:bg-themewhite2 active:scale-[0.99] cursor-pointer'
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
                                        {!cat.comingSoon && (
                                            <ChevronRight size={16} className="text-tertiary/30 shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
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
        <div className="h-full overflow-y-auto px-4 pb-6">
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
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Result</p>
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
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-themewhite2 text-tertiary hover:bg-themewhite active:scale-[0.98] transition-all"
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
