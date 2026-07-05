import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, ChevronRight } from 'lucide-react'
import { listLocations } from '../../lib/adminService'
import type { AdminLocation } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { EmptyState } from '../EmptyState'

interface AdminSettingsContentProps {
  /** Open a location's detail (view/edit) — reuses the drawer's location pane. */
  onSelectLocation: (loc: AdminLocation) => void
  /** Open location create mode. */
  onCreateLocation: () => void
}

/**
 * Admin settings surface — currently locations management, lifted out of the
 * tab island and into a sheet (calendar-settings pattern). Locations aren't a
 * clean hierarchy parent (an org can sit in a different location than its
 * parent), so they live here as managed reference data rather than a primary
 * nav axis. Rows reuse the conversation-panel visual; tapping one opens the
 * existing location detail pane.
 */
export function AdminSettingsContent({ onSelectLocation, onCreateLocation }: AdminSettingsContentProps) {
  const gen = useInvalidation('locations')
  const [locations, setLocations] = useState<AdminLocation[]>([])

  const load = useCallback(async () => {
    setLocations(await listLocations())
  }, [])

  useEffect(() => { load() }, [load, gen])

  return (
    <div>
      {/* Locations — header + inline add (circular themeblue3 + button). */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-1.5">
        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider flex-1">Locations</p>
        <button
          type="button"
          onClick={onCreateLocation}
          aria-label="New location"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="px-4 py-2">
          <EmptyState title="No locations yet" />
        </div>
      ) : (
        <div className="divide-y divide-themeblue3/10">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelectLocation(loc)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/10">
                <MapPin size={16} className="text-themeblue2" />
              </div>
              <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{loc.display_name}</span>
              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
