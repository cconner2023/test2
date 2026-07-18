import { useState, useCallback, useMemo, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { Pencil, Package, FolderPlus, Trash2, Layers, Wrench, Route, ClipboardList, QrCode, Rows3 } from 'lucide-react'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { PmcsSheet } from './PmcsSheet'
import { DispatchSheet } from './DispatchSheet'
import { DD1750Sheet } from './DD1750Sheet'
import { isStructuralZone } from './levelUtils'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../../Utilities/propertyAuthorized'
import { useDD1750Export } from '../../Hooks/useDD1750Export'
import { useZoneLabelExport } from '../../Hooks/useZoneLabelExport'
import type { DD1750Item } from '../../Utilities/DD1750Export'
import type { LabelItem } from '../../Utilities/PropertyLabelExport'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'

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

/** Build the zone/location action menu — the single item set shared by the tree row
 *  ellipsis, the zone-detail header, and any child-zone row inside a detail. */
function buildLocationMenuItems(opts: {
  location: LocalPropertyLocation
  canDelete: boolean
  onEdit: () => void
  onNewItem: () => void
  /** Bulk-edit every item in this zone in the grid. Shown only when the zone has items. */
  onEditItems?: () => void
  onNewArea: () => void
  /** Add a building floor (kind='level'). Shown only when canAddLevel. */
  onAddLevel?: () => void
  /** True when this zone can hold floors (a structural zone, not a person/level/root). */
  canAddLevel?: boolean
  onDelete: () => void
  /** Open the vehicle PMCS (5988) overlay. Shown only for kind='vehicle' zones. */
  onPmcs?: () => void
  /** Open the vehicle Dispatch (DA 5982/5987) overlay. Shown only for vehicles. */
  onDispatch?: () => void
  /** Generate a DD 1750 packing list for this zone. */
  onDD1750?: () => void
  /** Print a Data Matrix label for this zone. */
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
    ...(opts.onEditItems
      ? [{ key: 'edit-items', label: 'Edit items', icon: Rows3, onAction: opts.onEditItems } as ContextMenuItem]
      : []),
    { key: 'new-area', label: 'New area', icon: FolderPlus, onAction: opts.onNewArea },
    ...(opts.canAddLevel && opts.onAddLevel
      ? [{ key: 'add-level', label: 'Add level', icon: Layers, onAction: opts.onAddLevel } as ContextMenuItem]
      : []),
    ...(opts.canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: opts.onDelete } as ContextMenuItem] : []),
  ]
}

export interface LocationActionMenuHandle {
  /** Open the shared zone action menu anchored to a trigger's bounding rect —
   *  called from the location tree rows AND the zone-detail header. */
  openMenu: (location: LocalPropertyLocation, anchor: DOMRect) => void
}

interface LocationActionMenuProps {
  /** Full item set — DD 1750 subtree collection + the "Edit items" availability check. */
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  /** The property drawer/pane the co-located overlays (PMCS/Dispatch/DD1750) scope
   *  to on desktop. Null on mobile → centered/floated above the detail sheet. */
  containerRef?: RefObject<HTMLElement | null>
  onEdit: (loc: LocalPropertyLocation) => void
  onNewItem: (loc: LocalPropertyLocation) => void
  onNewArea: (loc: LocalPropertyLocation) => void
  /** Add a building floor to a structural zone (the menu gates on isStructuralZone). */
  onAddLevel: (loc: LocalPropertyLocation) => void
  /** Open the bulk item grid for this zone (menu gates on the zone having editable stock). */
  onEditItems: (loc: LocalPropertyLocation) => void
  onDelete: (loc: LocalPropertyLocation) => void
  /** Whether delete is offered at all (host has a delete flow). The default cluster
   *  zone (BAS) is a standing concept and is never deletable regardless. */
  canDelete?: boolean
}

/**
 * The single, shared property-ZONE action menu — the location sibling of
 * ItemActionMenu. Mounted ONCE by PropertyPanel and driven imperatively (openMenu)
 * from every surface: the location tree rows (tree + scoped detail sub-tree) and the
 * zone-detail header ellipsis. Co-locates the vehicle PMCS / Dispatch overlays, the
 * DD 1750 packing-list flow (picker → PDF), and the zone Data Matrix label print, so
 * the surfaces can't drift and those actions work from any row — not just the open
 * detail. Host actions (edit form, add-zone draw flow, add item, edit-items grid,
 * delete confirm) call the props.
 */
export const LocationActionMenu = forwardRef<LocationActionMenuHandle, LocationActionMenuProps>(
  function LocationActionMenu({ items, locations, containerRef, onEdit, onNewItem, onNewArea, onAddLevel, onEditItems, onDelete, canDelete }, ref) {
  // The LATCHED subject: survives the menu closing so an open sheet keeps its zone.
  const [active, setActive] = useState<LocalPropertyLocation | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [showPmcs, setShowPmcs] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const [showDD1750, setShowDD1750] = useState(false)

  const { exportDD1750, dd1750Preview, downloadDD1750, clearDD1750Preview, status: dd1750Status } = useDD1750Export()
  const { exportZoneLabels, zoneLabelPreview, downloadZoneLabels, clearZoneLabelPreview, status: zoneLabelStatus } = useZoneLabelExport()

  useImperativeHandle(ref, () => ({
    openMenu: (location, anchor) => {
      setActive(location)
      setAnchorRect(anchor)
      setShowPmcs(false)
      setShowDispatch(false)
      setShowDD1750(false)
    },
  }), [])

  // Re-resolve the live zone each render so name/kind stay fresh as the store mutates.
  const location = active ? (locations.find(l => l.id === active.id) ?? active) : null

  // A zone's editable stock (exclude containers, authorized-only pars, zone shadows,
  // and gone stock) — mirrors PropertyPanel.zoneEditItems; drives "Edit items" gating.
  const hasEditableItems = useMemo(() =>
    !!location && items.some(i =>
      i.location_id === location.id && !i.deleted_at && !i.turned_in_at &&
      !isLinContainer(i) && !isAuthTarget(i) && !isZoneShadow(i)
    ), [items, location])

  // DD 1750 = this zone as the END ITEM plus everything packed inside it, recursively.
  const handleDD1750Create = useCallback((opts: { packedBy?: string; reviewedBy?: string }) => {
    if (!location) return
    const lines = collectDD1750Lines(location.id, items, locations)
    const date = new Date().toISOString().slice(0, 10)
    void exportDD1750({ zoneName: location.name, packedBy: opts.packedBy, reviewedBy: opts.reviewedBy, date, items: lines })
    setShowDD1750(false)
  }, [items, locations, location, exportDD1750])

  const handlePrintLabel = useCallback(() => {
    if (!location) return
    const label: LabelItem = { id: location.id, name: location.name, nsn: null }
    void exportZoneLabels({ items: [label], geometry: 'standard' })
  }, [location, exportZoneLabels])

  if (!location) return null

  const isVehicle = location.kind === 'vehicle'

  return (
    <>
      {anchorRect && (
        <LiftedRowMenu
          isOpen
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
          layout="list"
          align="right"
          items={buildLocationMenuItems({
            location,
            // The default cluster zone (BAS) is a standing concept — never deletable.
            canDelete: !!canDelete && !location.is_default_zone,
            onEdit: () => onEdit(location),
            onNewItem: () => onNewItem(location),
            onEditItems: hasEditableItems ? () => onEditItems(location) : undefined,
            onNewArea: () => onNewArea(location),
            canAddLevel: isStructuralZone(location),
            onAddLevel: () => onAddLevel(location),
            onDelete: () => onDelete(location),
            onPmcs: () => setShowPmcs(true),
            onDispatch: () => setShowDispatch(true),
            onDD1750: () => setShowDD1750(true),
            onPrintLabel: handlePrintLabel,
          })}
        />
      )}

      {/* Vehicle 5988 — open faults to correct / clean-check / report. */}
      {isVehicle && (
        <PmcsSheet
          isOpen={showPmcs}
          onClose={() => setShowPmcs(false)}
          subjectType="location"
          subjectId={location.id}
          clinicId={location.clinic_id}
          containerRef={containerRef}
        />
      )}

      {/* Vehicle dispatch (DA 5982/5987). */}
      {isVehicle && (
        <DispatchSheet
          isOpen={showDispatch}
          onClose={() => setShowDispatch(false)}
          subjectId={location.id}
          clinicId={location.clinic_id}
          containerRef={containerRef}
        />
      )}

      {/* DD 1750 packed-by / reviewed-by picker → onCreate runs the export below. */}
      <DD1750Sheet
        isOpen={showDD1750}
        onClose={() => setShowDD1750(false)}
        onCreate={handleDD1750Create}
        containerRef={containerRef}
      />

      {/* DD 1750 packing list — high z so it floats above the detail sheet on mobile. */}
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
    </>
  )
})
