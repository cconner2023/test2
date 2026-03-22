import { useRef, useEffect, useCallback, useMemo } from 'react'
import { Check, ChevronRight, Lock, CalendarDays } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData } from '../../Data/TrainingData'
import type { TaskTrainingData } from '../../Data/TrainingData'
import type { subjectAreaArrayOptions } from '../../Types/CatTypes'
import { useTrainingCompletions } from '../../Hooks/useTrainingCompletions'
import { AudioAidPlayer } from '../AudioAidPlayer'
import { skillLevelLabels, categoryOrder } from '../../Data/TrainingConstants'
import { StepCallout, PerformanceStepItem, SectionHeader } from '../TrainingStepComponents'

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
    assignment,
}: {
    task: FlatTask
    onSelectTask: (t: subjectAreaArrayOptions) => void
    isTaskCompleted: (id: string) => boolean
    isTaskViewed: (id: string) => boolean
    assignment?: ReturnType<ReturnType<typeof useTrainingCompletions>['getAssignment']>
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
            onClick={() => hasData && onSelectTask(task.option)}
            disabled={!hasData}
            className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all
                ${hasData
                    ? 'active:scale-95 hover:bg-themeblue2/5 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
        >
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary/40'}`}>
                    {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-tertiary/70 font-mono">
                        {task.taskId}
                    </p>
                    {isAssigned && assignment.dueDate && (
                        <span className={`text-[10px] font-medium ${isOverdue ? 'text-themeredred' : 'text-themeblue3'}`}>
                            {isOverdue ? 'Overdue' : 'Due'}: {formatDueDate(assignment.dueDate)}
                        </span>
                    )}
                </div>
                {!hasData && (
                    <p className="text-[9px] text-tertiary/40 flex items-center gap-1 mt-0.5">
                        <Lock size={9} /> Coming soon
                    </p>
                )}
            </div>
            <div className="shrink-0 ml-2 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[8pt] font-semibold bg-tertiary/10 text-tertiary/60">
                    {badge}
                </span>
                {completed ? (
                    <Check size={16} className="text-themegreen" />
                ) : isAssigned ? (
                    <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-themeredred' : 'bg-themeblue3'}`} />
                ) : viewed ? (
                    <div className="w-2 h-2 rounded-full bg-themeyellow" />
                ) : hasData ? (
                    <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
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
    const { isTaskCompleted, isTaskViewed, getAssignment } = useTrainingCompletions()

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
        <div className="px-5 py-4 space-y-5">
            <p className="text-xs text-tertiary/60">
                Select a task to begin studying.
            </p>

            {isSearching && (
                <p className="text-[10px] text-tertiary/50">
                    {totalResults} result{totalResults !== 1 ? 's' : ''}
                </p>
            )}

            {totalResults === 0 && isSearching ? (
                <EmptyState title="No tasks match your search" />
            ) : (
                Array.from(displayCategories).map(([categoryName, tasks]) => (
                    <div key={categoryName}>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">
                                {categoryName}
                            </p>
                            <span className="text-[10px] text-tertiary/40">{tasks.length}</span>
                        </div>
                        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                            {tasks.map((task, idx) => (
                                <div key={task.taskId} className={idx > 0 ? 'border-t border-tertiary/8' : ''}>
                                    <TaskRow
                                        task={task}
                                        onSelectTask={onSelectTask}
                                        isTaskCompleted={isTaskCompleted}
                                        isTaskViewed={isTaskViewed}
                                        assignment={getAssignment(task.taskId)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

// ─── Sub-view: Task Detail (Learning View) ───────────────────────────────────


function TaskDetail({
    taskData,
    taskNumber,
}: {
    taskData: TaskTrainingData
    taskNumber: string
}) {
    const { markTaskViewed, markTaskCompleted, isTaskCompleted, getAssignment } = useTrainingCompletions()
    const bottomRef = useRef<HTMLDivElement>(null)
    const completed = isTaskCompleted(taskNumber)
    const assignment = getAssignment(taskNumber)
    const isAssigned = assignment && !assignment.completedAt
    const isOverdue = isAssigned && assignment.dueDate && new Date(assignment.dueDate) < new Date()

    const messagesCtx = useMessagesContext()
    const calendarGroupId = useCalendarStore(s => s.calendarGroupId)
    const calendarEvents = useCalendarStore(s => s.events)
    const updateCalendarEvent = useCalendarStore(s => s.updateEvent)

    const formatDueDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const updateCalendarOnCompletion = useCallback(() => {
        if (!isAssigned || !assignment.calendarOriginId || !calendarGroupId || !messagesCtx?.sendCalendarEvent) return
        const calEvent = calendarEvents.find(e => e.originId === assignment.calendarOriginId)
        if (!calEvent) return

        const updatedEvent = { ...calEvent, status: 'completed' as const, updated_at: new Date().toISOString() }
        updateCalendarEvent(calEvent.id, { status: 'completed', updated_at: updatedEvent.updated_at })

        const oldOriginIds = calEvent.originId ? [calEvent.originId] : []
        if (oldOriginIds.length > 0 && messagesCtx.deleteCalendarEventMessages) {
            messagesCtx.deleteCalendarEventMessages(calendarGroupId, oldOriginIds).catch(() => {})
        }
        messagesCtx.sendCalendarEvent(calendarGroupId, {
            type: 'calendar_event',
            action: 'create',
            data: updatedEvent,
        }).then(newOriginId => {
            if (newOriginId) updateCalendarEvent(calEvent.id, { originId: newOriginId })
        }).catch(() => {})
    }, [isAssigned, assignment, calendarGroupId, messagesCtx, calendarEvents, updateCalendarEvent])

    // Mark as viewed on mount
    useEffect(() => {
        markTaskViewed(taskNumber)
    }, [taskNumber, markTaskViewed])

    // Observe bottom of content to mark completed
    useEffect(() => {
        if (completed || !bottomRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    markTaskCompleted(taskNumber)
                    updateCalendarOnCompletion()
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(bottomRef.current)
        return () => observer.disconnect()
    }, [taskNumber, completed, markTaskCompleted, updateCalendarOnCompletion])

    const handleMarkComplete = useCallback(() => {
        markTaskCompleted(taskNumber)
        updateCalendarOnCompletion()
    }, [taskNumber, markTaskCompleted, updateCalendarOnCompletion])

    return (
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

            {/* Assignment banner */}
            {isAssigned && assignment.dueDate && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 ${
                    isOverdue
                        ? 'bg-themeredred/10 border border-themeredred/20'
                        : 'bg-themeblue3/10 border border-themeblue3/20'
                }`}>
                    <CalendarDays size={15} className={isOverdue ? 'text-themeredred' : 'text-themeblue3'} />
                    <span className={`text-sm font-medium ${isOverdue ? 'text-themeredred' : 'text-themeblue3'}`}>
                        {isOverdue ? 'Overdue' : 'Due'}: {formatDueDate(assignment.dueDate)}
                    </span>
                    {assignment.supervisorNotes && (
                        <span className="text-xs text-tertiary/60 ml-auto truncate max-w-[50%]">
                            {assignment.supervisorNotes}
                        </span>
                    )}
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
