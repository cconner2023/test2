import { useRef, useCallback, useMemo } from 'react'
import { ChevronRight, Pencil, Package, FolderPlus, Camera, X, Trash2 } from 'lucide-react'
import type { ContextMenuItem } from '../ContextMenu'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'

interface PropertyLocationDetailProps {
  location: LocalPropertyLocation
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  /** Tap a child zone → navigate to it (canvas on desktop / re-point the sheet on mobile). */
  onNavigateZone: (locationId: string) => void
  onSelectItem: (item: LocalPropertyItem) => void
}

/**
 * PropertyLocationDetail — the selected-zone CONTENT surface (photo + child zones +
 * items). Used in the desktop right pane and the mobile sheet. Actions live in the
 * host header (ellipsis menu via buildLocationMenuItems), not in the body.
 */
export function PropertyLocationDetail({
  location,
  locations,
  items,
  onNavigateZone,
  onSelectItem,
}: PropertyLocationDetailProps) {
  const childZones = useMemo(
    () => locations.filter((l) => l.parent_id === location.id),
    [locations, location.id],
  )
  const zoneItems = useMemo(
    () => items.filter((i) => i.location_id === location.id),
    [items, location.id],
  )

  return (
    <div className="flex flex-col">
      {location.photo_data && (
        <div className="px-4 pt-4">
          <img src={location.photo_data} alt={location.name} className="w-full h-40 object-cover rounded-xl border border-tertiary/15" />
        </div>
      )}

      <div className="px-4 pt-4">
        {childZones.length === 0 && zoneItems.length === 0 ? (
          <p className="text-[10pt] text-tertiary text-center py-6">Nothing here yet</p>
        ) : (
          <div className="rounded-xl border border-tertiary/12 overflow-hidden">
            {childZones.map((loc) => {
              const count = items.filter((i) => i.location_id === loc.id).length
              return (
                <button
                  key={loc.id}
                  onClick={() => onNavigateZone(loc.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-themeblue3/5 active:bg-themeblue3/10 transition-colors border-b border-tertiary/8 last:border-b-0"
                >
                  <div className="w-2 h-2 rounded-sm bg-themeblue3/40 shrink-0" />
                  <span className="text-sm font-medium text-primary truncate flex-1 text-left">{loc.name}</span>
                  {count > 0 && <span className="text-[10pt] text-tertiary shrink-0">{count}</span>}
                  <ChevronRight size={14} className="text-tertiary shrink-0" />
                </button>
              )
            })}
            {zoneItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-tertiary/5 active:bg-tertiary/10 transition-colors border-b border-tertiary/8 last:border-b-0"
              >
                <span className="text-sm text-primary truncate flex-1 text-left">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="text-[10pt] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-tertiary/10 text-tertiary">{item.quantity}</span>
                )}
                <ChevronRight size={14} className="text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Build the location action menu (header ellipsis) — shared by desktop pane + mobile sheet. */
export function buildLocationMenuItems(opts: {
  location: LocalPropertyLocation
  canDelete: boolean
  onRename: () => void
  onNewItem: () => void
  onNewArea: () => void
  onPhoto: () => void
  onRemovePhoto: () => void
  onDelete: () => void
}): ContextMenuItem[] {
  const hasPhoto = !!opts.location.photo_data
  return [
    { key: 'rename', label: 'Rename', icon: Pencil, onAction: opts.onRename },
    { key: 'new-item', label: 'New item', icon: Package, onAction: opts.onNewItem },
    { key: 'new-area', label: 'New area', icon: FolderPlus, onAction: opts.onNewArea },
    { key: 'photo', label: hasPhoto ? 'Change photo' : 'Add photo', icon: Camera, onAction: opts.onPhoto },
    ...(hasPhoto ? [{ key: 'remove-photo', label: 'Remove photo', icon: X, onAction: opts.onRemovePhoto } as ContextMenuItem] : []),
    ...(opts.canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: opts.onDelete } as ContextMenuItem] : []),
  ]
}

/** Hidden file input + trigger for setting a location's zone photo (resized data-URL). */
export function usePropertyPhotoUpload(onSet: (locationId: string, dataUrl: string | null) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<string | null>(null)

  const trigger = useCallback((locationId: string) => {
    targetRef.current = locationId
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = targetRef.current
    if (!file || !id) return
    try {
      const { resizeImage } = await import('../../Utilities/imageUtils')
      const resized = await resizeImage(file, 800, 0.7)
      onSet(id, resized)
    } catch { /* non-fatal */ }
    e.target.value = ''
    targetRef.current = null
  }, [onSet])

  const input = (
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
  )

  return { trigger, input }
}
