import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Check, ChevronRight, AlertTriangle, Info, Lock, Wind, Droplets, ShieldPlus, Stethoscope, Pill, Bone, Ambulance, BookOpen, Search, X } from 'lucide-react'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData } from '../../Data/TrainingData'
import type { TaskTrainingData, PerformanceStep } from '../../Data/TrainingData'
import type { subjectAreaArrayOptions } from '../../Types/CatTypes'
import { useTrainingCompletions } from '../../Hooks/useTrainingCompletions'
import { AudioAidPlayer } from '../AudioAidPlayer'
const subjectAreaIcons: Record<string, React.ReactNode> = {
    'Airway Management': <Wind size={14} />,
    'Fluid Management': <Droplets size={14} />,
    'Force Health Protection': <ShieldPlus size={14} />,
    'Medical Management': <Stethoscope size={14} />,
    'Medication Management': <Pill size={14} />,
    'Trauma Management': <Bone size={14} />,
    'Triage and Evacuation': <Ambulance size={14} />,
}

// Short badge labels for each skill level
const skillLevelLabels: Record<string, string> = {
    'Readiness Requirements': 'RR',
    'Skill Level 1': 'SL1',
    'Skill Level 2': 'SL2',
    'Skill Level 3': 'SL3',
}

// Canonical category ordering
const categoryOrder = [
    'Airway Management',
    'Fluid Management',
    'Force Health Protection',
    'Medical Management',
    'Medication Management',
    'Trauma Management',
    'Triage and Evacuation',
]

interface FlatTask {
    taskId: string
    title: string
    levelIdx: number
    levelName: string
    areaName: string
    option: subjectAreaArrayOptions
}

/**
 * Flatten all skill levels into a single list grouped by category.
 * De-duplicates by task ID within a category (keeps lowest skill level).
 * Sorted by (1) category order, (2) skill level, (3) title alphabetically.
 */
function buildAllTasksByCategory(): Map<string, FlatTask[]> {
    const seen = new Map<string, Set<string>>() // areaName -> set of taskIds
    const grouped = new Map<string, FlatTask[]>()

    // Initialise in canonical order
    for (const cat of categoryOrder) {
        grouped.set(cat, [])
        seen.set(cat, new Set())
    }

    stp68wTraining.forEach((level, levelIdx) => {
        level.subjectArea.forEach((area, areaIdx) => {
            if (!grouped.has(area.name)) {
                grouped.set(area.name, [])
                seen.set(area.name, new Set())
            }
            const seenSet = seen.get(area.name)!
            area.tasks.forEach((task, taskIdx) => {
                if (seenSet.has(task.id)) return // de-dupe
                seenSet.add(task.id)
                grouped.get(area.name)!.push({
                    taskId: task.id,
                    title: task.title,
                    levelIdx,
                    levelName: level.skillLevel,
                    areaName: area.name,
                    option: {
                        id: taskIdx,
                        icon: task.id,
                        text: task.title,
                        isParent: false,
                        parentId: areaIdx,
                    },
                })
            })
        })
    })

    // Sort within each category by skill level, then alphabetically
    for (const tasks of grouped.values()) {
        tasks.sort((a, b) => a.levelIdx - b.levelIdx || a.title.localeCompare(b.title))
    }

    return grouped
}

// ─── Sub-view: Training List (grouped by subject area headers) ──────────────

function TaskRow({
    task,
    onSelectTask,
    isTaskCompleted,
    isTaskViewed,
}: {
    task: FlatTask
    onSelectTask: (t: subjectAreaArrayOptions) => void
    isTaskCompleted: (id: string) => boolean
    isTaskViewed: (id: string) => boolean
}) {
    const hasData = !!getTaskData(task.taskId)
    const completed = isTaskCompleted(task.taskId)
    const viewed = isTaskViewed(task.taskId)
    const badge = skillLevelLabels[task.levelName] ?? task.levelName

    return (
        <button
            onClick={() => hasData && onSelectTask(task.option)}
            disabled={!hasData}
            className={`flex items-center w-full px-6 py-3 rounded-xl text-left transition-all
                ${hasData
                    ? 'hover:bg-themewhite2 active:scale-[0.98] cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
        >
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                    {task.title}
                </p>
                <p className="text-[8pt] text-tertiary/50 font-mono">
                    {task.taskId}
                </p>
                {!hasData && (
                    <p className="text-[8pt] text-tertiary/40 flex items-center gap-1 mt-0.5">
                        <Lock size={9} /> Coming soon
                    </p>
                )}
            </div>
            <div className="shrink-0 ml-2 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[8pt] font-semibold bg-themewhite2 text-tertiary/60">
                    {badge}
                </span>
                {completed ? (
                    <Check size={16} className="text-themegreen" />
                ) : viewed ? (
                    <div className="w-2 h-2 rounded-full bg-themeyellow" />
                ) : hasData ? (
                    <ChevronRight size={16} className="text-tertiary/30" />
                ) : null}
            </div>
        </button>
    )
}

function TrainingList({
    onSelectTask,
}: {
    onSelectTask: (task: subjectAreaArrayOptions) => void
}) {
    const { isTaskCompleted, isTaskViewed } = useTrainingCompletions()
    const [searchQuery, setSearchQuery] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const allByCategory = useMemo(() => buildAllTasksByCategory(), [])

    // Filter when searching
    const displayCategories = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return allByCategory

        const filtered = new Map<string, FlatTask[]>()
        for (const [cat, tasks] of allByCategory) {
            const matched = tasks.filter(
                t => t.title.toLowerCase().includes(q) || t.taskId.toLowerCase().includes(q)
            )
            if (matched.length > 0) filtered.set(cat, matched)
        }
        return filtered
    }, [searchQuery, allByCategory])

    const totalResults = useMemo(() => {
        let n = 0
        for (const tasks of displayCategories.values()) n += tasks.length
        return n
    }, [displayCategories])

    const isSearching = searchQuery.trim().length > 0

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-xs text-tertiary/60 mb-3">
                    STP 8-68W13-SM-TG — Select a task to begin studying.
                </p>

                {/* Search Bar */}
                <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tasks..."
                        className="w-full pl-8 pr-8 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                                   placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); inputRef.current?.focus() }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-tertiary/10 transition-colors"
                        >
                            <X size={14} className="text-tertiary/50" />
                        </button>
                    )}
                </div>

                {isSearching && (
                    <p className="text-[10px] text-tertiary/50 mb-2">
                        {totalResults} result{totalResults !== 1 ? 's' : ''}
                    </p>
                )}

                {totalResults === 0 && isSearching ? (
                    <p className="text-sm text-tertiary/40 text-center py-8">No tasks match your search.</p>
                ) : (
                    <div className="space-y-1">
                        {Array.from(displayCategories).map(([categoryName, tasks]) => (
                            <div key={categoryName}>
                                {/* Group header */}
                                <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-tertiary/50">
                                        {subjectAreaIcons[categoryName] ?? <BookOpen size={14} />}
                                        <p className="text-[10px] font-semibold tracking-widest uppercase">
                                            {categoryName}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-tertiary/40">
                                        {tasks.length}
                                    </p>
                                </div>

                                {/* Tasks */}
                                {tasks.map((task) => (
                                    <TaskRow
                                        key={task.taskId}
                                        task={task}
                                        onSelectTask={onSelectTask}
                                        isTaskCompleted={isTaskCompleted}
                                        isTaskViewed={isTaskViewed}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Sub-view: Task Detail (Learning View) ───────────────────────────────────

function StepCallout({ type, text }: { type: 'warning' | 'caution' | 'note'; text: string }) {
    const styles = {
        warning: { bg: 'bg-themeyellow/10', border: 'border-themeyellow/30', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0 mt-0.5" />, label: 'WARNING' },
        caution: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />, label: 'CAUTION' },
        note: { bg: 'bg-themeblue2/10', border: 'border-themeblue2/30', icon: <Info size={13} className="text-themeblue2 shrink-0 mt-0.5" />, label: 'NOTE' },
    }
    const s = styles[type]

    return (
        <div className={`${s.bg} border ${s.border} rounded-md px-3 py-2 mt-1.5 flex items-start gap-2`}>
            {s.icon}
            <div>
                <p className="text-[7pt] font-bold tracking-wider opacity-60">{s.label}</p>
                <p className="text-xs text-primary/80">{text}</p>
            </div>
        </div>
    )
}

function PerformanceStepItem({ step }: { step: PerformanceStep }) {
    return (
        <div className={`${step.isSubStep ? 'ml-6' : ''}`}>
            <div className="flex items-start gap-2 py-1.5">
                <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right mt-px">
                    {step.number}
                </span>
                <p className="text-sm text-primary flex-1">{step.text}</p>
            </div>
            {step.warning && <StepCallout type="warning" text={step.warning} />}
            {step.caution && <StepCallout type="caution" text={step.caution} />}
            {step.note && <StepCallout type="note" text={step.note} />}
        </div>
    )
}

function TaskDetail({
    taskData,
    taskNumber,
}: {
    taskData: TaskTrainingData
    taskNumber: string
}) {
    const { markTaskViewed, markTaskCompleted, isTaskCompleted } = useTrainingCompletions()
    const bottomRef = useRef<HTMLDivElement>(null)
    const completed = isTaskCompleted(taskNumber)

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskNumber, 0)
    }, [taskNumber, markTaskViewed])

    // Observe bottom of content to mark completed
    useEffect(() => {
        if (completed || !bottomRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    markTaskCompleted(taskNumber)
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(bottomRef.current)
        return () => observer.disconnect()
    }, [taskNumber, completed, markTaskCompleted])

    const handleMarkComplete = useCallback(() => {
        markTaskCompleted(taskNumber)
    }, [taskNumber, markTaskCompleted])

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5 pb-12">
                {/* Header */}
                <div className="mb-4">
                    <p className="text-[8pt] text-tertiary/50 font-mono">{taskData.taskNumber}</p>
                    <h3 className="text-lg font-semibold text-primary">{taskData.title}</h3>
                    {completed && (
                        <span className="inline-flex items-center gap-1 text-[9pt] text-themegreen mt-1">
                            <Check size={12} /> Completed
                        </span>
                    )}
                </div>

                {/* Conditions */}
                <div className="mb-4">
                    <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Conditions</p>
                    <div className="bg-themewhite2 rounded-lg px-3.5 py-3">
                        <p className="text-sm text-primary/80 leading-relaxed">{taskData.conditions}</p>
                    </div>
                </div>

                {/* Standards */}
                <div className="mb-4">
                    <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Standards</p>
                    <div className="bg-themewhite2 rounded-lg px-3.5 py-3">
                        <p className="text-sm text-primary/80 leading-relaxed">{taskData.standards}</p>
                    </div>
                </div>

                {/* Audio Training Aids */}
                {taskData.audioAids && taskData.audioAids.length > 0 && (
                    <AudioAidPlayer audioAids={taskData.audioAids} />
                )}

                {/* Performance Steps */}
                <div className="mb-4">
                    <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Performance Steps</p>
                    <div className="bg-themewhite2 rounded-lg px-3 py-2">
                        {taskData.performanceSteps.map((step, i) => (
                            <PerformanceStepItem key={i} step={step} />
                        ))}
                    </div>
                </div>

                {/* Mark complete button (if not already) */}
                {!completed && (
                    <button
                        onClick={handleMarkComplete}
                        className="w-full py-3 rounded-xl bg-themegreen/15 text-themegreen text-sm font-medium
                                   hover:bg-themegreen/25 active:scale-[0.98] transition-all"
                    >
                        Mark as Completed
                    </button>
                )}

                {/* Bottom sentinel for auto-complete */}
                <div ref={bottomRef} className="h-1" />
            </div>
        </div>
    )
}

// ─── Exported Panel ──────────────────────────────────────────────────────────

export type TrainingView = 'training' | 'training-detail'

interface TrainingPanelProps {
    view: TrainingView
    selectedTask: subjectAreaArrayOptions | null
    onSelectTask: (task: subjectAreaArrayOptions) => void
}

export function TrainingPanel({
    view,
    selectedTask,
    onSelectTask,
}: TrainingPanelProps) {
    if (view === 'training-detail' && selectedTask) {
        const taskData = getTaskData(selectedTask.icon)
        if (taskData) {
            return <TaskDetail taskData={taskData} taskNumber={selectedTask.icon} />
        }
    }

    return <TrainingList onSelectTask={onSelectTask} />
}
