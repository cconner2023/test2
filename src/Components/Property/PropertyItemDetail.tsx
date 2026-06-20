import { useState, useMemo, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { ScanLine, ArrowRightLeft, GitMerge, Plus, Minus, Check, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { SectionCard } from '../Section'
import { type ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { Sheet } from '../Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { ItemTimeline } from '../Timeline/ItemTimeline'
import { ItemPmcs } from './ItemPmcs'

export interface PropertyItemDetailHandle {
  /** Open the action menu (Edit / Move / Merge / Share / Enroll / Delete) anchored to the
   *  host header's ellipsis button. Hosts render the trigger; the menu lives here so its
   *  Move/Merge/Share sheets stay co-located. */
  openMenu: (anchor: DOMRect) => void
}

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  items: LocalPropertyItem[]
  onEnroll: () => void
  onEdit?: () => void
  onDelete?: () => void
  canDelete?: boolean
  /** Desktop only — the right-pane element the split/merge PreviewOverlay scopes
   *  to (dims/centers within the pane instead of a viewport-wide bottom drawer).
   *  Omitted on mobile, where split/merge render as bottom Sheets. */
  containerRef?: RefObject<HTMLElement | null>
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
      <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">{label}</span>
      <span className="text-[10pt] text-primary text-right truncate">{value}</span>
    </div>
  )
}

const EXPIRY_LABELS = {
  expired: { label: 'EXPIRED', dot: 'bg-themeredred', text: 'text-themeredred' },
  expiring: { label: 'EXPIRING SOON', dot: 'bg-themeyellow', text: 'text-themeyellow' },
} as const

export const PropertyItemDetail = forwardRef<PropertyItemDetailHandle, PropertyItemDetailProps>(
  function PropertyItemDetail({ item, locations, holders, items, onEnroll, onEdit, onDelete, canDelete, containerRef }, ref) {
  const isMobile = useIsMobile()
  const splitItem = usePropertyStore(s => s.splitItem)
  const mergeItems = usePropertyStore(s => s.mergeItems)

  const [showSplitSheet, setShowSplitSheet] = useState(false)
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [splitQty, setSplitQty] = useState(1)
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
  useImperativeHandle(ref, () => ({
    openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
  }), [])

  const { share: shareToChat, picker: shareToChatPicker } = useShareToChat()
  const handleShareToChat = () => {
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
    items.filter(i =>
      i.id !== item.id &&
      !i.is_serialized &&
      i.name.toLowerCase() === item.name.toLowerCase()
    ),
    [items, item.id, item.name]
  )

  const splitMergeTarget = useMemo(() =>
    splitTargetId
      ? items.find(i =>
          i.id !== item.id &&
          !i.is_serialized &&
          i.location_id === splitTargetId &&
          i.name.toLowerCase() === item.name.toLowerCase() &&
          (item.nsn ? i.nsn === item.nsn : !i.nsn)
        ) ?? null
      : null,
    [splitTargetId, items, item.id, item.name, item.nsn]
  )

  const handleSplit = async () => {
    if (!splitTargetId) return
    setShowSplitSheet(false)
    await splitItem(item.id, splitQty, splitTargetId)
  }

  const handleMerge = async (sourceId: string) => {
    setShowMergeSheet(false)
    await mergeItems(sourceId, item.id)
  }

  const location = item.location_id ? locations.find(l => l.id === item.location_id) : null
  const holder = item.current_holder_id ? holders.get(item.current_holder_id) : null
  const parentItem = item.parent_item_id ? items.find(i => i.id === item.parent_item_id) : null
  const subItems = items.filter(i => i.parent_item_id === item.id)
  const isMissing = item.condition_code === 'missing'
  const expiry = expiryStatus(item.expiry_date ?? null)
  const expiryLabel = expiry ? EXPIRY_LABELS[expiry] : null

  // ── Shared split/move + merge body pieces. Rendered inside a bottom Sheet on
  //    mobile and a pane-scoped PreviewOverlay on desktop — bare rows so each
  //    primitive supplies its own card chrome. ────────────────────────────────
  const splitTitle = item.quantity > 1 ? 'Split / Move' : 'Move to Location'
  const otherLocations = locations.filter(l => l.id !== item.location_id)

  const qtyStepper = (
    <div className="flex items-center gap-4">
      <button
        onClick={() => setSplitQty(q => Math.max(1, q - 1))}
        className="w-10 h-10 rounded-full border border-tertiary/20 flex items-center justify-center text-secondary active:scale-95 transition-all"
      >
        <Minus size={16} />
      </button>
      <span className="text-2xl font-semibold text-primary w-12 text-center">{splitQty}</span>
      <button
        onClick={() => setSplitQty(q => Math.min(item.quantity, q + 1))}
        className="w-10 h-10 rounded-full border border-tertiary/20 flex items-center justify-center text-secondary active:scale-95 transition-all"
      >
        <Plus size={16} />
      </button>
      <span className="text-[10pt] text-tertiary">of {item.quantity}</span>
    </div>
  )

  const destinationRows = (
    <>
      {otherLocations.map(loc => (
        <button
          key={loc.id}
          onClick={() => setSplitTargetId(loc.id === splitTargetId ? null : loc.id)}
          className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-primary/5 last:border-b-0 transition-colors ${
            splitTargetId === loc.id ? 'bg-themeblue3/10' : 'active:bg-secondary/5'
          }`}
        >
          <span className="text-sm text-primary">{loc.name}</span>
          {splitTargetId === loc.id && <Check size={16} className="text-themeblue2 shrink-0" />}
        </button>
      ))}
      {otherLocations.length === 0 && (
        <p className="text-[10pt] text-tertiary px-4 py-3">No other locations</p>
      )}
    </>
  )

  const mergeHint = splitMergeTarget ? (
    <p className="text-[10pt] text-secondary">
      Will merge into existing <span className="font-medium">{splitMergeTarget.name}</span> (×{splitMergeTarget.quantity}) at that location
    </p>
  ) : null

  const confirmButton = (
    <button
      onClick={handleSplit}
      disabled={!splitTargetId}
      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-themeblue3 text-white font-medium py-3 text-sm disabled:opacity-30 active:scale-[0.98] transition-all duration-200"
    >
      <ArrowRightLeft size={16} />
      {splitQty >= item.quantity ? 'Move All' : `Move ${splitQty}`}
    </button>
  )

  const mergeIntro = (
    <p className="text-[10pt] text-secondary">
      Select an item to absorb into <span className="font-medium">{item.name}</span> (×{item.quantity}). The selected item will be deleted.
    </p>
  )

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
    <div className={`flex flex-col h-full ${isMobile ? 'px-4 py-4 space-y-4' : 'px-3 py-3 space-y-3'}`}>
      {/* Main info card */}
      <SectionCard>
        <div className={isMobile ? 'p-4 space-y-1' : 'p-3 space-y-1'}>
          {/* Accountability flag only — health/serviceability now lives in PMCS. */}
          {isMissing && (
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-themeredred" />
              <span className="text-[9pt] font-semibold text-themeredred tracking-widest uppercase">Missing</span>
            </div>
          )}

          <h2 className={`font-bold text-primary ${isMobile ? 'text-lg' : 'text-sm'}`}>{item.name}</h2>

          {item.nomenclature && (
            <p className={`text-secondary ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{item.nomenclature}</p>
          )}
        </div>
      </SectionCard>

      {/* Details card */}
      <SectionCard>
        <div className={isMobile ? 'px-4 py-2' : 'px-3 py-2'}>
          <DetailRow label="NSN" value={item.nsn} />
          <DetailRow label="LIN" value={item.lin} />
          <DetailRow label="Serial" value={item.serial_number} />
          <DetailRow label="Qty" value={item.quantity > 1 ? String(item.quantity) : null} />
          <DetailRow label="Location" value={location?.name} />
          <DetailRow label="Holder" value={holder?.displayName} />
          <DetailRow label="Parent" value={parentItem?.name} />
          {item.expiry_date && (
            <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">Expires</span>
              <div className="flex items-center gap-1.5">
                {expiryLabel && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${expiryLabel.dot}`} />}
                <span className={`text-[10pt] text-right truncate ${expiryLabel ? expiryLabel.text : 'text-primary'}`}>
                  {item.expiry_date}
                  {expiryLabel && ` · ${expiryLabel.label}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Notes */}
      {item.notes && (
        <SectionCard>
          <div className={isMobile ? 'px-4 py-3' : 'px-3 py-2'}>
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Notes</span>
            <p className={`mt-1 text-secondary whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{item.notes}</p>
          </div>
        </SectionCard>
      )}

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Components</span>
            <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
              {subItems.length}
            </span>
          </div>
          <SectionCard>
            {subItems.map(sub => (
              <div key={sub.id} className={`flex items-center justify-between ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`}>
                <span className={`text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{sub.name}</span>
                {sub.serial_number && (
                  <span className="text-[9pt] text-tertiary shrink-0 ml-2">{sub.serial_number}</span>
                )}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* PMCS — open faults + clean-check logging (replaces condition chips). */}
      <ItemPmcs subjectId={item.id} clinicId={item.clinic_id} />

      {/* Lifecycle timeline (creation, move, assign/transfer, edit, expend, faults) */}
      <ItemTimeline
        subjectId={item.id}
        clinicId={item.clinic_id}
        locations={locations}
        holders={holders}
      />

      <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />

      {/* Action menu — opened from the host header ellipsis (openMenu handle).
          All item actions live here so Move/Merge/Share sheets stay co-located. */}
      {menuAnchor && (
        <LiftedRowMenu
          isOpen
          anchorRect={menuAnchor.rect}
          onClose={() => setMenuAnchor(null)}
          layout="list"
          align="right"
          items={[
            ...(onEdit ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: onEdit } as ContextMenuItem] : []),
            ...(!item.is_serialized ? [{
              key: 'move',
              label: item.quantity > 1 ? 'Split / Move' : 'Move to location',
              icon: ArrowRightLeft,
              onAction: () => { setSplitQty(1); setSplitTargetId(null); setShowSplitSheet(true) },
            } as ContextMenuItem] : []),
            ...(!item.is_serialized && mergeCandidates.length > 0
              ? [{ key: 'merge', label: 'Merge like items', icon: GitMerge, onAction: () => setShowMergeSheet(true) } as ContextMenuItem]
              : []),
            { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: handleShareToChat },
            { key: 'enroll', label: item.visual_fingerprint ? 'Update Visual ID' : 'Enroll Visual ID', icon: ScanLine, onAction: onEnroll },
            ...(onDelete && canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: onDelete } as ContextMenuItem] : []),
          ]}
        />
      )}

      {/* Split / Move + Merge — bottom Sheet on mobile, pane-scoped PreviewOverlay
          on desktop (so it surfaces within the right pane, not a viewport drawer). */}
      {isMobile ? (
        <>
          <Sheet
            isOpen={showSplitSheet}
            onClose={() => setShowSplitSheet(false)}
            title={splitTitle}
            height="fit"
            maxHeight={75}
            zIndex={1450}
          >
            <div className="px-5 pt-3 pb-5 flex flex-col gap-4">
              {item.quantity > 1 && (
                <div>
                  <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Quantity to move</p>
                  {qtyStepper}
                </div>
              )}
              <div>
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Destination</p>
                <SectionCard>{destinationRows}</SectionCard>
              </div>
              {mergeHint}
              {confirmButton}
            </div>
          </Sheet>

          <Sheet
            isOpen={showMergeSheet}
            onClose={() => setShowMergeSheet(false)}
            title="Merge Like Items"
            height="fit"
            maxHeight={60}
            zIndex={1450}
          >
            <div className="px-5 pt-3 pb-5 flex flex-col gap-4">
              {mergeIntro}
              <SectionCard>{mergeRows}</SectionCard>
            </div>
          </Sheet>
        </>
      ) : (
        <>
          <PreviewOverlay
            isOpen={showSplitSheet}
            onClose={() => setShowSplitSheet(false)}
            anchorRect={null}
            containerRef={containerRef}
            title={splitTitle}
            maxWidth={340}
            previewMaxHeight="34dvh"
            headerCard={item.quantity > 1 ? (
              <div className="bg-themewhite rounded-2xl px-4 py-3">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Quantity to move</p>
                {qtyStepper}
              </div>
            ) : undefined}
            supplemental={mergeHint ? <div className="px-1">{mergeHint}</div> : undefined}
            footer={<div className="flex-1">{confirmButton}</div>}
          >
            <div className="px-1.5 pb-1.5">{destinationRows}</div>
          </PreviewOverlay>

          <PreviewOverlay
            isOpen={showMergeSheet}
            onClose={() => setShowMergeSheet(false)}
            anchorRect={null}
            containerRef={containerRef}
            title="Merge Like Items"
            maxWidth={340}
            previewMaxHeight="34dvh"
            headerCard={<div className="bg-themewhite rounded-2xl px-4 py-3">{mergeIntro}</div>}
          >
            <div className="px-1.5 pb-1.5">{mergeRows}</div>
          </PreviewOverlay>
        </>
      )}

      {shareToChatPicker}
    </div>
  )
})
