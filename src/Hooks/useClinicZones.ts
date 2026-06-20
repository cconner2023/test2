// Hooks/useClinicZones.ts — structural property zones for a clinic, used as the
// calendar's "room" options. Replaces the retired clinics.rooms jsonb: a calendar
// event's room_id now references a property_locations.id.
//
// Returns the BAS SUBTREE only: the default cluster zone (BAS) plus every zone
// nested within it, at any depth. A zone becomes a calendar room ONLY by living
// inside BAS — organic zones drawn elsewhere on the root canvas (motor pool, etc.)
// are NOT rooms. Personnel/member zones (holder_user_id set) are the "who", not
// the "where", so they're excluded regardless. If BAS doesn't exist yet (lazily
// provisioned on first property-drawer open), the list is empty and the picker hides.
//
// Offline-first by construction: reads through propertyService.fetchClinicLocations
// (IDB-first, reconciles with Supabase when online), so the picker works without a
// network round-trip and without depending on the generated DB types for the new
// is_default_zone column. Cache + in-flight dedup mirror useClinicConfig; refetches
// on a `properties` invalidation bump.

import { useState, useEffect } from 'react'
import { fetchClinicLocations } from '../lib/propertyService'
import { ROOT_LOCATION_NAME } from '../Types/PropertyTypes'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

export interface ClinicZone {
  id: string
  name: string
  is_default_zone: boolean
  /** Map anchor (Phase 2 zone↔overlay link). Lets the calendar render a zone's
   *  map preview for an event scheduled in it. */
  overlay_id?: string | null
  overlay_feature_id?: string | null
}

const EMPTY: ClinicZone[] = []
const snapshots = new Map<string, ClinicZone[]>()
const inflight = new Map<string, Promise<ClinicZone[]>>()

function fetchZones(clinicId: string, key: string): Promise<ClinicZone[]> {
  const existing = inflight.get(key)
  if (existing) return existing

  const p = fetchClinicLocations(clinicId)
    .then((locs) => {
      inflight.delete(key)
      // Vehicles are property containers, not schedulable rooms — exclude them
      // from the calendar-room subtree even if drawn under BAS.
      const structural = locs.filter(
        (l) => l.holder_user_id == null && l.name !== ROOT_LOCATION_NAME && l.kind !== 'vehicle',
      )
      const bas = structural.find((l) => l.is_default_zone)

      let zones: ClinicZone[] = EMPTY
      if (bas) {
        // Index children by parent, then walk the BAS subtree (BAS + descendants, any depth).
        const childrenByParent = new Map<string, typeof structural>()
        for (const l of structural) {
          if (!l.parent_id) continue
          const arr = childrenByParent.get(l.parent_id)
          if (arr) arr.push(l)
          else childrenByParent.set(l.parent_id, [l])
        }
        const subtree: typeof structural = []
        const seen = new Set<string>()
        const queue = [bas]
        while (queue.length) {
          const node = queue.shift()!
          if (seen.has(node.id)) continue
          seen.add(node.id)
          subtree.push(node)
          for (const child of childrenByParent.get(node.id) ?? []) queue.push(child)
        }
        zones = subtree
          .map((l) => ({
            id: l.id,
            name: l.name,
            is_default_zone: !!l.is_default_zone,
            overlay_id: l.overlay_id ?? null,
            overlay_feature_id: l.overlay_feature_id ?? null,
          }))
          .sort((a, b) =>
            a.is_default_zone === b.is_default_zone
              ? a.name.localeCompare(b.name)
              : a.is_default_zone
                ? -1
                : 1,
          )
      }
      snapshots.set(key, zones)
      const prefix = `${clinicId}::`
      for (const k of snapshots.keys()) {
        if (k !== key && k.startsWith(prefix)) snapshots.delete(k)
      }
      return zones
    })
    .catch(() => {
      inflight.delete(key)
      return EMPTY
    })

  inflight.set(key, p)
  return p
}

/**
 * Structural zones for a clinic, used as the calendar room picker options.
 * `targetClinicId` defaults to the caller's assigned clinic; supervisor surfaces
 * pass an explicit id to honor the clinic-context toggle.
 */
export function useClinicZones(targetClinicId?: string | null): ClinicZone[] {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const gen = useInvalidation('properties')
  const key = clinicId ? `${clinicId}::${gen}` : ''

  const [zones, setZones] = useState<ClinicZone[]>(() => (key && snapshots.get(key)) || EMPTY)

  useEffect(() => {
    if (!clinicId) {
      setZones(EMPTY)
      return
    }
    const cached = snapshots.get(key)
    if (cached) {
      setZones(cached)
      return
    }
    let cancelled = false
    fetchZones(clinicId, key).then((next) => {
      if (!cancelled) setZones(next)
    })
    return () => {
      cancelled = true
    }
  }, [clinicId, key])

  return zones
}

/** The clinic's default cluster zone id (BAS), or null. New events default room_id here. */
export function defaultZoneId(zones: ClinicZone[]): string | null {
  return zones.find((z) => z.is_default_zone)?.id ?? null
}
