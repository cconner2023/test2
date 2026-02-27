import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useClinicMedics } from '../../../Hooks/useClinicMedics'
import { fetchClinicCertifications } from '../../../lib/certificationService'
import { fetchClinicTestHistory, type TrainingCompletionUI } from '../../../lib/trainingService'
import { createLogger } from '../../../Utilities/Logger'
import { formatMedicName, getExpirationStatus } from './supervisorHelpers'
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
  /** Get overdue items: expired/expiring certs + NO_GO tests */
  overdueItems: (userId: string) => { expiredCerts: Certification[]; failedTests: TrainingCompletionUI[] }
  /** Resolve a userId to a display name */
  resolveName: (id: string | null) => string
  /** Update a cert in local state (after verify/unverify) */
  updateCert: (certId: string, updates: Partial<Certification>) => void
  /** Remove a test from local state (after delete) */
  removeTest: (testId: string) => void
  /** Refresh certs + tests from server */
  refreshData: () => void
}

export function useSupervisorData(): SupervisorData {
  const [loading, setLoading] = useState(true)
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<ClinicMedic | null>(null)
  const [certs, setCerts] = useState<Certification[]>([])
  const [tests, setTests] = useState<TrainingCompletionUI[]>([])

  const { medics, loading: medicsLoading } = useClinicMedics()

  // Auth check + profile fetch (runs once)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) { setLoading(false); return }

        setCurrentUserId(user.id)
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, middle_initial, rank, credential, roles')
          .eq('id', user.id)
          .single()

        if (data && !cancelled) {
          const roles = data.roles as string[] | null
          setIsSupervisor(roles?.includes('supervisor') ?? false)
          setCurrentUserProfile({
            id: data.id,
            firstName: data.first_name,
            lastName: data.last_name,
            middleInitial: data.middle_initial,
            rank: data.rank,
            credential: data.credential,
          })
        }
      } catch (err) {
        logger.error('Auth check failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
      const [certsData, testsData] = await Promise.all([
        fetchClinicCertifications(allIds),
        fetchClinicTestHistory(allIds, currentUserId),
      ])
      setCerts(certsData)
      setTests(testsData)
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

  return {
    loading: loading || medicsLoading,
    isSupervisor,
    currentUserId,
    currentUserProfile,
    medics,
    allClinicUsers,
    certs,
    tests,
    certsForSoldier,
    testsForSoldier,
    overdueItems,
    resolveName,
    updateCert,
    removeTest,
    refreshData: fetchCertsAndTests,
  }
}
