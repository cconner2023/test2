/**
 * Helpers for the workout side of the fitness surface. Pure derivations over
 * clinics.exercises, clinics.workouts and calendar events.
 */

import type { CalendarEvent, WorkoutBlockType, WorkoutLog, WorkoutLogBlock } from '../../Types/CalendarTypes'
import type { ClinicExercise, ClinicWorkout } from '../supervisorService'

/** Snapshot an exercise onto a log block (name + type, empty sets). */
export function blockFromExercise(ex: ClinicExercise): WorkoutLogBlock {
  return { exercise_name: ex.name, type: ex.type, sets: [] }
}

/** Build an empty log from a clinic workout template, resolving exercise_ids → exercises. */
export function logFromTemplate(workout: ClinicWorkout, exercises: ClinicExercise[]): WorkoutLog {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const blocks: WorkoutLogBlock[] = []
  for (const id of workout.exercise_ids) {
    const ex = byId.get(id)
    if (ex) blocks.push(blockFromExercise(ex))
  }
  return { workout_id: workout.id, blocks }
}

/** Build an ad-hoc single-exercise log. Caller picks the block type. */
export function logFromExercise(exerciseName: string, type: WorkoutBlockType): WorkoutLog {
  return {
    workout_id: null,
    blocks: [{ exercise_name: exerciseName, type, sets: [] }],
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
