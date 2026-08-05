import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useClinicMedics } from '../../../Hooks/useClinicMedics'
import { useAuth } from '../../../Hooks/useAuth'
import { fetchClinicCertifications } from '../../../lib/certificationService'
import { enrichCalendarLinks, type TrainingCompletionUI } from '../../../lib/trainingService'
import { loadAuditByClinicDomain } from '../../../lib/auditService'
import { countAlgorithmRuns } from '../../../Utilities/algorithmStp'
import { foldTrainingState, liveTrainingEvents } from '../../../lib/trainingFold'
import { createLogger } from '../../../Utilities/Logger'
import {
  formatMedicName,
  buildTestableTaskMap,
  buildCompetencyMatrix,
  computeTeamMetrics,
  rollupEncounterReads,
  type FlatTask,
  type TeamMetrics,
  type SoldierCompetency,
  type EncounterRollup,
} from './supervisorHelpers'
import { getExpirationStatus } from '../../Certifications/certHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'
import type { AuditEvent } from '../../../lib/auditTypes'

const logger = createLogger('useSupervisorData')

export interface SupervisorData {
  /** True while initial auth + data fetch is in progress */
  loading: boolean
  /** True if the user has the supervisor role */
  isSupervisor: boolean
  /** Current user's Supabase UID */
  currentUserId: string | null
  /** Clinic display name */
  clinicName: string | null
  /** Current user's profile as a ClinicMedic (for name resolution) */
  currentUserProfile: ClinicMedic | null
  /** Clinic medics (excluding self — self is in currentUserProfile) */
  medics: ClinicMedic[]
  /** All certifications for clinic members */
  certs: Certification[]
  /** All test history for clinic members */
  tests: TrainingCompletionUI[]
  /** Get certifications for a specific soldier */
  certsForSoldier: (userId: string) => Certification[]
  /** Get test history for a specific soldier */
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
  /** Get `read` completions for a soldier — includes algorithm-id reads (a medic
   *  running/reading an algorithm, via useAlgorithmMetrics.logNow) and STP reads. */
  readsForSoldier: (userId: string) => TrainingCompletionUI[]
  /** Logged-run counts per algorithm for one soldier, from the RAW event
   *  stream. Distinct from readsForSoldier, whose folded rows collapse repeat
   *  reads and so can only ever say "ran it", never "ran it x 3". */
  runCountsForSoldier: (userId: string) => Map<string, number>
  /** Get assignments for a specific soldier */
  assignmentsForSoldier: (userId: string) => TrainingCompletionUI[]
  /** Get overdue items: expired/expiring certs + NO_GO tests */
  overdueItems: (userId: string) => { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] }
  /** Resolve a userId to a display name */
  resolveName: (id: string | null) => string
  /** Update a cert in local state (after verify/unverify) */
  updateCert: (certId: string, updates: Partial<Certification>) => void
  /** Remove a test from local state (after delete) */
  removeTest: (testId: string) => void
  /** Add a cert to local state (after server insert) */
  addCert: (cert: Certification) => void
  /** Remove a cert from local state (after server delete) */
  removeCert: (certId: string) => void
  /** Add an assignment to local state (optimistic after assign) */
  addAssignment: (assignment: TrainingCompletionUI) => void
  /** Refresh certs + tests from server */
  refreshData: () => void
  /** Aggregate team metrics */
  teamMetrics: TeamMetrics
  /** teamMetrics recomputed over a subset of the roster (sub-cluster scope) */
  metricsFor: (subset: ClinicMedic[]) => TeamMetrics
  /** One ICTL competency row per medic. Scope-INDEPENDENT — the rail's subject
   *  is a slice of this, not a separate fold, so the cluster rows and a soldier's
   *  rows cannot drift apart. */
  competencyMatrix: SoldierCompetency[]
  /** RAW, unfolded training events, MINUS anything a completion.voided tombstone
   *  retired. Anything counting OCCURRENCES rather than state reads these: the
   *  fold collapses repeats (see rollupEncounterReads, rollupTrainingActivity),
   *  and a deleted record must not keep counting on the surfaces that never
   *  see the fold. */
  trainingEvents: AuditEvent[]
  /** Clinic-wide algorithm-encounter roll-up by body-system category (occurrence
   *  counts from the raw event stream, not the fold). */
  encounterRollup: EncounterRollup
  /** Map of subject area -> testable tasks (only tasks with gradedSteps) */
  testableTaskMap: Map<string, FlatTask[]>
}

export function useSupervisorData(): SupervisorData {
  const [certs, setCerts] = useState<Certification[]>([])
  const [tests, setTests] = useState<TrainingCompletionUI[]>([])
  const [reads, setReads] = useState<TrainingCompletionUI[]>([])
  const [assignments, setAssignments] = useState<TrainingCompletionUI[]>([])
  // Raw (unfolded, void-filtered) training events — kept so the encounter
  // roll-up can count every occurrence (the fold collapses repeats).
  // See rollupEncounterReads.
  const [trainingEvents, setTrainingEvents] = useState<AuditEvent[]>([])

  const { medics: allLocationMedics, loading: medicsLoading } = useClinicMedics()
  const { user, clinicId: userClinicId, supervisingClinicId, isSupervisorRole, roles: authRoles, profile: authProfile, loading: authLoading } = useAuth()
  // Roster pivots around the supervisor's active clinic context (toggle).
  // Single-clinic users always see their assigned clinic.
  const rosterClinicId = supervisingClinicId ?? userClinicId

  // Derive auth state from the reactive auth store (no separate Supabase call).
  // authLoading clears on INITIAL_SESSION before refreshProfile() resolves,
  // so we also wait for clinicId to populate (set by refreshProfile) to avoid
  // showing all-location medics before the supervisor's own clinic is known.
  const currentUserId = user?.id ?? null
  const isSupervisor = isSupervisorRole
  // Name must follow the toggle, not stay pinned to the home clinic. When
  // operating-as a loaned clinic, resolve its name from the loan pairs
  // (profile.surrogateClinics); home context falls back to profile.clinicName.
  const clinicName = supervisingClinicId && supervisingClinicId !== userClinicId
    ? (authProfile.surrogateClinics?.find(c => c.id === supervisingClinicId)?.name
        ?? authProfile.clinicName ?? null)
    : (authProfile.clinicName ?? null)
  const loading = authLoading || (!!user && !userClinicId)

  const currentUserProfile = useMemo<ClinicMedic | null>(() => {
    if (!user) return null
    return {
      id: user.id,
      firstName: authProfile.firstName ?? null,
      lastName: authProfile.lastName ?? null,
      middleInitial: authProfile.middleInitial ?? null,
      rank: authProfile.rank ?? null,
      credential: authProfile.credential ?? null,
      avatarId: null,
      // Carried so self is testable by isTrainingExempt like anyone off the
      // roster RPC — the roster shape is the same shape either way.
      roles: authRoles,
    }
  }, [user, authProfile.firstName, authProfile.lastName, authProfile.middleInitial, authProfile.rank, authProfile.credential, authRoles])

  // Roster scope: medics whose assigned OR surrogate clinic matches the
  // supervisor's currently-active clinic context (assigned by default,
  // surrogate when toggled). Excludes self (shown separately).
  const medics = useMemo(() => {
    const base = !rosterClinicId
      ? allLocationMedics
      : allLocationMedics.filter(m =>
          !m.clinicId
          || m.clinicId === rosterClinicId
          || m.surrogateClinicId === rosterClinicId
        )
    return currentUserId ? base.filter(m => m.id !== currentUserId) : base
  }, [allLocationMedics, rosterClinicId, currentUserId])

  // All clinic users including self for name resolution
  const allClinicUsers = useMemo(() => {
    if (!currentUserProfile) return medics
    return [...medics, currentUserProfile]
  }, [medics, currentUserProfile])

  // Name map for resolution
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of allClinicUsers) {
      map.set(u.id, formatMedicName(u))
    }
    return map
  }, [allClinicUsers])

  const resolveName = useCallback((id: string | null) => {
    if (!id) return 'Unknown'
    return nameMap.get(id) ?? id
  }, [nameMap])

  // Fetch certs + tests once medics are loaded
  const fetchCertsAndTests = useCallback(async () => {
    if (medics.length === 0 || !currentUserId) return

    const clinicUserIds = medics.map(u => u.id)
    const allIds = [...clinicUserIds, currentUserId]
    const foldClinicId = supervisingClinicId ?? userClinicId

    try {
      // Tests + assignments come from the audit_log event fold (clinic-scoped).
      // training_completions is retired here — the fold covers it, including a
      // loaned-in soldier's work graded in THIS clinic (those events carry this
      // clinic's id and are decryptable; their home-clinic events are not, by
      // design). Certs are not event-sourced yet, so they still fetch directly.
      //
      // Local-first: refreshData() runs the instant a grade is submitted, and
      // that grade is still a pending IDB row for up to one sync tick. Reading
      // the server alone returned the pre-grade world and the walk vanished.
      const [certsData, rawEvents] = await Promise.all([
        fetchClinicCertifications(allIds),
        foldClinicId
          ? loadAuditByClinicDomain(foldClinicId, 'training')
          : Promise.resolve([] as AuditEvent[]),
      ])
      const folded = await enrichCalendarLinks(foldTrainingState(rawEvents))
      setCerts(certsData)
      // Voided events are dropped HERE, once, rather than in each roll-up: the
      // fold reads the tombstones (so it takes the raw set), everything counting
      // occurrences must not (see liveTrainingEvents).
      setTrainingEvents(liveTrainingEvents(rawEvents))
      setTests(folded.filter((c) => c.completionType === 'test'))
      setReads(folded.filter((c) => c.completionType === 'read'))
      setAssignments(folded.filter((c) => c.completionType === 'assignment'))
    } catch (err) {
      logger.error('Failed to fetch certs/tests:', err)
    }
  }, [medics, currentUserId, userClinicId, supervisingClinicId])

  useEffect(() => {
    if (!medicsLoading && currentUserId) {
      fetchCertsAndTests()
    }
  }, [medicsLoading, currentUserId, fetchCertsAndTests])

  // Derived helpers
  const certsForSoldier = useCallback((userId: string) => {
    return certs.filter(c => c.user_id === userId)
  }, [certs])

  const testsForSoldier = useCallback((userId: string) => {
    return tests.filter(t => t.userId === userId)
  }, [tests])

  const readsForSoldier = useCallback((userId: string) => {
    return reads.filter(r => r.userId === userId)
  }, [reads])

  const runCountsForSoldier = useCallback((userId: string) => {
    return countAlgorithmRuns(trainingEvents, userId)
  }, [trainingEvents])

  const assignmentsForSoldier = useCallback((userId: string) => {
    return assignments.filter(a => a.userId === userId)
  }, [assignments])

  const overdueItems = useCallback((userId: string) => {
    const userCerts = certs.filter(c => c.user_id === userId)
    const expiredCerts = userCerts.filter(c => {
      const status = getExpirationStatus(c.exp_date)
      return status === 'expired' || status === 'expiring'
    })
    const failedTests = tests.filter(t => t.userId === userId && t.result === 'NO_GO')
    return { expiredCerts, failedTests }
  }, [certs, tests])

  // Local state mutators (avoid re-fetching after verify/unverify/delete)
  const updateCert = useCallback((certId: string, updates: Partial<Certification>) => {
    setCerts(prev => prev.map(c => c.id === certId ? { ...c, ...updates } : c))
  }, [])

  const removeTest = useCallback((testId: string) => {
    setTests(prev => prev.filter(t => t.id !== testId))
  }, [])

  const addCert = useCallback((cert: Certification) => {
    setCerts(prev => [cert, ...prev])
  }, [])

  const removeCert = useCallback((certId: string) => {
    setCerts(prev => prev.filter(c => c.id !== certId))
  }, [])

  const addAssignment = useCallback((assignment: TrainingCompletionUI) => {
    setAssignments(prev => [assignment, ...prev])
  }, [])

  // ─── Team Insights Computations ──────────────────────────────────────
  const testableTaskMapRef = useRef<Map<string, FlatTask[]> | null>(null)
  if (!testableTaskMapRef.current) {
    testableTaskMapRef.current = buildTestableTaskMap()
  }
  const testableTaskMap = testableTaskMapRef.current

  /** Folded ONCE for the whole roster. Every scoped surface slices this instead
   *  of re-folding: a matrix row is per-soldier and says nothing about who else
   *  is in scope, so a sub-cluster's rows are literally the cluster's rows. */
  const competencyMatrix = useMemo(
    () => buildCompetencyMatrix(medics, tests, testableTaskMap, runCountsForSoldier),
    [medics, tests, testableTaskMap, runCountsForSoldier]
  )

  const teamMetrics = useMemo(
    () => computeTeamMetrics(medics, tests, certs, testableTaskMap, overdueItems, runCountsForSoldier, competencyMatrix),
    [medics, tests, certs, testableTaskMap, overdueItems, runCountsForSoldier, competencyMatrix]
  )

  /** The same rollup over an arbitrary subset — the supervisor rail scopes the
   *  center pane to a sub-cluster, which needs its own coverage numbers rather
   *  than the clinic-wide ones. */
  const metricsFor = useCallback(
    (subset: ClinicMedic[]) => {
      const ids = new Set(subset.map(m => m.id))
      return computeTeamMetrics(
        subset, tests, certs, testableTaskMap, overdueItems, runCountsForSoldier,
        competencyMatrix.filter(s => ids.has(s.soldierId)),
      )
    },
    [tests, certs, testableTaskMap, overdueItems, runCountsForSoldier, competencyMatrix]
  )

  const encounterRollup = useMemo(
    () => rollupEncounterReads(trainingEvents),
    [trainingEvents]
  )

  return {
    loading: loading || medicsLoading,
    isSupervisor,
    currentUserId,
    clinicName,
    currentUserProfile,
    medics,
    certs,
    tests,
    certsForSoldier,
    testsForSoldier,
    readsForSoldier,
    runCountsForSoldier,
    assignmentsForSoldier,
    overdueItems,
    resolveName,
    updateCert,
    removeTest,
    addCert,
    removeCert,
    addAssignment,
    refreshData: fetchCertsAndTests,
    teamMetrics,
    metricsFor,
    competencyMatrix,
    trainingEvents,
    encounterRollup,
    testableTaskMap,
  }
}
