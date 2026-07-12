import { useEffect, useState } from 'react'
import { getLocalPropertyItems } from '../lib/offlineDb'
import { computeShortages } from '../Utilities/propertyShortage'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useVehicleDispatches } from './useVehicleDispatches'

export interface PropertyReadiness {
  /** Count of authorized lines currently short (computeShortages(...).lines.length). */
  shortLines: number
  /** Vehicle location ids with an expiring/expired open dispatch (the red-dot set). */
  expiringVehicleIds: string[]
}

/**
 * Mission-overview property readiness — a glanceable, delta-fed fold over the
 * ALREADY-WARM local projection. No store init / no server pull: shortages read
 * getLocalPropertyItems (the vault snapshot+tail keeps IDB current), dispatches
 * ride the existing clinic-wide useVehicleDispatches fold. Both refold on
 * `properties` invalidation. Empty when clinicId is null.
 *
 * These are propertyAccountability-gated signals — the widget that consumes this
 * gates on that feature; the hook itself just reports.
 */
export function usePropertyReadiness(clinicId: string | null): PropertyReadiness {
  const [shortLines, setShortLines] = useState(0)
  const propGen = useInvalidation('properties')
  const dispatches = useVehicleDispatches(clinicId)

  useEffect(() => {
    if (!clinicId) { setShortLines(0); return }
    let cancelled = false
    ;(async () => {
      const items = await getLocalPropertyItems(clinicId).catch(() => [])
      if (cancelled) return
      setShortLines(computeShortages(items).lines.length)
    })()
    return () => { cancelled = true }
  }, [clinicId, propGen])

  const expiringVehicleIds: string[] = []
  for (const [locationId, d] of dispatches) {
    if (d.status === 'expiring' || d.status === 'expired') expiringVehicleIds.push(locationId)
  }

  return { shortLines, expiringVehicleIds }
}
