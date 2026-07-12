import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchClinicLedger } from '../lib/propertyService'
import { getLocalPropertyItems, getLocalPropertyLocations } from '../lib/offlineDb'
import { usePropertyStore } from '../stores/usePropertyStore'
import { groupHandReceipts, groupTurnIns, type TurnInFold } from '../Utilities/handReceipts'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../Utilities/propertyAuthorized'
import { useInvalidation } from '../stores/useInvalidationStore'
import type { CustodyLedgerEntry, HandReceipt, HolderInfo, PropertyItem } from '../Types/PropertyTypes'

/**
 * Clinic roster cache keyed by clinicId, tagged with the `users` invalidation
 * generation it was fetched for. The roster (profiles) does NOT change on a
 * `properties` bump, so without this a full clinic-roster GET fired on every
 * property mutation — and on every remote peer change routed through the
 * clinic-vault drain — while the always-mounted Custody/dev-search surfaces
 * held useHandReceipts open. We only hit the wire when the roster is stale for
 * the current `users` generation; property churn now re-reads it for free.
 */
const rosterCache = new Map<string, { gen: number; map: Map<string, HolderInfo> }>()

async function loadClinicRoster(clinicId: string, usersGen: number): Promise<Map<string, HolderInfo>> {
  const cached = rosterCache.get(clinicId)
  if (cached && cached.gen === usersGen) return cached.map

  const { data } = await supabase
    .from('profiles')
    .select('id, rank, first_name, last_name')
    .eq('clinic_id', clinicId)

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
  // Offline / RLS-empty → fall back to the property store's in-memory roster so
  // internal recipient labels still resolve. Best-effort getState (not a
  // subscription), so the Settings surface still works without store init. Don't
  // cache an empty/fallback result — a later warm read should retry the wire.
  if (map.size === 0) {
    for (const [id, info] of usePropertyStore.getState().holders) map.set(id, info)
    return map
  }
  rosterCache.set(clinicId, { gen: usersGen, map })
  return map
}

/** Lean item row carried for receipt rendering + reprint. `expiry_date` feeds the
 *  Custody panel's "Expired" section (30-day expiry window via expiryStatus);
 *  `turned_in_at` + `sub_cluster_id` drive the DA 3161 turn-in fold + grouping. */
export type ReceiptItem = Pick<
  PropertyItem,
  'id' | 'name' | 'nomenclature' | 'nsn' | 'serial_number' | 'location_id' | 'quantity' | 'expiry_date' | 'turned_in_at' | 'sub_cluster_id'
>

export interface HandReceiptData {
  receipts: HandReceipt[]
  /** DA 3161 turn-in: staged-pending rows + completed docs. */
  turnIns: TurnInFold
  itemsById: Map<string, ReceiptItem>
  /** location id → display name (the item's usual/home zone). */
  locationNameById: Map<string, string>
  membersById: Map<string, HolderInfo>
  loading: boolean
  refetch: () => void
}

/**
 * Clinic-wide DA 2062 accountability data for the property Custody surface
 * (CustodyPanel) and the unified property search. Folds the custody ledger into
 * hand receipts (newest first) and supplies the lookup maps needed to show each
 * receipt's items + their usual location, and to reprint the 2062. Refetches on
 * `properties` invalidation (after sign-out/in).
 */
export function useHandReceipts(clinicId?: string | null): HandReceiptData {
  const propertiesGen = useInvalidation('properties')
  const usersGen = useInvalidation('users')
  const [receipts, setReceipts] = useState<HandReceipt[]>([])
  const [turnIns, setTurnIns] = useState<TurnInFold>({ pending: [], history: [] })
  const [itemsById, setItemsById] = useState<Map<string, ReceiptItem>>(new Map())
  const [locationNameById, setLocationNameById] = useState<Map<string, string>>(new Map())
  const [membersById, setMembersById] = useState<Map<string, HolderInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!clinicId) {
      setReceipts([])
      setTurnIns({ pending: [], history: [] })
      setItemsById(new Map())
      setLocationNameById(new Map())
      setMembersById(new Map())
      return
    }
    let cancelled = false
    setLoading(true)

    // Roster is served from the (clinicId, usersGen) cache — a `properties` bump
    // no longer re-pulls it. See loadClinicRoster above.
    const loadMembers = loadClinicRoster(clinicId, usersGen)

    // Items + locations come from the IDB projection (offline-first, and
    // store-independent so the Settings surface works without the property store).
    const loadItems = getLocalPropertyItems(clinicId).then((items) => {
      const map = new Map<string, ReceiptItem>()
      for (const r of items) {
        // Only REAL physical property is signable on a DA 2062 — abstract PHR entities
        // (LIN headers, location-less authorized targets, zone-shadow identities) are the
        // hand-receipt structure, not discrete stock, and must never appear as pickable
        // items. Filtering here keeps the whole custody/2062 surface (itemsById feeds the
        // Add-item picker + receipt rendering + liveIds) to real property only. A real
        // signed item carries its LIN via its parent + NSN — the identity survives.
        if (isLinContainer(r) || isAuthTarget(r) || isZoneShadow(r)) continue
        map.set(r.id, {
          id: r.id,
          name: r.name,
          nomenclature: r.nomenclature,
          nsn: r.nsn,
          serial_number: r.serial_number,
          location_id: r.location_id,
          quantity: r.quantity,
          expiry_date: r.expiry_date,
          turned_in_at: r.turned_in_at ?? null,
          sub_cluster_id: r.sub_cluster_id ?? null,
        })
      }
      return map
    })

    const loadLocations = getLocalPropertyLocations(clinicId).then((locs) => {
      const map = new Map<string, string>()
      for (const r of locs) map.set(r.id, r.name)
      return map
    })

    Promise.all([fetchClinicLedger(clinicId), loadMembers, loadItems, loadLocations])
      .then(([ledger, members, items, locations]) => {
        if (cancelled) return
        setMembersById(members)
        setItemsById(items)
        setLocationNameById(locations)
        // `items` keys = the live (non-tombstoned) item set from the IDB
        // projection; pass it so receipts for deleted items drop out of view.
        const liveIds = new Set(items.keys())
        setReceipts(groupHandReceipts(ledger as CustodyLedgerEntry[], members, liveIds))
        // Turn-in fold: an item is verified-turned-in once it carries turned_in_at.
        const turnedInIds = new Set<string>()
        for (const [id, it] of items) if (it.turned_in_at) turnedInIds.add(id)
        setTurnIns(groupTurnIns(ledger as CustodyLedgerEntry[], turnedInIds, liveIds))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clinicId, propertiesGen, usersGen, tick])

  return { receipts, turnIns, itemsById, locationNameById, membersById, loading, refetch }
}
