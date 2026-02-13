import { useRef, useEffect, useCallback } from 'react'
import { Check, ChevronRight, AlertTriangle, Info, Lock } from 'lucide-react'
import { TrainingStpData } from '../../Data/CatData'
import { getTaskData } from '../../Data/TrainingData'
import type { TaskTrainingData, PerformanceStep } from '../../Data/TrainingData'
import type { subjectAreaArray, subjectAreaArrayOptions } from '../../Types/CatTypes'
import { useTrainingProgress } from '../../Hooks/useTrainingProgress'

// ─── Sub-view: Subject Area List ─────────────────────────────────────────────

function SubjectAreaList({
    onSelectArea,
}: {
    onSelectArea: (area: subjectAreaArray) => void
}) {
    const { getSubjectAreaProgress } = useTrainingProgress()

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-xs text-tertiary/60 mb-4">
                    STP 8-68W13-SM-TG — Select a subject area to begin studying.
                </p>
                <div className="space-y-2">
                    {TrainingStpData.map((area) => {
                        const { completed, total } = getSubjectAreaProgress(area)
                        const allDone = total > 0 && completed === total

                        return (
                            <button
                                key={area.id}
                                onClick={() => onSelectArea(area)}
                                className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                           transition-all rounded-xl group text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9pt] text-tertiary/50 font-medium uppercase tracking-wider">
                                        {area.icon}
                                    </p>
                                    <p className="text-base text-primary font-medium truncate">
                                        {area.text}
                                    </p>
                                    {total > 0 && (
                                        <p className="text-[9pt] text-tertiary/50 mt-0.5">
                                            {completed}/{total} completed
                                        </p>
                                    )}
                                </div>
                                {allDone ? (
                                    <Check size={18} className="text-themegreen shrink-0 ml-2" />
                                ) : (
                                    <ChevronRight size={16} className="text-tertiary/40 shrink-0 ml-2" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Sub-view: Task List ─────────────────────────────────────────────────────

function TaskList({
    subjectArea,
    onSelectTask,
}: {
    subjectArea: subjectAreaArray
    onSelectTask: (task: subjectAreaArrayOptions) => void
}) {
    const { isTaskCompleted, isTaskViewed } = useTrainingProgress()

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="space-y-1">
                    {subjectArea.options.map((task) => {
                        const hasData = !!getTaskData(task.icon)
                        const completed = isTaskCompleted(task.icon)
                        const viewed = isTaskViewed(task.icon)

                        return (
                            <button
                                key={task.id}
                                onClick={() => hasData && onSelectTask(task)}
                                disabled={!hasData}
                                className={`flex items-center w-full px-4 py-3 rounded-xl text-left transition-all
                                    ${hasData
                                        ? 'hover:bg-themewhite2 active:scale-[0.98] cursor-pointer'
                                        : 'opacity-40 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[8pt] text-tertiary/50 font-mono">
                                        {task.icon}
                                    </p>
                                    <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                                        {task.text}
                                    </p>
                                    {!hasData && (
                                        <p className="text-[8pt] text-tertiary/40 flex items-center gap-1 mt-0.5">
                                            <Lock size={9} /> Coming soon
                                        </p>
                                    )}
                                </div>
                                <div className="shrink-0 ml-2">
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
    const { markTaskViewed, markTaskCompleted, isTaskCompleted } = useTrainingProgress()
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

export type TrainingView = 'training' | 'training-tasks' | 'training-detail'

interface TrainingPanelProps {
    view: TrainingView
    selectedSubjectArea: subjectAreaArray | null
    selectedTask: subjectAreaArrayOptions | null
    onSelectArea: (area: subjectAreaArray) => void
    onSelectTask: (task: subjectAreaArrayOptions) => void
}

export function TrainingPanel({
    view,
    selectedSubjectArea,
    selectedTask,
    onSelectArea,
    onSelectTask,
}: TrainingPanelProps) {
    if (view === 'training-detail' && selectedTask) {
        const taskData = getTaskData(selectedTask.icon)
        if (taskData) {
            return <TaskDetail taskData={taskData} taskNumber={selectedTask.icon} />
        }
    }

    if (view === 'training-tasks' && selectedSubjectArea) {
        return <TaskList subjectArea={selectedSubjectArea} onSelectTask={onSelectTask} />
    }

    return <SubjectAreaList onSelectArea={onSelectArea} />
}
