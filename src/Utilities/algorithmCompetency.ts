/**
 * algorithmCompetency — treats an ADTMC algorithm as a composite training
 * CATEGORY (like "Medication Management"), scored as the sum of four dimensions:
 *
 *   • STP data      — the algorithm's mapped STP tasks (real `test` completions)
 *   • Red flags     — recognizing the escalation triggers (synthetic dim)
 *   • Differentials — the DDX the medic must consider (synthetic dim)
 *   • Algorithm run — executing the decision tree to disposition (synthetic dim)
 *
 * STPs are already gradeable. The three non-STP dimensions are display-only text
 * in CatData (`redFlags[]`, `DDX[]`) or live in Algorithms.ts (the tree), so they
 * are made measurable here WITHOUT a schema change: each is minted a synthetic
 * `training_completions` key — `algo:<id>:redflags|ddx|run` — and synthesized into
 * EvaluationStep-compatible task data so the existing supervisor GO/NO_GO flow
 * grades them like any STP.
 *
 * Cross-links: src/Utilities/algorithmStp.ts (STP mapping), supervisorHelpers.ts
 * (buildAlgorithmCompetency rollup), EvaluationStep.tsx (getEvaluableTaskData).
 */
import { catData } from '../Data/CatData'
import type { subCatDataTypes } from '../Types/CatTypes'
import { getAlgorithmStpTaskNumbers } from './algorithmStp'
import { getTaskData, isTaskTestable, type TaskTrainingData, type PerformanceStep } from '../Data/TrainingData'

/** Synthetic (non-STP) competency dimensions of an algorithm. */
export type AlgoSynthDim = 'redflags' | 'ddx' | 'run'
export const ALGO_SYNTH_DIMS: readonly AlgoSynthDim[] = ['redflags', 'ddx', 'run']

const ALGO_KEY_PREFIX = 'algo:'

const DIM_LABEL: Record<AlgoSynthDim, string> = {
  redflags: 'Red flags',
  ddx: 'Differentials',
  run: 'Algorithm run',
}
export function algoDimLabel(dim: AlgoSynthDim): string {
  return DIM_LABEL[dim]
}

/** training_item_id for a synthetic algorithm dimension, e.g. "algo:A-1:redflags". */
export function algoDimKey(algorithmId: string, dim: AlgoSynthDim): string {
  return `${ALGO_KEY_PREFIX}${algorithmId}:${dim}`
}

export function isAlgoDimKey(key: string): boolean {
  return key.startsWith(ALGO_KEY_PREFIX)
}

/** Split a synthetic key back into its algorithm id + dimension (null if not one). */
export function parseAlgoDimKey(key: string): { algorithmId: string; dim: AlgoSynthDim } | null {
  if (!isAlgoDimKey(key)) return null
  const rest = key.slice(ALGO_KEY_PREFIX.length)
  // Algorithm ids contain dashes (e.g. "A-1") but never colons, so the dim is
  // whatever follows the LAST colon.
  const lastColon = rest.lastIndexOf(':')
  if (lastColon < 0) return null
  const algorithmId = rest.slice(0, lastColon)
  const dim = rest.slice(lastColon + 1) as AlgoSynthDim
  if (!algorithmId || !ALGO_SYNTH_DIMS.includes(dim)) return null
  return { algorithmId, dim }
}

/** The doctrinal rubric for the "run the decision tree" dimension. */
const RUN_RUBRIC: readonly string[] = [
  'Gathers the correct branch data at each decision point',
  'Follows the doctrinal path to the correct disposition',
  'Recognizes and escalates red-flag findings appropriately',
]

/** Find an algorithm's CatData entry by its id (the `icon`, e.g. "A-1"). */
function findAlgorithm(algorithmId: string): subCatDataTypes | undefined {
  for (const category of catData) {
    const found = category.contents.find((c) => c.icon === algorithmId)
    if (found) return found
  }
  return undefined
}

/** Backing texts for a synthetic dimension ([] when the algorithm has none). */
function dimTexts(algo: subCatDataTypes, dim: AlgoSynthDim): string[] {
  if (dim === 'run') return [...RUN_RUBRIC]
  const list = dim === 'redflags' ? algo.redFlags : algo.DDX
  return (list ?? []).map((x) => (x.text ?? '').trim()).filter(Boolean)
}

/**
 * Synthesize EvaluationStep-compatible task data for a synthetic algorithm
 * dimension. Each backing text becomes one graded performance step, so the
 * supervisor GO/NO_GO flow works unchanged. Returns undefined when the algorithm
 * has no content for that dimension (e.g. no documented red flags) — such a
 * dimension is simply omitted from the composite, never scored as a miss.
 */
export function synthesizeAlgoTaskData(algorithmId: string, dim: AlgoSynthDim): TaskTrainingData | undefined {
  const algo = findAlgorithm(algorithmId)
  if (!algo) return undefined
  const texts = dimTexts(algo, dim)
  if (texts.length === 0) return undefined

  const stem = dim === 'redflags' ? 'Recognizes red flag — '
    : dim === 'ddx' ? 'Considers differential — '
    : ''
  const performanceSteps: PerformanceStep[] = texts.map((t, i) => ({
    number: String(i + 1),
    text: `${stem}${t}`,
  }))
  const name = (algo.text ?? algorithmId).trim() || algorithmId
  return {
    taskNumber: algoDimKey(algorithmId, dim),
    title: `${name} — ${DIM_LABEL[dim]}`,
    conditions: `Evaluating the ${DIM_LABEL[dim].toLowerCase()} competency for algorithm ${algorithmId}.`,
    standards: dim === 'run'
      ? 'Medic executes the decision tree to the correct disposition without supervisor prompting.'
      : `Medic correctly identifies each ${dim === 'redflags' ? 'red flag' : 'differential'} for this presentation.`,
    performanceSteps,
    gradedSteps: performanceSteps.map((s) => s.number),
  }
}

/**
 * Resolver for the evaluation UI: real STP task data for STP task numbers,
 * synthesized data for synthetic `algo:<id>:<dim>` keys. EvaluationStep uses this
 * so a single component grades both STPs and the synthetic algorithm dimensions.
 */
export function getEvaluableTaskData(trainingItemId: string): TaskTrainingData | undefined {
  const parsed = parseAlgoDimKey(trainingItemId)
  if (parsed) return synthesizeAlgoTaskData(parsed.algorithmId, parsed.dim)
  return getTaskData(trainingItemId)
}

/** One unit (synthetic dim or STP) to evaluate when grading a whole algorithm. */
export interface AlgorithmEvalUnit {
  trainingItemId: string
  title: string
  /** Coarse grouping for the progress UI. */
  kind: 'stp' | AlgoSynthDim
}

/**
 * Ordered evaluable units for an algorithm: its synthetic dimensions (red flags,
 * differentials, run) that have content, then each TESTABLE mapped STP.
 * Evaluating an algorithm cascades through all of these — the STP units write
 * real STP completions, so grading the algorithm also lifts the STP-based
 * category bars (e.g. Medication Management).
 */
export function listAlgorithmEvalUnits(algorithmId: string): AlgorithmEvalUnit[] {
  const units: AlgorithmEvalUnit[] = []
  for (const dim of ALGO_SYNTH_DIMS) {
    const data = synthesizeAlgoTaskData(algorithmId, dim)
    if (data) units.push({ trainingItemId: data.taskNumber, title: data.title, kind: dim })
  }
  for (const taskNumber of getAlgorithmStpTaskNumbers(algorithmId)) {
    if (!isTaskTestable(taskNumber)) continue
    const title = getTaskData(taskNumber)?.title ?? taskNumber
    units.push({ trainingItemId: taskNumber, title, kind: 'stp' })
  }
  return units
}
