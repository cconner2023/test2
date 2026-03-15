import { useState, useEffect, useCallback, useMemo } from 'react'
import { generateInvite, redeemInvite, approveInvite, rejectInvite, revokeAssociation, getInvites, type ClinicInvite } from '../lib/clinicAssociationService'
import { loadCachedInvites, saveCachedInvites } from '../lib/clinicInviteCache'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ClinicInvites')

/** Find the freshest non-expired pending invite. */
function findActiveInvite(invites: ClinicInvite[]): ClinicInvite | null {
  const now = Date.now()
  return invites
    .filter(i => i.status === 'pending' && new Date(i.expires_at).getTime() > now)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
}

export function useClinicInvites() {
  const [invites, setInvites] = useState<ClinicInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getInvites()
    if (result.success) {
      setInvites(result.invites)
      saveCachedInvites(result.invites).catch(() => {})
    } else {
      logger.warn('Failed to fetch invites:', result.error)
      setError(result.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCachedInvites().then(cached => {
      if (cancelled) return
      if (cached.length > 0) {
        setInvites(cached)
        setLoading(false)
      }
      refresh()
    }).catch(() => {
      if (!cancelled) refresh()
    })
    return () => { cancelled = true }
  }, [refresh])

  // ── Active invite: ever-present, auto-generated ──────────────────────

  const activeInvite = useMemo(() => findActiveInvite(invites), [invites])

  // Auto-generate if no active invite exists (after initial load)
  useEffect(() => {
    if (loading || activeInvite) return
    let cancelled = false
    generateInvite(24).then(result => {
      if (cancelled) return
      if (result.success) refresh()
    })
    return () => { cancelled = true }
  }, [loading, activeInvite, refresh])

  // Auto-regenerate when active invite expires
  useEffect(() => {
    if (!activeInvite) return
    const remaining = new Date(activeInvite.expires_at).getTime() - Date.now()
    if (remaining <= 0) return // already expired, the above effect will handle it
    const timer = setTimeout(() => {
      generateInvite(24).then(result => {
        if (result.success) refresh()
      })
    }, remaining)
    return () => clearTimeout(timer)
  }, [activeInvite, refresh])

  const handleRedeemInvite = useCallback(async (code: string) => {
    const result = await redeemInvite(code)
    if (result.success) {
      await refresh()
    }
    return result
  }, [refresh])

  const handleApproveInvite = useCallback(async (inviteId: string) => {
    const result = await approveInvite(inviteId)
    if (result.success) {
      await refresh()
    }
    return result
  }, [refresh])

  const handleRejectInvite = useCallback(async (inviteId: string) => {
    const result = await rejectInvite(inviteId)
    if (result.success) {
      await refresh()
    }
    return result
  }, [refresh])

  const handleRevokeAssociation = useCallback(async (inviteId: string) => {
    const result = await revokeAssociation(inviteId)
    if (result.success) {
      await refresh()
    }
    return result
  }, [refresh])

  return {
    invites,
    loading,
    error,
    refresh,
    activeCode: activeInvite?.code ?? null,
    activeExpiresAt: activeInvite?.expires_at ?? null,
    redeemInvite: handleRedeemInvite,
    approveInvite: handleApproveInvite,
    rejectInvite: handleRejectInvite,
    revokeAssociation: handleRevokeAssociation,
  }
}
