import { useCallback, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PickerInput } from '../FormInputs'
import { useClinicWorkouts } from '../../Hooks/useClinicWorkouts'
import { parseMmss, formatMmss } from '../../lib/aft/scoring'
import type { ClinicWorkout, ClinicWorkoutBlock } from '../../lib/supervisorService'
import type { WorkoutLog, WorkoutLogBlock, WorkoutSetLog } from '../../Types/CalendarTypes'

interface Props {
  workoutId: string | null | undefined
  log: WorkoutLog | null | undefined
  onWorkoutIdChange: (next: string | null) => void
  onLogChange: (next: WorkoutLog | null) => void
}

function emptyLog(workoutId: string | null, blocks: ClinicWorkoutBlock[]): WorkoutLog {
  return {
    workout_id: workoutId,
    blocks: blocks.map(b => ({ exercise_name: b.exercise, sets: [] })),
  }
}

function targetSummary(b: ClinicWorkoutBlock): string {
  const parts: string[] = []
  if (b.target_sets != null) parts.push(`${b.target_sets} sets`)
  if (b.target_reps != null) parts.push(`${b.target_reps} reps`)
  if (b.target_load_lbs != null) parts.push(`${b.target_load_lbs} lbs`)
  if (b.target_time_sec != null) parts.push(`${formatMmss(b.target_time_sec)}`)
  if (b.target_distance_m != null) parts.push(`${b.target_distance_m} m`)
  return parts.join(' · ')
}

export function WorkoutEventSubForm({ workoutId, log, onWorkoutIdChange, onLogChange }: Props) {
  const workouts = useClinicWorkouts()

  const selected: ClinicWorkout | null = useMemo(() => {
    if (!workoutId) return null
    return workouts.find(w => w.id === workoutId) ?? null
  }, [workouts, workoutId])

  const handlePickWorkout = useCallback((id: string) => {
    if (!id) {
      onWorkoutIdChange(null)
      onLogChange(null)
      return
    }
    onWorkoutIdChange(id)
    const w = workouts.find(x => x.id === id)
    if (!w) return
    // Prefill log from template (one block per template block, sets: []).
    onLogChange(emptyLog(id, w.blocks))
  }, [workouts, onWorkoutIdChange, onLogChange])

  const updateBlock = useCallback((idx: number, patch: Partial<WorkoutLogBlock>) => {
    if (!log) return
    onLogChange({
      ...log,
      blocks: log.blocks.map((b, i) => i === idx ? { ...b, ...patch } : b),
    })
  }, [log, onLogChange])

  const addSet = useCallback((blockIdx: number) => {
    if (!log) return
    const block = log.blocks[blockIdx]
    if (!block) return
    updateBlock(blockIdx, { sets: [...block.sets, {}] })
  }, [log, updateBlock])

  const removeSet = useCallback((blockIdx: number, setIdx: number) => {
    if (!log) return
    const block = log.blocks[blockIdx]
    if (!block) return
    updateBlock(blockIdx, { sets: block.sets.filter((_, i) => i !== setIdx) })
  }, [log, updateBlock])

  const updateSet = useCallback((blockIdx: number, setIdx: number, patch: Partial<WorkoutSetLog>) => {
    if (!log) return
    const block = log.blocks[blockIdx]
    if (!block) return
    updateBlock(blockIdx, {
      sets: block.sets.map((s, i) => i === setIdx ? { ...s, ...patch } : s),
    })
  }, [log, updateBlock])

  const workoutOptions = useMemo(() => {
    return [
      { value: '', label: 'No workout' },
      ...workouts
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(w => ({ value: w.id, label: w.name })),
    ]
  }, [workouts])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        <PickerInput
          value={workoutId ?? ''}
          onChange={handlePickWorkout}
          options={workoutOptions}
          placeholder="Workout template"
        />
      </div>

      {selected && log && log.blocks.map((logBlock, blockIdx) => {
        const tmpl = selected.blocks[blockIdx]
        const summary = tmpl ? targetSummary(tmpl) : ''
        return (
          <div key={blockIdx} className="rounded-2xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-primary/6">
              <p className="text-sm font-medium text-primary truncate">{logBlock.exercise_name}</p>
              {summary && <p className="text-[9pt] text-tertiary mt-0.5">Target · {summary}</p>}
            </div>

            {logBlock.sets.length > 0 && (
              <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2rem] text-[9pt] text-tertiary border-b border-primary/6">
                <span className="px-2 py-1 text-center">Set</span>
                <span className="px-2 py-1 text-center border-l border-primary/6">Reps</span>
                <span className="px-2 py-1 text-center border-l border-primary/6">Load (lbs)</span>
                <span className="px-2 py-1 text-center border-l border-primary/6">Time mm:ss</span>
                <span className="px-2 py-1 text-center border-l border-primary/6">Dist (m)</span>
                <span className="border-l border-primary/6" />
              </div>
            )}
            {logBlock.sets.map((set, setIdx) => (
              <div key={setIdx} className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2rem] border-b border-primary/6 last:border-b-0">
                <span className="text-[10pt] text-tertiary px-2 py-2 text-center tabular-nums">{setIdx + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={set.reps ?? ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    updateSet(blockIdx, setIdx, { reps: Number.isNaN(n) ? undefined : n })
                  }}
                  placeholder="—"
                  className="bg-transparent px-2 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
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
                  className="bg-transparent px-2 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                />
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
                  className="bg-transparent px-2 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={set.distance_m ?? ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    updateSet(blockIdx, setIdx, { distance_m: Number.isNaN(n) ? undefined : n })
                  }}
                  placeholder="—"
                  className="bg-transparent px-2 py-2 text-center text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none border-l border-primary/6 tabular-nums"
                />
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
              className="w-full flex items-center justify-center gap-2 py-2 text-[10pt] text-tertiary hover:bg-themewhite hover:text-primary transition-colors"
            >
              <Plus size={12} /> Add set
            </button>
          </div>
        )
      })}

      {selected && selected.blocks.length === 0 && (
        <p className="px-2 text-[9pt] text-tertiary">Template has no blocks. Edit the workout template to add exercises.</p>
      )}
    </div>
  )
}
