import { useRef, useState, useCallback, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { Pencil, Package, FolderPlus, Camera, X, Trash2, MapPin, Layers, Wrench } from 'lucide-react'
import type { ContextMenuItem } from '../ContextMenu'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { PropertyLocationTree } from './PropertyLocationTree'
import { PmcsSheet } from './PmcsSheet'
import { ItemTimeline } from '../Timeline/ItemTimeline'

/** Stable empty holders map for vehicle timelines (no custody/move events). */
const EMPTY_HOLDERS: Map<string, HolderInfo> = new Map()

export interface PropertyLocationDetailHandle {
  /** Open the vehicle's PMCS overlay (5988). The trigger lives in the host header
   *  ellipsis (buildLocationMenuItems → onPmcs); the overlay state lives here so
   *  it stays co-located with the subject. No-op for non-vehicle zones. */
  openPmcs: () => void
}

interface PropertyLocationDetailProps {
  location: LocalPropertyLocation
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  holders?: Map<string, HolderInfo>
  /** Tap a child zone → navigate to it (canvas on desktop / re-point the sheet on mobile). */
  onNavigateZone: (locationId: string) => void
  onSelectItem: (item: LocalPropertyItem) => void
  // Tree row actions — drag-to-move, edit, delete, add (mirror the rail/list tree).
  onMoveLocation?: (locationId: string, newParentId: string | null) => void
  onMoveItem?: (itemId: string, newLocationId: string | null) => void
  onEditLocation?: (loc: LocalPropertyLocation) => void
  onEditItem?: (item: LocalPropertyItem) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onAddChildLocation?: (parentId: string | null) => void
  onAddItemAtLocation?: (locationId: string | null) => void
  /** Desktop only — the right-pane element the vehicle PMCS PreviewOverlay scopes to. */
  containerRef?: RefObject<HTMLElement | null>
}

/**
 * PropertyLocationDetail — the selected-zone CONTENT surface (photo + the zone's
 * subtree rendered with the shared PropertyLocationTree, scoped via rootId, so
 * children/items use the canonical tree rows + lifted-clone menus + drag-clone
 * preview instead of bespoke bordered rows). Used in the desktop right pane and
 * the mobile sheet. Header actions live in the host (buildLocationMenuItems).
 */
export const PropertyLocationDetail = forwardRef<PropertyLocationDetailHandle, PropertyLocationDetailProps>(
  function PropertyLocationDetail({
  location,
  locations,
  items,
  holders,
  onNavigateZone,
  onSelectItem,
  onMoveLocation,
  onMoveItem,
  onEditLocation,
  onEditItem,
  onDeleteLocation,
  onDeleteItem,
  onAddChildLocation,
  onAddItemAtLocation,
  containerRef,
}: PropertyLocationDetailProps, ref) {
  const [showPmcs, setShowPmcs] = useState(false)
  useImperativeHandle(ref, () => ({ openPmcs: () => setShowPmcs(true) }), [])

  return (
    <div className="flex flex-col pt-1 pb-2">
      {location.photo_data && (
        <div className="px-4 pb-1">
          <img src={location.photo_data} alt={location.name} className="w-full h-40 object-cover rounded-xl border border-tertiary/15" />
        </div>
      )}

      {/* A vehicle is property too — its own 5988 paper trail above the BII/
          components it holds (the tree below). PMCS itself is the overlay,
          launched from the header ellipsis (openPmcs handle). */}
      {location.kind === 'vehicle' && (
        <div className="px-4 pt-1 pb-3 space-y-4">
          <ItemTimeline
            subjectId={location.id}
            clinicId={location.clinic_id}
            locations={locations}
            holders={holders ?? EMPTY_HOLDERS}
          />
        </div>
      )}

      {location.kind === 'vehicle' && (
        <PmcsSheet
          isOpen={showPmcs}
          onClose={() => setShowPmcs(false)}
          subjectType="location"
          subjectId={location.id}
          clinicId={location.clinic_id}
          containerRef={containerRef}
        />
      )}

      <PropertyLocationTree
        rootId={location.id}
        locations={locations}
        items={items}
        holders={holders}
        onSelectLocation={(loc) => onNavigateZone(loc.id)}
        onSelectItem={onSelectItem}
        onMoveLocation={onMoveLocation}
        onMoveItem={onMoveItem}
        onEditLocation={onEditLocation}
        onEditItem={onEditItem}
        onDeleteLocation={onDeleteLocation}
        onDeleteItem={onDeleteItem}
        onAddChildLocation={onAddChildLocation}
        onAddItemAtLocation={onAddItemAtLocation}
      />
    </div>
  )
})

/** Build the location action menu (header ellipsis) — shared by desktop pane + mobile sheet. */
export function buildLocationMenuItems(opts: {
  location: LocalPropertyLocation
  canDelete: boolean
  onRename: () => void
  onNewItem: () => void
  onNewArea: () => void
  /** Add a building floor (kind='level') to this zone. Shown only when canAddLevel. */
  onAddLevel?: () => void
  /** True when this zone can hold floors (a structural zone, not a person/level/root). */
  canAddLevel?: boolean
  onPhoto: () => void
  onRemovePhoto: () => void
  onLinkMap: () => void
  onDelete: () => void
  /** Open the vehicle PMCS (5988) overlay. Shown only for kind='vehicle' zones. */
  onPmcs?: () => void
}): ContextMenuItem[] {
  const hasPhoto = !!opts.location.photo_data
  const hasMapLink = !!opts.location.overlay_id
  const isVehicle = opts.location.kind === 'vehicle'
  return [
    { key: 'rename', label: 'Rename', icon: Pencil, onAction: opts.onRename },
    ...(isVehicle && opts.onPmcs
      ? [{ key: 'pmcs', label: 'PMCS', icon: Wrench, onAction: opts.onPmcs } as ContextMenuItem]
      : []),
    { key: 'new-item', label: 'New item', icon: Package, onAction: opts.onNewItem },
    { key: 'new-area', label: 'New area', icon: FolderPlus, onAction: opts.onNewArea },
    ...(opts.canAddLevel && opts.onAddLevel
      ? [{ key: 'add-level', label: 'Add level', icon: Layers, onAction: opts.onAddLevel } as ContextMenuItem]
      : []),
    { key: 'link-map', label: hasMapLink ? 'Map link' : 'Link to map', icon: MapPin, onAction: opts.onLinkMap },
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
