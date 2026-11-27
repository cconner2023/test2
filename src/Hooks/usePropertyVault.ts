/**
 * usePropertyVault — offline-drain for property clinic-vault fan-out.
 *
 * Thin hook: the send + resolve logic lives in lib/propertyVault.ts (non-hook).
 * This only drains the pending-send queue on mount and whenever connectivity
 * returns, re-resolving cross-cluster targets at drain time (the holder may have
 * moved clusters while we were offline). Mirrors useCalendarVault's drain effect.
 */

import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { createLogger } from '../Utilities/Logger'
import { resolvePropertyTargetClinics, fanPropertyEvent } from '../lib/propertyVault'
import {
  loadPendingPropertySends, clearPendingPropertySend, patchPendingPropertySend,
  clearExpiredItemTombstones, clearExpiredZoneTombstones,
} from '../lib/propertyEventStore'

const logger = createLogger('usePropertyVault')

export function usePropertyVault(): void {
  const { clinicId, user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!clinicId || !userId) return
    // GC tombstones past the retention window (bounded above SPK retention).
    clearExpiredItemTombstones().catch(() => {})
    clearExpiredZoneTombstones().catch(() => {})
    const drain = async () => {
      const pending = await loadPendingPropertySends()
      for (const item of pending) {
        try {
          // Re-resolve cross-cluster targets: offline enqueue fell back to the
          // authoring clinic only; now that we're online, fan to the holder's
          // full clinic set. Deletes keep their stamped target set.
          const remaining = item.remainingTargets?.length ? item.remainingTargets : undefined
          const targets = remaining
            ? (item.payload.target_clinic_ids ?? remaining)
            : item.action === 'd'
              ? (item.payload.target_clinic_ids ?? (item.authoringClinicId ? [item.authoringClinicId] : []))
              : await resolvePropertyTargetClinics(item.authoringClinicId, item.holderIds)
          const payload = { ...item.payload, target_clinic_ids: targets }
          const r = await fanPropertyEvent(userId, item.action, item.entity, payload, remaining)
          if (!r || r.outcome.landed.length === 0) continue
          if (r.outcome.failed.length === 0) await clearPendingPropertySend(item.key, item.queuedAt)
          else await patchPendingPropertySend(item, { remainingTargets: r.outcome.failed, payload: { ...payload, originId: r.originId } })
        } catch (e) {
          logger.warn('property drain item failed:', e instanceof Error ? e.message : e)
        }
      }
    }
    drain()
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [clinicId, userId])
}
