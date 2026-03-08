/**
 * Hook bridging the property service layer to the UI.
 *
 * Follows the useTrainingCompletions pattern:
 * - Load from IndexedDB on mount (instant, offline-ready)
 * - Reconcile with server when online
 * - Auto-sync on connectivity change
 * - Optimistic CRUD callbacks
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createLogger } from '../Utilities/Logger'
import {
  fetchClinicItems,
  createItem,
  updateItem,
  deleteItem,
  fetchClinicLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  executeTransfer,
  rectifyDiscrepancy as rectifyDiscrepancySvc,
  searchProperty,
  fetchSubItems,
  fetchItemLedger,
  fetchHolderDiscrepancies,
} from '../lib/propertyService'
import { setupConnectivityListeners } from '../lib/syncService'
import { getLocalDiscrepanciesByStatus } from '../lib/offlineDb'
import type {
  PropertyItem,
  PropertyLocation,
  LocalPropertyItem,
  LocalPropertyLocation,
  LocalDiscrepancy,
  CustodyLedgerEntry,
  TransferPayload,
  PropertySearchResult,
} from '../Types/PropertyTypes'

const logger = createLogger('useProperty')

export function useProperty() {
  const [items, setItems] = useState<LocalPropertyItem[]>([])
  const [locations, setLocations] = useState<LocalPropertyLocation[]>([])
  const [discrepancies, setDiscrepancies] = useState<LocalDiscrepancy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const clinicIdRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const refreshItems = useCallback(async () => {
    const clinicId = clinicIdRef.current
    if (!clinicId) return
    const refreshed = await fetchClinicItems(clinicId)
    setItems(refreshed)
  }, [])

  const refreshLocations = useCallback(async () => {
    const clinicId = clinicIdRef.current
    if (!clinicId) return
    const refreshed = await fetchClinicLocations(clinicId)
    setLocations(refreshed)
  }, [])

  const refreshDiscrepancies = useCallback(async () => {
    const open = await getLocalDiscrepanciesByStatus('open')
    const rectified = await getLocalDiscrepanciesByStatus('rectified')
    setDiscrepancies([...open, ...rectified])
  }, [])

  // ── Initialization ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) { setIsLoading(false); return }

        userIdRef.current = user.id

        // Get clinic from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('clinic_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile?.clinic_id || cancelled) { setIsLoading(false); return }
        clinicIdRef.current = profile.clinic_id

        // Load from IDB (instant)
        await Promise.all([refreshItems(), refreshLocations(), refreshDiscrepancies()])
        if (!cancelled) setIsLoading(false)

        // Set up connectivity listeners
        cleanupRef.current = setupConnectivityListeners(user.id, {
          clinicId: profile.clinic_id,
          onSyncStart: () => { if (!cancelled) setIsSyncing(true) },
          onSyncComplete: () => {
            if (!cancelled) {
              setIsSyncing(false)
              refreshItems()
              refreshLocations()
              refreshDiscrepancies()
            }
          },
          onPropertyReconcileComplete: (reconciled) => {
            if (!cancelled) setItems(reconciled)
          },
        })
      } catch (err) {
        logger.error('Property init failed:', err)
        if (!cancelled) setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [refreshItems, refreshLocations, refreshDiscrepancies])

  // ── CRUD Callbacks ─────────────────────────────────────────

  const addItem = useCallback(async (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at'>) => {
    const userId = userIdRef.current
    if (!userId) return
    const result = await createItem(data, userId)
    if (result.success) {
      setItems((prev) => [...prev, result.item])
    }
    return result
  }, [])

  const editItem = useCallback(async (id: string, updates: Partial<PropertyItem>) => {
    const userId = userIdRef.current
    if (!userId) return
    const result = await updateItem(id, updates, userId)
    if (result.success) {
      setItems((prev) => prev.map((item) => item.id === id ? result.item : item))
    }
    return result
  }, [])

  const removeItem = useCallback(async (id: string) => {
    const userId = userIdRef.current
    if (!userId) return

    // Collect child IDs from IDB before optimistic removal
    const childItems = await fetchSubItems(id)
    const childIds = childItems.map((c) => c.id)

    // Optimistic removal of parent + all children
    setItems((prev) => prev.filter((i) => i.id !== id && !childIds.includes(i.id)))

    // Delete parent first, then children
    const result = await deleteItem(id, userId)
    for (const child of childItems) {
      await deleteItem(child.id, userId)
    }

    if (!result.success) {
      await refreshItems()
    }
    return result
  }, [refreshItems])

  const addLocation = useCallback(async (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => {
    const userId = userIdRef.current
    if (!userId) return
    const result = await createLocation(data, userId)
    if (result.success) {
      setLocations((prev) => [...prev, result.location])
    }
    return result
  }, [])

  const editLocation = useCallback(async (id: string, updates: Partial<PropertyLocation>) => {
    const userId = userIdRef.current
    if (!userId) return
    const result = await updateLocation(id, updates, userId)
    if (result.success) {
      await refreshLocations()
    }
    return result
  }, [refreshLocations])

  const removeLocation = useCallback(async (id: string) => {
    const userId = userIdRef.current
    if (!userId) return

    // Collect all descendant location IDs (depth-first) from current state
    const collectDescendants = (parentId: string, allLocs: LocalPropertyLocation[]): string[] => {
      const children = allLocs.filter((l) => l.parent_id === parentId)
      return children.flatMap((c) => [c.id, ...collectDescendants(c.id, allLocs)])
    }

    // We need current locations snapshot before the state update
    const allLocs = locations
    const descendantIds = collectDescendants(id, allLocs)
    const allIdsToDelete = [id, ...descendantIds]

    // Optimistic removal of location + all descendants
    setLocations((prev) => prev.filter((loc) => !allIdsToDelete.includes(loc.id)))

    // Null out location_id on any items assigned to deleted locations
    setItems((prev) =>
      prev.map((item) =>
        item.location_id && allIdsToDelete.includes(item.location_id)
          ? { ...item, location_id: null }
          : item,
      ),
    )

    // Delete each location (service handles zone/tag cleanup per location)
    const result = await deleteLocation(id, userId)
    for (const descId of descendantIds) {
      await deleteLocation(descId, userId)
    }

    if (!result.success) {
      await refreshLocations()
    }
    return result
  }, [locations, refreshLocations])

  const doTransfer = useCallback(async (payload: TransferPayload) => {
    const userId = userIdRef.current
    const clinicId = clinicIdRef.current
    if (!userId || !clinicId) return
    const result = await executeTransfer(payload, userId, clinicId)
    if (result.success) {
      await Promise.all([refreshItems(), refreshDiscrepancies()])
    }
    return result
  }, [refreshItems, refreshDiscrepancies])

  const doRectifyDiscrepancy = useCallback(async (id: string, method: string, notes: string) => {
    const userId = userIdRef.current
    if (!userId) return
    const result = await rectifyDiscrepancySvc(id, method, notes, userId)
    if (result.success) {
      await refreshDiscrepancies()
    }
    return result
  }, [refreshDiscrepancies])

  const search = useCallback(async (query: string): Promise<PropertySearchResult[]> => {
    const clinicId = clinicIdRef.current
    if (!clinicId) return []
    return searchProperty(clinicId, query)
  }, [])

  const getSubItems = useCallback(async (parentId: string) => {
    return fetchSubItems(parentId)
  }, [])

  const getLedger = useCallback(async (itemId: string): Promise<CustodyLedgerEntry[]> => {
    return fetchItemLedger(itemId)
  }, [])

  const getHolderDiscrepancies = useCallback(async (holderId: string) => {
    return fetchHolderDiscrepancies(holderId)
  }, [])

  return {
    items,
    locations,
    discrepancies,
    isLoading,
    isSyncing,
    clinicId: clinicIdRef.current,
    addItem,
    editItem,
    removeItem,
    addLocation,
    editLocation,
    removeLocation,
    doTransfer,
    doRectifyDiscrepancy,
    search,
    getSubItems,
    getLedger,
    getHolderDiscrepancies,
    refreshItems,
    refreshLocations,
  }
}
