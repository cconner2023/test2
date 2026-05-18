/**
 * useMapOverlaySync — Boot-time hydration for map overlays.
 *
 * Loads persisted overlay tombstones into the in-memory set so vault drain,
 * realtime delivery, and backup restore can guard against resurrecting
 * deleted overlays. Also prunes expired tombstones to keep the store bounded.
 *
 * Overlays themselves live in the offlineDb mapOverlays store and are read
 * directly by MapOverlayPanel; this hook owns only the tombstone lifecycle.
 *
 * Counterpart to useCalendarSync for calendar events.
 */

import { useEffect } from 'react'
import { initOverlayTombstones } from '../lib/mapOverlayRouting'
import { clearExpiredOverlayTombstones } from '../lib/mapOverlayEventStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('MapOverlaySync')

export function useMapOverlaySync(): void {
  useEffect(() => {
    ;(async () => {
      try {
        await initOverlayTombstones()
        clearExpiredOverlayTombstones().catch(() => {})
      } catch (e) {
        logger.warn('Failed to init overlay tombstones:', e)
      }
    })()
  }, [])
}
