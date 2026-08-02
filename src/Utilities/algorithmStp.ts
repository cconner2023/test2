/**
 * algorithmStp -- the canonical algorithm -> STP task mapping.
 *
 * The mapping already exists in src/Data/CatData.ts: every algorithm
 * (a `subCatDataTypes` entry whose `icon` is the algorithm id, e.g. "A-1")
 * carries an `stp[]` array of task nodes whose `icon` is the STP task number
 * (e.g. "081-000-1001"). The algorithm page's info drawer (SymptomGuidelines)
 * renders that same array. This module is the single read path so trained-status
 * derivation and the info drawer agree on what "this algorithm's STPs" means.
 */
import { catData } from '../Data/CatData'
import type { subjectAreaArrayOptions } from '../Types/CatTypes'
import type { AuditEvent } from '../lib/auditTypes'

/**
 * Logged runs required for the runs component of algorithm completion (USR
 * 2026-07-29: "ran it x 3"). A run is a LOGGED ENCOUNTER, deliberately not a
 * supervised rep — the supervised half is the separate assessed component.
 */
export const ALGO_RUN_TARGET = 3

/**
 * The STP task nodes doctrinally associated with an algorithm, in render order.
 * Returns [] for an unknown algorithm id or one with no mapped tasks.
 */
export function getAlgorithmStpTasks(algorithmId: string): subjectAreaArrayOptions[] {
  for (const category of catData) {
    const symptom = category.contents.find((c) => c.icon === algorithmId)
    if (symptom) {
      return (symptom.stp as subjectAreaArrayOptions[] | undefined)?.filter(Boolean) ?? []
    }
  }
  return []
}

/** Just the STP task numbers (each node's `icon`) for an algorithm. */
export function getAlgorithmStpTaskNumbers(algorithmId: string): string[] {
  return getAlgorithmStpTasks(algorithmId).map((t) => t.icon)
}

export interface AlgorithmStpEntry {
  /** Algorithm id (e.g. "A-1"). */
  id: string
  /** Display name (the algorithm's `text`). */
  name: string
  /** Parent category display name (the catData category's `text`). */
  category: string
  /** Mapped STP task numbers. */
  taskNumbers: string[]
}

/**
 * Map EVERY algorithm id (e.g. "A-1") to its parent body-system category display
 * name (the catData category's `text`, e.g. "EAR, NOSE, THROAT"). Unlike
 * listAlgorithmsWithStp this includes algorithms with NO mapped STPs — an
 * encounter can be logged against any algorithm, so the roll-up needs the full
 * set. First occurrence wins (matches getAlgorithmStpTasks' find semantics).
 */
export function buildAlgorithmCategoryMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const category of catData) {
    const catName = (category.text ?? '').trim() || 'Other'
    for (const c of category.contents) {
      if (!map.has(c.icon)) map.set(c.icon, catName)
    }
  }
  return map
}

/**
 * Every algorithm that maps to at least one STP task, in catData render order.
 * Deduped by id (first occurrence wins, matching getAlgorithmStpTasks' find).
 *
 * Prefer listAllAlgorithms for completion math — an algorithm with no mapped STP
 * simply has one fewer completion component, so filtering it out here would drop
 * it from the rollup entirely rather than scoring it on the components it has.
 */
export function listAlgorithmsWithStp(): AlgorithmStpEntry[] {
  return listAllAlgorithms().filter((a) => a.taskNumbers.length > 0)
}

/**
 * EVERY algorithm in catData render order, deduped by id, with its mapped STP
 * task numbers (`[]` when it has none).
 *
 * Completion has two category families — ICTLs and algorithms (USR 2026-07-29) —
 * and an algorithm's components are whichever of runs / assessed / sub-taskings
 * it actually has. A zero-link algorithm has runs + assessed and is complete at
 * two of two, so it belongs in this list; the `I.` gynecological series is the
 * live instance (zero `stpTask()` links, a real ADTMC content gap).
 */
export function listAllAlgorithms(): AlgorithmStpEntry[] {
  const out: AlgorithmStpEntry[] = []
  const seen = new Set<string>()
  for (const category of catData) {
    for (const c of category.contents) {
      if (seen.has(c.icon)) continue
      seen.add(c.icon)
      out.push({
        id: c.icon,
        name: (c.text ?? '').trim() || c.icon,
        category: (category.text ?? '').trim() || 'Other',
        taskNumbers: (c.stp as subjectAreaArrayOptions[] | undefined)
          ?.filter(Boolean)
          .map((t) => t.icon) ?? [],
      })
    }
  }
  return out
}

/**
 * Count logged runs per algorithm from RAW, unfolded training events.
 *
 * Must read raw events: an encounter is logged as a `read.recorded` keyed by the
 * algorithm id (useAlgorithmMetrics.logNow) and foldTrainingState collapses every
 * repeat read of the same (user, item) into one row, so the fold can express
 * "ran it" but never "ran it x 3". STP-task reads share the event type and are
 * excluded by the algorithm category map.
 *
 * Pass userId to scope to one soldier. Omit it only for aggregate surfaces —
 * mixing subjects into one count would read as one medic's reps.
 */
export function countAlgorithmRuns(events: AuditEvent[], userId?: string): Map<string, number> {
  const catMap = buildAlgorithmCategoryMap()
  const counts = new Map<string, number>()
  for (const e of events) {
    if (e.eventType !== 'read.recorded') continue
    if (userId && e.subjectId !== userId) continue
    const item = e.payload?.training_item_id as string | undefined
    if (!item || !catMap.has(item)) continue
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return counts
}
