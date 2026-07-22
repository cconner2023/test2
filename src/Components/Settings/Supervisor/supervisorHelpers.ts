import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { stp68wTraining } from '../../../Data/TrainingTaskList'
import { categoryOrder } from '../../../Data/TrainingConstants'
import { isTaskTestable } from '../../../Data/TrainingData'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import type { Certification } from '../../../Data/User'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getExpirationStatus } from '../../Certifications/certHelpers'
import { listAlgorithmsWithStp, buildAlgorithmCategoryMap } from '../../../Utilities/algorithmStp'
import type { AuditEvent } from '../../../lib/auditTypes'
import {
  ALGO_SYNTH_DIMS,
  algoDimKey,
  algoDimLabel,
  synthesizeAlgoTaskData,
  type AlgoSynthDim,
} from '../../../Utilities/algorithmCompetency'

// â”€â”€â”€ Encounter Log (algorithm completions) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Algorithm "log to calendar" writes a calendar event tagged with
// encounter_algorithm_id (see useAlgorithmMetrics). These helpers roll those
// events up for supervisor surfaces. Operational only â€” title carries the
// algorithm name, never PHI.

/**
 * True when an event is an algorithm encounter record. Primary signal is the
 * encounter_algorithm_id tag; the `ADTMC ` title prefix is a backward-compat
 * fallback for encounters logged before the tag existed.
 */
export function isEncounterEvent(e: CalendarEvent): boolean {
  return !!e.encounter_algorithm_id || e.title.startsWith('ADTMC ')
}

// â”€â”€â”€ Readiness Color Scale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ONE two-tone scheme for every supervisor percentage: faded operating-clinic
// blue when passing, red when low. themeblue3 is the same accent the clinic
// switcher uses to mark the clinic you're operating as. Matches the FillBar
// primitive's defaults â€” reach for <FillBar> for the bar itself; these are for
// the surfaces that color a bare number or pill.

/** At/above this a readiness/coverage percentage reads as passing. */
export const READINESS_THRESHOLD = 50

export function readinessBarColor(pct: number): string {
  return pct >= READINESS_THRESHOLD ? 'bg-themeblue3/50' : 'bg-themeredred'
}

export function readinessTextColor(pct: number): string {
  return pct >= READINESS_THRESHOLD ? 'text-themeblue3' : 'text-themeredred'
}

// â”€â”€â”€ Encounter Roll-up by body-system category (from RAW audit events) â”€â”€â”€â”€â”€â”€â”€â”€
// An algorithm encounter is logged as a `read.recorded` training event keyed by
// the algorithm id (useAlgorithmMetrics.logNow). Each encounter is a DISTINCT
// event, so occurrence totals MUST be counted from the raw event stream â€” the
// trainingFold collapses repeat reads of the same (user, algorithm) into one row
// and would undercount. STP-task reads share the event type but their
// training_item_id is a task number (not in the algorithm category map) and are
// skipped here. Aggregate counts only â€” no soldier identity â€” so this roll-up is
// safe to fan up the echelon as a de-identified summary.

export interface EncounterCategoryRollup {
  /** Body-system category display name (catData category text). */
  category: string
  /** Total encounters logged in this category across the fetched window. */
  count: number
  /** Encounters logged on the local current calendar day. */
  today: number
}

export interface EncounterRollup {
  /** Per-category rows, most-logged first. */
  categories: EncounterCategoryRollup[]
  /** Total encounters across all categories. */
  total: number
  /** Total encounters logged today (local). */
  totalToday: number
}

/** Local start-of-day epoch ms for "today" bucketing. */
function startOfLocalDay(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Roll algorithm-encounter reads up by body-system category. Pass the RAW,
 * unfolded training audit events (see note above). Returns aggregate counts only.
 */
export function rollupEncounterReads(events: AuditEvent[]): EncounterRollup {
  const catMap = buildAlgorithmCategoryMap()
  const dayStart = startOfLocalDay()
  const byCat = new Map<string, EncounterCategoryRollup>()
  let total = 0
  let totalToday = 0

  for (const e of events) {
    if (e.eventType !== 'read.recorded') continue
    const item = e.payload?.training_item_id as string | undefined
    if (!item) continue
    const category = catMap.get(item)
    if (!category) continue // STP read, not an algorithm encounter
    const isToday = new Date(e.occurredAt).getTime() >= dayStart
    const row = byCat.get(category) ?? { category, count: 0, today: 0 }
    row.count += 1
    if (isToday) row.today += 1
    byCat.set(category, row)
    total += 1
    if (isToday) totalToday += 1
  }

  const categories = [...byCat.values()].sort(
    (a, b) => b.count - a.count || a.category.localeCompare(b.category),
  )
  return { categories, total, totalToday }
}

// â”€â”€â”€ Algorithm Competency (composite category) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Treats an algorithm as a training CATEGORY (like "Medication Management"),
// scored as the SUM of two dimensions: STP data + algorithm run. (Red flags +
// differentials were dropped from the scored model 2026-07-12 â€” not GO/NO_GO
// testable; see Utilities/algorithmCompetency ALGO_SYNTH_DIMS.) Distinct from the
// Encounter Log (which counts how often an algorithm was LOGGED). Each dimension
// is derived from supervisor `test` completions: the STP dim reads the mapped STP
// task numbers; the run dim reads the `algo:<id>:run` key.

export type AlgorithmCompetencyLevel = 'trained' | 'partial' | 'untrained'

export interface AlgorithmDimScore {
  dim: 'stp' | AlgoSynthDim
  label: string
  /** Graded items passed (test GO). */
  validated: number
  /** Total graded items in this dimension. */
  total: number
  /** True when every graded item in the dimension is GO. */
  met: boolean
  /** True when a supervisor `test` completion exists for this dimension at all
   *  (regardless of GO/NO_GO) â€” i.e. it has actually been evaluated. Lets the
   *  per-soldier drill distinguish "not evaluated" from "evaluated all NO_GO". */
  graded: boolean
}

export interface AlgorithmCompetency {
  id: string
  name: string
  /** Item-count-weighted composite, 0â€“100. */
  pct: number
  status: AlgorithmCompetencyLevel
  /** Per-dimension breakdown (only dimensions the algorithm actually has). */
  dims: AlgorithmDimScore[]
}

/** GO-step count for a synthetic dimension's single completion record. */
function synthValidated(latest: TrainingCompletionUI | undefined, total: number): number {
  if (!latest) return 0
  if (latest.stepResults && latest.stepResults.length) {
    return latest.stepResults.filter((s) => s.result === 'GO').length
  }
  return latest.result === 'GO' ? total : 0
}

/**
 * Per-algorithm composite competency for one soldier, derived from their test
 * completions. Covers every algorithm that maps to STPs. Sorted worst-first
 * (untrained â†’ partial â†’ trained, then higher % first) so gaps surface on top â€”
 * mirrors the Training Competency category ordering.
 */
export function buildAlgorithmCompetency(
  tests: TrainingCompletionUI[]
): AlgorithmCompetency[] {
  const latestByTask = getLatestTestByTask(tests)

  const rows = listAlgorithmsWithStp().map((a): AlgorithmCompetency => {
    const dims: AlgorithmDimScore[] = []

    // STP dimension â€” real STP completions, testable STPs only.
    const stpKeys = a.taskNumbers.filter(isTaskTestable)
    if (stpKeys.length > 0) {
      const validated = stpKeys.filter((tn) => latestByTask.get(tn)?.result === 'GO').length
      const graded = stpKeys.some((tn) => latestByTask.has(tn))
      dims.push({ dim: 'stp', label: 'STP data', validated, total: stpKeys.length, met: validated >= stpKeys.length, graded })
    }

    // Synthetic dimensions â€” only those with backing content.
    for (const dim of ALGO_SYNTH_DIMS) {
      const data = synthesizeAlgoTaskData(a.id, dim)
      if (!data) continue
      const total = data.gradedSteps?.length ?? 0
      const validated = synthValidated(latestByTask.get(algoDimKey(a.id, dim)), total)
      const graded = latestByTask.has(algoDimKey(a.id, dim))
      dims.push({ dim, label: algoDimLabel(dim), validated, total, met: total > 0 && validated >= total, graded })
    }

    const totalItems = dims.reduce((s, d) => s + d.total, 0)
    const validItems = dims.reduce((s, d) => s + d.validated, 0)
    const pct = totalItems ? Math.round((validItems / totalItems) * 100) : 0
    const status: AlgorithmCompetencyLevel =
      dims.length > 0 && dims.every((d) => d.met) ? 'trained' : validItems > 0 ? 'partial' : 'untrained'

    return { id: a.id, name: a.name, pct, status, dims }
  })

  const order: Record<AlgorithmCompetencyLevel, number> = { untrained: 0, partial: 1, trained: 2 }
  return rows.sort(
    (a, b) => order[a.status] - order[b.status] || b.pct - a.pct || a.name.localeCompare(b.name),
  )
}

// â”€â”€â”€ Name Formatting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function formatMedicName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += ', ' + medic.firstName.charAt(0) + '.'
    if (medic.middleInitial) name += medic.middleInitial + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

// â”€â”€â”€ Testable Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface FlatTask {
  taskId: string
  title: string
  levelIdx: number
  levelName: string
  areaName: string
}

export function buildTestableTasksByCategory(): Map<string, FlatTask[]> {
  const seen = new Map<string, Set<string>>()
  const grouped = new Map<string, FlatTask[]>()

  for (const cat of categoryOrder) {
    grouped.set(cat, [])
    seen.set(cat, new Set())
  }

  stp68wTraining.forEach((level, levelIdx) => {
    level.subjectArea.forEach((area) => {
      if (!grouped.has(area.name)) {
        grouped.set(area.name, [])
        seen.set(area.name, new Set())
      }
      const seenSet = seen.get(area.name)!
      area.tasks.forEach((task) => {
        if (seenSet.has(task.id)) return
        seenSet.add(task.id)
        grouped.get(area.name)!.push({
          taskId: task.id,
          title: task.title,
          levelIdx,
          levelName: level.skillLevel,
          areaName: area.name,
        })
      })
    })
  })

  for (const tasks of grouped.values()) {
    tasks.sort((a, b) => a.levelIdx - b.levelIdx || a.title.localeCompare(b.title))
  }

  return grouped
}

// â”€â”€â”€ Team Insights Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CompetencyStatus = 'GO' | 'NO_GO' | 'UNTESTED'

export interface SubjectAreaCompetency {
  areaName: string
  tested: number
  passed: number
  total: number
  tasks: { taskId: string; title: string; status: CompetencyStatus }[]
  status: CompetencyStatus
}

export interface SoldierCompetency {
  soldierId: string
  areas: SubjectAreaCompetency[]
  overallPassed: number
  overallTested: number
  overallTotal: number
}

export interface TeamMetrics {
  totalMedics: number
  teamReadinessPercent: number
  certCompliancePercent: number
  soldierReadiness: SoldierReadinessEntry[]
  subjectAreaGaps: SubjectAreaGap[]
  /** Per-algorithm team coverage â€” algorithms surfaced as a peer of subject-area
   *  gaps in the Coverage Gaps surface. Item-weighted across the composite
   *  competency dimensions (STP + run â€” see ALGO_SYNTH_DIMS; red flags + ddx
   *  were dropped from the scored model 2026-07-12). */
  algorithmGaps: AlgorithmGap[]
}

export interface SoldierReadinessEntry {
  soldierId: string
  readinessPercent: number
  compliancePercent: number
  overdueCount: number
}

export interface SubjectAreaGap {
  areaName: string
  coveragePercent: number
  deficientSoldierIds: string[]
}

export interface AlgorithmGap {
  algorithmId: string
  name: string
  coveragePercent: number
  /** Soldiers not yet fully trained on this algorithm. */
  deficientSoldierIds: string[]
}

// â”€â”€â”€ Team Insights Pure Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Wraps buildTestableTasksByCategory but filters to only tasks with gradedSteps. */
export function buildTestableTaskMap(): Map<string, FlatTask[]> {
  const all = buildTestableTasksByCategory()
  const filtered = new Map<string, FlatTask[]>()
  for (const [area, tasks] of all) {
    const testable = tasks.filter(t => isTaskTestable(t.taskId))
    if (testable.length > 0) {
      filtered.set(area, testable)
    }
  }
  return filtered
}

/** Filter to completionType === 'test', return latest by updatedAt per taskId. */
export function getLatestTestByTask(
  tests: TrainingCompletionUI[]
): Map<string, TrainingCompletionUI> {
  const map = new Map<string, TrainingCompletionUI>()
  for (const t of tests) {
    if (t.completionType !== 'test') continue
    const existing = map.get(t.trainingItemId)
    if (!existing || t.updatedAt > existing.updatedAt) {
      map.set(t.trainingItemId, t)
    }
  }
  return map
}

/** Build competency data for a single soldier. */
export function buildSoldierCompetency(
  soldierId: string,
  soldierTests: TrainingCompletionUI[],
  testableTaskMap: Map<string, FlatTask[]>
): SoldierCompetency {
  const latestByTask = getLatestTestByTask(soldierTests)
  const areas: SubjectAreaCompetency[] = []
  let overallPassed = 0
  let overallTested = 0
  let overallTotal = 0

  for (const areaName of categoryOrder) {
    const tasks = testableTaskMap.get(areaName)
    if (!tasks || tasks.length === 0) continue

    let areaTested = 0
    let areaPassed = 0
    const taskStatuses: SubjectAreaCompetency['tasks'] = []

    for (const task of tasks) {
      const latest = latestByTask.get(task.taskId)
      let status: CompetencyStatus = 'UNTESTED'
      if (latest) {
        areaTested++
        status = latest.result === 'GO' ? 'GO' : 'NO_GO'
        if (status === 'GO') areaPassed++
      }
      taskStatuses.push({ taskId: task.taskId, title: task.title, status })
    }

    const areaStatus: CompetencyStatus =
      areaTested === 0 ? 'UNTESTED' :
      areaPassed === tasks.length ? 'GO' : 'NO_GO'

    areas.push({
      areaName,
      tested: areaTested,
      passed: areaPassed,
      total: tasks.length,
      tasks: taskStatuses,
      status: areaStatus,
    })

    overallPassed += areaPassed
    overallTested += areaTested
    overallTotal += tasks.length
  }

  return { soldierId, areas, overallPassed, overallTested, overallTotal }
}

/** Build the full competency matrix for all soldiers. */
export function buildCompetencyMatrix(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  testableTaskMap: Map<string, FlatTask[]>
): SoldierCompetency[] {
  const testsByUser = new Map<string, TrainingCompletionUI[]>()
  for (const t of tests) {
    if (t.completionType !== 'test') continue
    const arr = testsByUser.get(t.userId) ?? []
    arr.push(t)
    testsByUser.set(t.userId, arr)
  }

  return medics.map(m =>
    buildSoldierCompetency(m.id, testsByUser.get(m.id) ?? [], testableTaskMap)
  )
}

/**
 * Per-algorithm team coverage. Runs the per-soldier composite competency for
 * each medic and aggregates item-weighted across the team (sum of validated
 * dimension items / sum of total dimension items), mirroring how subject-area
 * gaps aggregate STP passes. A soldier is "deficient" until fully trained.
 */
export function buildAlgorithmGaps(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[]
): AlgorithmGap[] {
  const testsByUser = new Map<string, TrainingCompletionUI[]>()
  for (const t of tests) {
    if (t.completionType !== 'test') continue
    const arr = testsByUser.get(t.userId) ?? []
    arr.push(t)
    testsByUser.set(t.userId, arr)
  }

  // algorithmId -> { name, validated, total, deficient }
  const agg = new Map<string, { name: string; validated: number; total: number; deficient: string[] }>()
  for (const m of medics) {
    const comps = buildAlgorithmCompetency(testsByUser.get(m.id) ?? [])
    for (const c of comps) {
      const entry = agg.get(c.id) ?? { name: c.name, validated: 0, total: 0, deficient: [] }
      for (const d of c.dims) {
        entry.validated += d.validated
        entry.total += d.total
      }
      if (c.status !== 'trained') entry.deficient.push(m.id)
      agg.set(c.id, entry)
    }
  }

  const gaps: AlgorithmGap[] = [...agg.entries()].map(([algorithmId, e]) => ({
    algorithmId,
    name: e.name,
    coveragePercent: e.total > 0 ? Math.round((e.validated / e.total) * 100) : 0,
    deficientSoldierIds: e.deficient,
  }))
  gaps.sort((a, b) => a.coveragePercent - b.coveragePercent || a.name.localeCompare(b.name))
  return gaps
}

/** Compute aggregate team metrics. */
export function computeTeamMetrics(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  certs: Certification[],
  testableTaskMap: Map<string, FlatTask[]>,
  overdueItemsFn: (userId: string) => { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] }
): TeamMetrics {
  // Per-soldier readiness + compliance
  const matrix = buildCompetencyMatrix(medics, tests, testableTaskMap)
  const soldierReadiness: SoldierReadinessEntry[] = medics.map(m => {
    const sc = matrix.find(s => s.soldierId === m.id)
    const readinessPercent = sc && sc.overallTotal > 0
      ? Math.round((sc.overallPassed / sc.overallTotal) * 100) : 0
    const { expiredCerts, failedTests } = overdueItemsFn(m.id)
    const soldierCerts = certs.filter(c => c.user_id === m.id)
    const soldierValidCerts = soldierCerts.filter(c => getExpirationStatus(c.exp_date) === 'valid')
    const compliancePercent = soldierCerts.length > 0
      ? Math.round((soldierValidCerts.length / soldierCerts.length) * 100) : 100
    return {
      soldierId: m.id,
      readinessPercent,
      compliancePercent,
      overdueCount: expiredCerts.length + failedTests.length,
    }
  })

  // Team readiness = average of all soldier readiness
  const teamReadinessPercent = medics.length > 0
    ? Math.round(soldierReadiness.reduce((sum, s) => sum + s.readinessPercent, 0) / medics.length)
    : 0

  // Cert compliance = % of certs that are valid (not expired/expiring)
  const allMedicCerts = certs.filter(c => medics.some(m => m.id === c.user_id))
  const validCerts = allMedicCerts.filter(c => getExpirationStatus(c.exp_date) === 'valid')
  const certCompliancePercent = allMedicCerts.length > 0
    ? Math.round((validCerts.length / allMedicCerts.length) * 100) : 100

  // Subject area gaps
  const subjectAreaGaps: SubjectAreaGap[] = []
  for (const areaName of categoryOrder) {
    const tasks = testableTaskMap.get(areaName)
    if (!tasks || tasks.length === 0) continue

    const deficientSoldierIds: string[] = []
    let totalPassed = 0
    const totalPossible = medics.length * tasks.length

    for (const sc of matrix) {
      const area = sc.areas.find(a => a.areaName === areaName)
      if (area) {
        totalPassed += area.passed
        if (area.passed < area.total) {
          deficientSoldierIds.push(sc.soldierId)
        }
      } else {
        deficientSoldierIds.push(sc.soldierId)
      }
    }

    subjectAreaGaps.push({
      areaName,
      coveragePercent: totalPossible > 0 ? Math.round((totalPassed / totalPossible) * 100) : 0,
      deficientSoldierIds,
    })
  }

  // Sort gaps by coverage ascending (worst first)
  subjectAreaGaps.sort((a, b) => a.coveragePercent - b.coveragePercent)

  return {
    totalMedics: medics.length,
    teamReadinessPercent,
    certCompliancePercent,
    soldierReadiness,
    subjectAreaGaps,
    algorithmGaps: buildAlgorithmGaps(medics, tests),
  }
}
