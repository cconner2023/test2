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
 * Every algorithm that maps to at least one STP task, in catData render order.
 * Deduped by id (first occurrence wins, matching getAlgorithmStpTasks' find).
 * Used by supervisor surfaces to show trained-or-not per algorithm.
 */
export function listAlgorithmsWithStp(): AlgorithmStpEntry[] {
  const out: AlgorithmStpEntry[] = []
  const seen = new Set<string>()
  for (const category of catData) {
    for (const c of category.contents) {
      if (seen.has(c.icon)) continue
      const taskNumbers = (c.stp as subjectAreaArrayOptions[] | undefined)
        ?.filter(Boolean)
        .map((t) => t.icon) ?? []
      if (taskNumbers.length === 0) continue
      seen.add(c.icon)
      out.push({
        id: c.icon,
        name: (c.text ?? '').trim() || c.icon,
        category: (category.text ?? '').trim() || 'Other',
        taskNumbers,
      })
    }
  }
  return out
}
