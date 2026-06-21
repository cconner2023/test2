import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchClinicLedger } from '../lib/propertyService'
import { groupHandReceipts } from '../Utilities/handReceipts'
import { useInvalidation } from '../stores/useInvalidationStore'
import type { CustodyLedgerEntry, HandReceipt, HolderInfo, PropertyItem } from '../Types/PropertyTypes'

/** Lean item row carried for receipt rendering + reprint. */
export type ReceiptItem = Pick<
  PropertyItem,
  'id' | 'name' | 'nomenclature' | 'nsn' | 'serial_number' | 'location_id'
>

export interface HandReceiptData {
  receipts: HandReceipt[]
  itemsById: Map<string, ReceiptItem>
  /** location id → display name (the item's usual/home zone). */
  locationNameById: Map<string, string>
  membersById: Map<string, HolderInfo>
  loading: boolean
  refetch: () => void
}

/**
 * Clinic-wide DA 2062 accountability data for the Settings surface. Folds the
 * custody ledger into hand receipts (newest first) and supplies the lookup maps
 * the panel needs to show each receipt's items + their usual location, and to
 * reprint the 2062. Refetches on `properties` invalidation (after sign-out/in).
 */
export function useHandReceipts(clinicId?: string | null): HandReceiptData {
  const propertiesGen = useInvalidation('properties')
  const [receipts, setReceipts] = useState<HandReceipt[]>([])
  const [itemsById, setItemsById] = useState<Map<string, ReceiptItem>>(new Map())
  const [locationNameById, setLocationNameById] = useState<Map<string, string>>(new Map())
  const [membersById, setMembersById] = useState<Map<string, HolderInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!clinicId) {
      setReceipts([])
      setItemsById(new Map())
      setLocationNameById(new Map())
      setMembersById(new Map())
      return
    }
    let cancelled = false
    setLoading(true)

    const loadMembers = supabase
      .from('profiles')
      .select('id, rank, first_name, last_name')
      .eq('clinic_id', clinicId)
      .then(({ data }) => {
        const map = new Map<string, HolderInfo>()
        for (const p of data ?? []) {
          map.set(p.id, {
            id: p.id,
            rank: p.rank,
            firstName: p.first_name,
            lastName: p.last_name,
            displayName: [p.rank, p.last_name, p.first_name].filter(Boolean).join(' '),
          })
        }
        return map
      })

    const loadItems = supabase
      .from('property_items')
      .select('id, name, nomenclature, nsn, serial_number, location_id')
      .eq('clinic_id', clinicId)
      .then(({ data }) => {
        const map = new Map<string, ReceiptItem>()
        for (const r of (data ?? []) as ReceiptItem[]) map.set(r.id, r)
        return map
      })

    const loadLocations = supabase
      .from('property_locations')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .then(({ data }) => {
        const map = new Map<string, string>()
        for (const r of data ?? []) map.set(r.id, r.name as string)
        return map
      })

    Promise.all([fetchClinicLedger(clinicId), loadMembers, loadItems, loadLocations])
      .then(([ledger, members, items, locations]) => {
        if (cancelled) return
        setMembersById(members)
        setItemsById(items)
        setLocationNameById(locations)
        setReceipts(groupHandReceipts(ledger as CustodyLedgerEntry[], members))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clinicId, propertiesGen, tick])

  return { receipts, itemsById, locationNameById, membersById, loading, refetch }
}
