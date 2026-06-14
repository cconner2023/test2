import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PropertyItem, PropertyLocation } from '../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../Types/PropertyTypes'
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

    const loadItems = supabase
      .from('property_items')
      .select('id, name, parent_item_id')
      .eq('clinic_id', clinicId)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const rows = (data ?? []) as Pick<PropertyItem, 'id' | 'name' | 'parent_item_id'>[]
        setItems(rows.filter(r => !r.parent_item_id).map(r => ({ id: r.id, name: r.name })))
      })

    const loadLocations = supabase
      .from('property_locations')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const rows = (data ?? []) as Pick<PropertyLocation, 'id' | 'name'>[]
        setLocations(rows.filter(r => r.name !== ROOT_LOCATION_NAME))
      })

    void Promise.all([loadItems, loadLocations])
    return () => { cancelled = true }
  }, [clinicId, propertiesGen])

  return { items, locations }
}
