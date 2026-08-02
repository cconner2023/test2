/**
 * algorithmCompetency — treats an ADTMC algorithm as a composite training
 * CATEGORY (like "Medication Management"), scored as the sum of two dimensions:
 *
 *   • STP data      — the algorithm's mapped STP tasks (real `test` completions)
 *   • Algorithm run — executing the decision tree to disposition (synthetic dim)
 *
 * NOTE (2026-07-12, USR): Red flags and Differentials USED TO be synthetic
 * competency dimensions here, but they aren't genuinely testable via a GO/NO_GO
 * rubric, so they were dropped from the scored model — `ALGO_SYNTH_DIMS` is now
 * just `run`. Their labels/synthesis helpers remain (below) so any historical
 * `algo:<id>:redflags|ddx` completions still parse, but nothing new grades them.
 *
 * STPs are already gradeable. The Algorithm-run dimension lives in Algorithms.ts
 * (the tree), so it is made measurable here WITHOUT a schema change: it is minted
 * a synthetic `training_completions` key — `algo:<id>:run` — and synthesized into
 * EvaluationStep-compatible task data so the existing supervisor GO/NO_GO flow
 * grades it like any STP. The run walk emits ONE graded step per tree node — red
 * flags, each decision question, each action — so the supervisor walks the soldier
 * through the entire algorithm (buildRunWalkSteps); a generic rubric is only a
 * fallback for algorithms with no tree.
 *
 * Cross-links: src/Utilities/algorithmStp.ts (STP mapping), supervisorHelpers.ts
 * (buildAlgorithmCompetency rollup), EvaluationStep.tsx (getEvaluableTaskData).
 */
import { catData } from '../Data/CatData'
import type { subCatDataTypes } from '../Types/CatTypes'
import { Algorithm } from '../Data/Algorithms'
import type { AlgorithmOptions } from '../Types/AlgorithmTypes'
import { getAlgorithmStpTaskNumbers } from './algorithmStp'
import { getTaskData, isTaskTestable, type TaskTrainingData, type PerformanceStep } from '../Data/TrainingData'
import { ictlTaskAsTrainingData } from './ictlEvaluation'

/** Synthetic (non-STP) competency dimensions of an algorithm. */
export type AlgoSynthDim = 'redflags' | 'ddx' | 'run'
// Only `run` is a scored dimension. `redflags`/`ddx` are retained in the type +
// label/synthesis helpers for back-compat with any historical completions, but
// they are NOT in this list, so buildAlgorithmCompetency + listAlgorithmEvalUnits
// no longer score or evaluate them (USR 2026-07-12 — not GO/NO_GO testable).
export const ALGO_SYNTH_DIMS: readonly AlgoSynthDim[] = ['run']

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

/**
 * Fallback rubric for the "run the decision tree" dimension — used only when an
 * algorithm has no decision tree in Algorithms.ts. Normally the run walk emits a
 * graded step per tree node (see buildRunWalkSteps).
 */
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

/** Find an algorithm's decision-tree cards by its id (the `id`, e.g. "A-1"). */
function findAlgorithmTree(algorithmId: string): AlgorithmOptions[] | undefined {
  return Algorithm.find((a) => a.id === algorithmId)?.options
}

/**
 * Graded steps for the "run the algorithm" walk: one linear pass over the
 * algorithm's decision tree (Algorithms.ts), emitting a graded step per node so
 * the supervisor walks the soldier through the whole tree —
 *   • rf card     → one step per red-flag finding  ("Recognizes red flag — …")
 *   • action card → one step per action item        ("Performs — …")
 *   • decision    → one step for the branch question, its criteria as a note.
 * Cards are walked in array order (matching how the tree renders), so every node
 * is graded regardless of the branch a live patient would take — a full-tree
 * competency check, not a single-path replay. Returns [] when the algorithm has
 * no tree (caller falls back to RUN_RUBRIC).
 */
function buildRunWalkSteps(algorithmId: string): PerformanceStep[] {
  const cards = findAlgorithmTree(algorithmId)
  if (!cards || cards.length === 0) return []

  const steps: PerformanceStep[] = []
  const push = (text: string, extra?: Partial<PerformanceStep>) => {
    const clean = text.trim()
    if (!clean) return
    steps.push({ number: String(steps.length + 1), text: clean, ...extra })
  }

  for (const card of cards) {
    const items = (card.questionOptions ?? [])
      .map((q) => (q.text ?? '').trim())
      .filter(Boolean)

    if (card.type === 'rf') {
      if (items.length > 0) items.forEach((it) => push(`Recognizes red flag — ${it}`))
      else push(`Recognizes red flags — ${card.text}`)
    } else if (card.type === 'action') {
      if (items.length > 0) items.forEach((it) => push(`Performs — ${it}`))
      else push(`Performs — ${card.text}`)
    } else {
      // initial | choice | count — a branch decision node
      push(card.text, items.length > 0 ? { note: `Assesses: ${items.join('; ')}` } : undefined)
    }
  }
  return steps
}

/**
 * Backing texts for the legacy synthetic dimensions ([] when none). Only
 * redflags/ddx flow through here now (back-compat synthesis); the `run` dim
 * builds its steps from the decision tree via buildRunWalkSteps.
 */
function dimTexts(algo: subCatDataTypes, dim: 'redflags' | 'ddx'): string[] {
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

  let performanceSteps: PerformanceStep[]
  if (dim === 'run') {
    // Walk the actual decision tree, one graded step per node. Only when the
    // algorithm has no tree do we fall back to the generic rubric.
    const walk = buildRunWalkSteps(algorithmId)
    performanceSteps = walk.length > 0
      ? walk
      : RUN_RUBRIC.map((t, i) => ({ number: String(i + 1), text: t }))
  } else {
    const texts = dimTexts(algo, dim)
    if (texts.length === 0) return undefined
    const stem = dim === 'redflags' ? 'Recognizes red flag — ' : 'Considers differential — '
    performanceSteps = texts.map((t, i) => ({ number: String(i + 1), text: `${stem}${t}` }))
  }
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
 * Resolver for the evaluation UI — the ONE place evaluation content is chosen,
 * in precedence order:
 *   1. synthetic `algo:<id>:<dim>` keys → the synthesized algorithm dimension
 *   2. an authored ICTL packet → its graded performance measures
 *   3. the STP substrate
 *
 * ICTL sits ahead of the STP because it is the approved artifact the unit is
 * held to, and a handful of numbers exist in both lists with different content
 * (081-000-0125 most notably). Keeping the fork here means no caller has to
 * know which roster a number came from.
 */
export function getEvaluableTaskData(trainingItemId: string): TaskTrainingData | undefined {
  const parsed = parseAlgoDimKey(trainingItemId)
  if (parsed) return synthesizeAlgoTaskData(parsed.algorithmId, parsed.dim)
  return ictlTaskAsTrainingData(trainingItemId) ?? getTaskData(trainingItemId)
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
