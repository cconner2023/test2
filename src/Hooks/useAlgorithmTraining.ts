/**
 * useAlgorithmTraining -- derives an algorithm's training status for the CURRENT
 * user from their training_completions, against the algorithm's mapped STP tasks.
 *
 * Two explicit tiers (per the 2026-06-17 decision):
 *   - self      : the medic has a `read` completion for the STP (self-reported).
 *   - validated : a supervisor `test` completion exists with result GO.
 *
 * "Trained" (the badge) requires every mapped STP validated. There is NO cascade
 * from completing an algorithm encounter event into these completions -- this hook
 * only READS whatever STP completions already exist (decoupled loops).
 *
 * Scope: current user only (self-view, e.g. the algorithm info drawer). A
 * supervisor viewing another soldier needs that soldier's completions via the
 * clinic-scoped path and is intentionally out of scope here.
 */
import { useMemo } from 'react'
import { useTrainingCompletions } from './useTrainingCompletions'
import { getAlgorithmStpTaskNumbers } from '../Utilities/algorithmStp'

export interface AlgorithmStpStatus {
  taskNumber: string
  /** A `read` completion exists (self-reported). */
  self: boolean
  /** A supervisor `test` completion exists with result GO. */
  validated: boolean
}

export interface AlgorithmTrainingStatus {
  taskNumbers: string[]
  total: number
  /** Count of mapped STPs with a self (`read`) completion. */
  selfDone: number
  /** Count of mapped STPs with a validated (`test` GO) completion. */
  validatedDone: number
  /** All mapped STPs self-completed (total > 0). */
  selfComplete: boolean
  /** All mapped STPs validated (total > 0) -- drives the "trained" badge. */
  validated: boolean
  /** True when the algorithm maps to no STP tasks. */
  isEmpty: boolean
  perTask: AlgorithmStpStatus[]
}

/**
 * Derive two-tier training status for a single algorithm for the current user.
 */
export function useAlgorithmTraining(algorithmId: string): AlgorithmTrainingStatus {
  const { isTaskCompleted, getTestResult } = useTrainingCompletions()

  return useMemo(() => {
    const taskNumbers = getAlgorithmStpTaskNumbers(algorithmId)
    const total = taskNumbers.length

    const perTask: AlgorithmStpStatus[] = taskNumbers.map((taskNumber) => ({
      taskNumber,
      self: isTaskCompleted(taskNumber),
      validated: getTestResult(taskNumber)?.result === 'GO',
    }))

    const selfDone = perTask.filter((t) => t.self).length
    const validatedDone = perTask.filter((t) => t.validated).length

    return {
      taskNumbers,
      total,
      selfDone,
      validatedDone,
      selfComplete: total > 0 && selfDone === total,
      validated: total > 0 && validatedDone === total,
      isEmpty: total === 0,
      perTask,
    }
  }, [algorithmId, isTaskCompleted, getTestResult])
}
