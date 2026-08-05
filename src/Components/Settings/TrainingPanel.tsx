import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Check, ChevronRight, Lock, CalendarDays, ClipboardList, Pin, RotateCcw } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { AddFab } from '@/Components/primitives/AddFab'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData } from '../../Data/TrainingData'
import type { TaskTrainingData } from '../../Data/TrainingData'
import type { subjectAreaArrayOptions } from '../../Types/CatTypes'
import { useTrainingCompletions, type TrainingCompletionUI } from '../../Hooks/useTrainingCompletions'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { AudioAidPlayer } from '../AudioAidPlayer'
import { ImageAidGallery } from '../ImageAidGallery'
import { useAuthStore } from '../../stores/useAuthStore'
import { skillLevelLabels, categoryOrder } from '../../Data/TrainingConstants'
import { StepCallout, PerformanceStepItem } from '../TrainingStepComponents'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from '../liftPress'
import { useNavPreferencesStore } from '../../stores/useNavPreferencesStore'
import { useShallow } from 'zustand/react/shallow'

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

// ─── Assignments Section ────────────────────────────────────────────────────

function AssignmentsSection({
    assignments,
    onSelectTask,
    resolveName,
}: {
    assignments: TrainingCompletionUI[]
    onSelectTask: (t: subjectAreaArrayOptions) => void
    resolveName: (id: string | null) => string
}) {
    if (assignments.length === 0) return null

    const formatDueDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const now = new Date()

    return (
        <div className="px-5 pt-4 pb-1">
            <SectionHeader trailing={<span className="text-[9pt] text-tertiary">{assignments.length}</span>}>
                Assignments
            </SectionHeader>
            <SectionCard>
                {assignments.map((a, idx) => {
                    const taskData = getTaskData(a.trainingItemId)
                    const title = taskData?.title ?? a.trainingItemId
                    const isOverdue = a.dueDate && new Date(a.dueDate) < now

                    return (
                        <button
                            key={a.id}
                            onClick={() => {
                                if (!taskData) return
                                onSelectTask({
                                    id: 0,
                                    icon: a.trainingItemId,
                                    text: title,
                                    isParent: false,
                                    parentId: 0,
                                })
                            }}
                            className={`flex items-center gap-3 w-full px-4 py-3.5 text-left active:scale-95 transition-all
                                hover:bg-themeblue2/5 cursor-pointer
                                ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                        >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isOverdue ? 'bg-themeredred/10' : 'bg-themeblue3/10'
                            }`}>
                                <ClipboardList size={14} className={isOverdue ? 'text-themeredred' : 'text-themeblue2'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-primary truncate">{title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9pt] text-tertiary">
                                        {resolveName(a.supervisorId)}
                                    </span>
                                    {a.dueDate && (
                                        <>
                                            <span className="text-tertiary">·</span>
                                            <span className={`text-[9pt] font-medium ${
                                                isOverdue ? 'text-themeredred' : 'text-tertiary'
                                            }`}>
                                                {isOverdue ? 'Overdue' : 'Due'} {formatDueDate(a.dueDate)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className={`shrink-0 w-2 h-2 rounded-full ${
                                isOverdue ? 'bg-themeredred' : 'bg-themeblue2'
                            }`} />
                        </button>
                    )
                })}
            </SectionCard>
        </div>
    )
}

// ─── Sub-view: Training List (grouped by subject area headers) ──────────────

function TaskRow({
    task,
    onClick,
    isTaskCompleted,
    isTaskViewed,
    assignment,
    isPinned,
    pressHandlers,
}: {
    task: FlatTask
    onClick: () => void
    isTaskCompleted: (id: string) => boolean
    isTaskViewed: (id: string) => boolean
    assignment?: ReturnType<ReturnType<typeof useTrainingCompletions>['getAssignment']>
    isPinned: boolean
    pressHandlers: ReturnType<typeof liftPressHandlers>
}) {
    const hasData = !!getTaskData(task.taskId)
    const completed = isTaskCompleted(task.taskId)
    const viewed = isTaskViewed(task.taskId)
    const badge = skillLevelLabels[task.levelName] ?? task.levelName

    const isAssigned = assignment && !assignment.completedAt
    const isOverdue = isAssigned && assignment.dueDate && new Date(assignment.dueDate) < new Date()

    const formatDueDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <button
            onClick={() => hasData && onClick()}
            disabled={!hasData}
            {...(hasData ? pressHandlers : {})}
            className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all
                ${hasData
                    ? 'active:scale-95 hover:bg-themeblue2/5 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
        >
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                    {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9pt] text-tertiary font-mono">
                        {task.taskId}
                    </p>
                    {isAssigned && assignment.dueDate && (
                        <span className={`text-[9pt] font-medium ${isOverdue ? 'text-themeredred' : 'text-themeblue2'}`}>
                            {isOverdue ? 'Overdue' : 'Due'}: {formatDueDate(assignment.dueDate)}
                        </span>
                    )}
                </div>
                {!hasData && (
                    <p className="text-[9pt] text-tertiary flex items-center gap-1 mt-0.5">
                        <Lock size={9} /> Coming soon
                    </p>
                )}
            </div>
            <div className="shrink-0 ml-2 flex items-center gap-2">
                {isPinned && (
                    <Pin size={12} className="text-themeblue2/40" />
                )}
                <span className="px-1.5 py-0.5 rounded text-[9pt] font-semibold bg-tertiary/10 text-tertiary">
                    {badge}
                </span>
                {completed ? (
                    <Check size={16} className="text-themegreen" />
                ) : isAssigned ? (
                    <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-themeredred' : 'bg-themeblue2'}`} />
                ) : viewed ? (
                    <div className="w-2 h-2 rounded-full bg-themeyellow" />
                ) : hasData ? (
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                ) : null}
            </div>
        </button>
    )
}

function TrainingList({
    onSelectTask,
    searchQuery,
}: {
    onSelectTask: (task: subjectAreaArrayOptions) => void
    searchQuery: string
}) {
    const { isTaskCompleted, isTaskViewed, getAssignment, getPendingAssignments } = useTrainingCompletions()
    const { medics } = useClinicMedics()
    const { pinnedKB, togglePinKB } = useNavPreferencesStore(
        useShallow(s => ({ pinnedKB: s.pinnedKB, togglePinKB: s.togglePinKB }))
    )

    // ── Lift-and-clone menu (long-press / right-click) ────────
    const [lifted, setLifted] = useState<({ id: string } & LiftSnapshot) | null>(null)
    const pressRef = useRef<LiftPressState | null>(null)

    const makeHandlers = useCallback((id: string) =>
        liftPressHandlers((snap) => setLifted({ id, ...snap }), pressRef), [])

    const handleTaskClick = useCallback((task: FlatTask) => {
        if (pressRef.current?.fired) return
        onSelectTask(task.option)
    }, [onSelectTask])

    const pendingAssignments = useMemo(() => getPendingAssignments(), [getPendingAssignments])

    const resolveName = useCallback((id: string | null): string => {
        if (!id) return 'Unknown'
        const medic = medics.find(m => m.id === id)
        if (!medic) return 'Supervisor'
        return `${medic.rank ? medic.rank + ' ' : ''}${medic.lastName ?? 'Unknown'}`
    }, [medics])

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
        <>
        {!isSearching && pendingAssignments.length > 0 && (
            <AssignmentsSection
                assignments={pendingAssignments}
                onSelectTask={onSelectTask}
                resolveName={resolveName}
            />
        )}
        <div className="px-5 py-4 space-y-5">
            <p className="text-[10pt] text-tertiary">
                Select a task to begin studying.
            </p>

            {isSearching && (
                <p className="text-[9pt] text-tertiary">
                    {totalResults} result{totalResults !== 1 ? 's' : ''}
                </p>
            )}

            {totalResults === 0 && isSearching ? (
                <EmptyState title="No tasks match your search" />
            ) : (
                Array.from(displayCategories).map(([categoryName, tasks]) => (
                    <div key={categoryName}>
                        <SectionHeader trailing={<span className="text-[9pt] text-tertiary">{tasks.length}</span>}>
                            {categoryName}
                        </SectionHeader>
                        <SectionCard>
                            {tasks.map((task, idx) => (
                                <div key={task.taskId} className={idx > 0 ? 'border-t border-tertiary/8' : ''}>
                                    <TaskRow
                                        task={task}
                                        onClick={() => handleTaskClick(task)}
                                        isTaskCompleted={isTaskCompleted}
                                        isTaskViewed={isTaskViewed}
                                        assignment={getAssignment(task.taskId)}
                                        isPinned={pinnedKB.includes('task:' + task.taskId)}
                                        pressHandlers={makeHandlers('task:' + task.taskId)}
                                    />
                                </div>
                            ))}
                        </SectionCard>
                    </div>
                ))
            )}
        </div>

        {lifted && (
            <LiftedRowMenu
                isOpen
                anchorRect={lifted.rect}
                row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                onClose={() => setLifted(null)}
                layout="list"
                items={[{
                    key: 'pin',
                    label: pinnedKB.includes(lifted.id) ? 'Unpin' : 'Pin',
                    icon: Pin,
                    onAction: () => togglePinKB(lifted.id),
                }]}
            />
        )}
        </>
    )
}

// ─── Sub-view: Task Detail (Learning View) ───────────────────────────────────

/** When a read happened. The year only when it is not this one — a refresh
 *  interval is measured in months, so the year is the part that changes what the
 *  date means. */
function formatReadDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    })
}

function TaskDetail({
    taskData,
    taskNumber,
}: {
    taskData: TaskTrainingData
    taskNumber: string
}) {
    const { markTaskViewed, markTaskCompleted, getLastRead, getAssignment } = useTrainingCompletions()
    const isDevRole = useAuthStore(s => s.isDevRole)
    const [confirmRelog, setConfirmRelog] = useState(false)
    const lastRead = getLastRead(taskNumber)
    const completed = !!lastRead
    const assignment = getAssignment(taskNumber)
    const isAssigned = assignment && !assignment.completedAt
    const isOverdue = isAssigned && assignment.dueDate && new Date(assignment.dueDate) < new Date()

    const { sendEvent: vaultSendEvent, deleteEvents: vaultDeleteEvents } = useCalendarVault()
    const calendarEvents = useCalendarStore(s => s.events)
    const updateCalendarEvent = useCalendarStore(s => s.updateEvent)

    const formatDueDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const updateCalendarOnCompletion = useCallback(() => {
        if (!isAssigned || !assignment.calendarOriginId) return
        const calEvent = calendarEvents.find(e => e.originId === assignment.calendarOriginId)
        if (!calEvent) return

        const updatedEvent = { ...calEvent, status: 'completed' as const, updated_at: new Date().toISOString() }
        updateCalendarEvent(calEvent.id, { status: 'completed', updated_at: updatedEvent.updated_at })

        const oldOriginIds = calEvent.originId ? [calEvent.originId] : []
        if (oldOriginIds.length > 0) {
            vaultDeleteEvents(oldOriginIds).catch(() => {})
        }
        vaultSendEvent('c', updatedEvent).then(newOriginId => {
            if (newOriginId) updateCalendarEvent(calEvent.id, { originId: newOriginId })
        }).catch(() => {})
    }, [isAssigned, assignment, vaultSendEvent, vaultDeleteEvents, calendarEvents, updateCalendarEvent])

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskNumber)
    }, [taskNumber, markTaskViewed])

    /**
     * Logging a read is an ACT, never a side effect of scrolling.
     *
     * This used to be an IntersectionObserver on a sentinel at the foot of the
     * packet: scrolling to the bottom wrote a real, supervisor-visible,
     * medic-undeletable training record. It also made the deliberate control
     * unpressable — the button sat directly above the sentinel, so bringing it
     * into view fired the observer, flipped `completed`, and unmounted the button
     * under the thumb. What the record said was "reached the end of a page", and
     * a training record has to be able to say more than that.
     *
     * The FAB SURVIVES COMPLETION, which is the other half. Tasks carry a
     * doctrine refresh interval, so a re-read is a new record rather than a
     * no-op, and there was previously no way to log one at all.
     */
    const handleLog = useCallback(() => {
        markTaskCompleted(taskNumber)
        updateCalendarOnCompletion()
        setConfirmRelog(false)
    }, [taskNumber, markTaskCompleted, updateCalendarOnCompletion])

    // Only the repeat is gated. The first read is unambiguous, but a second tap
    // on a task already read costs a record the medic cannot take back — only a
    // supervisor can void one.
    const handleFab = useCallback(() => {
        if (completed) setConfirmRelog(true)
        else handleLog()
    }, [completed, handleLog])

    return (
        <div className="px-4 py-3 md:p-5 pb-12">
            {/* Header */}
            <div className="mb-4">
                <p className="text-[9pt] text-tertiary font-mono">{taskData.taskNumber}</p>
                <h3 className="text-lg font-semibold text-primary">{taskData.title}</h3>
                {/* The DATE, not a checkmark. Currency is what a refresh interval
                    is measured against, so "read once, at some point" is the one
                    thing this line must not say. */}
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

            {/* Visual Exam Reference — dev-gated */}
            {isDevRole && taskData.imageAids && taskData.imageAids.length > 0 && (
                <ImageAidGallery imageAids={taskData.imageAids} />
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

            {/* Sticky rather than absolute: this body is plain flow inside the
                drawer's scrollport, so there is no positioned ancestor to hang a
                FAB off, and sticky keeps its space instead of covering the last
                performance step. Same idiom as the evaluator's submit. */}
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
        </div>
    )
}

// ─── Exported Panel ──────────────────────────────────────────────────────────

export type TrainingView = 'training' | 'training-detail'

interface TrainingPanelProps {
    view: TrainingView
    selectedTask: subjectAreaArrayOptions | null
    onSelectTask: (task: subjectAreaArrayOptions) => void
    searchQuery: string
}

export function TrainingPanel({
    view,
    selectedTask,
    onSelectTask,
    searchQuery,
}: TrainingPanelProps) {
    if (view === 'training-detail' && selectedTask) {
        const taskData = getTaskData(selectedTask.icon)
        if (taskData) {
            return <TaskDetail taskData={taskData} taskNumber={selectedTask.icon} />
        }
    }

    return <TrainingList onSelectTask={onSelectTask} searchQuery={searchQuery} />
}
