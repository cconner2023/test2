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
