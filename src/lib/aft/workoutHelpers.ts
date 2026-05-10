/**
 * Helpers for the workout side of the fitness surface. Pure derivations over
 * clinics.workouts and calendar events.
 */

import type { CalendarEvent, WorkoutLog, WorkoutLogBlock } from '../../Types/CalendarTypes'
import type { ClinicWorkout, ClinicWorkoutBlock } from '../supervisorService'

/** Unique, alphabetized exercise names across all clinic workout blocks. */
export function clinicExerciseCorpus(workouts: ClinicWorkout[]): string[] {
  const seen = new Set<string>()
  for (const w of workouts) {
    for (const b of w.blocks) {
      const name = b.exercise.trim()
      if (name) seen.add(name)
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/** Snapshot a clinic workout block's targets onto a log block. */
export function blockFromTemplate(b: ClinicWorkoutBlock): WorkoutLogBlock {
  const out: WorkoutLogBlock = { exercise_name: b.exercise, sets: [] }
  if (b.target_sets != null)        out.target_sets = b.target_sets
  if (b.target_reps != null)        out.target_reps = b.target_reps
  if (b.target_load_lbs != null)    out.target_load_lbs = b.target_load_lbs
  if (b.target_time_sec != null)    out.target_time_sec = b.target_time_sec
  if (b.target_distance_m != null)  out.target_distance_m = b.target_distance_m
  return out
}

/** Build an empty log from a clinic workout template (sets[] empty per block). */
export function logFromTemplate(workout: ClinicWorkout): WorkoutLog {
  return {
    workout_id: workout.id,
    blocks: workout.blocks.map(blockFromTemplate),
  }
}

/** Build an ad-hoc single-exercise log. */
export function logFromExercise(exerciseName: string): WorkoutLog {
  return {
    workout_id: null,
    blocks: [{ exercise_name: exerciseName, sets: [] }],
  }
}

/** Most recent past 'workout' events with logs filled, for one soldier. */
export function recentWorkoutLogs(
  soldierId: string,
  events: CalendarEvent[],
  now: Date,
  limit = 6,
): CalendarEvent[] {
  return events
    .filter(e => e.category === 'workout')
    .filter(e => e.assigned_to.includes(soldierId))
    .filter(e => e.workout_log != null && e.workout_log.blocks.some(b => b.sets.length > 0))
    .filter(e => new Date(e.start_time) <= now)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, limit)
}

/** Open assigned workouts: future-dated 'workout' events with no log filled. */
export function openWorkoutGoals(
  soldierId: string,
  events: CalendarEvent[],
  now: Date,
): CalendarEvent[] {
  return events
    .filter(e => e.category === 'workout')
    .filter(e => e.assigned_to.includes(soldierId))
    .filter(e => e.workout_log == null || !e.workout_log.blocks.some(b => b.sets.length > 0))
    .filter(e => new Date(e.start_time) >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}
