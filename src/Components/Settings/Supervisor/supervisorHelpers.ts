import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { stp68wTraining } from '../../../Data/TrainingTaskList'
import { categoryOrder } from '../../../Data/TrainingConstants'
import { isTaskTestable } from '../../../Data/TrainingData'
import type { TrainingCompletionUI } from '../../../lib/trainingService'
import type { Certification } from '../../../Data/User'
import { getExpirationStatus } from '../../Certifications/certHelpers'

// ─── Name Formatting ─────────────────────────────────────────────────────────

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

// ─── Testable Tasks ──────────────────────────────────────────────────────────

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

// ─── Team Insights Types ──────────────────────────────────────────────────

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
  evaluationsThisPeriod: number
  evaluationsLastPeriod: number
  soldierReadiness: SoldierReadinessEntry[]
  subjectAreaGaps: SubjectAreaGap[]
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

export interface TrendBucket {
  label: string
  periodStart: string
  totalEvaluations: number
  passCount: number
  failCount: number
  passRate: number
}

export type TrendPeriod = '30d' | '60d' | '90d' | 'all'

// ─── Team Insights Pure Functions ─────────────────────────────────────────

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

/** Compute aggregate team metrics. */
export function computeTeamMetrics(
  medics: ClinicMedic[],
  tests: TrainingCompletionUI[],
  certs: Certification[],
  testableTaskMap: Map<string, FlatTask[]>,
  overdueItemsFn: (userId: string) => { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] }
): TeamMetrics {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Only test completions
  const testCompletions = tests.filter(t => t.completionType === 'test')

  // Evaluations this period (last 30d) and last period (30-60d)
  const evaluationsThisPeriod = testCompletions.filter(
    t => new Date(t.updatedAt) >= thirtyDaysAgo
  ).length
  const evaluationsLastPeriod = testCompletions.filter(
    t => {
      const d = new Date(t.updatedAt)
      return d >= sixtyDaysAgo && d < thirtyDaysAgo
    }
  ).length

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
    evaluationsThisPeriod,
    evaluationsLastPeriod,
    soldierReadiness,
    subjectAreaGaps,
  }
}

/** Compute trend buckets for charting. */
export function computeTrends(
  tests: TrainingCompletionUI[],
  period: TrendPeriod,
  groupBy: 'week' | 'month',
  soldierId?: string
): TrendBucket[] {
  const now = new Date()
  let cutoff: Date | null = null
  if (period === '30d') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  else if (period === '60d') cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  else if (period === '90d') cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Filter to test completions, optionally by soldier, optionally by date
  let filtered = tests.filter(t => t.completionType === 'test')
  if (soldierId) filtered = filtered.filter(t => t.userId === soldierId)
  if (cutoff) filtered = filtered.filter(t => new Date(t.updatedAt) >= cutoff)

  if (filtered.length === 0) return []

  // Group into buckets
  const buckets = new Map<string, { label: string; periodStart: string; pass: number; fail: number }>()

  for (const t of filtered) {
    const d = new Date(t.updatedAt)
    let key: string
    let label: string
    let periodStart: string

    if (groupBy === 'week') {
      // Week start = Monday
      const day = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((day + 6) % 7))
      key = monday.toISOString().slice(0, 10)
      periodStart = key
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      label = `${monthNames[monday.getMonth()]} ${monday.getDate()}`
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      periodStart = `${key}-01`
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
    }

    if (!buckets.has(key)) {
      buckets.set(key, { label, periodStart, pass: 0, fail: 0 })
    }
    const bucket = buckets.get(key)!
    if (t.result === 'GO') bucket.pass++
    else bucket.fail++
  }

  // Sort by periodStart ascending
  const sorted = [...buckets.entries()].sort((a, b) => a[1].periodStart.localeCompare(b[1].periodStart))

  return sorted.map(([, b]) => ({
    label: b.label,
    periodStart: b.periodStart,
    totalEvaluations: b.pass + b.fail,
    passCount: b.pass,
    failCount: b.fail,
    passRate: (b.pass + b.fail) > 0 ? Math.round((b.pass / (b.pass + b.fail)) * 100) : 0,
  }))
}
