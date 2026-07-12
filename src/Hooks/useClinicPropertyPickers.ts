import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PropertyItem, PropertyLocation } from '../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../Types/PropertyTypes'
import { getLocalPropertyItems, getLocalPropertyLocations } from '../lib/offlineDb'
import { useInvalidation } from '../stores/useInvalidationStore'

export interface PropertyPickerOption {
  id: string
  name: string
}

/**
 * Fetches lean { id, name } lists of property items + locations for an arbitrary clinic.
 * Used by the PCC template editor so a supervisor toggled into a surrogate cluster
 * sees that cluster's equipment/locations, not their assigned cluster's. Mirrors the
 * useClinicZones / useClinicHuddleTasks pattern.
 */
export function useClinicPropertyPickers(clinicId?: string | null) {
  const propertiesGen = useInvalidation('properties')
  const [items, setItems] = useState<PropertyPickerOption[]>([])
  const [locations, setLocations] = useState<PropertyPickerOption[]>([])

  useEffect(() => {
    if (!clinicId) {
      setItems([])
      setLocations([])
      return
    }
    let cancelled = false

    const toItemOptions = (rows: Pick<PropertyItem, 'id' | 'name' | 'parent_item_id'>[]) =>
      rows.filter(r => !r.parent_item_id).map(r => ({ id: r.id, name: r.name }))
    // Filter out the system staging zone so it's never a pickable location.
    const toLocationOptions = (rows: Pick<PropertyLocation, 'id' | 'name' | 'is_turn_in_zone'>[]) =>
      rows.filter(r => r.name !== ROOT_LOCATION_NAME && !r.is_turn_in_zone).map(r => ({ id: r.id, name: r.name }))

    ;(async () => {
      // Warm device: serve the picker lists straight from the offline-first IDB
      // projection — zero egress, and it re-reads (cheaply) on every `properties`
      // bump so edits stay live. Only a COLD device with no local projection
      // (e.g. a supervisor toggled into a surrogate cluster it has never synced)
      // falls back to the network, mirroring the cold-device-floor gate in
      // fetchClinicItems / fetchClinicLocations.
      const [localItems, localLocs] = await Promise.all([
        getLocalPropertyItems(clinicId),
        getLocalPropertyLocations(clinicId),
      ])
      if (cancelled) return

      if (localItems.length > 0) {
        setItems(toItemOptions(localItems))
      } else {
        const { data, error } = await supabase
          .from('property_items')
          .select('id, name, parent_item_id')
          .eq('clinic_id', clinicId)
        if (cancelled || error) return
        setItems(toItemOptions((data ?? []) as Pick<PropertyItem, 'id' | 'name' | 'parent_item_id'>[]))
      }

      if (localLocs.length > 0) {
        setLocations(toLocationOptions(localLocs))
      } else {
        const { data, error } = await supabase
          .from('property_locations')
          .select('id, name, is_turn_in_zone')
          .eq('clinic_id', clinicId)
        if (cancelled || error) return
        setLocations(toLocationOptions((data ?? []) as Pick<PropertyLocation, 'id' | 'name' | 'is_turn_in_zone'>[]))
      }
    })()

    return () => { cancelled = true }
  }, [clinicId, propertiesGen])

  return { items, locations }
}
