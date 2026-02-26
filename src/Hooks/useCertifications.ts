import { useState, useEffect, useCallback } from 'react'
import type { Certification } from '../Data/User'
import {
  fetchCertifications,
  addCertification,
  removeCertification,
  togglePrimary,
} from '../lib/certificationService'
import { useAuth } from './useAuth'

export function useCertifications() {
  const { user, refreshProfile } = useAuth()
  const [certs, setCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const data = await fetchCertifications(user.id)
    setCerts(data)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const addCert = useCallback(async (input: {
    title: string
    cert_number?: string | null
    issue_date?: string | null
    exp_date?: string | null
    is_primary?: boolean
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' }
    const result = await addCertification(user.id, input)
    if (result.success) {
      await load()
      if (input.is_primary) await refreshProfile()
    }
    return result
  }, [user, load, refreshProfile])

  const removeCert = useCallback(async (certId: string, wasPrimary: boolean) => {
    if (!user) return { success: false, error: 'Not authenticated' }
    const result = await removeCertification(user.id, certId, wasPrimary)
    if (result.success) {
      await load()
      if (wasPrimary) await refreshProfile()
    }
    return result
  }, [user, load, refreshProfile])

  const togglePrimaryCert = useCallback(async (certId: string, currentlyPrimary: boolean) => {
    if (!user) return { success: false, error: 'Not authenticated' }
    const result = await togglePrimary(user.id, certId, currentlyPrimary)
    if (result.success) {
      await load()
      await refreshProfile()
    }
    return result
  }, [user, load, refreshProfile])

  return { certs, loading, addCert, removeCert, togglePrimaryCert, refresh: load }
}
