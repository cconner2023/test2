/**
 * AdminLocationsList.tsx
 *
 * Lists all non-archived locations. Mirrors AdminClinicsList structure
 * (search-driven, tap-to-open detail). Right-click / long-press / ellipsis on a
 * row raises the iOS lifted-clone context menu (Edit + Delete), the same gesture
 * used by the property location list and messaging rows. Delete archives the row
 * (soft-delete) once it is confirmed and no clinic references it.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MapPin, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionCard } from '@/Components/primitives/Section'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { AdminListSkeleton } from './AdminSkeletons'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { listLocations, listClinics, archiveLocation } from '../../lib/adminService'
import type { AdminLocation, AdminClinic } from '../../lib/adminService'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { findSubdivisionName } from '../../lib/iso3166'

interface AdminLocationsListProps {
  onSelectLocation: (location: AdminLocation) => void
  onEditLocation?: (location: AdminLocation) => void
  onCreateLocation: () => void
  searchQuery?: string
  bare?: boolean
  /** When true, renders as a labelled section inside the unified Directory tab. */
  embedded?: boolean
  /** Section heading shown above the list in embedded mode. */
  title?: string
}

export function AdminLocationsList({
  onSelectLocation,
  onEditLocation,
  searchQuery: searchQueryProp,
  bare,
  embedded,
  title,
}: AdminLocationsListProps) {
  const searchQuery = searchQueryProp ?? ''
  const gen = useInvalidation('locations', 'clinics')

  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  const [contextMenu, setContextMenu] = useState<{ id: string; rect: DOMRect } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminLocation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const openRowMenu = useCallback((id: string, rect: DOMRect) => {
    setContextMenu({ id, rect })
  }, [])

  // Delete = soft-archive. Blocked while clinics still reference the location —
  // the FK is ON DELETE RESTRICT, so surface the blocker instead of failing.
  const requestDelete = useCallback((loc: AdminLocation) => {
    setContextMenu(null)
    const count = clinicCountByLocation.get(loc.id) ?? 0
    if (count > 0) {
      setError(`Cannot delete ${loc.display_name} — referenced by ${count} cluster${count !== 1 ? 's' : ''}. Reassign or archive ${count === 1 ? 'it' : 'them'} first.`)
      return
    }
    setError(null)
    setConfirmDelete(loc)
  }, [clinicCountByLocation])

  const confirmDeleteAction = useCallback(async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const result = await archiveLocation(confirmDelete.id)
    setDeleting(false)
    setConfirmDelete(null)
    if (result.success) {
      invalidate('locations')
    } else {
      setError(result.error || 'Failed to delete location')
    }
  }, [confirmDelete])

  const renderItems = () => filtered.map(loc => (
    <LocationCard
      key={loc.id}
      location={loc}
      allLocations={locations}
      clinicCount={clinicCountByLocation.get(loc.id) ?? 0}
      onTap={() => onSelectLocation(loc)}
      onMenu={openRowMenu}
    />
  ))

  const menuLocation = contextMenu ? locations.find(l => l.id === contextMenu.id) ?? null : null
  const overlays = (
    <>
      {contextMenu && menuLocation && (() => {
        const loc = menuLocation
        const items: ContextMenuItem[] = [
          ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditLocation(loc) }] : []),
          { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => requestDelete(loc) },
        ]
        return (
          <LiftedRowMenu
            isOpen
            layout="list"
            anchorRect={contextMenu.rect}
            onClose={() => setContextMenu(null)}
            items={items}
            row={(
              <div className="flex items-center gap-3 px-4 py-3.5 bg-themewhite">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                  <MapPin size={16} className="text-tertiary" />
                </div>
                <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{loc.display_name}</span>
              </div>
            )}
          />
        )
      })()}

      <ConfirmDialog
        visible={!!confirmDelete}
        title={`Delete ${confirmDelete?.display_name ?? 'location'}?`}
        subtitle="Archives the location. Clinics keep their reference but it no longer appears in pickers."
        confirmLabel="Delete"
        variant="danger"
        processing={deleting}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )

  if (bare) {
    if (filtered.length === 0) return null
    return <>{renderItems()}{overlays}</>
  }

  // ── Embedded mode: labelled section inside the Directory tab ──
  if (embedded) {
    if (filtered.length === 0 && searchQuery) return null
    return (
      <section className="space-y-2">
        {title && (
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-[11pt] font-semibold text-primary">{title}</h3>
            <span className="text-[9pt] text-tertiary">{filtered.length}</span>
          </div>
        )}
        {error && <div className="mb-1"><ErrorDisplay message={error} /></div>}
        {showLoading ? (
          <AdminListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState title="No locations" />
        ) : (
          <SectionCard>{renderItems()}</SectionCard>
        )}
        {overlays}
      </section>
    )
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-4">
        {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}
        {showLoading ? (
          <AdminListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState title={searchQuery ? 'No locations match your search.' : 'No locations'} />
        ) : (
          <SectionCard>
            {renderItems()}
          </SectionCard>
        )}
      </div>
      {overlays}
    </div>
  )
}

interface LocationCardProps {
  location: AdminLocation
  allLocations: AdminLocation[]
  clinicCount: number
  onTap: () => void
  onMenu: (id: string, rect: DOMRect) => void
}

function LocationCard({ location, allLocations, clinicCount, onTap, onMenu }: LocationCardProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const longPress = useRef<number | null>(null)
  const preventTap = useRef(false)

  const fireMenu = useCallback(() => {
    if (rowRef.current) onMenu(location.id, rowRef.current.getBoundingClientRect())
  }, [onMenu, location.id])

  const clearLongPress = useCallback(() => {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
  }, [])

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-label={`Open location ${location.display_name}`}
      onClick={() => { if (preventTap.current) { preventTap.current = false; return } onTap() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); fireMenu() }}
      onTouchStart={() => {
        preventTap.current = false
        longPress.current = window.setTimeout(() => { preventTap.current = true; fireMenu() }, 500)
      }}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
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
      <button
        onClick={(e) => { e.stopPropagation(); fireMenu() }}
        aria-label="More actions"
        className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all shrink-0"
      >
        <MoreHorizontal size={16} />
      </button>
      <ChevronRight size={16} className="text-tertiary shrink-0" />
    </div>
  )
}
