import { useRef, useState, useCallback, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { Pencil, Package, FolderPlus, Camera, X, Trash2, Layers, Wrench, Route } from 'lucide-react'
import type { ContextMenuItem } from '../ContextMenu'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { PropertyLocationTree } from './PropertyLocationTree'
import { PmcsSheet } from './PmcsSheet'
import { DispatchSheet } from './DispatchSheet'
import { ItemTimeline } from '../Timeline/ItemTimeline'

/** Stable empty holders map for vehicle timelines (no custody/move events). */
const EMPTY_HOLDERS: Map<string, HolderInfo> = new Map()

export interface PropertyLocationDetailHandle {
  /** Open the vehicle's PMCS overlay (5988). The trigger lives in the host header
   *  ellipsis (buildLocationMenuItems → onPmcs); the overlay state lives here so
   *  it stays co-located with the subject. No-op for non-vehicle zones. */
  openPmcs: () => void
  /** Open the vehicle's Dispatch overlay (DA 5982/5987). Same host-ellipsis
   *  trigger pattern as openPmcs (buildLocationMenuItems → onDispatch). */
  openDispatch: () => void
}

interface PropertyLocationDetailProps {
  location: LocalPropertyLocation
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  holders?: Map<string, HolderInfo>
  /** Tap a child zone → navigate to it (canvas on desktop / re-point the sheet on mobile). */
  onNavigateZone: (locationId: string) => void
  onSelectItem: (item: LocalPropertyItem) => void
  // Tree row actions — edit, delete, add (mirror the rail/list tree).
  onEditLocation?: (loc: LocalPropertyLocation) => void
  onEditItem?: (item: LocalPropertyItem) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onAddChildLocation?: (parentId: string | null) => void
  onAddItemAtLocation?: (locationId: string | null) => void
  /** The whole property drawer element the vehicle PMCS / Dispatch PreviewOverlays
   *  scope to (dim/center over the entire drawer, not just the pane). Null on mobile
   *  → the overlays float fixed, auto-stacked above the detail sheet. */
  drawerRef?: RefObject<HTMLElement | null>
}

/**
 * PropertyLocationDetail — the selected-zone CONTENT surface (photo + the zone's
 * subtree rendered with the shared PropertyLocationTree, scoped via rootId, so
 * children/items use the canonical tree rows + lifted-clone menus instead of
 * bespoke bordered rows). Used in the desktop right pane and the mobile sheet.
 * Header actions live in the host (buildLocationMenuItems).
 */
export const PropertyLocationDetail = forwardRef<PropertyLocationDetailHandle, PropertyLocationDetailProps>(
  function PropertyLocationDetail({
  location,
  locations,
  items,
  holders,
  onNavigateZone,
  onSelectItem,
  onEditLocation,
  onEditItem,
  onDeleteLocation,
  onDeleteItem,
  onAddChildLocation,
  onAddItemAtLocation,
  drawerRef,
}: PropertyLocationDetailProps, ref) {
  const [showPmcs, setShowPmcs] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  useImperativeHandle(ref, () => ({
    openPmcs: () => setShowPmcs(true),
    openDispatch: () => setShowDispatch(true),
  }), [])

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
          containerRef={drawerRef}
        />
      )}

      {location.kind === 'vehicle' && (
        <DispatchSheet
          isOpen={showDispatch}
          onClose={() => setShowDispatch(false)}
          subjectId={location.id}
          clinicId={location.clinic_id}
          containerRef={drawerRef}
        />
      )}

      <PropertyLocationTree
        rootId={location.id}
        locations={locations}
        items={items}
        holders={holders}
        onSelectLocation={(loc) => onNavigateZone(loc.id)}
        onSelectItem={onSelectItem}
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
  onEdit: () => void
  onNewItem: () => void
  onNewArea: () => void
  /** Add a building floor (kind='level') to this zone. Shown only when canAddLevel. */
  onAddLevel?: () => void
  /** True when this zone can hold floors (a structural zone, not a person/level/root). */
  canAddLevel?: boolean
  onPhoto: () => void
  onRemovePhoto: () => void
  onDelete: () => void
  /** Open the vehicle PMCS (5988) overlay. Shown only for kind='vehicle' zones. */
  onPmcs?: () => void
  /** Open the vehicle Dispatch (DA 5982/5987) overlay. Shown only for vehicles. */
  onDispatch?: () => void
}): ContextMenuItem[] {
  const hasPhoto = !!opts.location.photo_data
  const isVehicle = opts.location.kind === 'vehicle'
  return [
    { key: 'edit', label: 'Edit', icon: Pencil, onAction: opts.onEdit },
    ...(isVehicle && opts.onPmcs
      ? [{ key: 'pmcs', label: 'PMCS', icon: Wrench, onAction: opts.onPmcs } as ContextMenuItem]
      : []),
    ...(isVehicle && opts.onDispatch
      ? [{ key: 'dispatch', label: 'Dispatch', icon: Route, onAction: opts.onDispatch } as ContextMenuItem]
      : []),
    { key: 'new-item', label: 'New item', icon: Package, onAction: opts.onNewItem },
    { key: 'new-area', label: 'New area', icon: FolderPlus, onAction: opts.onNewArea },
    ...(opts.canAddLevel && opts.onAddLevel
      ? [{ key: 'add-level', label: 'Add level', icon: Layers, onAction: opts.onAddLevel } as ContextMenuItem]
      : []),
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
