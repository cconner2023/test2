import { useCallback, useMemo, useRef, useState } from 'react'
import { Dumbbell, Plus, Target } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { useClinicExercises } from '../../Hooks/useClinicExercises'
import { openWorkoutGoals, recentWorkoutLogs } from '../../lib/aft/workoutHelpers'
import { LogWorkoutPopover } from './LogWorkoutPopover'
import { generateId, toLocalISOString } from '../../Types/CalendarTypes'
import type { CalendarEvent, WorkoutLog } from '../../Types/CalendarTypes'

interface WorkoutDrawerProps {
    isVisible: boolean
    onClose: () => void
}

function formatGoalDate(evt: CalendarEvent): string {
    const start = new Date(evt.start_time)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const eventDay = new Date(start); eventDay.setHours(0, 0, 0, 0)
    let dayLabel: string
    if (eventDay.getTime() === today.getTime()) dayLabel = 'Today'
    else if (eventDay.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow'
    else dayLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (evt.all_day) return dayLabel
    return `${dayLabel} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function formatHistoryDate(evt: CalendarEvent): string {
    return new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type LogTarget =
    | { kind: 'adhoc' }
    | { kind: 'goal'; eventId: string }

function WorkoutDrawerContent() {
    const { user, clinicId } = useAuth()
    const calendarEvents = useCalendarStore(s => s.events)
    const { writeEvent, isWriting } = useCalendarWrite()
    const exercises = useClinicExercises()
    const now = useMemo(() => new Date(), [])

    const goals = useMemo(
        () => (user?.id ? openWorkoutGoals(user.id, calendarEvents, now) : []),
        [user?.id, calendarEvents, now],
    )
    const history = useMemo(
        () => (user?.id ? recentWorkoutLogs(user.id, calendarEvents, now, 20) : []),
        [user?.id, calendarEvents, now],
    )

    const logFabRef = useRef<HTMLDivElement>(null)
    const [logAnchor, setLogAnchor] = useState<DOMRect | null>(null)
    const [logTarget, setLogTarget] = useState<LogTarget>({ kind: 'adhoc' })

    const openAdhocLog = useCallback(() => {
        if (!logFabRef.current) return
        setLogTarget({ kind: 'adhoc' })
        setLogAnchor(logFabRef.current.getBoundingClientRect())
    }, [])

    const openGoalLog = useCallback((eventId: string, anchor: DOMRect) => {
        setLogTarget({ kind: 'goal', eventId })
        setLogAnchor(anchor)
    }, [])

    const closeLog = useCallback(() => setLogAnchor(null), [])

    const initialSelection = useMemo(() => {
        if (logTarget.kind !== 'goal') return undefined
        const evt = calendarEvents.find(e => e.id === logTarget.eventId)
        if (!evt) return undefined
        if (evt.workout_id) return { kind: 'workout' as const, workoutId: evt.workout_id }
        const firstName = evt.workout_log?.blocks[0]?.exercise_name
        if (firstName) {
            const ex = exercises.find(e => e.name === firstName)
            if (ex) return { kind: 'exercise' as const, exerciseId: ex.id }
        }
        return undefined
    }, [logTarget, calendarEvents, exercises])

    const handleLogSubmit = useCallback(async (log: WorkoutLog, title: string) => {
        if (!user?.id || !clinicId) return
        const nowIso = new Date().toISOString()
        if (logTarget.kind === 'goal') {
            const existing = useCalendarStore.getState().events.find(e => e.id === logTarget.eventId)
            if (!existing) { closeLog(); return }
            await writeEvent({
                ...existing,
                title: existing.title || title,
                status: 'completed',
                workout_id: log.workout_id ?? existing.workout_id ?? null,
                workout_log: log,
                updated_at: nowIso,
            })
        } else {
            const start = new Date()
            start.setSeconds(0, 0)
            const end = new Date(start)
            end.setHours(end.getHours() + 1)
            await writeEvent({
                id: generateId(),
                clinic_id: clinicId,
                title,
                description: null,
                category: 'workout',
                status: 'completed',
                start_time: toLocalISOString(start),
                end_time: toLocalISOString(end),
                all_day: false,
                location: null,
                opord_notes: null,
                uniform: null,
                report_time: null,
                assigned_to: [user.id],
                property_item_ids: [],
                room_id: null,
                huddle_task_id: null,
                structured_location: null,
                resource_allocations: null,
                workout_id: log.workout_id ?? null,
                workout_log: log,
                created_by: user.id,
                created_at: nowIso,
                updated_at: nowIso,
            })
        }
        closeLog()
    }, [user?.id, clinicId, logTarget, writeEvent, closeLog])

    const body =
        goals.length === 0 && history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-tertiary text-sm px-6 text-center">
                No workout activity yet — tap Log workout to start.
            </div>
        ) : (
            <div className="divide-y divide-tertiary/8">
                {goals.length > 0 && (
                    <section>
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase px-4 pt-4 pb-2">
                            Assigned ({goals.length})
                        </p>
                        <div className="divide-y divide-tertiary/8">
                            {goals.map(evt => (
                                <button
                                    key={evt.id}
                                    type="button"
                                    onClick={e => openGoalLog(evt.id, e.currentTarget.getBoundingClientRect())}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-tertiary/5 active:bg-tertiary/8"
                                >
                                    <Target size={14} className="text-themeyellow shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{evt.title || 'Workout'}</p>
                                        <p className="text-[9pt] text-tertiary">Due {formatGoalDate(evt)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
                {history.length > 0 && (
                    <section>
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase px-4 pt-4 pb-2">
                            History ({history.length})
                        </p>
                        <div className="divide-y divide-tertiary/8">
                            {history.map(evt => {
                                const setCount = evt.workout_log?.blocks.reduce((s, b) => s + b.sets.length, 0) ?? 0
                                const blockCount = evt.workout_log?.blocks.length ?? 0
                                return (
                                    <div key={evt.id} className="flex items-center gap-3 px-4 py-3">
                                        <Dumbbell size={14} className="text-tertiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-primary truncate">{evt.title || 'Workout'}</p>
                                            <p className="text-[9pt] text-tertiary">{formatHistoryDate(evt)}</p>
                                        </div>
                                        <span className="text-[10pt] text-tertiary tabular-nums shrink-0">
                                            {blockCount} {blockCount === 1 ? 'block' : 'blocks'} · {setCount} {setCount === 1 ? 'set' : 'sets'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        )

    return (
        <div className="relative h-full flex flex-col">
            {body}
            <ActionPill ref={logFabRef} shadow="sm" placement="overlay">
                <ActionButton icon={Plus} label="Log workout" onClick={openAdhocLog} />
            </ActionPill>
            <LogWorkoutPopover
                isOpen={logAnchor !== null}
                anchorRect={logAnchor}
                onClose={closeLog}
                onSubmit={handleLogSubmit}
                initial={initialSelection}
                saving={isWriting}
            />
        </div>
    )
}

export function WorkoutDrawer({ isVisible, onClose }: WorkoutDrawerProps) {
    const isDevRole = useAuthStore(s => s.isDevRole)
    if (!isDevRole) return null
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            header={{ title: 'Fitness' }}
        >
            <WorkoutDrawerContent />
        </BaseDrawer>
    )
}
