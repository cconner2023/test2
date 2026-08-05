import { useMemo } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useTrainingCompletions } from './useTrainingCompletions'
import {
  buildTestableTaskMap,
  buildSoldierCompetency,
  buildAlgorithmCompetency,
} from '../Components/Settings/Supervisor/supervisorHelpers'
import { getExpirationStatus } from '../Components/Certifications/certHelpers'
import type { Certification } from '../Data/User'
import type { TrainingCompletionUI } from '../lib/trainingService'

/**
 * The current user's own readiness, derived with the SAME pure helpers the
 * supervisor runs over a subordinate — so a medic's numbers and their team
 * lead's numbers cannot disagree.
 *
 * WHY IT IS A HOOK AND NOT LOCAL TO MyReadinessSection: two surfaces show these
 * numbers now — the Readiness section in the profile, and the pinned card at the
 * top of the desktop settings rail (the structural twin of the supervisor rail's
 * SubjectCard). A second hand-rolled copy of the derivation is exactly how the
 * self view and the supervisor view drift apart.
 *
 * CERTS ARE AN ARGUMENT, NOT AN INTERNAL FETCH. Compliance needs them, but
 * ProfilePage already owns a live cert list (it edits them), so fetching a second
 * copy in here would make a freshly added cert move one surface and not the
 * other. The caller passes whichever list it owns.
 */
export interface SelfReadiness {
  readinessPercent: number
  compliancePercent: number
  /** Open + completed training assignments (not the graded tests). */
  assignments: TrainingCompletionUI[]
  /** The medic ICTL roster does not apply to this user — see isTrainingExempt.
   *  readinessPercent stays computed; surfaces hide it rather than show a figure
   *  measured against a standard the user is not held to. */
  exempt: boolean
}

export function useSelfReadiness(certs: Certification[]): SelfReadiness {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const exempt = useAuthStore(s => s.isProviderRole)
  const { completions, algorithmRunCounts } = useTrainingCompletions()

  const tests = useMemo(
    () => completions.filter((c: TrainingCompletionUI) => c.completionType === 'test'),
    [completions],
  )
  const assignments = useMemo(
    () => completions.filter((c: TrainingCompletionUI) => c.completionType === 'assignment'),
    [completions],
  )

  const testableTaskMap = useMemo(() => buildTestableTaskMap(), [])

  const algorithmCompetency = useMemo(
    () => buildAlgorithmCompetency(tests, algorithmRunCounts),
    [tests, algorithmRunCounts],
  )

  // Feeds the ADTMC criteria: an ICTL the user has cleared every mapped
  // algorithm for is marked off, the same as it would be for their team lead.
  const trainedAlgorithmIds = useMemo(
    () => new Set(algorithmCompetency.filter(a => a.status === 'trained').map(a => a.id)),
    [algorithmCompetency],
  )

  const soldierComp = useMemo(
    () => buildSoldierCompetency(userId ?? '', tests, testableTaskMap, trainedAlgorithmIds),
    [userId, tests, testableTaskMap, trainedAlgorithmIds],
  )
  const readinessPercent = soldierComp.overallTotal > 0
    ? Math.round((soldierComp.overallPassed / soldierComp.overallTotal) * 100)
    : 0

  // No certs on file reads as compliant, not as a 0% failure — a medic who has
  // not entered any is not out of date, they are unenrolled.
  const compliancePercent = certs.length > 0
    ? Math.round((certs.filter(c => getExpirationStatus(c.exp_date) === 'valid').length / certs.length) * 100)
    : 100

  return {
    readinessPercent,
    compliancePercent,
    assignments,
    exempt,
  }
}
