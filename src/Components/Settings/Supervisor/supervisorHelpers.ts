import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { getTaskData, isTaskTestable } from '../../../Data/TrainingData'
import { ictlAreas, isIctlTaskTestable, ICTL_LEVEL_NAME } from '../../../Utilities/ictlEvaluation'
import { ictlAdtmcAlgorithms, ictlAdtmcCategories, hasAdtmcCriteria } from '../../../Utilities/ictlAdtmc'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import type { Certification } from '../../../Data/User'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getExpirationStatus } from '../../Certifications/certHelpers'
import {
  listAllAlgorithms,
  buildAlgorithmCategoryMap,
  ALGO_RUN_TARGET,
} from '../../../Utilities/algorithmStp'
import type { AuditEvent } from '../../../lib/auditTypes'
import {
  ALGO_SYNTH_DIMS,
  algoDimKey,
  algoDimLabel,
  parseAlgoDimKey,
  getEvaluableTaskData,
  synthesizeAlgoTaskData,
  type AlgoSynthDim,
} from '../../../Utilities/algorithmCompetency'

// ─── Encounter Log (algorithm completions) ───────────────────────────────────
// Algorithm "log to calendar" writes a calendar event tagged with
// encounter_algorithm_id (see useAlgorithmMetrics). These helpers roll those
// events up for supervisor surfaces. Operational only — title carries the
// algorithm name, never PHI.

/**
 * True when an event is an algorithm encounter record. Primary signal is the
 * encounter_algorithm_id tag; the `ADTMC ` title prefix is a backward-compat
 * fallback for encounters logged before the tag existed.
 */
export function isEncounterEvent(e: CalendarEvent): boolean {
  return !!e.encounter_algorithm_id || e.title.startsWith('ADTMC ')
}

// The readiness colour scale moved to the FillBar primitive
// (primitives/FillBar.tsx: READINESS_THRESHOLD / readinessBarColor /
// readinessTextColor). It is not supervisor-specific — the self-facing readiness
// surfaces use the same scheme, and keeping a second definition here is what let
// a third copy appear in MyReadinessSection.

// ─── Encounter Roll-up by body-system category (from RAW audit events) ────────
// An algorithm encounter is logged as a `read.recorded` training event keyed by
// the algorithm id (useAlgorithmMetrics.logNow). Each encounter is a DISTINCT
// event, so occurrence totals MUST be counted from the raw event stream — the
// trainingFold collapses repeat reads of the same (user, algorithm) into one row
// and would undercount. STP-task reads share the event type but their
// training_item_id is a task number (not in the algorithm category map) and are
// skipped here. Aggregate counts only — no soldier identity — so this roll-up is
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

// ─── Training activity over time ─────────────────────────────────────────────
// The Training pane's timeline: how much training a scope did, week by week.
//
// TWO SERIES, NEVER ONE TOTAL. `evaluated` is a supervisor's graded walk
// (test.graded); `ran` is the medic's own logged rep (read.recorded). Summing
// them into a single bar would state that a self-reported rep and a supervised
// evaluation are the same evidence, which is the one thing the completion model
// insists they are not (see buildAlgorithmCompetency's Runs/Assessed split).
//
// Counted from the RAW event stream, like the encounter roll-up and for the same
// reason: the fold collapses repeats, so folded rows can say "trained" but never
// "trained twice in March".

export interface TrainingActivityWeek {
  /** Local epoch ms of the week's first day. The bucket key and x anchor.
   *  The axis label is DERIVED from it at render rather than carried: the wire
   *  shape a subordinate cluster publishes (EchelonActivityWeek) is then exactly
   *  this, and its weeks plot with no translation step to get wrong. */
  start: number
  /** Supervisor-graded evaluations recorded in this week. */
  evaluated: number
  /** Reps the medic logged themselves — algorithm runs and task reads. */
  ran: number
}

/** Local midnight on the Sunday that starts this date's week. */
function startOfLocalWeek(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

/**
 * Weekly training activity for a scope, oldest bucket first.
 *
 * `soldierIds` narrows to a subject — the rail's selection — and null means the
 * whole fetched stream. An event is attributed by `subjectId`, the soldier the
 * record is ABOUT, not by the supervisor who filed it: a squad's bar has to
 * count the training its members received.
 *
 * Buckets are dense: a week nobody trained renders as a real zero rather than
 * closing the gap and making a lull look like continuous work.
 */
export function rollupTrainingActivity(
  events: AuditEvent[],
  soldierIds: Set<string> | null,
  weeks = 12,
): TrainingActivityWeek[] {
  const thisWeek = startOfLocalWeek(Date.now())
  const buckets: TrainingActivityWeek[] = []
  const byStart = new Map<number, TrainingActivityWeek>()

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() - i * 7)
    const start = d.getTime()
    const bucket: TrainingActivityWeek = { start, evaluated: 0, ran: 0 }
    buckets.push(bucket)
    byStart.set(start, bucket)
  }

  for (const e of events) {
    if (e.eventType !== 'test.graded' && e.eventType !== 'read.recorded') continue
    if (soldierIds && !soldierIds.has(e.subjectId)) continue
    const bucket = byStart.get(startOfLocalWeek(new Date(e.occurredAt).getTime()))
    if (!bucket) continue
    if (e.eventType === 'test.graded') bucket.evaluated++
    else bucket.ran++
  }

  return buckets
}

// --- Algorithm Completion (composite category) -------------------------------
// Treats an algorithm as a training CATEGORY (like "Medication Management").
// Completion is three components (USR 2026-07-29), every one of them required:
//
//   Runs          - ran it x3. LOGGED ENCOUNTERS, counted from raw events.
//   Assessed      - supervised. Reads the `algo:<id>:run` synthetic test key.
//   Prerequisites - the algorithm's mapped STP tasks, real `test` completions.
//
// An algorithm is scored on the components it HAS: with no mapped STP it has two,
// and is complete at two of two. Never render 2/3 against an authoring gap - the
// denominator is presence-driven, see listAllAlgorithms.
//
// PREREQUISITES IS WHERE THE STP ROSTER NOW LIVES (2026-07-31). The supervisor's
// categories moved to the ICTL, so an STP task is no longer tracked as a
// category of its own; it is tracked as groundwork an algorithm stands on. Same
// completions, same keys, same cascade on evaluate - what changed is that the
// STP is stated as a precondition rather than an end in itself.
//
// Runs and Assessed are the unsupervised/supervised halves and are never
// interchangeable: logging three encounters is self-reported by design.
// (Red flags + differentials left the scored model 2026-07-12 - not GO/NO_GO
// testable; see Utilities/algorithmCompetency ALGO_SYNTH_DIMS.)

export type AlgorithmCompetencyLevel = 'trained' | 'partial' | 'untrained'

export type AlgorithmComponentKind = 'runs' | 'assessed' | 'subtaskings'

export interface AlgorithmComponentScore {
  kind: AlgorithmComponentKind
  label: string
  /** Items satisfied. Runs counts logged encounters, capped at the target. */
  validated: number
  /** Items required. Runs uses ALGO_RUN_TARGET. */
  total: number
  /** True when this component is fully satisfied. */
  met: boolean
  /** True when the component has been exercised at all: a run logged, or a
   *  supervisor `test` recorded whatever its result. Lets the per-soldier drill
   *  separate "not evaluated" from "evaluated all NO_GO". */
  graded: boolean
  /** The individual items behind validated/total, when the component HAS
   *  nameable ones — only Prerequisites does. A drill showing "2/3" tells a
   *  supervisor there is a gap but not which task to schedule, which is the one
   *  thing they opened the drill to find out. */
  items?: AlgorithmComponentItem[]
}

/** One nameable item of a component — today an STP prerequisite task. */
export interface AlgorithmComponentItem {
  id: string
  title: string
  met: boolean
}

export interface AlgorithmCompetency {
  id: string
  name: string
  /** Item-weighted composite across the components present, 0-100. */
  pct: number
  status: AlgorithmCompetencyLevel
  /** Only the components this algorithm has - two or three of them. */
  components: AlgorithmComponentScore[]
  /** Logged runs, UNCAPPED. The components entry is what caps at the target. */
  runCount: number
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
 * Per-algorithm completion for one soldier. Covers EVERY algorithm, not just the
 * ones with mapped STPs, since a zero-link algorithm still has runs + assessed.
 *
 * `runCounts` must come from countAlgorithmRuns over RAW events - the fold
 * collapses repeat reads, so folded completions can say "ran it" but never
 * "ran it x 3". Pass an empty map only where reps are genuinely unavailable;
 * every algorithm then reads 0 runs and none can reach complete.
 *
 * Sorted worst-first (untrained -> partial -> trained, then higher % first) so
 * gaps surface on top, mirroring the Training Competency category ordering.
 */
export function buildAlgorithmCompetency(
  tests: TrainingCompletionUI[],
  runCounts: Map<string, number>,
): AlgorithmCompetency[] {
  const latestByTask = getLatestTestByTask(tests)

  const rows = listAllAlgorithms().map((a): AlgorithmCompetency => {
    const components: AlgorithmComponentScore[] = []

    // Runs - logged encounters. Always present: any algorithm can be logged.
    const runCount = runCounts.get(a.id) ?? 0
    components.push({
      kind: 'runs',
      // "Logged", not "Runs" — the timeline's legend already calls this half
      // Logged, and one thing cannot have two names across two surfaces.
      label: 'Logged',
      validated: Math.min(runCount, ALGO_RUN_TARGET),
      total: ALGO_RUN_TARGET,
      met: runCount >= ALGO_RUN_TARGET,
      graded: runCount > 0,
    })

    // Assessed - the supervised walk of the decision tree. Synthesis falls back
    // to a generic rubric for a treeless algorithm, so this is always present.
    for (const dim of ALGO_SYNTH_DIMS) {
      const data = synthesizeAlgoTaskData(a.id, dim)
      if (!data) continue
      const total = data.gradedSteps?.length ?? 0
      const validated = synthValidated(latestByTask.get(algoDimKey(a.id, dim)), total)
      components.push({
        kind: 'assessed',
        label: 'Assessed',
        validated,
        total,
        met: total > 0 && validated >= total,
        graded: latestByTask.has(algoDimKey(a.id, dim)),
      })
    }

    // Prerequisites - mapped STP tasks. Absent when the algorithm maps to none,
    // or to none that are testable. ABSENT, not vacuously satisfied. Testability
    // here stays on the STP substrate: these are STP numbers, and resolving them
    // against the ICTL would gate them on a roster they were never on.
    const stpKeys = a.taskNumbers.filter(isTaskTestable)
    if (stpKeys.length > 0) {
      const items: AlgorithmComponentItem[] = stpKeys.map((tn) => ({
        id: tn,
        title: getTaskData(tn)?.title ?? tn,
        met: latestByTask.get(tn)?.result === 'GO',
      }))
      const validated = items.filter((i) => i.met).length
      components.push({
        kind: 'subtaskings',
        label: 'Prerequisites',
        validated,
        total: stpKeys.length,
        met: validated >= stpKeys.length,
        graded: stpKeys.some((tn) => latestByTask.has(tn)),
        items,
      })
    }

    const totalItems = components.reduce((s, c) => s + c.total, 0)
    const validItems = components.reduce((s, c) => s + c.validated, 0)
    const pct = totalItems ? Math.round((validItems / totalItems) * 100) : 0
    const status: AlgorithmCompetencyLevel =
      components.every((c) => c.met) ? 'trained' : validItems > 0 ? 'partial' : 'untrained'

    return { id: a.id, name: a.name, pct, status, components, runCount }
  })

  const order: Record<AlgorithmCompetencyLevel, number> = { untrained: 0, partial: 1, trained: 2 }
  return rows.sort(
    (a, b) => order[a.status] - order[b.status] || b.pct - a.pct || a.name.localeCompare(b.name),
  )
}

// ─── Sub-cluster membership ──────────────────────────────────────────────────

/** The leftovers bucket: no sub-cluster, or one that no longer exists. It is a
 *  real scope like any other group — a soldier nobody has placed still has
 *  readiness someone has to answer for. */
export const HQ_SUB_CLUSTER_ID = '__hq__'

/**
 * Members of one sub-cluster. `knownIds` is the live sub-cluster id set; a medic
 * pointing at an id outside it has a stale pointer and falls to HQ, which is the
 * same resolution the rail's tree does when it buckets rows.
 */
export function medicsInSubCluster(
  medics: ClinicMedic[],
  subClusterId: string,
  knownIds: Set<string>,
): ClinicMedic[] {
  if (subClusterId === HQ_SUB_CLUSTER_ID) {
    return medics.filter(m => !m.subClusterId || !knownIds.has(m.subClusterId))
  }
  return medics.filter(m => m.subClusterId === subClusterId)
}

// --- Name Formatting ---------------------------------------------------------

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

/**
 * The same name, for a snake_case roster row rather than a ClinicMedic.
 *
 * Two surfaces had a private `memberName` over ClinicMember and they disagreed:
 * the cluster node delegated here (so "SGT Smith, J."), the child-cluster roster
 * sheet hand-rolled "SGT John Smith". One roster, two spellings of one person.
 * They now share this, and the roster keeps the one thing its copy had that the
 * delegation lacked — the account email as the fallback identity, because a
 * member invited but not yet set up has no name to format.
 */
export function clinicMemberName(m: {
  id: string
  first_name?: string | null
  last_name?: string | null
  middle_initial?: string | null
  rank?: string | null
  credential?: string | null
  avatar_id?: string | null
  email?: string | null
}): string {
  if (!m.first_name && !m.last_name) return m.email || 'Unknown'
  return formatMedicName({
    id: m.id,
    firstName: m.first_name ?? undefined,
    lastName: m.last_name ?? undefined,
    middleInitial: m.middle_initial ?? undefined,
    rank: m.rank ?? undefined,
    credential: m.credential ?? undefined,
    avatarId: m.avatar_id ?? undefined,
  } as ClinicMedic)
}

// ─── Testable Tasks ──────────────────────────────────────────────────────────

export interface FlatTask {
  taskId: string
  title: string
  levelIdx: number
  levelName: string
  areaName: string
}

/**
 * The supervisor's categories, sourced from the approved 68W SL1 ICTL — five
 * subject areas, thirty-two critical tasks, in published order.
 *
 * WHY THE ICTL AND NOT THE STP ROSTER. The two lists were always decoupled and
 * answer different questions. The STP soldier's manual is the content substrate:
 * broad, tiered by skill level, and the thing algorithms hang their prerequisite
 * tasks off. The ICTL is the shorter list a unit's proficiency is actually
 * measured against. A coverage surface exists to answer "is this cluster ready",
 * so it tracks the second list. STP tasks did not disappear — they moved to
 * where they belong, as the prerequisite component of algorithm competency (see
 * buildAlgorithmCompetency), and are no longer a category axis of their own.
 *
 * There is no level axis to flatten here, so every task takes levelIdx 0 and the
 * ICTL badge; ordering inside an area is the published order, not alphabetical.
 */
export function buildTestableTasksByCategory(): Map<string, FlatTask[]> {
  const grouped = new Map<string, FlatTask[]>()

  for (const area of ictlAreas()) {
    const seen = new Set<string>()
    const tasks: FlatTask[] = []
    for (const task of area.tasks) {
      if (seen.has(task.id)) continue
      seen.add(task.id)
      tasks.push({
        taskId: task.id,
        title: task.title,
        levelIdx: 0,
        levelName: ICTL_LEVEL_NAME,
        areaName: area.name,
      })
    }
    grouped.set(area.name, tasks)
  }

  return grouped
}

// ─── Team Insights Types ──────────────────────────────────────────────────

export type CompetencyStatus = 'GO' | 'NO_GO' | 'UNTESTED'

/**
 * The ADTMC steps of one ICTL task, for a single soldier. Present only on the
 * ICTLs whose title names an ADTMC category — see Utilities/ictlAdtmc for why
 * the map is eight entries and not thirteen.
 */
export interface AdtmcCriteria {
  /** The mapped ADTMC categories, for the criteria heading. */
  categories: string[]
  /** One entry per mapped algorithm — these ARE the steps. */
  algorithms: { id: string; name: string; category: string; trained: boolean }[]
  complete: number
  total: number
  /** Every step done. This alone marks the ICTL off. */
  met: boolean
}

export interface TaskCompetency {
  taskId: string
  title: string
  status: CompetencyStatus
  /** Absent for an ICTL graded on its measures alone. */
  adtmc?: AdtmcCriteria
  /** True when `status` is GO because every ADTMC step is done rather than
   *  because a supervisor graded the packet. Lets a surface say WHY it passed —
   *  the two are not interchangeable to anyone auditing a record. */
  metByAdtmc?: boolean
}

export interface SubjectAreaCompetency {
  areaName: string
  tested: number
  passed: number
  total: number
  tasks: TaskCompetency[]
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
  /** Per-algorithm team coverage - algorithms surfaced as a peer of subject-area
   *  gaps in the Coverage Gaps surface. Item-weighted across whichever
   *  completion components each algorithm has (runs / assessed / sub-taskings). */
  algorithmGaps: AlgorithmGap[]
}

export interface SoldierReadinessEntry {
  soldierId: string
  readinessPercent: number
  compliancePercent: number
  overdueCount: number
  /** Cert counts behind compliancePercent. Carried so an arbitrary subset of the
   *  roster can be rolled up cert-weighted (see rollupReadiness) instead of
   *  averaging percentages, which weights a one-cert soldier like a ten-cert one. */
  certTotal: number
  certValid: number
}

/**
 * Roll a subset of soldier entries into the same two numbers computeTeamMetrics
 * produces for the whole clinic, by the SAME definitions: readiness is the mean
 * of per-soldier readiness, compliance is valid certs over all certs. Use this
 * wherever a group (sub-cluster, subordinate cluster) needs its own pair —
 * running computeTeamMetrics per group would re-fold the competency matrix for
 * every render of every row.
 */
export function rollupReadiness(
  entries: SoldierReadinessEntry[],
): { readinessPercent: number; compliancePercent: number } {
  if (entries.length === 0) return { readinessPercent: 0, compliancePercent: 100 }
  const readinessPercent = Math.round(
    entries.reduce((s, e) => s + e.readinessPercent, 0) / entries.length,
  )
  const certTotal = entries.reduce((s, e) => s + e.certTotal, 0)
  const certValid = entries.reduce((s, e) => s + e.certValid, 0)
  return {
    readinessPercent,
    compliancePercent: certTotal > 0 ? Math.round((certValid / certTotal) * 100) : 100,
  }
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

// ─── Team Insights Pure Functions ─────────────────────────────────────────

/** Wraps buildTestableTasksByCategory but filters to tasks with graded measures.
 *  An area whose every task is unauthored drops out rather than rendering an
 *  empty category — a readiness denominator of zero is not a gap, it is an
 *  authoring hole, and scoring against it would read as 0% forever. */
export function buildTestableTaskMap(): Map<string, FlatTask[]> {
  const all = buildTestableTasksByCategory()
  const filtered = new Map<string, FlatTask[]>()
  for (const [area, tasks] of all) {
    const testable = tasks.filter(t => isIctlTaskTestable(t.taskId))
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

// ─── Records (the audit-backed read / evaluate / assign rows) ────────────────

/**
 * One folded completion, carrying the soldier it belongs to.
 *
 * A record is a FOLD row, not a raw event, and that is the whole reason these
 * are editable at all: the fold keeps at most one row per (soldier, item, type)
 * and takes the latest, so re-grading or re-assigning replaces what the
 * supervisor is looking at instead of stacking a second row beside it. The raw
 * events behind it stay append-only — the history is intact, it is just not what
 * this list is a list of.
 */
export interface TaskRecord {
  completion: TrainingCompletionUI
  soldier: ClinicMedic
}

/** Ordering within a record list: newest first, an open assignment always on top
 *  — it is the only row that is still owed, so it is the only one you can act on
 *  before the fact rather than after it. */
function recordSort(a: TaskRecord, b: TaskRecord): number {
  const openA = a.completion.completionType === 'assignment' && !a.completion.completedAt
  const openB = b.completion.completionType === 'assignment' && !b.completion.completedAt
  if (openA !== openB) return openA ? -1 : 1
  return b.completion.updatedAt.localeCompare(a.completion.updatedAt)
}

/**
 * Every record held against one training item, across a roster.
 *
 * `itemIds` rather than a single id because an ALGORITHM is not one item: a
 * logged run is recorded against the bare algorithm id and a supervisor's
 * assessment against the synthetic `algo:<id>:<dim>` key, so a drill on A-1 has
 * to ask for both or half its records are invisible. See algoDimKey.
 */
export function collectTaskRecords(
  medics: ClinicMedic[],
  itemIds: Set<string>,
  completionsFor: (userId: string) => TrainingCompletionUI[],
): TaskRecord[] {
  const out: TaskRecord[] = []
  for (const soldier of medics) {
    for (const completion of completionsFor(soldier.id)) {
      if (itemIds.has(completion.trainingItemId)) out.push({ completion, soldier })
    }
  }
  return out.sort(recordSort)
}

/**
 * The training item ids an algorithm's records can be filed under: the bare id
 * (logged runs) plus one synthetic key per dimension.
 *
 * EVERY dimension, not ALGO_SYNTH_DIMS. That list is what is scored TODAY —
 * `run` alone since red flags and differentials were ruled not GO/NO_GO testable
 * — but a grade written before that ruling is still on file, and a record list
 * scoped to the scoring list would render it invisible and therefore
 * undeletable. What can be corrected has to be what exists, not what is current.
 */
const ALL_ALGO_DIMS: readonly AlgoSynthDim[] = ['run', 'redflags', 'ddx']

export function algorithmRecordIds(algorithmId: string): Set<string> {
  return new Set([algorithmId, ...ALL_ALGO_DIMS.map(d => algoDimKey(algorithmId, d))])
}

/** What a record's training item is CALLED. Synthetic algorithm keys resolve to
 *  their dimension label rather than the raw `algo:A-1:run` string, which is an
 *  id and reads like one. */
export function recordItemLabel(trainingItemId: string): string {
  const synth = parseAlgoDimKey(trainingItemId)
  if (synth) return `${synth.algorithmId} · ${algoDimLabel(synth.dim)}`
  return getEvaluableTaskData(trainingItemId)?.title ?? trainingItemId
}

/**
 * The ADTMC steps of one ICTL for one soldier. `trainedAlgorithmIds` is the set
 * of algorithms that soldier has fully completed (buildAlgorithmCompetency
 * status 'trained'). Returns undefined for an ICTL with no mapped categories.
 */
export function buildAdtmcCriteria(
  taskId: string,
  trainedAlgorithmIds: Set<string>,
): AdtmcCriteria | undefined {
  if (!hasAdtmcCriteria(taskId)) return undefined
  const algorithms = ictlAdtmcAlgorithms(taskId).map(a => ({
    id: a.id,
    name: a.name,
    category: a.category,
    trained: trainedAlgorithmIds.has(a.id),
  }))
  const complete = algorithms.filter(a => a.trained).length
  return {
    categories: ictlAdtmcCategories(taskId),
    algorithms,
    complete,
    total: algorithms.length,
    // A mapped ICTL whose categories somehow resolve to no algorithms must NOT
    // read as met — that is an empty denominator, not a finished checklist.
    met: algorithms.length > 0 && complete === algorithms.length,
  }
}

/**
 * ONE soldier's standing on ONE ICTL — the single definition of how an ICTL
 * passes. Both the readiness matrix and the coverage surface call this; a second
 * hand-rolled copy of the rule is how the roster bar and the personnel list start
 * disagreeing about whether a soldier holds a task.
 *
 * ADTMC is checked FIRST so a soldier who has since cleared every mapped
 * algorithm is not held at NO_GO by one stale failed evaluation of the packet.
 */
export function resolveIctlStatus(
  taskId: string,
  latestByTask: Map<string, TrainingCompletionUI>,
  trainedAlgorithmIds: Set<string>,
): { status: CompetencyStatus; adtmc?: AdtmcCriteria; metByAdtmc: boolean } {
  const adtmc = buildAdtmcCriteria(taskId, trainedAlgorithmIds)
  if (adtmc?.met) return { status: 'GO', adtmc, metByAdtmc: true }
  const latest = latestByTask.get(taskId)
  if (!latest) return { status: 'UNTESTED', adtmc, metByAdtmc: false }
  return { status: latest.result === 'GO' ? 'GO' : 'NO_GO', adtmc, metByAdtmc: false }
}

/**
 * Build competency data for a single soldier.
 *
 * TWO WAYS AN ICTL PASSES, and they are peers rather than one being a fallback:
 * a supervisor grades the packet's measures GO, OR the soldier completes every
 * ADTMC algorithm the task maps to. The second is not a shortcut — for a
 * complaint-shaped ICTL, applying the algorithms IS the task, so clearing all of
 * them is a demonstration of the same competency by a different route (USR
 * 2026-07-31: "ADTMC completion counts for a step in the ICTL").
 *
 * `trainedAlgorithmIds` may be empty, and then only the graded-measures path can
 * pass anything — which is exactly the behaviour every caller had before ADTMC
 * criteria existed.
 */
export function buildSoldierCompetency(
  soldierId: string,
  soldierTests: TrainingCompletionUI[],
  testableTaskMap: Map<string, FlatTask[]>,
  trainedAlgorithmIds: Set<string> = new Set(),
): SoldierCompetency {
  const latestByTask = getLatestTestByTask(soldierTests)
  const areas: SubjectAreaCompetency[] = []
  let overallPassed = 0
  let overallTested = 0
  let overallTotal = 0

  // Iterate the map, not a hardcoded order — the map IS the roster's order, and
  // a constant list would silently drop any area the roster gains.
  for (const [areaName, tasks] of testableTaskMap) {
    if (tasks.length === 0) continue

    let areaTested = 0
    let areaPassed = 0
    const taskStatuses: TaskCompetency[] = []

    for (const task of tasks) {
      const { status, adtmc, metByAdtmc } = resolveIctlStatus(
        task.taskId,
        latestByTask,
        trainedAlgorithmIds,
      )

      // An ADTMC pass counts as TESTED as well as passed: every step of it was a
      // supervised algorithm evaluation, so it is graded evidence, not an
      // assumption about an ungraded soldier.
      if (status !== 'UNTESTED') areaTested++
      if (status === 'GO') areaPassed++

      taskStatuses.push({
        taskId: task.taskId,
        title: task.title,
        status,
        ...(adtmc ? { adtmc } : {}),
        ...(metByAdtmc ? { metByAdtmc } : {}),
      })
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

/**
 * Build the full competency matrix for all soldiers.
 *
 * `runCountsFor` is what makes the ADTMC criteria computable: an algorithm's
 * completion needs its logged-run count, so without it every algorithm reads
 * untrained and no ICTL could ever pass by that route. Omit it only where reps
 * are genuinely unavailable, and accept that ICTLs then pass on graded measures
 * alone.
 */
export function buildCompetencyMatrix(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  testableTaskMap: Map<string, FlatTask[]>,
  runCountsFor?: (userId: string) => Map<string, number>,
): SoldierCompetency[] {
  const testsByUser = new Map<string, TrainingCompletionUI[]>()
  for (const t of tests) {
    if (t.completionType !== 'test') continue
    const arr = testsByUser.get(t.userId) ?? []
    arr.push(t)
    testsByUser.set(t.userId, arr)
  }

  return medics.map(m => {
    const own = testsByUser.get(m.id) ?? []
    const trained = runCountsFor
      ? new Set(
          buildAlgorithmCompetency(own, runCountsFor(m.id))
            .filter(a => a.status === 'trained')
            .map(a => a.id),
        )
      : new Set<string>()
    return buildSoldierCompetency(m.id, own, testableTaskMap, trained)
  })
}

export interface IctlCategoryRow {
  areaName: string
  /** ICTLs held, summed over the scope's soldiers. */
  passed: number
  /** ICTLs on the roster times the headcount — the scope's denominator. */
  total: number
  pct: number
}

/**
 * ICTL completion by category for a SCOPE — one soldier, a sub-cluster, or the
 * whole roster. The Training pane's rows.
 *
 * It takes a competency matrix rather than a roster because the matrix is
 * already scope-independent: one row per soldier, computed once, sliced by
 * whoever the rail is pointed at. Handing it a single-element slice is what
 * makes the soldier view the same rows as the cluster view with a different
 * denominator, which is the whole rule — a scope changes the numbers on a row,
 * never where the row goes.
 *
 * Order is the ICTL's published order (the map's), NOT worst-first. These rows
 * are a roster you scan repeatedly, and a list that resorts itself every time a
 * number moves cannot be scanned by position. The gap surface that DID sort
 * worst-first was a different question.
 */
export function buildIctlCategoryRows(
  matrix: SoldierCompetency[],
  testableTaskMap: Map<string, FlatTask[]>,
): IctlCategoryRow[] {
  const rows: IctlCategoryRow[] = []
  for (const [areaName, tasks] of testableTaskMap) {
    if (tasks.length === 0) continue
    let passed = 0
    for (const sc of matrix) {
      const area = sc.areas.find(a => a.areaName === areaName)
      if (area) passed += area.passed
    }
    const total = matrix.length * tasks.length
    rows.push({
      areaName,
      passed,
      total,
      pct: total > 0 ? Math.round((passed / total) * 100) : 0,
    })
  }
  return rows
}

/**
 * Per-algorithm team coverage. Runs the per-soldier composite competency for
 * each medic and aggregates item-weighted across the team (sum of validated
 * dimension items / sum of total dimension items), mirroring how subject-area
 * gaps aggregate STP passes. A soldier is "deficient" until fully trained.
 */
export function buildAlgorithmGaps(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  runCountsFor: (userId: string) => Map<string, number>,
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
    const comps = buildAlgorithmCompetency(testsByUser.get(m.id) ?? [], runCountsFor(m.id))
    for (const c of comps) {
      const entry = agg.get(c.id) ?? { name: c.name, validated: 0, total: 0, deficient: [] }
      for (const d of c.components) {
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

/**
 * Compute aggregate team metrics.
 *
 * `prebuiltMatrix` is the SAME matrix sliced to `medics`. A matrix row is
 * scope-independent, so a host that already holds one for the whole roster
 * passes a slice instead of paying for a second fold per sub-cluster it renders.
 * Omit it and the matrix is built here, exactly as before.
 */
export function computeTeamMetrics(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  certs: Certification[],
  testableTaskMap: Map<string, FlatTask[]>,
  overdueItemsFn: (userId: string) => { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] },
  runCountsFor: (userId: string) => Map<string, number>,
  prebuiltMatrix?: SoldierCompetency[],
): TeamMetrics {
  // Per-soldier readiness + compliance
  const matrix = prebuiltMatrix ?? buildCompetencyMatrix(medics, tests, testableTaskMap, runCountsFor)
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
      certTotal: soldierCerts.length,
      certValid: soldierValidCerts.length,
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
  for (const [areaName, tasks] of testableTaskMap) {
    if (tasks.length === 0) continue

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
    algorithmGaps: buildAlgorithmGaps(medics, tests, runCountsFor),
  }
}
