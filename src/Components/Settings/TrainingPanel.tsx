import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Check, ChevronRight, AlertTriangle, Info, Lock, Wind, Droplets, ShieldPlus, Stethoscope, Pill, Bone, Ambulance, BookOpen } from 'lucide-react'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData } from '../../Data/TrainingData'
import type { TaskTrainingData, PerformanceStep } from '../../Data/TrainingData'
import type { subjectAreaArray, subjectAreaArrayOptions } from '../../Types/CatTypes'
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

// Convert a skill level's subject areas to the subjectAreaArray format
function toSubjectAreaArrays(skillLevelIdx: number): subjectAreaArray[] {
    const level = stp68wTraining[skillLevelIdx]
    if (!level) return []
    return level.subjectArea.map((area, areaIdx) => ({
        id: areaIdx,
        icon: level.skillLevel,
        text: area.name,
        isParent: true,
        options: area.tasks.map((task, taskIdx) => ({
            id: taskIdx,
            icon: task.id,
            text: task.title,
            isParent: false,
            parentId: areaIdx
        }))
    }))
}

// ─── Sub-view: Training List (grouped by subject area headers) ──────────────

function TrainingList({
    onSelectTask,
}: {
    onSelectTask: (task: subjectAreaArrayOptions) => void
}) {
    const { getSubjectAreaProgress, isTaskCompleted, isTaskViewed } = useTrainingCompletions()
    const [selectedLevel, setSelectedLevel] = useState(0)
    const areas = useMemo(() => toSubjectAreaArrays(selectedLevel), [selectedLevel])

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-xs text-tertiary/60 mb-3">
                    STP 8-68W13-SM-TG — Select a skill level and task to begin studying.
                </p>

                {/* Skill Level Tabs */}
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                    {stp68wTraining.map((level, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedLevel(idx)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97]
                                ${idx === selectedLevel
                                    ? 'bg-themeblue2 text-white'
                                    : 'bg-themewhite2 text-tertiary/70 hover:text-primary'
                                }`}
                        >
                            {level.skillLevel}
                        </button>
                    ))}
                </div>

                <div className="space-y-1">
                    {areas.map((area) => {
                        const { completed, total } = getSubjectAreaProgress(area)

                        return (
                            <div key={area.id}>
                                {/* Group header */}
                                <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-tertiary/50">
                                        {subjectAreaIcons[area.text] ?? <BookOpen size={14} />}
                                        <p className="text-[10px] font-semibold tracking-widest uppercase">
                                            {area.text}
                                        </p>
                                    </div>
                                    {total > 0 && (
                                        <p className="text-[10px] text-tertiary/40">
                                            {completed}/{total}
                                        </p>
                                    )}
                                </div>

                                {/* Tasks under this area */}
                                {area.options.map((task) => {
                                    const hasData = !!getTaskData(task.icon)
                                    const taskCompleted = isTaskCompleted(task.icon)
                                    const viewed = isTaskViewed(task.icon)

                                    return (
                                        <button
                                            key={task.id}
                                            onClick={() => hasData && onSelectTask(task)}
                                            disabled={!hasData}
                                            className={`flex items-center w-full px-6 py-3 rounded-xl text-left transition-all
                                                ${hasData
                                                    ? 'hover:bg-themewhite2 active:scale-[0.98] cursor-pointer'
                                                    : 'opacity-40 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                                                    {task.text}
                                                </p>
                                                <p className="text-[8pt] text-tertiary/50 font-mono">
                                                    {task.icon}
                                                </p>
                                                {!hasData && (
                                                    <p className="text-[8pt] text-tertiary/40 flex items-center gap-1 mt-0.5">
                                                        <Lock size={9} /> Coming soon
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 ml-2">
                                                {taskCompleted ? (
                                                    <Check size={16} className="text-themegreen" />
                                                ) : viewed ? (
                                                    <div className="w-2 h-2 rounded-full bg-themeyellow" />
                                                ) : hasData ? (
                                                    <ChevronRight size={16} className="text-tertiary/30" />
                                                ) : null}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
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
