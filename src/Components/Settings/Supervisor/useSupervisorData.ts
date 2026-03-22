import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useClinicMedics } from '../../../Hooks/useClinicMedics'
import { useAuth } from '../../../Hooks/useAuth'
import { fetchClinicCertifications } from '../../../lib/certificationService'
import { fetchClinicTestHistory, fetchClinicAssignments, type TrainingCompletionUI } from '../../../lib/trainingService'
import { createLogger } from '../../../Utilities/Logger'
import {
  formatMedicName,
  getExpirationStatus,
  buildTestableTaskMap,
  buildCompetencyMatrix,
  computeTeamMetrics,
  type FlatTask,
  type SoldierCompetency,
  type TeamMetrics,
} from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

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
  /** Clinic medics (excluding the current user) */
  medics: ClinicMedic[]
  /** All clinic users including self (for name resolution) */
  allClinicUsers: ClinicMedic[]
  /** All certifications for clinic members */
  certs: Certification[]
  /** All test history for clinic members */
  tests: TrainingCompletionUI[]
  /** Get certifications for a specific soldier */
  certsForSoldier: (userId: string) => Certification[]
  /** Get test history for a specific soldier */
  testsForSoldier: (userId: string) => TrainingCompletionUI[]
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
  /** Competency matrix for all soldiers */
  competencyMatrix: SoldierCompetency[]
  /** Aggregate team metrics */
  teamMetrics: TeamMetrics
  /** Map of subject area -> testable tasks (only tasks with gradedSteps) */
  testableTaskMap: Map<string, FlatTask[]>
}

export function useSupervisorData(): SupervisorData {
  const [certs, setCerts] = useState<Certification[]>([])
  const [tests, setTests] = useState<TrainingCompletionUI[]>([])
  const [assignments, setAssignments] = useState<TrainingCompletionUI[]>([])

  const { medics: allLocationMedics, loading: medicsLoading } = useClinicMedics()
  const { user, clinicId: userClinicId, isSupervisorRole, profile: authProfile, loading: authLoading } = useAuth()

  // Derive auth state from the reactive auth store (no separate Supabase call).
  // authLoading clears on INITIAL_SESSION before refreshProfile() resolves,
  // so we also wait for clinicId to populate (set by refreshProfile) to avoid
  // showing all-location medics before the supervisor's own clinic is known.
  const currentUserId = user?.id ?? null
  const isSupervisor = isSupervisorRole
  const clinicName = authProfile.clinicName ?? null
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
    }
  }, [user, authProfile.firstName, authProfile.lastName, authProfile.middleInitial, authProfile.rank, authProfile.credential])

  // Filter to own clinic only – supervisor view should not include nearby clinics
  const medics = useMemo(() => {
    if (!userClinicId) return allLocationMedics
    return allLocationMedics.filter(m => !m.clinicId || m.clinicId === userClinicId)
  }, [allLocationMedics, userClinicId])

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

    try {
      const [certsData, testsData, assignmentsData] = await Promise.all([
        fetchClinicCertifications(allIds),
        fetchClinicTestHistory(allIds, currentUserId),
        fetchClinicAssignments(allIds),
      ])
      setCerts(certsData)
      setTests(testsData)
      setAssignments(assignmentsData)
    } catch (err) {
      logger.error('Failed to fetch certs/tests:', err)
    }
  }, [medics, currentUserId])

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

  const competencyMatrix = useMemo(
    () => buildCompetencyMatrix(medics, tests, testableTaskMap),
    [medics, tests, testableTaskMap]
  )

  const teamMetrics = useMemo(
    () => computeTeamMetrics(medics, tests, certs, testableTaskMap, overdueItems),
    [medics, tests, certs, testableTaskMap, overdueItems]
  )

  return {
    loading: loading || medicsLoading,
    isSupervisor,
    currentUserId,
    clinicName,
    currentUserProfile,
    medics,
    allClinicUsers,
    certs,
    tests,
    certsForSoldier,
    testsForSoldier,
    assignmentsForSoldier,
    overdueItems,
    resolveName,
    updateCert,
    removeTest,
    addCert,
    removeCert,
    addAssignment,
    refreshData: fetchCertsAndTests,
    competencyMatrix,
    teamMetrics,
    testableTaskMap,
  }
}
