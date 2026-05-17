/**
 * AdminLocationsList.tsx
 *
 * Lists all non-archived locations. Mirrors AdminClinicsList structure
 * (search-driven, tap-to-open detail). Long-press context menu omitted —
 * archive lives in the detail view since it's gated by "no clinics reference
 * this location".
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SectionCard } from '../Section'
import { AdminListSkeleton } from './AdminSkeletons'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { listLocations, listClinics } from '../../lib/adminService'
import type { AdminLocation, AdminClinic } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { findSubdivisionName } from '../../lib/iso3166'

interface AdminLocationsListProps {
  onSelectLocation: (location: AdminLocation) => void
  onCreateLocation: () => void
  searchQuery?: string
  bare?: boolean
}

export function AdminLocationsList({
  onSelectLocation,
  searchQuery: searchQueryProp,
  bare,
}: AdminLocationsListProps) {
  const searchQuery = searchQueryProp ?? ''
  const gen = useInvalidation('locations', 'clinics')

  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [locs, cs] = await Promise.all([listLocations(), listClinics()])
    setLocations(locs)
    setClinics(cs)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData, gen])

  const clinicCountByLocation = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of clinics) {
      if (c.location_id) m.set(c.location_id, (m.get(c.location_id) ?? 0) + 1)
    }
    return m
  }, [clinics])

  const filtered = useMemo(() => {
    if (!searchQuery) return locations
    const q = searchQuery.toLowerCase()
    return locations.filter(l =>
      l.display_name.toLowerCase().includes(q) ||
      l.installation.toLowerCase().includes(q) ||
      (l.sub_area?.toLowerCase().includes(q) ?? false) ||
      l.country_code.toLowerCase() === q ||
      (l.subdivision?.toLowerCase() === q) ||
      (l.command?.toLowerCase().includes(q) ?? false)
    )
  }, [locations, searchQuery])

  const renderItems = () => filtered.map(loc => (
    <LocationCard
      key={loc.id}
      location={loc}
      allLocations={locations}
      clinicCount={clinicCountByLocation.get(loc.id) ?? 0}
      onTap={() => onSelectLocation(loc)}
    />
  ))

  if (bare) {
    if (filtered.length === 0) return null
    return <>{renderItems()}</>
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-4">
        {showLoading ? (
          <AdminListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState title={searchQuery ? 'No locations match your search.' : 'No locations yet — tap + to add one.'} />
        ) : (
          <SectionCard>
            {renderItems()}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

interface LocationCardProps {
  location: AdminLocation
  allLocations: AdminLocation[]
  clinicCount: number
  onTap: () => void
}

function LocationCard({ location, allLocations, clinicCount, onTap }: LocationCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open location ${location.display_name}`}
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
      className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 cursor-pointer select-none"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
        <MapPin size={16} className="text-tertiary" />
      </div>

      <div className="flex-1 min-w-0">
        {location.parent_id && (
          <LocationBreadcrumb
            locationId={location.id}
            allLocations={allLocations}
            excludeLeaf
            className="block text-[8pt] text-tertiary/70 mb-0.5 truncate"
          />
        )}
        <p className="text-sm font-medium text-primary truncate">{location.display_name}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">
          {[
            findSubdivisionName(location.country_code, location.subdivision) ?? location.subdivision,
            location.command,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      <span className="text-[9pt] text-tertiary shrink-0">
        {clinicCount} cluster{clinicCount !== 1 ? 's' : ''}
      </span>
      <ChevronRight size={16} className="text-tertiary shrink-0" />
    </div>
  )
}
