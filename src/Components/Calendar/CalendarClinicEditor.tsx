import { useCallback, useRef, useState } from 'react'
import { Check, Clock, ListChecks, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useClinicHuddleTasks } from '../../Hooks/useClinicHuddleTasks'
import { useClinicAppointmentTypes } from '../../Hooks/useClinicAppointmentTypes'
import {
  updateSupervisorClinicHuddleTasks,
  updateSupervisorClinicAppointmentTypes,
  type ClinicHuddleTask,
  type ClinicAppointmentType,
} from '../../lib/supervisorService'
import { patchClinicConfig } from '../../Hooks/useClinicConfig'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ErrorPill } from '@/Components/primitives/ErrorPill'
import { PreviewOverlay } from '../PreviewOverlay'
import { PreCombatChecksSection } from './PreCombatChecksSection'
import { CategoryColorSettings } from './CategoryColorSettings'

// Which slice of clinic config this editor renders.
//  - 'clinic'   → Checklists only (now surfaced via Settings → App Content →
//                 Checklists, which renders PreCombatChecksSection directly)
//  - 'calendar' → Huddle Tasks, Rooms, Appointment Types, Category Colors (CalendarDrawer settings)
// Each section lives in exactly one surface so clinic management holds only
// clinic concerns and calendar settings hold only calendar concerns.
export type ClinicEditorVariant = 'clinic' | 'calendar'

export function CalendarClinicEditor({ variant = 'clinic' }: { variant?: ClinicEditorVariant } = {}) {
  const showClinic = variant === 'clinic'
  const showCalendar = variant === 'calendar'
  // Pivot on the supervisor toggle so editing huddle tasks / appointment types
  // targets the active clinic context (assigned by default, surrogate when toggled).
  // Rooms are no longer edited here — they are property zones, managed in the
  // property book (see useClinicZones / v2/property zone-unification).
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId
  const clinicHuddleTasks = useClinicHuddleTasks(clinicId)

  const [error, setError] = useState<string | null>(null)

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
    patchClinicConfig(clinicId, { huddleTasks: next })
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
    patchClinicConfig(clinicId, { appointmentTypes: next })
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

  return (
    <>
      {error && (
        <div className="px-1 pb-2">
          <ErrorPill>{error}</ErrorPill>
        </div>
      )}

      {showClinic && <PreCombatChecksSection />}

      {showCalendar && <section>
        <div className="pb-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Huddle Tasks</p>
        </div>
        <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {clinicHuddleTasks.length === 0 ? (
              <p className="text-[10pt] text-tertiary py-4 text-center">No huddle tasks formatted</p>
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
      </section>}

      {showCalendar && <section>
        <div className="pb-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Appointment Types</p>
        </div>
        <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {clinicApptTypes.length === 0 ? (
              <p className="text-[10pt] text-tertiary py-4 text-center">No appointment types formatted</p>
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
      </section>}

      {showCalendar && <CategoryColorSettings />}

      <PreviewOverlay
        isOpen={!!taskPopover}
        onClose={closeTaskPopover}
        anchorRect={taskPopover?.anchor ?? null}
        title={taskPopover?.mode === 'new' ? 'New huddle task' : 'Edit huddle task'}
        maxWidth={340}
        footer={
          taskPopover && taskPopover.mode === 'edit' ? (
            <ActionPill>
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
            </ActionPill>
          ) : undefined
        }
        rightFooter={
          taskPopover ? (
            <ActionPill>
              <ActionButton
                icon={taskSaving ? Loader2 : Check}
                label={taskSaving ? 'Saving…' : 'Save'}
                variant={taskSaving || !taskDraftName.trim() ? 'disabled' : 'success'}
                onClick={handleSaveTask}
              />
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
          apptPopover && apptPopover.mode === 'edit' ? (
            <ActionPill>
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
            </ActionPill>
          ) : undefined
        }
        rightFooter={
          apptPopover ? (
            <ActionPill>
              <ActionButton
                icon={apptSaving ? Loader2 : Check}
                label={apptSaving ? 'Saving…' : 'Save'}
                variant={apptSaving || !apptDraftName.trim() || !(parseInt(apptDraftDuration, 10) > 0) ? 'disabled' : 'success'}
                onClick={handleSaveAppt}
              />
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
    </>
  )
}
