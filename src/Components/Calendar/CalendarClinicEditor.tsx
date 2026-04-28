import { useCallback, useRef, useState } from 'react'
import { Check, DoorClosed, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useClinicRooms } from '../../Hooks/useClinicRooms'
import { useClinicHuddleTasks } from '../../Hooks/useClinicHuddleTasks'
import {
  updateSupervisorClinicRooms,
  updateSupervisorClinicHuddleTasks,
  type ClinicHuddleTask,
} from '../../lib/supervisorService'
import type { ClinicRoom } from '../../lib/adminService'
import { invalidate } from '../../stores/useInvalidationStore'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { PreviewOverlay } from '../PreviewOverlay'

export function CalendarClinicEditor() {
  const { clinicId, isSupervisorRole } = useAuth()
  const clinicRooms = useClinicRooms()
  const clinicHuddleTasks = useClinicHuddleTasks()

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
        <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
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
          {isSupervisorRole && (
            <ActionPill ref={roomFabRef} shadow="sm" className="absolute top-2 right-2">
              <ActionButton icon={Plus} label="New room" onClick={openRoomNewPopover} />
            </ActionPill>
          )}
        </div>
      </section>

      <section data-tour="clinic-huddle-tasks">
        <div className="pb-2 flex items-center gap-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Huddle Tasks</p>
          <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
            {clinicHuddleTasks.length}
          </span>
        </div>
        <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
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
          {isSupervisorRole && (
            <ActionPill ref={taskFabRef} shadow="sm" className="absolute top-2 right-2">
              <ActionButton icon={Plus} label="New huddle task" onClick={openTaskNewPopover} />
            </ActionPill>
          )}
        </div>
      </section>

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
                  onClick={() => roomPopover.room && setConfirmDeleteRoom(roomPopover.room)}
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
                  onClick={() => taskPopover.task && setConfirmDeleteTask(taskPopover.task)}
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
    </>
  )
}
