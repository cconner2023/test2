import { useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Info, Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { getTaskData } from '../Data/TrainingData'
import type { PerformanceStep } from '../Data/TrainingData'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'

interface TrainingDrawerProps {
    isVisible: boolean
    onClose: () => void
    taskId: string | null
}

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

function TrainingDrawerContent({ taskId }: { taskId: string }) {
    const taskData = getTaskData(taskId)
    const { markTaskViewed, markTaskCompleted, isTaskCompleted } = useTrainingCompletions()
    const bottomRef = useRef<HTMLDivElement>(null)
    const completed = isTaskCompleted(taskId)

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskId, 0)
    }, [taskId, markTaskViewed])

    // Observe bottom of content to mark completed
    useEffect(() => {
        if (completed || !bottomRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    markTaskCompleted(taskId)
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(bottomRef.current)
        return () => observer.disconnect()
    }, [taskId, completed, markTaskCompleted])

    const handleMarkComplete = useCallback(() => {
        markTaskCompleted(taskId)
    }, [taskId, markTaskCompleted])

    if (!taskData) {
        return (
            <div className="h-full flex items-center justify-center text-tertiary/60 text-sm">
                Task data not available
            </div>
        )
    }

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

                {/* Caution (task-level) */}
                {taskData.caution && (
                    <div className="mb-4">
                        <StepCallout type="caution" text={taskData.caution} />
                    </div>
                )}

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

export function TrainingDrawer({ isVisible, onClose, taskId }: TrainingDrawerProps) {
    const taskData = taskId ? getTaskData(taskId) : undefined
    const headerTitle = taskData ? taskData.title : 'Training Task'

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            header={{
                title: headerTitle,
            }}
        >
            {taskId ? (
                <TrainingDrawerContent taskId={taskId} />
            ) : (
                <div className="h-full flex items-center justify-center text-tertiary/60 text-sm">
                    No task selected
                </div>
            )}
        </BaseDrawer>
    )
}
