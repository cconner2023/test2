import { useCallback, useMemo, useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { PickerInput } from '../FormInputs'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { PreviewOverlay } from '../PreviewOverlay'
import { useClinicWorkouts } from '../../Hooks/useClinicWorkouts'
import { useClinicExercises } from '../../Hooks/useClinicExercises'
import { parseMmss, formatMmss } from '../../lib/aft/scoring'
import { blockFromExercise, logFromTemplate } from '../../lib/aft/workoutHelpers'
import type { WorkoutLog, WorkoutLogBlock } from '../../Types/CalendarTypes'

type Selection =
  | { kind: 'workout'; workoutId: string }
  | { kind: 'exercise'; exerciseId: string }
  | null

interface Props {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  /** Called with the built log + a default title. Parent decides how to persist (create event, update existing goal). */
  onSubmit: (log: WorkoutLog, title: string) => Promise<void> | void
  /** When provided, prefills with this workout/exercise (e.g. logging against an open goal). */
  initial?: Selection
  /** When provided, prefills set values (editing an existing log). */
  initialLog?: WorkoutLog | null
  saving?: boolean
}

const MIXED_OPTION_PREFIX_WORKOUT = 'w:'
const MIXED_OPTION_PREFIX_EXERCISE = 'e:'

export function LogWorkoutPopover({ isOpen, anchorRect, onClose, onSubmit, initial, initialLog, saving }: Props) {
  const workouts = useClinicWorkouts()
  const exercises = useClinicExercises()

  const [selection, setSelection] = useState<Selection>(initial ?? null)
  const [log, setLog] = useState<WorkoutLog | null>(initialLog ?? null)

  const handleClose = useCallback(() => {
    setSelection(null)
    setLog(null)
    onClose()
  }, [onClose])

  const pickerOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [{ value: '', label: 'Select…' }]
    const sortedWorkouts = [...workouts].sort((a, b) => a.sort_order - b.sort_order)
    for (const w of sortedWorkouts) {
      out.push({ value: `${MIXED_OPTION_PREFIX_WORKOUT}${w.id}`, label: `${w.name} (workout)` })
    }
    const sortedExercises = [...exercises].sort((a, b) => a.sort_order - b.sort_order)
    for (const ex of sortedExercises) {
      out.push({ value: `${MIXED_OPTION_PREFIX_EXERCISE}${ex.id}`, label: `${ex.name} (exercise)` })
    }
    return out
  }, [workouts, exercises])

  const selectionValue = useMemo(() => {
    if (!selection) return ''
    if (selection.kind === 'workout') return `${MIXED_OPTION_PREFIX_WORKOUT}${selection.workoutId}`
    return `${MIXED_OPTION_PREFIX_EXERCISE}${selection.exerciseId}`
  }, [selection])

  const handlePick = useCallback((v: string) => {
    if (!v) {
      setSelection(null)
      setLog(null)
      return
    }
    if (v.startsWith(MIXED_OPTION_PREFIX_WORKOUT)) {
      const id = v.slice(MIXED_OPTION_PREFIX_WORKOUT.length)
      const w = workouts.find(x => x.id === id)
      if (!w) return
      setSelection({ kind: 'workout', workoutId: id })
      setLog(logFromTemplate(w, exercises))
    } else if (v.startsWith(MIXED_OPTION_PREFIX_EXERCISE)) {
      const id = v.slice(MIXED_OPTION_PREFIX_EXERCISE.length)
      const ex = exercises.find(x => x.id === id)
      if (!ex) return
      setSelection({ kind: 'exercise', exerciseId: id })
      setLog({ workout_id: null, blocks: [blockFromExercise(ex)] })
    }
  }, [workouts, exercises])

  const addSet = useCallback((blockIdx: number) => {
    setLog(prev => {
      if (!prev) return prev
      return {
        ...prev,
        blocks: prev.blocks.map((b, i) =>
          i === blockIdx ? { ...b, sets: [...b.sets, {}] } : b,
        ),
      }
    })
  }, [])

  const removeSet = useCallback((blockIdx: number, setIdx: number) => {
    setLog(prev => {
      if (!prev) return prev
      return {
        ...prev,
        blocks: prev.blocks.map((b, i) =>
          i === blockIdx ? { ...b, sets: b.sets.filter((_, j) => j !== setIdx) } : b,
        ),
      }
    })
  }, [])

  const updateSet = useCallback((blockIdx: number, setIdx: number, patch: Partial<WorkoutLogBlock['sets'][number]>) => {
    setLog(prev => {
      if (!prev) return prev
      return {
        ...prev,
        blocks: prev.blocks.map((b, i) =>
          i === blockIdx ? { ...b, sets: b.sets.map((s, j) => j === setIdx ? { ...s, ...patch } : s) } : b,
        ),
      }
    })
  }, [])

  const canSubmit = useMemo(() => {
    if (!log || !selection) return false
    return log.blocks.some(b => b.sets.length > 0)
  }, [log, selection])

  const handleSubmit = useCallback(async () => {
    if (!log || !selection || !canSubmit) return
    const title = selection.kind === 'workout'
      ? (workouts.find(w => w.id === selection.workoutId)?.name ?? 'Workout')
      : (exercises.find(e => e.id === selection.exerciseId)?.name ?? 'Workout')
    await onSubmit(log, title)
    setSelection(null)
    setLog(null)
  }, [log, selection, canSubmit, workouts, exercises, onSubmit])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={handleClose}
      anchorRect={anchorRect}
      title="Log workout"
      maxWidth={460}
      footer={
        <ActionPill>
          <ActionButton
            icon={saving ? Loader2 : Check}
            label={saving ? 'Saving…' : 'Save'}
            variant={saving || !canSubmit ? 'disabled' : 'success'}
            onClick={handleSubmit}
          />
        </ActionPill>
      }
    >
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        <PickerInput
          value={selectionValue}
          onChange={handlePick}
          options={pickerOptions}
          placeholder="Pick a workout or exercise"
        />
      </div>

      {log && (
        <div className="px-3 py-2 space-y-2 max-h-[55vh] overflow-y-auto">
          {log.blocks.map((block, blockIdx) => {
            const isWeight = block.type === 'weight'
            const cols = isWeight ? 'grid-cols-[1.5rem_1fr_1fr_2rem]' : 'grid-cols-[1.5rem_1fr_2rem]'
            return (
              <div key={blockIdx} className="rounded-xl bg-themewhite overflow-hidden">
                <div className="px-3 py-2 border-b border-primary/6 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-primary truncate flex-1 min-w-0">{block.exercise_name}</p>
                  <span className="text-[9pt] text-tertiary uppercase tracking-wider shrink-0">
                    {isWeight ? 'Weight' : 'Timed'}
                  </span>
                </div>

                {block.sets.length > 0 && (
                  <div className={`grid ${cols} text-[9pt] text-tertiary border-b border-primary/6`}>
                    <span className="px-1 py-1 text-center">Set</span>
                    {isWeight ? (
                      <>
                        <span className="px-1 py-1 text-center border-l border-primary/6">Reps</span>
                        <span className="px-1 py-1 text-center border-l border-primary/6">Load (lbs)</span>
                      </>
                    ) : (
                      <span className="px-1 py-1 text-center border-l border-primary/6">Time mm:ss</span>
                    )}
                    <span className="border-l border-primary/6" />
                  </div>
                )}
                {block.sets.map((set, setIdx) => (
                  <div key={setIdx} className={`grid ${cols} border-b border-primary/6 last:border-b-0`}>
                    <span className="text-[10pt] text-tertiary px-1 py-2 text-center tabular-nums">{setIdx + 1}</span>
                    {isWeight ? (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={set.reps ?? ''}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10)
                            updateSet(blockIdx, setIdx, { reps: Number.isNaN(n) ? undefined : n })
                          }}
                          placeholder="—"
                          className="bg-transparent px-1 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={set.load_lbs ?? ''}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value)
                            updateSet(blockIdx, setIdx, { load_lbs: Number.isNaN(n) ? undefined : n })
                          }}
                          placeholder="—"
                          className="bg-transparent px-1 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        value={set.time_sec != null ? formatMmss(set.time_sec) : ''}
                        onChange={(e) => {
                          const v = e.target.value.trim()
                          if (!v) { updateSet(blockIdx, setIdx, { time_sec: undefined }); return }
                          const sec = parseMmss(v)
                          if (Number.isNaN(sec)) return
                          updateSet(blockIdx, setIdx, { time_sec: sec })
                        }}
                        placeholder="—"
                        className="bg-transparent px-1 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeSet(blockIdx, setIdx)}
                      aria-label="Remove set"
                      className="border-l border-primary/6 text-tertiary hover:text-themeredred flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addSet(blockIdx)}
                  className="w-full flex items-center justify-center gap-2 py-1.5 text-[10pt] text-tertiary hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  <Plus size={12} /> Add set
                </button>
              </div>
            )
          })}
        </div>
      )}
    </PreviewOverlay>
  )
}
