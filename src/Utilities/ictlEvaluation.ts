/**
 * ICTL → evaluator adapter. The supervisor's GO/NO-GO flow speaks one shape,
 * TaskTrainingData, and until now only the STP substrate spoke it. This maps an
 * approved ICTL packet onto that shape so the same EvaluationStep grades both.
 *
 * WHAT IS GRADED. An ICTL packet carries two different lists: narrative
 * `performanceSteps` (how the task is walked, sometimes deferring detail to a
 * TCCC module) and `performanceMeasures` (the GO/NO-GO line items). `gradedMeasures`
 * numbers the second list, never the first, so the adapter feeds the MEASURES in
 * as the evaluator's steps. Grading the narrative would score a medic against
 * prose that was written to teach, not to test.
 *
 * PRECEDENCE. Where an ICTL number also exists in TrainingData — 081-000-0125 is
 * the live case, reassigned by the ICTL from "Maintain a Nasogastric Tube" to
 * "Treat Massive Hemorrhage" — the ICTL wins. It is the approved artifact and
 * the roster the unit is actually held to; the STP twin is legacy content kept
 * alive only for the algorithm substrate. That fork is resolved in
 * getEvaluableTaskData, which is the one place evaluation resolves content.
 */

import { getIctlTaskData, ictlTaskData } from '../Data/ICTLContent'
import { ictl68wSL1 } from '../Data/ICTL'
import type { TaskTrainingData } from '../Data/TrainingData'

/** Badge text for an ICTL row. The ICTL is one flat approved list, not a tiered
 *  soldier's manual, so there is no skill level to name. */
export const ICTL_LEVEL_NAME = 'ICTL'

/**
 * True when an ICTL packet exists for this number AND names graded measures.
 * The category surfaces gate on this the way they used to gate on isTaskTestable:
 * a task with no graded measures is on the roster but cannot be evaluated, and
 * renders locked rather than silently absent.
 */
export function isIctlTaskTestable(taskNumber: string): boolean {
  const packet = getIctlTaskData(taskNumber)
  return !!packet && packet.gradedMeasures.length > 0
}

/**
 * One ICTL packet in the evaluator's shape. Returns undefined when no packet is
 * authored for the number, which is how the resolver falls through to the STP
 * substrate rather than grading an empty task.
 *
 * `danger` has no home in TaskTrainingData and is folded into the warning line —
 * dropping it would silently lose the most severe advisory a packet carries.
 */
export function ictlTaskAsTrainingData(taskNumber: string): TaskTrainingData | undefined {
  const p = getIctlTaskData(taskNumber)
  if (!p) return undefined

  const warning = [p.danger, p.warning].filter(Boolean).join('\n\n') || undefined

  return {
    taskNumber: p.taskNumber,
    title: p.title,
    conditions: p.conditions,
    standards: p.standards,
    warning,
    caution: p.caution,
    performanceSteps: p.performanceMeasures.map((m) => ({ number: m.number, text: m.text })),
    gradedSteps: p.gradedMeasures,
  }
}

/** Every ICTL number that has an authored packet. */
export function listAuthoredIctlTaskNumbers(): string[] {
  return ictlTaskData.map((t) => t.taskNumber)
}

/**
 * The ICTL's subject areas in published order, each with its tasks. The single
 * top-level entry of `ictl68wSL1` names the list rather than a skill level, so
 * the areas underneath are the whole grouping — there is no level axis to
 * flatten, which is the shape difference from the STP roster.
 */
export function ictlAreas(): { name: string; tasks: { id: string; title: string }[] }[] {
  return ictl68wSL1.flatMap((level) =>
    level.subjectArea.map((area) => ({
      name: area.name,
      tasks: area.tasks.map((t) => ({ id: t.id, title: t.title })),
    })),
  )
}
