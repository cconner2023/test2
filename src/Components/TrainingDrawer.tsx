import { useEffect, useState, useCallback } from 'react'
import { Check, CalendarDays, RotateCcw } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { AddFab } from '@/Components/primitives/AddFab'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { getTaskData } from '../Data/TrainingData'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { useCalendarWrite } from '../Hooks/useCalendarWrite'
import { useCalendarStore } from '../stores/useCalendarStore'
import { AudioAidPlayer } from './AudioAidPlayer'
import { StepCallout, PerformanceStepItem } from './TrainingStepComponents'
import { SectionHeader } from '@/Components/primitives/Section'

interface TrainingDrawerProps {
    isVisible: boolean
    onClose: () => void
    taskId: string | null
}

/** When a read happened. Duplicated from TrainingPanel's copy the way
 *  formatDueDate already is — the two readers share a look, not a module. */
function formatReadDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    })
}

function TrainingDrawerContent({ taskId }: { taskId: string }) {
    const taskData = getTaskData(taskId)
    const { markTaskViewed, markTaskCompleted, getLastRead, getAssignment } = useTrainingCompletions()
    const [confirmRelog, setConfirmRelog] = useState(false)
    const lastRead = getLastRead(taskId)
    const completed = !!lastRead
    const assignment = getAssignment(taskId)
    const isAssigned = assignment && !assignment.completedAt
    const isOverdue = isAssigned && assignment.dueDate && new Date(assignment.dueDate) < new Date()

    const { vaultUpdate } = useCalendarWrite()
    const calendarEvents = useCalendarStore(s => s.events)

    const formatDueDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const updateCalendarOnCompletion = useCallback(() => {
        if (!isAssigned || !assignment.calendarOriginId) return
        const calEvent = calendarEvents.find(e => e.originId === assignment.calendarOriginId)
        if (!calEvent) return
        const updatedEvent = { ...calEvent, status: 'completed' as const, updated_at: new Date().toISOString() }
        // Optimistic local update then vault sync
        useCalendarStore.getState().updateEvent(calEvent.id, updatedEvent)
        vaultUpdate(updatedEvent)
    }, [isAssigned, assignment, calendarEvents, vaultUpdate])

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskId)
    }, [taskId, markTaskViewed])

    // Logging is an act, not a scroll side effect — and the FAB outlives the
    // first read so a refresh can be logged. See TrainingPanel's TaskDetail for
    // the full reasoning; this reader carries the identical surface.
    const handleLog = useCallback(() => {
        markTaskCompleted(taskId)
        updateCalendarOnCompletion()
        setConfirmRelog(false)
    }, [taskId, markTaskCompleted, updateCalendarOnCompletion])

    const handleFab = useCallback(() => {
        if (completed) setConfirmRelog(true)
        else handleLog()
    }, [completed, handleLog])

    if (!taskData) {
        return (
            <div className="h-full flex items-center justify-center text-tertiary text-sm">
                Task data not available
            </div>
        )
    }

    return (
        <>
                {/* Header */}
                <div className="mb-5">
                    <p className="text-[9pt] text-tertiary font-mono">{taskData.taskNumber}</p>
                    <h3 className="text-lg font-semibold text-primary">{taskData.title}</h3>
                    {/* The date, not a checkmark — currency is what a doctrine
                        refresh interval is measured against. */}
                    {lastRead && (
                        <span className="inline-flex items-center gap-1 text-[9pt] text-themegreen mt-1">
                            <Check size={12} /> Last read {formatReadDate(lastRead.completedAt ?? lastRead.updatedAt)}
                        </span>
                    )}
                </div>

                {/* Assignment banner */}
                {isAssigned && assignment.dueDate && (
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 ${
                        isOverdue
                            ? 'bg-themeredred/10 border border-themeredred/20'
                            : 'bg-themeblue3/10 border border-themeblue3/20'
                    }`}>
                        <CalendarDays size={15} className={isOverdue ? 'text-themeredred' : 'text-themeblue2'} />
                        <span className={`text-sm font-medium ${isOverdue ? 'text-themeredred' : 'text-themeblue2'}`}>
                            {isOverdue ? 'Overdue' : 'Due'}: {formatDueDate(assignment.dueDate)}
                        </span>
                        {assignment.supervisorNotes && (
                            <span className="text-[10pt] text-tertiary ml-auto truncate max-w-[50%]">
                                {assignment.supervisorNotes}
                            </span>
                        )}
                    </div>
                )}

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
                    <p className="text-sm text-primary leading-relaxed">{taskData.conditions}</p>
                </div>

                {/* Standards */}
                <div className="mb-5">
                    <SectionHeader>Standards</SectionHeader>
                    <p className="text-sm text-primary leading-relaxed">{taskData.standards}</p>
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

                {/* Sticky, not absolute: this body is plain flow inside
                    BaseDrawer's scrollport, so there is no positioned ancestor to
                    hang a FAB off. Same idiom as the evaluator's submit. */}
                <div className="sticky bottom-4 z-10 flex justify-end pt-2 pointer-events-none">
                    <AddFab
                        icon={completed ? RotateCcw : Check}
                        label={completed ? 'Log another read' : 'Log completion'}
                        onClick={handleFab}
                    />
                </div>

                <ConfirmDialog
                    visible={confirmRelog}
                    title="Log another read?"
                    subtitle={`This records a new read of ${taskData.taskNumber} today. The earlier one stays on file — only a supervisor can remove a record.`}
                    confirmLabel="Log read"
                    variant="primary"
                    onConfirm={handleLog}
                    onCancel={() => setConfirmRelog(false)}
                />
        </>
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
            contentPadding="standard"
        >
            {taskId ? (
                <TrainingDrawerContent taskId={taskId} />
            ) : (
                <div className="h-full flex items-center justify-center text-tertiary text-sm">
                    No task selected
                </div>
            )}
        </BaseDrawer>
    )
}
