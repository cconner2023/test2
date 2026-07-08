import { useState, useCallback, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { Pencil, Package, FolderPlus, Trash2, Layers, Wrench, Route, ClipboardList, QrCode, Download } from 'lucide-react'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { isZoneShadow } from '../../Utilities/propertyAuthorized'
import { downloadBlob } from '../../Utilities/downloadUtils'
import { dataUrlToBlob } from '../../Utilities/imageUtils'
import { PropertyLocationTree } from './PropertyLocationTree'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { PmcsSheet } from './PmcsSheet'
import { DispatchSheet } from './DispatchSheet'
import { ItemTimeline } from '../Timeline/ItemTimeline'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { useDD1750Export } from '../../Hooks/useDD1750Export'
import type { DD1750Item } from '../../Utilities/DD1750Export'
import { useZoneLabelExport } from '../../Hooks/useZoneLabelExport'
import type { LabelItem } from '../../Utilities/PropertyLabelExport'
import { DD1750Sheet } from './DD1750Sheet'

/** Stable empty holders map for vehicle timelines (no custody/move events). */
const EMPTY_HOLDERS: Map<string, HolderInfo> = new Map()

/** Map a live item to a DD 1750 packing-list line. */
const toDD1750Line = (it: LocalPropertyItem): DD1750Item => ({
  name: it.name,
  nomenclature: it.nomenclature,
  nsn: it.nsn,
  serial_number: it.serial_number,
  quantity: it.quantity,
})

/**
 * Collect DD 1750 lines for a zone SUBTREE (the end item + everything packed
 * inside it), pre-order:
 *   1. the zone's direct contents — live, excluding zone-shadows (a shadow is
 *      emitted as its child zone's component line, below — never as loose stock
 *      here). A child is folded into its parent's line ONLY when that parent is a
 *      packed set physically present in this subtree; a LIN-component filler (parent
 *      LIN/shadow not listed here) is emitted as its own line;
 *   2. for each child zone: if it's a LIN component (has a zone-shadow) emit that
 *      shadow as the component line, then recurse into the child.
 * So zone A → A's items, then child zone B (as a LIN-component line), then B's
 * items, then B's children, … The root zone itself is the END ITEM (box 3), so
 * its own shadow is never listed — only descendants' shadows are.
 */
function collectDD1750Lines(
  rootId: string,
  items: LocalPropertyItem[],
  locations: LocalPropertyLocation[],
): DD1750Item[] {
  // Zone ids in this subtree — gathered first so a content item can tell a PACKED
  // SKO (its container is itself a physical line IN this list → child rides it, one
  // line) from a LIN-COMPONENT filler (its parent LIN is a standalone item-LIN with
  // location_id null, or a zone-shadow — never emitted here, so the filler must be
  // its own line). Suppressing on `parent_item_id !== null` alone dropped the latter.
  const zoneIds = new Set<string>()
  const collectZones = (zoneId: string) => {
    if (zoneIds.has(zoneId)) return
    zoneIds.add(zoneId)
    for (const l of locations) if (l.parent_id === zoneId && !l.deleted_at) collectZones(l.id)
  }
  collectZones(rootId)
  // Ids of items that DO appear as their own physical line in the subtree (live,
  // located in a subtree zone, not a shadow). A content item is suppressed ONLY when
  // its parent is one of these — i.e. it is packed inside a set that is itself listed.
  const presentIds = new Set(
    items
      .filter(
        (it) =>
          it.location_id != null &&
          zoneIds.has(it.location_id) &&
          !it.deleted_at &&
          !it.turned_in_at &&
          !it.represents_location_id,
      )
      .map((it) => it.id),
  )
  const seen = new Set<string>() // cycle guard (offline sync could theoretically loop parent_id)
  const walk = (zoneId: string): DD1750Item[] => {
    if (seen.has(zoneId)) return []
    seen.add(zoneId)
    const out: DD1750Item[] = []
    const contents = items.filter(
      (it) =>
        it.location_id === zoneId &&
        !it.deleted_at &&
        !it.turned_in_at &&
        !it.represents_location_id &&
        (it.parent_item_id === null || !presentIds.has(it.parent_item_id)),
    )
    out.push(...contents.map(toDD1750Line))
    const children = locations.filter((l) => l.parent_id === zoneId && !l.deleted_at)
    for (const child of children) {
      const shadow = items.find((it) => isZoneShadow(it) && it.represents_location_id === child.id)
      if (shadow) out.push(toDD1750Line(shadow))
      out.push(...walk(child.id))
    }
    return out
  }
  return walk(rootId)
}

export interface PropertyLocationDetailHandle {
  /** Open the vehicle's PMCS overlay (5988). The trigger lives in the host header
   *  ellipsis (buildLocationMenuItems → onPmcs); the overlay state lives here so
   *  it stays co-located with the subject. No-op for non-vehicle zones. */
  openPmcs: () => void
  /** Open the vehicle's Dispatch overlay (DA 5982/5987). Same host-ellipsis
   *  trigger pattern as openPmcs (buildLocationMenuItems → onDispatch). */
  openDispatch: () => void
  /** Generate a DD 1750 packing list for THIS zone as the END ITEM — its contents
   *  plus every child zone (LIN-component shadow line) and their nested contents,
   *  recursively (see collectDD1750Lines). Same host-ellipsis trigger pattern
   *  (buildLocationMenuItems → onDD1750); the preview overlay lives here. */
  openDD1750: () => void
  /** Generate a Data Matrix label sheet (BCN-ZONE:<id>) for THIS zone — the zone
   *  sibling of item labels. Same host-ellipsis trigger (→ onPrintLabel). */
  openPrintLabel: () => void
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
  /** Open the shared item action menu for a tree item row (panel-hosted). */
  onOpenItemMenu?: (item: LocalPropertyItem, rect: DOMRect) => void
  onDeleteLocation?: (locId: string) => void
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
  onOpenItemMenu,
  onDeleteLocation,
  onAddChildLocation,
  onAddItemAtLocation,
  drawerRef,
}: PropertyLocationDetailProps, ref) {
  const isMobile = useIsMobile()
  const [showPmcs, setShowPmcs] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const { exportDD1750, dd1750Preview, downloadDD1750, clearDD1750Preview, status: dd1750Status } = useDD1750Export()
  const { exportZoneLabels, zoneLabelPreview, downloadZoneLabels, clearZoneLabelPreview, status: zoneLabelStatus } = useZoneLabelExport()
  const [showDD1750, setShowDD1750] = useState(false)

  // DD 1750 = this zone as the END ITEM plus everything packed inside it,
  // RECURSIVELY: the zone's direct contents (top-level → a packed SKO stays one
  // line), then each child zone that is a LIN component (its shadow line) and all
  // of that child's contents, on down the subtree. Live rows only (not tombstoned,
  // not turned in). packed-by / reviewed-by come from the picker sheet.
  const handleDD1750Create = useCallback((opts: { packedBy?: string; reviewedBy?: string }) => {
    const lines = collectDD1750Lines(location.id, items, locations)
    const date = new Date().toISOString().slice(0, 10)
    void exportDD1750({ zoneName: location.name, packedBy: opts.packedBy, reviewedBy: opts.reviewedBy, date, items: lines })
    setShowDD1750(false)
  }, [items, locations, location.id, location.name, exportDD1750])

  // Print a Data Matrix label (BCN-ZONE:<id>) for THIS zone — the zone sibling of
  // item labels. Single label, no NSN, default 'standard' (Avery 5160) stock.
  const handlePrintLabel = useCallback(() => {
    const label: LabelItem = { id: location.id, name: location.name, nsn: null }
    void exportZoneLabels({ items: [label], geometry: 'standard' })
  }, [location.id, location.name, exportZoneLabels])

  useImperativeHandle(ref, () => ({
    openPmcs: () => setShowPmcs(true),
    openDispatch: () => setShowDispatch(true),
    openDD1750: () => setShowDD1750(true),
    openPrintLabel: handlePrintLabel,
  }), [handlePrintLabel])

  // The zone photo already IS the map tile background — so the detail doesn't
  // re-preview it. Instead we surface it as a downloadable file (edit lives in
  // the zone Edit form). resizeImage always writes JPEG; older data may be PNG.
  const photoExt = location.photo_data?.startsWith('data:image/png') ? 'png' : 'jpg'
  const photoFilename = `${(location.name || 'photo').trim().replace(/[^\w.-]+/g, '_') || 'photo'}.${photoExt}`
  const handleDownloadPhoto = useCallback(() => {
    if (location.photo_data) downloadBlob(dataUrlToBlob(location.photo_data), photoFilename)
  }, [location.photo_data, photoFilename])

  return (
    <div className="flex flex-col pt-1 pb-2">
      {location.photo_data && (
        <button
          type="button"
          onClick={handleDownloadPhoto}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/5 active:opacity-70 transition-colors"
        >
          <span className="flex-1 min-w-0 text-[10pt] text-primary truncate">{photoFilename}</span>
          <Download size={15} className="shrink-0 text-tertiary" />
        </button>
      )}

      <PropertyLocationTree
        rootId={location.id}
        hoverActions={!isMobile}
        locations={locations}
        items={items}
        holders={holders}
        onSelectLocation={(loc) => onNavigateZone(loc.id)}
        onSelectItem={onSelectItem}
        onEditLocation={onEditLocation}
        onOpenItemMenu={onOpenItemMenu}
        onDeleteLocation={onDeleteLocation}
        onAddChildLocation={onAddChildLocation}
        onAddItemAtLocation={onAddItemAtLocation}
      />

      {/* A vehicle is property too — its own 5988 paper trail below the BII/
          components it holds (the tree above). PMCS itself is the overlay,
          launched from the header ellipsis (openPmcs handle). */}
      {location.kind === 'vehicle' && (
        <div className="px-4 pt-1 pb-3 space-y-4">
          <ItemTimeline
            subjectId={location.id}
            clinicId={location.clinic_id}
            locations={locations}
            holders={holders ?? EMPTY_HOLDERS}
            hideWhenEmpty
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

      {/* DD 1750 packing list for this zone — any zone, generated on demand.
          High z so it floats above the detail sheet on mobile. */}
      <PdfPreviewModal
        preview={dd1750Preview}
        generating={dd1750Status === 'generating'}
        onDownload={downloadDD1750}
        onClose={clearDD1750Preview}
        zIndex={1600}
      />

      {/* Data Matrix label sheet for this zone (BCN-ZONE) — print + affix to the container. */}
      <PdfPreviewModal
        preview={zoneLabelPreview}
        generating={zoneLabelStatus === 'generating'}
        onDownload={downloadZoneLabels}
        onClose={clearZoneLabelPreview}
        zIndex={1600}
      />

      {/* DD 1750 packed-by / reviewed-by picker → onCreate runs the export above. */}
      <DD1750Sheet
        isOpen={showDD1750}
        onClose={() => setShowDD1750(false)}
        onCreate={handleDD1750Create}
        containerRef={drawerRef}
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
  onDelete: () => void
  /** Open the vehicle PMCS (5988) overlay. Shown only for kind='vehicle' zones. */
  onPmcs?: () => void
  /** Open the vehicle Dispatch (DA 5982/5987) overlay. Shown only for vehicles. */
  onDispatch?: () => void
  /** Generate a DD 1750 packing list for this zone. Shown for any zone when passed. */
  onDD1750?: () => void
  /** Print a Data Matrix label for this zone. Shown for any zone when passed. */
  onPrintLabel?: () => void
}): ContextMenuItem[] {
  const isVehicle = opts.location.kind === 'vehicle'
  return [
    { key: 'edit', label: 'Edit', icon: Pencil, onAction: opts.onEdit },
    ...(isVehicle && opts.onPmcs
      ? [{ key: 'pmcs', label: 'PMCS', icon: Wrench, onAction: opts.onPmcs } as ContextMenuItem]
      : []),
    ...(isVehicle && opts.onDispatch
      ? [{ key: 'dispatch', label: 'Dispatch', icon: Route, onAction: opts.onDispatch } as ContextMenuItem]
      : []),
    ...(opts.onDD1750
      ? [{ key: 'dd1750', label: 'DD 1750', icon: ClipboardList, onAction: opts.onDD1750 } as ContextMenuItem]
      : []),
    ...(opts.onPrintLabel
      ? [{ key: 'print-label', label: 'Print label', icon: QrCode, onAction: opts.onPrintLabel } as ContextMenuItem]
      : []),
    { key: 'new-item', label: 'New item', icon: Package, onAction: opts.onNewItem },
    { key: 'new-area', label: 'New area', icon: FolderPlus, onAction: opts.onNewArea },
    ...(opts.canAddLevel && opts.onAddLevel
      ? [{ key: 'add-level', label: 'Add level', icon: Layers, onAction: opts.onAddLevel } as ContextMenuItem]
      : []),
    ...(opts.canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: opts.onDelete } as ContextMenuItem] : []),
  ]
}
