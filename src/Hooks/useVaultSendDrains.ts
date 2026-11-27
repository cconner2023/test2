import { useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useMessagingStore } from '../stores/useMessagingStore'
import { drainPendingVaultSends } from './useCalendarVault'
import { drainPendingOverlaySends } from './useMapOverlayVault'

export function useVaultSendDrains(): void {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const clinicId = useAuthStore(s => s.clinicId)
  const supervisingClinicId = useAuthStore(s => s.supervisingClinicId)
  const localDeviceId = useMessagingStore(s => s.localDeviceId)
  const clinicDeviceId = useMessagingStore(s => s.clinicDeviceId)

  useEffect(() => {
    if (!userId || !localDeviceId || !clinicDeviceId) return
    if (!clinicId && !supervisingClinicId) return
    const drain = () => {
      void drainPendingVaultSends()
      void drainPendingOverlaySends()
    }
    drain()
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [userId, clinicId, supervisingClinicId, localDeviceId, clinicDeviceId])
}
