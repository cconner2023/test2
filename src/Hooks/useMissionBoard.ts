import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CalendarEvent } from '../Types/CalendarTypes'
import type {
  ResourceAllocation,
  AllocationRole,
  WaypointAllocationSummary,
} from '../Types/MissionTypes'
import type { LocalMapOverlay } from '../Types/MapOverlayTypes'
import type { PropertyItem } from '../Types/PropertyTypes'
import { getOverlay } from '../lib/mapOverlayService'
import { usePropertyStore } from '../stores/usePropertyStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('useMissionBoard')

export interface UseMissionBoardResult {
  overlay: LocalMapOverlay | null
  loading: boolean
  error: string | null
  allocations: ResourceAllocation[]
  waypointSummaries: WaypointAllocationSummary[]
  unpositioned: (ResourceAllocation & { resolvedItem?: PropertyItem })[]
  allocate: (
    itemId: string,
    waypointId: string | null,
    role: AllocationRole,
    personnelId?: string | null,
  ) => void
  deallocate: (itemId: string) => void
  updateAllocation: (itemId: string, updates: Partial<ResourceAllocation>) => void
  setAllocations: (allocs: ResourceAllocation[]) => void
}

export function useMissionBoard(event: CalendarEvent | null): UseMissionBoardResult {
  const propertyItems = usePropertyStore(s => s.items)

  const [allocations, setAllocationsState] = useState<ResourceAllocation[]>(
    () => event?.resource_allocations ?? [],
  )
  const [overlay, setOverlay] = useState<LocalMapOverlay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset allocations when the event changes
  useEffect(() => {
    setAllocationsState(event?.resource_allocations ?? [])
  }, [event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load overlay when the linked overlay changes
  useEffect(() => {
    const overlayId = event?.structured_location?.overlay_id
    if (!overlayId) {
      setOverlay(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getOverlay(overlayId)
      .then(result => {
        if (cancelled) return
        if (result.ok) {
          setOverlay(result.data ?? null)
        } else {
          logger.warn('Failed to load overlay', result.error)
          setError(result.error ?? 'Failed to load overlay')
        }
      })
      .catch(e => {
        if (cancelled) return
        logger.error('Unexpected error loading overlay', e)
        setError('Failed to load overlay')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [event?.structured_location?.overlay_id])

  // Build an item lookup map for fast resolution
  const itemMap = useMemo(() => {
    const map = new Map<string, PropertyItem>()
    for (const item of propertyItems) map.set(item.id, item)
    return map
  }, [propertyItems])

  // Allocations with resolved PropertyItem attached
  const resolvedAllocations = useMemo(
    () =>
      allocations.map(a => ({
        ...a,
        resolvedItem: itemMap.get(a.item_id),
      })),
    [allocations, itemMap],
  )

  // Build a set of waypoint IDs present in the overlay
  const waypointIds = useMemo(() => {
    if (!overlay) return new Set<string>()
    return new Set(
      overlay.features.filter(f => f.type === 'waypoint').map(f => f.id),
    )
  }, [overlay])

  // waypointSummaries: group allocations by waypoint
  const waypointSummaries = useMemo<WaypointAllocationSummary[]>(() => {
    if (!overlay) return []
    const waypoints = overlay.features.filter(f => f.type === 'waypoint')
    return waypoints.map(wp => {
      const items = resolvedAllocations.filter(a => a.waypoint_id === wp.id)
      const personnel = [
        ...new Set(
          items
            .map(a => a.personnel_id)
            .filter((p): p is string => Boolean(p)),
        ),
      ]
      return { waypoint: wp, items, personnel }
    })
  }, [overlay, resolvedAllocations])

  // unpositioned: no waypoint_id, or waypoint_id not found in overlay
  const unpositioned = useMemo(
    () =>
      resolvedAllocations.filter(
        a => !a.waypoint_id || !waypointIds.has(a.waypoint_id),
      ),
    [resolvedAllocations, waypointIds],
  )

  const allocate = useCallback(
    (
      itemId: string,
      waypointId: string | null,
      role: AllocationRole,
      personnelId?: string | null,
    ) => {
      setAllocationsState(prev => {
        const existing = prev.findIndex(a => a.item_id === itemId)
        const next: ResourceAllocation = {
          item_id: itemId,
          waypoint_id: waypointId,
          role,
          personnel_id: personnelId ?? null,
        }
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = next
          return updated
        }
        return [...prev, next]
      })
    },
    [],
  )

  const deallocate = useCallback((itemId: string) => {
    setAllocationsState(prev => prev.filter(a => a.item_id !== itemId))
  }, [])

  const updateAllocation = useCallback(
    (itemId: string, updates: Partial<ResourceAllocation>) => {
      setAllocationsState(prev =>
        prev.map(a => (a.item_id === itemId ? { ...a, ...updates } : a)),
      )
    },
    [],
  )

  const setAllocations = useCallback((allocs: ResourceAllocation[]) => {
    setAllocationsState(allocs)
  }, [])

  return {
    overlay,
    loading,
    error,
    allocations,
    waypointSummaries,
    unpositioned,
    allocate,
    deallocate,
    updateAllocation,
    setAllocations,
  }
}
