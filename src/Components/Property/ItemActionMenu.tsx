import { useState, useMemo, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { ScanLine, ArrowRightLeft, GitMerge, Check, MessageSquare, Pencil, Trash2, Wrench, PackageMinus, UserCheck, Users, Eye, Printer, Boxes, Package } from 'lucide-react'
import { SectionCard } from '../Section'
import { type ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionSheet } from '../ActionSheet'
import { PdfPreviewModal } from '../PdfPreviewModal'
import { TextInput, PickerInput } from '../FormInputs'
import { PillButton } from '../HeaderPill'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import type { LabelPresetKey } from '../../Utilities/PropertyLabelExport'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { usePropertyLabelExport } from '../../Hooks/usePropertyLabelExport'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { PmcsSheet } from './PmcsSheet'

export interface ItemActionMenuHandle {
  /** Open the shared item action menu anchored to a trigger's bounding rect. Pass
   *  `{ view: true }` from surfaces where the item isn't already open (tree /
   *  sign-out tab) so a leading "View" row is offered; omit it on the item detail
   *  itself (already focused). */
  openMenu: (item: LocalPropertyItem, anchor: DOMRect, opts?: { view?: boolean }) => void
}

interface ItemActionMenuProps {
  /** Full item set — merge candidates, split destinations, live-item re-resolve. */
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  /** The property drawer/pane the co-located overlays (Split/Merge/Expend/PMCS)
   *  scope to on desktop — they dim/center within it. Null on mobile → centered
   *  fixed above the sheet. */
  containerRef?: RefObject<HTMLElement | null>
  /** Open the item's detail — only emitted (as "View") when the menu is opened with
   *  `{ view: true }`, i.e. from a surface that isn't already showing the item. */
  onView?: (item: LocalPropertyItem) => void
  onEdit?: (item: LocalPropertyItem) => void
  onDelete?: (item: LocalPropertyItem) => void
  canDelete?: boolean
  /** Enroll / update the item's visual fingerprint (opens the scanner host-side). */
  onEnroll?: (item: LocalPropertyItem) => void
  /** Stage this item (+ its SKO subtree) for turn-in — the rolling DA 3161 bucket. */
  onStageTurnIn?: (item: LocalPropertyItem) => void
}

/** Quantity entry shared by Expend and Split/Move: a primitive numeric TextInput
 *  with an identical "of N" cap to its right. */
function QtyField({
  value, onChange, total, placeholder, onKeyDown,
}: {
  value: number
  onChange: (v: string) => void
  total: number
  placeholder: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <TextInput
          value={value ? String(value) : ''}
          onChange={onChange}
          onKeyDown={onKeyDown}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
        />
      </div>
      <span className="text-[10pt] text-tertiary shrink-0">of {total}</span>
    </div>
  )
}

/**
 * The single, shared property-item action menu. Top level stays short (View · Edit ·
 * Quantity · PMCS · Share · Logistics · Delete) with the crowded actions collapsed
 * into two submenus so the menu can't outgrow a small viewport: Quantity groups
 * Split/Move · Merge · Expend; Logistics groups Mark-as-mine · Print label · Visual
 * ID · Stage turn-in. Co-locates its Split/Merge/Expend/PMCS overlays, the single-
 * item label print (stock choice + PDF preview), and the share picker. Mounted ONCE
 * by PropertyPanel and driven imperatively (openMenu)
 * from every surface — the location tree, the sign-out (Custody) tab, and the item
 * detail header — so the three surfaces can't drift. Self-contained actions run
 * straight through usePropertyStore; host actions (view/edit/delete/enroll/stage)
 * call the props.
 */
export const ItemActionMenu = forwardRef<ItemActionMenuHandle, ItemActionMenuProps>(
  function ItemActionMenu({ items, locations, containerRef, onView, onEdit, onDelete, canDelete, onEnroll, onStageTurnIn }, ref) {
  const splitItem = usePropertyStore(s => s.splitItem)
  const mergeItems = usePropertyStore(s => s.mergeItems)
  const expendItem = usePropertyStore(s => s.expendItem)
  const editItem = usePropertyStore(s => s.editItem)
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  const isMobile = useIsMobile()

  // This menu is mounted ONCE at the host top level (so tree / detail / custody can't
  // drift), which puts its co-located overlays OUTSIDE any mobile detail sheet — they
  // can't inherit that sheet's OverlayStackContext ceiling. On desktop `containerRef`
  // scopes them into the pane; on mobile there's no scope, so float them explicitly
  // above the z1200 detail sheet (below the z1500 confirm dialogs). Omit on desktop.
  const overlayZ = isMobile ? 1300 : undefined

  // The LATCHED subject: survives the menu closing so an open sheet keeps its item.
  const [active, setActive] = useState<{ item: LocalPropertyItem; showView: boolean } | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [showSplitSheet, setShowSplitSheet] = useState(false)
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [showExpendSheet, setShowExpendSheet] = useState(false)
  const [showPmcs, setShowPmcs] = useState(false)
  const [showLabelStock, setShowLabelStock] = useState(false)
  const [splitQty, setSplitQty] = useState(1)
  const [expendQty, setExpendQty] = useState(1)
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    openMenu: (item, anchor, opts) => {
      setActive({ item, showView: !!opts?.view })
      setAnchorRect(anchor)
      setShowSplitSheet(false)
      setShowMergeSheet(false)
      setShowExpendSheet(false)
      setShowPmcs(false)
      setShowLabelStock(false)
    },
  }), [])

  // Re-resolve the live item each render so qty caps / candidates stay fresh as the
  // store mutates (compensates for not receiving the item as a per-render prop).
  const item = active ? (items.find(i => i.id === active.item.id) ?? active.item) : null

  const { exportLabels, labelPreview, downloadLabels, clearLabelPreview, status: labelExportStatus } = usePropertyLabelExport()
  const printLabel = (geometry: LabelPresetKey) => {
    if (!item) return
    setShowLabelStock(false)
    void exportLabels({ items: [{ id: item.id, name: item.name, nsn: item.nsn }], geometry })
  }

  const { share: shareToChat, picker: shareToChatPicker } = useShareToChat()
  const handleShareToChat = () => {
    if (!item) return
    const qty = item.is_serialized ? (item.serial_number ? `SN ${item.serial_number}` : 'Serialized') : `Qty ${item.quantity}`
    shareToChat({
      type: 'shared_ref',
      refKind: 'property-item',
      refId: item.id,
      label: item.name || item.nomenclature || 'Item',
      subLabel: item.nsn ? `${qty} · NSN ${item.nsn}` : qty,
    })
  }

  const mergeCandidates = useMemo(() =>
    item
      ? items.filter(i =>
          i.id !== item.id &&
          !i.is_serialized &&
          i.name.toLowerCase() === item.name.toLowerCase()
        )
      : [],
    [items, item]
  )

  const splitMergeTarget = useMemo(() =>
    item && splitTargetId
      ? items.find(i =>
          i.id !== item.id &&
          !i.is_serialized &&
          i.location_id === splitTargetId &&
          i.name.toLowerCase() === item.name.toLowerCase() &&
          (item.nsn ? i.nsn === item.nsn : !i.nsn)
        ) ?? null
      : null,
    [splitTargetId, items, item]
  )

  const handleSplit = async () => {
    if (!item || !splitTargetId) return
    setShowSplitSheet(false)
    await splitItem(item.id, splitQty, splitTargetId)
  }

  const handleMerge = async (sourceId: string) => {
    if (!item) return
    setShowMergeSheet(false)
    await mergeItems(sourceId, item.id)
  }

  // Expend quantity is a free-typed number input bounded by on-hand (you can only
  // consume what's present, not what's signed out). 0 = empty input → submit blocked.
  const setExpendInput = (v: string) => {
    if (!item) return
    const digits = v.replace(/[^0-9]/g, '')
    setExpendQty(digits === '' ? 0 : Math.min(parseInt(digits, 10), item.quantity))
  }
  const canExpend = !!item && expendQty >= 1 && expendQty <= item.quantity
  const handleExpend = async () => {
    if (!item || !canExpend) return
    setShowExpendSheet(false)
    await expendItem(item.id, expendQty)
  }

  // Ownership (personal vs cluster). null owner = cluster-owned (default). Set =
  // personally owned; it travels with the owner's member-zone on PCS. The toggle
  // flips between "mine" (current user) and cluster. See personal-zone-pcs-rehome.md.
  const isMine = !!item && !!currentUserId && item.owner_user_id === currentUserId
  const toggleOwnership = () => {
    if (!item) return
    void editItem(item.id, { owner_user_id: isMine ? null : currentUserId })
  }

  // Quantity to move is a free-typed number bounded by on-hand, like Expend.
  const setSplitInput = (v: string) => {
    if (!item) return
    const digits = v.replace(/[^0-9]/g, '')
    setSplitQty(digits === '' ? 0 : Math.min(Math.max(parseInt(digits, 10), 1), item.quantity))
  }

  if (!item) return null

  const splitTitle = item.quantity > 1 ? 'Split / Move' : 'Move to Location'
  const otherLocations = locations.filter(l => l.id !== item.location_id)

  const mergeHint = splitMergeTarget ? (
    <p className="text-[10pt] text-secondary">
      Will merge into existing <span className="font-medium">{splitMergeTarget.name}</span> (×{splitMergeTarget.quantity}) at that location
    </p>
  ) : null

  const mergeIntro = (
    <p className="text-[10pt] text-secondary">
      Select an item to absorb into <span className="font-medium">{item.name}</span> (×{item.quantity}). The selected item will be deleted.
    </p>
  )

  // Quantity ops (non-serialized only) collapse under one "Quantity" row so the
  // top-level menu stays short enough to never clip off a small viewport.
  const quantityChildren: ContextMenuItem[] = [
    ...(!item.is_serialized ? [{
      key: 'move',
      label: item.quantity > 1 ? 'Split / Move' : 'Move to location',
      icon: ArrowRightLeft,
      onAction: () => { setSplitQty(1); setSplitTargetId(null); setShowSplitSheet(true) },
    } as ContextMenuItem] : []),
    ...(!item.is_serialized && mergeCandidates.length > 0
      ? [{ key: 'merge', label: 'Merge like items', icon: GitMerge, onAction: () => setShowMergeSheet(true) } as ContextMenuItem]
      : []),
    ...(!item.is_serialized && item.quantity > 0
      ? [{ key: 'expend', label: 'Expend', icon: PackageMinus, onAction: () => { setExpendQty(1); setShowExpendSheet(true) } } as ContextMenuItem]
      : []),
  ]

  // Asset-admin actions (ownership, visual ID, turn-in, single-item label print)
  // collapse under one "Logistics" row.
  const logisticsChildren: ContextMenuItem[] = [
    ...(currentUserId ? [{
      key: 'ownership',
      label: isMine ? 'Mark as cluster property' : 'Mark as mine',
      icon: isMine ? Users : UserCheck,
      onAction: toggleOwnership,
    } as ContextMenuItem] : []),
    { key: 'print-label', label: 'Print label', icon: Printer, onAction: () => setShowLabelStock(true) },
    ...(onEnroll ? [{ key: 'enroll', label: item.visual_fingerprint ? 'Update Visual ID' : 'Enroll Visual ID', icon: ScanLine, onAction: () => onEnroll(item) } as ContextMenuItem] : []),
    ...(onStageTurnIn ? [{ key: 'turnin', label: 'Stage for turn-in', icon: PackageMinus, onAction: () => onStageTurnIn(item) } as ContextMenuItem] : []),
  ]

  const mergeRows = (
    <>
      {mergeCandidates.map(candidate => {
        const candidateLoc = candidate.location_id ? locations.find(l => l.id === candidate.location_id) : null
        return (
          <button
            key={candidate.id}
            onClick={() => handleMerge(candidate.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-primary/5 last:border-b-0 active:bg-secondary/5 transition-colors"
          >
            <div>
              <p className="text-sm text-primary">{candidate.name}</p>
              {candidateLoc && <p className="text-[10pt] text-tertiary">{candidateLoc.name}</p>}
            </div>
            <span className="text-sm font-medium px-2 py-1 rounded-full bg-tertiary/10 text-tertiary shrink-0 ml-2">
              ×{candidate.quantity}
            </span>
          </button>
        )
      })}
    </>
  )

  return (
    <>
      {/* Action menu — the full item action set, opened from any surface's trigger.
          All Move/Merge/Share sheets stay co-located here so the surfaces stay lean. */}
      {anchorRect && (
        <LiftedRowMenu
          isOpen
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
          layout="list"
          align="right"
          items={[
            ...(onView && active?.showView ? [{ key: 'view', label: 'View', icon: Eye, onAction: () => onView(item) } as ContextMenuItem] : []),
            ...(onEdit ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEdit(item) } as ContextMenuItem] : []),
            ...(quantityChildren.length > 0 ? [{ key: 'quantity', label: 'Quantity', icon: Boxes, submenu: quantityChildren } as ContextMenuItem] : []),
            { key: 'pmcs', label: 'PMCS', icon: Wrench, onAction: () => setShowPmcs(true) },
            { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: handleShareToChat },
            ...(logisticsChildren.length > 0 ? [{ key: 'logistics', label: 'Logistics', icon: Package, submenu: logisticsChildren } as ContextMenuItem] : []),
            ...(onDelete && canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDelete(item) } as ContextMenuItem] : []),
          ]}
        />
      )}

      {/* Split / Move — single primitive PreviewOverlay card matching Expend:
          primitive TextInput quantity ("of N") + primitive PickerInput destination,
          Move in the action footer. Drawer-scoped on desktop, centered on mobile. */}
      <PreviewOverlay
        isOpen={showSplitSheet}
        onClose={() => setShowSplitSheet(false)}
        anchorRect={null}
        containerRef={containerRef}
        zIndex={overlayZ}
        title={splitTitle}
        maxWidth={320}
        rightFooter={
          <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
            <PillButton
              icon={ArrowRightLeft}
              iconSize={16}
              accent="info"
              disabled={!splitTargetId}
              onClick={handleSplit}
              label={splitQty >= item.quantity ? 'Move all' : `Move ${splitQty}`}
            />
          </div>
        }
      >
        <div className="px-4 py-3 space-y-3">
          {item.quantity > 1 && (
            <QtyField value={splitQty} onChange={setSplitInput} total={item.quantity} placeholder="1" />
          )}
          <PickerInput
            value={splitTargetId ?? ''}
            onChange={setSplitTargetId}
            options={otherLocations.map(l => ({ value: l.id, label: l.name }))}
            placeholder="Destination"
          />
          {mergeHint}
        </div>
      </PreviewOverlay>

      {/* Merge Like Items — single primitive PreviewOverlay card. */}
      <PreviewOverlay
        isOpen={showMergeSheet}
        onClose={() => setShowMergeSheet(false)}
        anchorRect={null}
        containerRef={containerRef}
        zIndex={overlayZ}
        title="Merge Like Items"
        maxWidth={320}
      >
        <div className="px-4 py-3 space-y-3">
          {mergeIntro}
          <SectionCard>{mergeRows}</SectionCard>
        </div>
      </PreviewOverlay>

      {/* Expend — single primitive PreviewOverlay card: title + close (top-right),
          the primitive TextInput quantity in the body, and a Check submit in the
          action footer (rightFooter, bottom-right). */}
      <PreviewOverlay
        isOpen={showExpendSheet}
        onClose={() => setShowExpendSheet(false)}
        anchorRect={null}
        containerRef={containerRef}
        zIndex={overlayZ}
        title="Expend"
        maxWidth={320}
        rightFooter={
          <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
            <PillButton
              icon={Check}
              iconSize={16}
              accent="success"
              disabled={!canExpend}
              onClick={handleExpend}
              label="Expend"
            />
          </div>
        }
      >
        <div className="px-4 py-3">
          <QtyField
            value={expendQty}
            onChange={setExpendInput}
            total={item.quantity}
            placeholder="0"
            onKeyDown={(e) => { if (e.key === 'Enter') handleExpend() }}
          />
        </div>
      </PreviewOverlay>

      {/* PMCS — preview-overlay launched from the menu (open faults to correct /
          clean-check / report + editable, deletable history). */}
      <PmcsSheet
        isOpen={showPmcs}
        onClose={() => setShowPmcs(false)}
        subjectId={item.id}
        clinicId={item.clinic_id}
        containerRef={containerRef}
        zIndex={overlayZ}
      />

      {/* Print label — stock choice then PDF preview, mirroring PropertyDrawer's
          mass-label flow but scoped to this one item (the single-item target that
          the mass "print all labels" flow can't hit). */}
      <ActionSheet
        visible={showLabelStock}
        title="Print label — choose stock"
        options={[
          { key: 'standard', label: 'Address (1" × 2⅝")', onAction: () => printLabel('standard') },
          { key: 'fileFolder', label: 'File folder (⅔" × 3‑7/16")', onAction: () => printLabel('fileFolder') },
        ]}
        onClose={() => setShowLabelStock(false)}
        zIndex={overlayZ}
      />

      <PdfPreviewModal
        preview={labelPreview}
        generating={labelExportStatus === 'generating'}
        onDownload={downloadLabels}
        onClose={clearLabelPreview}
        zIndex={overlayZ}
      />

      {shareToChatPicker}
    </>
  )
})
