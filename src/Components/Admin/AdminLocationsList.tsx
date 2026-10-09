import { useState, useEffect, useMemo } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { listLocations, type AdminLocation } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { EmptyState } from '@/Components/primitives/EmptyState'

interface AdminLocationsListProps {
  searchQuery: string
  activeId?: string | null
  onSelect: (loc: AdminLocation) => void
  onCreate: () => void
}

/**
 * Locations — managed reference data, not a hierarchy axis (an org can sit in a
 * different location than its parent), so they get their own section rather
 * than nesting in the Directory tree.
 */
export function AdminLocationsList({ searchQuery, activeId, onSelect, onCreate }: AdminLocationsListProps) {
  const gen = useInvalidation('locations')
  const [locations, setLocations] = useState<AdminLocation[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listLocations().then(l => { if (!cancelled) setLocations(l) })
    return () => { cancelled = true }
  }, [gen])

  const q = searchQuery.trim().toLowerCase()
  const visible = useMemo(() => (locations ?? []).filter(l => !q
    || [l.display_name, l.installation, l.sub_area, l.command, l.country_code].some(f => (f ?? '').toLowerCase().includes(q)),
  ), [locations, q])

  if (!locations) return null
  if (locations.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState title="No locations yet" action={{ icon: Plus, label: 'New location', onClick: onCreate }} />
      </div>
    )
  }
  if (visible.length === 0) return <EmptyState title="No matches" bordered={false} />

  return (
    <>
      {visible.map(loc => (
        <ListItemRow
          key={loc.id}
          onClick={() => onSelect(loc)}
          className={`px-4 py-3 border-l-2 transition-colors ${
            activeId === loc.id ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
          }`}
          left={
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/10">
              <MapPin size={16} className="text-themeblue2" />
            </span>
          }
          center={
            <>
              <p className="text-[10pt] font-medium text-primary truncate">{loc.display_name}</p>
              {loc.command && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{loc.command}</p>}
            </>
          }
        />
      ))}
    </>
  )
}
