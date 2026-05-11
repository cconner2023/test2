import { useCallback, useRef, useState } from 'react'
import { Check, Clock, DoorClosed, Dumbbell, ListChecks, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClinicRooms } from '../../Hooks/useClinicRooms'
import { useClinicHuddleTasks } from '../../Hooks/useClinicHuddleTasks'
import { useClinicAppointmentTypes } from '../../Hooks/useClinicAppointmentTypes'
import { useClinicWorkouts } from '../../Hooks/useClinicWorkouts'
import { useClinicExercises } from '../../Hooks/useClinicExercises'
import {
  updateSupervisorClinicRooms,
  updateSupervisorClinicHuddleTasks,
  updateSupervisorClinicAppointmentTypes,
  updateSupervisorClinicWorkouts,
  updateSupervisorClinicExercises,
  type ClinicHuddleTask,
  type ClinicAppointmentType,
  type ClinicWorkout,
  type ClinicExercise,
} from '../../lib/supervisorService'
import type { WorkoutBlockType } from '../../Types/CalendarTypes'
import type { ClinicRoom } from '../../lib/adminService'
import { invalidate } from '../../stores/useInvalidationStore'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { PreviewOverlay } from '../PreviewOverlay'

export function CalendarClinicEditor() {
  // Pivot on the supervisor toggle so editing rooms / huddle tasks /
  // appointment types targets the active clinic context (assigned by default,
  // surrogate when toggled).
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId
  const clinicRooms = useClinicRooms(clinicId)
  const clinicHuddleTasks = useClinicHuddleTasks(clinicId)

  const [error, setError] = useState<string | null>(null)

  const roomFabRef = useRef<HTMLDivElement>(null)
  const [roomPopover, setRoomPopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; room?: ClinicRoom } | null>(null)
  const [roomDraftName, setRoomDraftName] = useState('')
  const [roomSaving, setRoomSaving] = useState(false)
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<ClinicRoom | null>(null)

  const taskFabRef = useRef<HTMLDivElement>(null)
  const [taskPopover, setTaskPopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; task?: ClinicHuddleTask } | null>(null)
  const [taskDraftName, setTaskDraftName] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<ClinicHuddleTask | null>(null)

  const clinicApptTypes = useClinicAppointmentTypes(clinicId)
  const apptFabRef = useRef<HTMLDivElement>(null)
  const [apptPopover, setApptPopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; type?: ClinicAppointmentType } | null>(null)
  const [apptDraftName, setApptDraftName] = useState('')
  const [apptDraftDuration, setApptDraftDuration] = useState('20')
  const [apptSaving, setApptSaving] = useState(false)
  const [confirmDeleteAppt, setConfirmDeleteAppt] = useState<ClinicAppointmentType | null>(null)

  // Fitness — dev-only.
  const isDevRole = useAuthStore(s => s.isDevRole)

  // Exercise catalog — the corpus workouts pick from.
  const clinicExercises = useClinicExercises(clinicId)
  const exerciseFabRef = useRef<HTMLDivElement>(null)
  const [exercisePopover, setExercisePopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; exercise?: ClinicExercise } | null>(null)
  const [exerciseDraftName, setExerciseDraftName] = useState('')
  const [exerciseDraftType, setExerciseDraftType] = useState<WorkoutBlockType>('weight')
  const [exerciseSaving, setExerciseSaving] = useState(false)
  const [confirmDeleteExercise, setConfirmDeleteExercise] = useState<ClinicExercise | null>(null)

  // Workouts — pick exercises from the catalog (no inline block editor).
  const clinicWorkouts = useClinicWorkouts(clinicId)
  const workoutFabRef = useRef<HTMLDivElement>(null)
  const [workoutPopover, setWorkoutPopover] = useState<{ mode: 'edit' | 'new'; anchor: DOMRect; workout?: ClinicWorkout } | null>(null)
  const [workoutDraftName, setWorkoutDraftName] = useState('')
  const [workoutDraftExerciseIds, setWorkoutDraftExerciseIds] = useState<string[]>([])
  const [workoutSaving, setWorkoutSaving] = useState(false)
  const [confirmDeleteWorkout, setConfirmDeleteWorkout] = useState<ClinicWorkout | null>(null)

  const closeRoomPopover = useCallback(() => {
    setRoomPopover(null)
    setRoomDraftName('')
    setRoomSaving(false)
  }, [])

  const openRoomEditPopover = useCallback((room: ClinicRoom, target: HTMLElement) => {
    setRoomPopover({ mode: 'edit', anchor: target.getBoundingClientRect(), room })
    setRoomDraftName(room.name)
  }, [])

  const openRoomNewPopover = useCallback(() => {
    if (!roomFabRef.current) return
    setRoomPopover({ mode: 'new', anchor: roomFabRef.current.getBoundingClientRect() })
    setRoomDraftName('')
  }, [])

  const persistRooms = useCallback(async (next: ClinicRoom[]): Promise<boolean> => {
    if (!clinicId) return false
    setRoomSaving(true)
    setError(null)
    const result = await updateSupervisorClinicRooms(clinicId, next)
    setRoomSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    invalidate('clinics')
    return true
  }, [clinicId])

  const handleSaveRoom = useCallback(async () => {
    if (!roomPopover) return
    const trimmed = roomDraftName.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    let next: ClinicRoom[]
    if (roomPopover.mode === 'new') {
      if (clinicRooms.some(r => r.name.toLowerCase() === lower)) {
        setError('A room with that name already exists')
        return
      }
      const nextSort = clinicRooms.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1
      next = [...clinicRooms, { id: crypto.randomUUID(), name: trimmed, sort_order: nextSort }]
    } else {
      const target = roomPopover.room!
      if (clinicRooms.some(r => r.id !== target.id && r.name.toLowerCase() === lower)) {
        setError('A room with that name already exists')
        return
      }
      next = clinicRooms.map(r => r.id === target.id ? { ...r, name: trimmed } : r)
    }
    const ok = await persistRooms(next)
    if (ok) closeRoomPopover()
  }, [roomPopover, roomDraftName, clinicRooms, persistRooms, closeRoomPopover])

  const handleConfirmDeleteRoom = useCallback(async () => {
    if (!confirmDeleteRoom) return
    const next = clinicRooms.filter(r => r.id !== confirmDeleteRoom.id)
    const ok = await persistRooms(next)
    setConfirmDeleteRoom(null)
    if (ok) closeRoomPopover()
  }, [confirmDeleteRoom, clinicRooms, persistRooms, closeRoomPopover])

  const closeTaskPopover = useCallback(() => {
    setTaskPopover(null)
    setTaskDraftName('')
    setTaskSaving(false)
  }, [])

  const openTaskEditPopover = useCallback((task: ClinicHuddleTask, target: HTMLElement) => {
    setTaskPopover({ mode: 'edit', anchor: target.getBoundingClientRect(), task })
    setTaskDraftName(task.name)
  }, [])

  const openTaskNewPopover = useCallback(() => {
    if (!taskFabRef.current) return
    setTaskPopover({ mode: 'new', anchor: taskFabRef.current.getBoundingClientRect() })
    setTaskDraftName('')
  }, [])

  const persistTasks = useCallback(async (next: ClinicHuddleTask[]): Promise<boolean> => {
    if (!clinicId) return false
    setTaskSaving(true)
    setError(null)
    const result = await updateSupervisorClinicHuddleTasks(clinicId, next)
    setTaskSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    invalidate('clinics')
    return true
  }, [clinicId])

  const handleSaveTask = useCallback(async () => {
    if (!taskPopover) return
    const trimmed = taskDraftName.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    let next: ClinicHuddleTask[]
    if (taskPopover.mode === 'new') {
      if (clinicHuddleTasks.some(t => t.name.toLowerCase() === lower)) {
        setError('A task with that name already exists')
        return
      }
      const nextSort = clinicHuddleTasks.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
      next = [...clinicHuddleTasks, { id: crypto.randomUUID(), name: trimmed, sort_order: nextSort }]
    } else {
      const target = taskPopover.task!
      if (clinicHuddleTasks.some(t => t.id !== target.id && t.name.toLowerCase() === lower)) {
        setError('A task with that name already exists')
        return
      }
      next = clinicHuddleTasks.map(t => t.id === target.id ? { ...t, name: trimmed } : t)
    }
    const ok = await persistTasks(next)
    if (ok) closeTaskPopover()
  }, [taskPopover, taskDraftName, clinicHuddleTasks, persistTasks, closeTaskPopover])

  const handleConfirmDeleteTask = useCallback(async () => {
    if (!confirmDeleteTask) return
    const next = clinicHuddleTasks.filter(t => t.id !== confirmDeleteTask.id)
    const ok = await persistTasks(next)
    setConfirmDeleteTask(null)
    if (ok) closeTaskPopover()
  }, [confirmDeleteTask, clinicHuddleTasks, persistTasks, closeTaskPopover])

  const closeApptPopover = useCallback(() => {
    setApptPopover(null)
    setApptDraftName('')
    setApptDraftDuration('20')
    setApptSaving(false)
  }, [])

  const openApptEditPopover = useCallback((type: ClinicAppointmentType, target: HTMLElement) => {
    setApptPopover({ mode: 'edit', anchor: target.getBoundingClientRect(), type })
    setApptDraftName(type.name)
    setApptDraftDuration(String(type.duration_min))
  }, [])

  const openApptNewPopover = useCallback(() => {
    if (!apptFabRef.current) return
    setApptPopover({ mode: 'new', anchor: apptFabRef.current.getBoundingClientRect() })
    setApptDraftName('')
    setApptDraftDuration('20')
  }, [])

  const persistApptTypes = useCallback(async (next: ClinicAppointmentType[]): Promise<boolean> => {
    if (!clinicId) return false
    setApptSaving(true)
    setError(null)
    const result = await updateSupervisorClinicAppointmentTypes(clinicId, next)
    setApptSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    invalidate('clinics')
    return true
  }, [clinicId])

  const handleSaveAppt = useCallback(async () => {
    if (!apptPopover) return
    const trimmed = apptDraftName.trim()
    const duration = parseInt(apptDraftDuration, 10)
    if (!trimmed || !Number.isFinite(duration) || duration < 1) return
    const lower = trimmed.toLowerCase()
    let next: ClinicAppointmentType[]
    if (apptPopover.mode === 'new') {
      if (clinicApptTypes.some(t => t.name.toLowerCase() === lower)) {
        setError('An appointment type with that name already exists')
        return
      }
      const nextSort = clinicApptTypes.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
      next = [...clinicApptTypes, { id: crypto.randomUUID(), name: trimmed, duration_min: duration, sort_order: nextSort }]
    } else {
      const target = apptPopover.type!
      if (clinicApptTypes.some(t => t.id !== target.id && t.name.toLowerCase() === lower)) {
        setError('An appointment type with that name already exists')
        return
      }
      next = clinicApptTypes.map(t => t.id === target.id ? { ...t, name: trimmed, duration_min: duration } : t)
    }
    const ok = await persistApptTypes(next)
    if (ok) closeApptPopover()
  }, [apptPopover, apptDraftName, apptDraftDuration, clinicApptTypes, persistApptTypes, closeApptPopover])

  const handleConfirmDeleteAppt = useCallback(async () => {
    if (!confirmDeleteAppt) return
    const next = clinicApptTypes.filter(t => t.id !== confirmDeleteAppt.id)
    const ok = await persistApptTypes(next)
    setConfirmDeleteAppt(null)
    if (ok) closeApptPopover()
  }, [confirmDeleteAppt, clinicApptTypes, persistApptTypes, closeApptPopover])

  // ── Exercises (catalog) ──────────────────────────────────────────────────

  const closeExercisePopover = useCallback(() => {
    setExercisePopover(null)
    setExerciseDraftName('')
    setExerciseDraftType('weight')
    setExerciseSaving(false)
  }, [])

  const openExerciseEditPopover = useCallback((ex: ClinicExercise, target: HTMLElement) => {
    setExercisePopover({ mode: 'edit', anchor: target.getBoundingClientRect(), exercise: ex })
    setExerciseDraftName(ex.name)
    setExerciseDraftType(ex.type)
  }, [])

  const openExerciseNewPopover = useCallback(() => {
    if (!exerciseFabRef.current) return
    setExercisePopover({ mode: 'new', anchor: exerciseFabRef.current.getBoundingClientRect() })
    setExerciseDraftName('')
    setExerciseDraftType('weight')
  }, [])

  const persistExercises = useCallback(async (next: ClinicExercise[]): Promise<boolean> => {
    if (!clinicId) return false
    setExerciseSaving(true)
    setError(null)
    const result = await updateSupervisorClinicExercises(clinicId, next)
    setExerciseSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    invalidate('clinics')
    return true
  }, [clinicId])

  const handleSaveExercise = useCallback(async () => {
    if (!exercisePopover) return
    const trimmed = exerciseDraftName.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    let next: ClinicExercise[]
    if (exercisePopover.mode === 'new') {
      if (clinicExercises.some(e => e.name.toLowerCase() === lower)) {
        setError('An exercise with that name already exists.')
        return
      }
      const nextSort = clinicExercises.reduce((m, e) => Math.max(m, e.sort_order), -1) + 1
      next = [...clinicExercises, { id: crypto.randomUUID(), name: trimmed, type: exerciseDraftType, sort_order: nextSort }]
    } else {
      const target = exercisePopover.exercise
      if (!target) return
      if (clinicExercises.some(e => e.id !== target.id && e.name.toLowerCase() === lower)) {
        setError('An exercise with that name already exists.')
        return
      }
      next = clinicExercises.map(e => e.id === target.id ? { ...e, name: trimmed, type: exerciseDraftType } : e)
    }
    const ok = await persistExercises(next)
    if (ok) closeExercisePopover()
  }, [exercisePopover, exerciseDraftName, exerciseDraftType, clinicExercises, persistExercises, closeExercisePopover])

  const handleConfirmDeleteExercise = useCallback(async () => {
    if (!confirmDeleteExercise) return
    const exId = confirmDeleteExercise.id
    const nextExercises = clinicExercises.filter(e => e.id !== exId)
    const okEx = await persistExercises(nextExercises)
    setConfirmDeleteExercise(null)
    if (!okEx) return
    // Cascade: scrub the deleted id out of every workout's exercise_ids.
    const affected = clinicWorkouts.filter(w => w.exercise_ids.includes(exId))
    if (affected.length > 0) {
      const nextWorkouts = clinicWorkouts.map(w =>
        w.exercise_ids.includes(exId)
          ? { ...w, exercise_ids: w.exercise_ids.filter(id => id !== exId) }
          : w,
      )
      if (clinicId) {
        await updateSupervisorClinicWorkouts(clinicId, nextWorkouts)
        invalidate('clinics')
      }
    }
    closeExercisePopover()
  }, [confirmDeleteExercise, clinicExercises, clinicWorkouts, clinicId, persistExercises, closeExercisePopover])

  // ── Workouts ─────────────────────────────────────────────────────────────

  const closeWorkoutPopover = useCallback(() => {
    setWorkoutPopover(null)
    setWorkoutDraftName('')
    setWorkoutDraftExerciseIds([])
    setWorkoutSaving(false)
  }, [])

  const openWorkoutEditPopover = useCallback((workout: ClinicWorkout, target: HTMLElement) => {
    setWorkoutPopover({ mode: 'edit', anchor: target.getBoundingClientRect(), workout })
    setWorkoutDraftName(workout.name)
    setWorkoutDraftExerciseIds(workout.exercise_ids ?? [])
  }, [])

  const openWorkoutNewPopover = useCallback(() => {
    if (!workoutFabRef.current) return
    setWorkoutPopover({ mode: 'new', anchor: workoutFabRef.current.getBoundingClientRect() })
    setWorkoutDraftName('')
    setWorkoutDraftExerciseIds([])
  }, [])

  const toggleDraftExercise = useCallback((id: string) => {
    setWorkoutDraftExerciseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const persistWorkouts = useCallback(async (next: ClinicWorkout[]): Promise<boolean> => {
    if (!clinicId) return false
    setWorkoutSaving(true)
    setError(null)
    const result = await updateSupervisorClinicWorkouts(clinicId, next)
    setWorkoutSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    invalidate('clinics')
    return true
  }, [clinicId])

  const handleSaveWorkout = useCallback(async () => {
    if (!workoutPopover) return
    const trimmed = workoutDraftName.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    const exerciseIds = workoutDraftExerciseIds
    let next: ClinicWorkout[]
    if (workoutPopover.mode === 'new') {
      if (clinicWorkouts.some(w => w.name.toLowerCase() === lower)) {
        setError('A workout with that name already exists.')
        return
      }
      const nextSort = clinicWorkouts.reduce((m, w) => Math.max(m, w.sort_order), -1) + 1
      next = [...clinicWorkouts, { id: crypto.randomUUID(), name: trimmed, exercise_ids: exerciseIds, sort_order: nextSort }]
    } else {
      const target = workoutPopover.workout
      if (!target) return
      if (clinicWorkouts.some(w => w.id !== target.id && w.name.toLowerCase() === lower)) {
        setError('A workout with that name already exists.')
        return
      }
      next = clinicWorkouts.map(w => w.id === target.id ? { ...w, name: trimmed, exercise_ids: exerciseIds } : w)
    }
    const ok = await persistWorkouts(next)
    if (ok) closeWorkoutPopover()
  }, [workoutPopover, workoutDraftName, workoutDraftExerciseIds, clinicWorkouts, persistWorkouts, closeWorkoutPopover])

  const handleConfirmDeleteWorkout = useCallback(async () => {
    if (!confirmDeleteWorkout) return
    const next = clinicWorkouts.filter(w => w.id !== confirmDeleteWorkout.id)
    const ok = await persistWorkouts(next)
    setConfirmDeleteWorkout(null)
    if (ok) closeWorkoutPopover()
  }, [confirmDeleteWorkout, clinicWorkouts, persistWorkouts, closeWorkoutPopover])

  return (
    <>
      {error && (
        <div className="px-1 pb-2">
          <ErrorPill>{error}</ErrorPill>
        </div>
      )}

      <section data-tour="clinic-rooms">
        <div className="pb-2 flex items-center gap-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Rooms</p>
        </div>
        <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {clinicRooms.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">No clinic rooms formatted</p>
            ) : (
              <div className="space-y-1">
                {[...clinicRooms]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={(e) => isSupervisorRole && openRoomEditPopover(room, e.currentTarget)}
                      disabled={!isSupervisorRole}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <DoorClosed size={14} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{room.name}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          </div>
          {isSupervisorRole && (
            <ActionPill ref={roomFabRef} shadow="sm" placement="overlay">
              <ActionButton icon={Plus} label="New room" onClick={openRoomNewPopover} />
            </ActionPill>
          )}
        </div>
      </section>

      <section data-tour="clinic-huddle-tasks">
        <div className="pb-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Huddle Tasks</p>
        </div>
        <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {clinicHuddleTasks.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">No huddle tasks formatted</p>
            ) : (
              <div className="space-y-1">
                {[...clinicHuddleTasks]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={(e) => isSupervisorRole && openTaskEditPopover(task, e.currentTarget)}
                      disabled={!isSupervisorRole}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <ListChecks size={14} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{task.name}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          </div>
          {isSupervisorRole && (
            <ActionPill ref={taskFabRef} shadow="sm" placement="overlay">
              <ActionButton icon={Plus} label="New huddle task" onClick={openTaskNewPopover} />
            </ActionPill>
          )}
        </div>
      </section>

      <section data-tour="clinic-appointment-types">
        <div className="pb-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Appointment Types</p>
        </div>
        <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {clinicApptTypes.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">No appointment types formatted</p>
            ) : (
              <div className="space-y-1">
                {[...clinicApptTypes]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={(e) => isSupervisorRole && openApptEditPopover(type, e.currentTarget)}
                      disabled={!isSupervisorRole}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <Clock size={14} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-primary truncate">{type.name}</p>
                        <span className="text-[10pt] text-tertiary tabular-nums shrink-0">{type.duration_min} min</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          </div>
          {isSupervisorRole && (
            <ActionPill ref={apptFabRef} shadow="sm" placement="overlay">
              <ActionButton icon={Plus} label="New appointment type" onClick={openApptNewPopover} />
            </ActionPill>
          )}
        </div>
      </section>

      {isDevRole && (
        <section data-tour="clinic-exercises">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Exercises</p>
          </div>
          <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {clinicExercises.length === 0 ? (
                <p className="text-sm text-tertiary py-4 text-center">No exercises configured</p>
              ) : (
                <div className="space-y-1">
                  {[...clinicExercises]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={(e) => isSupervisorRole && openExerciseEditPopover(ex, e.currentTarget)}
                        disabled={!isSupervisorRole}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                          <Dumbbell size={14} className="text-tertiary" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-primary truncate">{ex.name}</p>
                          <span className="text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0">
                            {ex.type === 'weight' ? 'Weight' : 'Timed'}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            </div>
            {isSupervisorRole && (
              <ActionPill ref={exerciseFabRef} shadow="sm" placement="overlay">
                <ActionButton icon={Plus} label="New exercise" onClick={openExerciseNewPopover} />
              </ActionPill>
            )}
          </div>
        </section>
      )}

      {isDevRole && (
        <section data-tour="clinic-workouts">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Workouts</p>
          </div>
          <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {clinicWorkouts.length === 0 ? (
                <p className="text-sm text-tertiary py-4 text-center">No workouts formatted</p>
              ) : (
                <div className="space-y-1">
                  {[...clinicWorkouts]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((workout) => (
                      <button
                        key={workout.id}
                        type="button"
                        onClick={(e) => isSupervisorRole && openWorkoutEditPopover(workout, e.currentTarget)}
                        disabled={!isSupervisorRole}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                          <Dumbbell size={14} className="text-tertiary" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-primary truncate">{workout.name}</p>
                          <span className="text-[10pt] text-tertiary tabular-nums shrink-0">
                            {workout.exercise_ids.length} {workout.exercise_ids.length === 1 ? 'exercise' : 'exercises'}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            </div>
            {isSupervisorRole && (
              <ActionPill ref={workoutFabRef} shadow="sm" placement="overlay">
                <ActionButton icon={Plus} label="New workout" onClick={openWorkoutNewPopover} />
              </ActionPill>
            )}
          </div>
        </section>
      )}

      <PreviewOverlay
        isOpen={!!roomPopover}
        onClose={closeRoomPopover}
        anchorRect={roomPopover?.anchor ?? null}
        title={roomPopover?.mode === 'new' ? 'New room' : 'Edit room'}
        maxWidth={340}
        footer={
          roomPopover ? (
            <ActionPill>
              <ActionButton
                icon={roomSaving ? Loader2 : Check}
                label={roomSaving ? 'Saving…' : 'Save'}
                variant={roomSaving || !roomDraftName.trim() ? 'disabled' : 'success'}
                onClick={handleSaveRoom}
              />
              {roomPopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const room = roomPopover.room
                    if (!room) return
                    closeRoomPopover()
                    setTimeout(() => setConfirmDeleteRoom(room), 320)
                  }}
                />
              )}
            </ActionPill>
          ) : undefined
        }
      >
        {roomPopover && (
          <label className="block border-b border-primary/6">
            <input
              autoFocus
              type="text"
              value={roomDraftName}
              onChange={(e) => setRoomDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && roomDraftName.trim() && !roomSaving) handleSaveRoom()
              }}
              placeholder="Room name"
              maxLength={60}
              className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
            />
          </label>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteRoom}
        title="Delete this room?"
        subtitle="Past events stop showing the room pill but are otherwise unaffected."
        confirmLabel="Delete"
        variant="danger"
        processing={roomSaving}
        onConfirm={handleConfirmDeleteRoom}
        onCancel={() => setConfirmDeleteRoom(null)}
      />

      <PreviewOverlay
        isOpen={!!taskPopover}
        onClose={closeTaskPopover}
        anchorRect={taskPopover?.anchor ?? null}
        title={taskPopover?.mode === 'new' ? 'New huddle task' : 'Edit huddle task'}
        maxWidth={340}
        footer={
          taskPopover ? (
            <ActionPill>
              <ActionButton
                icon={taskSaving ? Loader2 : Check}
                label={taskSaving ? 'Saving…' : 'Save'}
                variant={taskSaving || !taskDraftName.trim() ? 'disabled' : 'success'}
                onClick={handleSaveTask}
              />
              {taskPopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const task = taskPopover.task
                    if (!task) return
                    closeTaskPopover()
                    setTimeout(() => setConfirmDeleteTask(task), 320)
                  }}
                />
              )}
            </ActionPill>
          ) : undefined
        }
      >
        {taskPopover && (
          <label className="block border-b border-primary/6">
            <input
              autoFocus
              type="text"
              value={taskDraftName}
              onChange={(e) => setTaskDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskDraftName.trim() && !taskSaving) handleSaveTask()
              }}
              placeholder="Task name"
              maxLength={60}
              className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
            />
          </label>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteTask}
        title="Delete this huddle task?"
        subtitle="Past events stop being grouped under it but are otherwise unaffected."
        confirmLabel="Delete"
        variant="danger"
        processing={taskSaving}
        onConfirm={handleConfirmDeleteTask}
        onCancel={() => setConfirmDeleteTask(null)}
      />

      <PreviewOverlay
        isOpen={!!apptPopover}
        onClose={closeApptPopover}
        anchorRect={apptPopover?.anchor ?? null}
        title={apptPopover?.mode === 'new' ? 'New appointment type' : 'Edit appointment type'}
        maxWidth={340}
        footer={
          apptPopover ? (
            <ActionPill>
              <ActionButton
                icon={apptSaving ? Loader2 : Check}
                label={apptSaving ? 'Saving…' : 'Save'}
                variant={apptSaving || !apptDraftName.trim() || !(parseInt(apptDraftDuration, 10) > 0) ? 'disabled' : 'success'}
                onClick={handleSaveAppt}
              />
              {apptPopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const type = apptPopover.type
                    if (!type) return
                    closeApptPopover()
                    setTimeout(() => setConfirmDeleteAppt(type), 320)
                  }}
                />
              )}
            </ActionPill>
          ) : undefined
        }
      >
        {apptPopover && (
          <>
            <label className="block border-b border-primary/6">
              <input
                autoFocus
                type="text"
                value={apptDraftName}
                onChange={(e) => setApptDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apptDraftName.trim() && !apptSaving) handleSaveAppt()
                }}
                placeholder="Type name (e.g. 20-min in-person)"
                maxLength={60}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
            </label>
            <label className="block">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={480}
                value={apptDraftDuration}
                onChange={(e) => setApptDraftDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apptDraftName.trim() && !apptSaving) handleSaveAppt()
                }}
                placeholder="Duration (minutes)"
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
            </label>
          </>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteAppt}
        title="Delete this appointment type?"
        subtitle="Existing templated events keep their duration; only future generation is affected."
        confirmLabel="Delete"
        variant="danger"
        processing={apptSaving}
        onConfirm={handleConfirmDeleteAppt}
        onCancel={() => setConfirmDeleteAppt(null)}
      />

      <PreviewOverlay
        isOpen={!!exercisePopover}
        onClose={closeExercisePopover}
        anchorRect={exercisePopover?.anchor ?? null}
        title={exercisePopover?.mode === 'new' ? 'New exercise' : 'Edit exercise'}
        maxWidth={340}
        footer={
          exercisePopover ? (
            <ActionPill>
              <ActionButton
                icon={exerciseSaving ? Loader2 : Check}
                label={exerciseSaving ? 'Saving…' : 'Save'}
                variant={exerciseSaving || !exerciseDraftName.trim() ? 'disabled' : 'success'}
                onClick={handleSaveExercise}
              />
              {exercisePopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const ex = exercisePopover.exercise
                    if (!ex) return
                    closeExercisePopover()
                    setTimeout(() => setConfirmDeleteExercise(ex), 320)
                  }}
                />
              )}
            </ActionPill>
          ) : undefined
        }
      >
        {exercisePopover && (
          <>
            <label className="block border-b border-primary/6">
              <input
                autoFocus
                type="text"
                value={exerciseDraftName}
                onChange={(e) => setExerciseDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && exerciseDraftName.trim() && !exerciseSaving) handleSaveExercise()
                }}
                placeholder="Exercise name (e.g. Back Squat, 2-mile run)"
                maxLength={80}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 border-b border-primary/6">
              <button
                type="button"
                onClick={() => setExerciseDraftType('weight')}
                className={`px-3 py-2.5 text-[10pt] uppercase tracking-wider transition-colors ${exerciseDraftType === 'weight' ? 'bg-themewhite2 text-primary font-medium' : 'text-tertiary hover:bg-themewhite/60'}`}
              >
                Weight
              </button>
              <button
                type="button"
                onClick={() => setExerciseDraftType('timed')}
                className={`px-3 py-2.5 text-[10pt] uppercase tracking-wider border-l border-primary/6 transition-colors ${exerciseDraftType === 'timed' ? 'bg-themewhite2 text-primary font-medium' : 'text-tertiary hover:bg-themewhite/60'}`}
              >
                Timed
              </button>
            </div>
          </>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDeleteExercise}
        title={`Delete "${confirmDeleteExercise?.name || 'this exercise'}"?`}
        subtitle="Workouts using this exercise have it removed from their list. Past log snapshots keep the exercise name."
        confirmLabel="Delete"
        variant="danger"
        processing={exerciseSaving}
        onConfirm={handleConfirmDeleteExercise}
        onCancel={() => setConfirmDeleteExercise(null)}
      />

      <PreviewOverlay
        isOpen={!!workoutPopover}
        onClose={closeWorkoutPopover}
        anchorRect={workoutPopover?.anchor ?? null}
        title={workoutPopover?.mode === 'new' ? 'New workout' : 'Edit workout'}
        maxWidth={460}
        previewMaxHeight="40dvh"
        searchPlaceholder="Search exercises"
        preview={(filter) => {
          if (!workoutPopover) return null
          const lc = filter.trim().toLowerCase()
          const selectedIds = new Set(workoutDraftExerciseIds)
          const selectedRows = workoutDraftExerciseIds
            .map(id => clinicExercises.find(e => e.id === id))
            .filter((e): e is ClinicExercise => !!e)
          const sortedAll = [...clinicExercises].sort((a, b) => a.sort_order - b.sort_order)
          const available = sortedAll
            .filter(e => !selectedIds.has(e.id))
            .filter(e => !lc || e.name.toLowerCase().includes(lc))
          return (
            <div>
              <div className="sticky top-0 z-10 bg-themewhite border-b border-primary/6">
                <input
                  autoFocus
                  type="text"
                  value={workoutDraftName}
                  onChange={(e) => setWorkoutDraftName(e.target.value)}
                  placeholder="Workout name (e.g. Murph, Bear Complex)"
                  maxLength={80}
                  className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                />
              </div>
              {selectedRows.length > 0 && (
                <div className="border-b border-primary/6">
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
                      Selected ({selectedRows.length})
                    </p>
                  </div>
                  <div className="pb-2">
                    {selectedRows.map(ex => (
                      <div key={ex.id} className="flex items-center gap-2 px-4 py-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                          <Dumbbell size={12} className="text-tertiary" />
                        </div>
                        <span className="flex-1 text-sm text-primary min-w-0 break-words">{ex.name}</span>
                        <span className="text-[9pt] uppercase tracking-wider text-tertiary shrink-0">
                          {ex.type === 'weight' ? 'Weight' : 'Timed'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDraftExercise(ex.id)}
                          className="shrink-0 p-1 text-tertiary active:text-primary transition-colors"
                          aria-label="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
                    Available
                  </p>
                </div>
                {available.length === 0 ? (
                  <p className="text-sm text-tertiary text-center py-6 px-4">
                    {lc ? 'No matches' : clinicExercises.length === 0 ? 'No exercises configured. Add some above first.' : 'All exercises selected.'}
                  </p>
                ) : (
                  <div className="pb-2">
                    {available.map(ex => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => toggleDraftExercise(ex.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-themeblue3/5 active:scale-[0.99] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                          <Plus size={12} className="text-tertiary" />
                        </div>
                        <span className="flex-1 text-sm text-primary min-w-0 break-words">{ex.name}</span>
                        <span className="text-[9pt] uppercase tracking-wider text-tertiary shrink-0">
                          {ex.type === 'weight' ? 'Weight' : 'Timed'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }}
        footer={
          workoutPopover ? (
            <ActionPill>
              <ActionButton
                icon={workoutSaving ? Loader2 : Check}
                label={workoutSaving ? 'Saving…' : 'Save'}
                variant={workoutSaving || !workoutDraftName.trim() ? 'disabled' : 'success'}
                onClick={handleSaveWorkout}
              />
              {workoutPopover.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const workout = workoutPopover.workout
                    if (!workout) return
                    closeWorkoutPopover()
                    setTimeout(() => setConfirmDeleteWorkout(workout), 320)
                  }}
                />
              )}
            </ActionPill>
          ) : undefined
        }
      />

      <ConfirmDialog
        visible={!!confirmDeleteWorkout}
        title="Delete this workout?"
        subtitle="Past calendar logs keep their snapshot of blocks performed; only future scheduling is affected."
        confirmLabel="Delete"
        variant="danger"
        processing={workoutSaving}
        onConfirm={handleConfirmDeleteWorkout}
        onCancel={() => setConfirmDeleteWorkout(null)}
      />
    </>
  )
}
