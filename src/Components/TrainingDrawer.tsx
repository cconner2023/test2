import { useEffect, useRef, useCallback } from 'react'
import { Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { getTaskData } from '../Data/TrainingData'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { AudioAidPlayer } from './AudioAidPlayer'
import { StepCallout, PerformanceStepItem, SectionHeader } from './TrainingStepComponents'

interface TrainingDrawerProps {
    isVisible: boolean
    onClose: () => void
    taskId: string | null
}

function TrainingDrawerContent({ taskId }: { taskId: string }) {
    const taskData = getTaskData(taskId)
    const { markTaskViewed, markTaskCompleted, isTaskCompleted } = useTrainingCompletions()
    const bottomRef = useRef<HTMLDivElement>(null)
    const completed = isTaskCompleted(taskId)

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskId)
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
                <div className="mb-5">
                    <p className="text-[8pt] text-tertiary/50 font-mono">{taskData.taskNumber}</p>
                    <h3 className="text-lg font-semibold text-primary">{taskData.title}</h3>
                    {completed && (
                        <span className="inline-flex items-center gap-1 text-[9pt] text-themegreen mt-1">
                            <Check size={12} /> Completed
                        </span>
                    )}
                </div>

                {/* Warning (task-level) */}
                {taskData.warning && (
                    <div className="mb-4">
                        <StepCallout type="warning" text={taskData.warning} />
                    </div>
                )}

                {/* Caution (task-level) */}
                {taskData.caution && (
                    <div className="mb-4">
                        <StepCallout type="caution" text={taskData.caution} />
                    </div>
                )}

                {/* Conditions */}
                <div className="mb-5">
                    <SectionHeader>Conditions</SectionHeader>
                    <p className="text-sm text-primary/80 leading-relaxed">{taskData.conditions}</p>
                </div>

                {/* Standards */}
                <div className="mb-5">
                    <SectionHeader>Standards</SectionHeader>
                    <p className="text-sm text-primary/80 leading-relaxed">{taskData.standards}</p>
                </div>

                {/* Audio Training Aids */}
                {taskData.audioAids && taskData.audioAids.length > 0 && (
                    <AudioAidPlayer audioAids={taskData.audioAids} />
                )}

                {/* Performance Steps */}
                <div className="mb-5">
                    <SectionHeader>Performance Steps</SectionHeader>
                    <div className="divide-y divide-tertiary/8">
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
                                   hover:bg-themegreen/25 active:scale-95 transition-all"
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
