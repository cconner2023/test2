import { useMemo, memo } from 'react'
import { Package } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyDashboardProps {
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  searchQuery?: string
  onSelectItem: (item: LocalPropertyItem) => void
}

interface LocationGroup {
  id: string | null
  name: string
  items: LocalPropertyItem[]
}

export const PropertyDashboard = memo(function PropertyDashboard({
  items,
  locations,
  holders,
  searchQuery = '',
  onSelectItem,
}: PropertyDashboardProps) {
  const visibleLocations = useMemo(
    () => locations.filter((l) => l.name !== ROOT_LOCATION_NAME),
    [locations],
  )

  // Build a map from location id → root ancestor id
  const rootAncestorMap = useMemo(() => {
    const parentMap = new Map<string, string | null>()
    for (const loc of visibleLocations) {
      parentMap.set(loc.id, loc.parent_id)
    }
    const cache = new Map<string, string>()
    function findRoot(id: string): string {
      if (cache.has(id)) return cache.get(id)!
      const parentId = parentMap.get(id)
      if (!parentId || !parentMap.has(parentId)) {
        cache.set(id, id)
        return id
      }
      const root = findRoot(parentId)
      cache.set(id, root)
      return root
    }
    for (const loc of visibleLocations) {
      findRoot(loc.id)
    }
    return cache
  }, [visibleLocations])

  const locationNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of visibleLocations) {
      map.set(loc.id, loc.name)
    }
    return map
  }, [visibleLocations])

  // Filter items by search
  const filteredItems = useMemo(() => {
    let list = items.filter((i) => !i.parent_item_id)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.nomenclature?.toLowerCase().includes(q) ||
          i.nsn?.toLowerCase().includes(q) ||
          i.serial_number?.toLowerCase().includes(q),
      )
    }
    return list
  }, [items, searchQuery])

  // Group items by root ancestor location
  const locationGroups = useMemo(() => {
    const groups = new Map<string | null, LocalPropertyItem[]>()

    for (const item of filteredItems) {
      const rootId = item.location_id ? (rootAncestorMap.get(item.location_id) ?? item.location_id) : null
      const existing = groups.get(rootId) || []
      existing.push(item)
      groups.set(rootId, existing)
    }

    const result: LocationGroup[] = []

    // Named locations first, sorted alphabetically
    const sortedLocationIds = [...groups.keys()]
      .filter((id): id is string => id !== null)
      .sort((a, b) => (locationNameMap.get(a) ?? '').localeCompare(locationNameMap.get(b) ?? ''))

    for (const locId of sortedLocationIds) {
      result.push({
        id: locId,
        name: locationNameMap.get(locId) ?? 'Unknown Location',
        items: groups.get(locId)!.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }

    // Unassigned at the bottom
    const unassigned = groups.get(null)
    if (unassigned?.length) {
      result.push({
        id: null,
        name: 'Unassigned',
        items: unassigned.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }

    return result
  }, [filteredItems, rootAncestorMap, locationNameMap])

  // Summary stats
  const stats = useMemo(() => {
    const topLevel = items.filter((i) => !i.parent_item_id)
    const total = topLevel.length
    const serviceable = topLevel.filter((i) => i.condition_code === 'serviceable').length
    const missing = topLevel.filter((i) => i.condition_code === 'missing').length
    const damaged = topLevel.filter((i) => i.condition_code === 'damaged').length
    const unserviceable = topLevel.filter((i) => i.condition_code === 'unserviceable').length
    return { total, serviceable, missing, damaged, unserviceable }
  }, [items])

  function resolveHolder(holderId: string | null): string | null {
    if (!holderId) return null
    return holders.get(holderId)?.displayName ?? null
  }

  function resolveLocationName(locationId: string | null): string | null {
    if (!locationId) return null
    return locationNameMap.get(locationId) ?? null
  }

  if (stats.total === 0) {
    return (
      <EmptyState
        icon={<Package size={28} className="text-tertiary/30" />}
        title="No property items"
        subtitle="Add items to start tracking your property book"
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Summary bar */}
      <div className="shrink-0 px-4 py-3 border-b border-tertiary/10">
        <div className="flex items-center gap-3 text-[9pt] text-tertiary">
          <span className="font-medium text-primary">{stats.total} items</span>
          <span className="text-tertiary/30">|</span>
          <span>{stats.serviceable} serviceable</span>
          {stats.missing > 0 && (
            <>
              <span className="text-tertiary/30">|</span>
              <span className="text-themeredred font-medium">{stats.missing} missing</span>
            </>
          )}
          {stats.damaged > 0 && (
            <>
              <span className="text-tertiary/30">|</span>
              <span className="text-themeyellow font-medium">{stats.damaged} damaged</span>
            </>
          )}
          {stats.unserviceable > 0 && (
            <>
              <span className="text-tertiary/30">|</span>
              <span className="font-medium">{stats.unserviceable} unserviceable</span>
            </>
          )}
        </div>
      </div>

      {/* Location-grouped sections */}
      <div className="flex-1 min-h-0 px-4 py-4 space-y-5">
        {locationGroups.map((group) => (
          <div key={group.id ?? '__unassigned'}>
            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
              {group.name}
            </p>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-primary truncate block">{item.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {resolveLocationName(item.location_id) && group.id !== null && (
                        <span className="text-[9pt] text-tertiary/60 truncate">
                          {resolveLocationName(item.location_id)}
                        </span>
                      )}
                      {resolveHolder(item.current_holder_id) && (
                        <span className="text-[9pt] text-secondary truncate">
                          {resolveHolder(item.current_holder_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9pt] text-tertiary/60 shrink-0 tabular-nums">
                    {item.quantity ?? 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {locationGroups.length === 0 && searchQuery.trim() && (
          <EmptyState title="No items match your search" />
        )}
      </div>
    </div>
  )
})
