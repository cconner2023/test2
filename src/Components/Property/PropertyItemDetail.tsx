import { useState, useMemo, useEffect, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { ScanLine, ArrowRightLeft, GitMerge, Check, MessageSquare, Pencil, Trash2, Wrench, PackageMinus, UserCheck, Users, AlertTriangle } from 'lucide-react'
import { SectionCard } from '../Section'
import { type ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput, PickerInput } from '../FormInputs'
import { PillButton } from '../HeaderPill'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { fetchItemLedger } from '../../lib/propertyService'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { ItemTimeline } from '../Timeline/ItemTimeline'
import { PmcsSheet } from './PmcsSheet'

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
  /** Stage this item (+ its SKO subtree) for turn-in — the rolling DA 3161 bucket. */
  onStageTurnIn?: () => void
  /** The whole property drawer element the desktop overlays (PMCS, split/merge)
   *  scope to — so they dim/center over the entire drawer, not just the right
   *  pane. Null on mobile, where those surfaces render as bottom Sheets. */
  drawerRef?: RefObject<HTMLElement | null>
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
      <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">{label}</span>
      <span className="text-[10pt] text-primary text-right min-w-0 break-words">{value}</span>
    </div>
  )
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

const EXPIRY_LABELS = {
  expired: { label: 'EXPIRED', dot: 'bg-themeredred', text: 'text-themeredred' },
  expiring: { label: 'EXPIRING SOON', dot: 'bg-themeyellow', text: 'text-themeyellow' },
} as const

/** Loud, unmissable status flag riding the top-right edge of the details card
 *  (depleted stock / expired). Solid red so it reads at a glance, unlike the
 *  quiet inline Expires row it replaces. */
function WarnBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9pt] font-semibold tracking-wide uppercase px-2 py-1 rounded-full bg-themeredred text-themewhite shadow-sm">
      <AlertTriangle size={11} className="shrink-0" />
      {label}
    </span>
  )
}

export const PropertyItemDetail = forwardRef<PropertyItemDetailHandle, PropertyItemDetailProps>(
  function PropertyItemDetail({ item, locations, holders, items, onEnroll, onEdit, onDelete, canDelete, onStageTurnIn, drawerRef }, ref) {
  const isMobile = useIsMobile()
  const splitItem = usePropertyStore(s => s.splitItem)
  const mergeItems = usePropertyStore(s => s.mergeItems)
  const expendItem = usePropertyStore(s => s.expendItem)
  const editItem = usePropertyStore(s => s.editItem)
  const currentUserId = useAuthStore(s => s.user?.id ?? null)

  const [showSplitSheet, setShowSplitSheet] = useState(false)
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [showExpendSheet, setShowExpendSheet] = useState(false)
  const [showPmcs, setShowPmcs] = useState(false)
  const [splitQty, setSplitQty] = useState(1)
  const [expendQty, setExpendQty] = useState(1)
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

  // Outstanding custody for a non-serialized stack: who holds how many right now,
  // folded from this item's open ledger receipts (Σ sign_down − Σ sign_up per
  // recipient). A stack can be split across several holders, so this is the
  // accountability view the single Holder row can't show. Re-runs when on-hand qty
  // changes (a sign-out/sign-in mutates quantity → effect refetches).
  const [outstanding, setOutstanding] = useState<{ key: string; label: string; qty: number }[]>([])
  useEffect(() => {
    if (item.is_serialized) { setOutstanding([]); return }
    let cancelled = false
    void (async () => {
      const rows = await fetchItemLedger(item.id)
      const byReceipt = new Map<string, typeof rows>()
      for (const r of rows) {
        if (!r.hand_receipt_id) continue
        const arr = byReceipt.get(r.hand_receipt_id) ?? []
        arr.push(r)
        byReceipt.set(r.hand_receipt_id, arr)
      }
      const qtyOf = (r: (typeof rows)[number]) => Math.max(1, r.quantity_delta ?? 1)
      const byHolder = new Map<string, { label: string; qty: number }>()
      for (const group of byReceipt.values()) {
        const down = group.filter((r) => r.action === 'sign_down')
        if (down.length === 0) continue
        const net =
          down.reduce((s, r) => s + qtyOf(r), 0) -
          group.filter((r) => r.action === 'sign_up').reduce((s, r) => s + qtyOf(r), 0)
        if (net <= 0) continue
        const head = down[0]
        const extName = head.notes?.split(' — ')[0]?.trim() || 'External recipient'
        const key = head.to_holder_id ?? `ext:${extName}`
        const label = head.to_holder_id ? holders.get(head.to_holder_id)?.displayName ?? 'Member' : extName
        const cur = byHolder.get(key) ?? { label, qty: 0 }
        cur.qty += net
        byHolder.set(key, cur)
      }
      if (!cancelled) setOutstanding([...byHolder.entries()].map(([key, v]) => ({ key, ...v })))
    })()
    return () => { cancelled = true }
  }, [item.id, item.is_serialized, item.quantity, holders])

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

  // Expend quantity is a free-typed number input bounded by on-hand (you can only
  // consume what's present, not what's signed out). 0 = empty input → submit blocked.
  const setExpendInput = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    setExpendQty(digits === '' ? 0 : Math.min(parseInt(digits, 10), item.quantity))
  }
  const canExpend = expendQty >= 1 && expendQty <= item.quantity
  const handleExpend = async () => {
    if (!canExpend) return
    setShowExpendSheet(false)
    await expendItem(item.id, expendQty)
  }

  const location = item.location_id ? locations.find(l => l.id === item.location_id) : null
  const holder = item.current_holder_id ? holders.get(item.current_holder_id) : null

  // Ownership (personal vs cluster). null owner = cluster-owned (default). Set =
  // personally owned; it travels with the owner's member-zone on PCS. The toggle
  // flips between "mine" (current user) and cluster — owning for someone else is
  // not an affordance here. See personal-zone-pcs-rehome.md.
  const isMine = !!currentUserId && item.owner_user_id === currentUserId
  const ownerLabel = item.owner_user_id
    ? (isMine ? 'You' : holders.get(item.owner_user_id)?.displayName ?? 'Personal')
    : null
  const toggleOwnership = () =>
    void editItem(item.id, { owner_user_id: isMine ? null : currentUserId })
  const parentItem = item.parent_item_id ? items.find(i => i.id === item.parent_item_id) : null
  const subItems = items.filter(i => i.parent_item_id === item.id)
  const isMissing = item.condition_code === 'missing'
  const expiry = expiryStatus(item.expiry_date ?? null)
  const isExpired = expiry === 'expired'
  const isDepleted = !item.is_serialized && item.quantity <= 0

  // ── Shared split/move + merge body pieces. Rendered in a single primitive
  //    PreviewOverlay card (matching the Expend overlay) — primitive TextInput
  //    quantity + primitive PickerInput destination. ───────────────────────────
  const splitTitle = item.quantity > 1 ? 'Split / Move' : 'Move to Location'
  const otherLocations = locations.filter(l => l.id !== item.location_id)

  // Quantity to move is a free-typed number bounded by on-hand, like Expend.
  const setSplitInput = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    setSplitQty(digits === '' ? 0 : Math.min(Math.max(parseInt(digits, 10), 1), item.quantity))
  }

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
      {/* Details card — title lives in the host header, so here we lead with the
          accountability flag + description, then the identity fields. The relative
          wrapper hosts the warning badge(s) riding the top-right edge (SectionCard
          is overflow-hidden, so the badge must be a lifted sibling). */}
      <div className="relative">
        {(isDepleted || isExpired) && (
          <div className="absolute top-0 right-3 -translate-y-1/2 z-10 flex items-center gap-1.5">
            {isDepleted && <WarnBadge label="Depleted" />}
            {isExpired && <WarnBadge label="Expired" />}
          </div>
        )}
        <SectionCard>
        <div className={isMobile ? 'px-4 py-2' : 'px-3 py-2'}>
          {/* Accountability flag only — health/serviceability now lives in PMCS. */}
          {isMissing && (
            <div className="flex items-center gap-2 py-2 border-b border-primary/5">
              <span className="h-2 w-2 rounded-full bg-themeredred" />
              <span className="text-[9pt] font-semibold text-themeredred tracking-widest uppercase">Missing</span>
            </div>
          )}
          {item.nomenclature && (
            <p className={`py-2 border-b border-primary/5 text-primary ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{item.nomenclature}</p>
          )}
          <DetailRow label="NSN" value={item.nsn} />
          <DetailRow label="LIN" value={item.lin} />
          <DetailRow label="Serial" value={item.serial_number} />
          <DetailRow label="Qty" value={item.quantity > 1 ? String(item.quantity) : null} />
          <DetailRow label="Location" value={location?.name} />
          <DetailRow label="Holder" value={holder?.displayName} />
          <DetailRow label="Owner" value={ownerLabel} />
          <DetailRow label="Parent" value={parentItem?.name} />
          {item.expiry_date && (
            <div className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0">Expires</span>
              <div className="flex items-center gap-1.5">
                {/* Expired alarm now lives in the top-right badge; here we keep only the
                    quieter "expiring soon" inline cue. */}
                {expiry === 'expiring' && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${EXPIRY_LABELS.expiring.dot}`} />}
                <span className={`text-[10pt] text-right truncate ${expiry === 'expiring' ? EXPIRY_LABELS.expiring.text : 'text-primary'}`}>
                  {item.expiry_date}
                  {expiry === 'expiring' && ` · ${EXPIRY_LABELS.expiring.label}`}
                </span>
              </div>
            </div>
          )}
        </div>
        </SectionCard>
      </div>

      {/* Signed out — who holds how many right now (non-serialized stacks split
          across holders; the single Holder row above only covers serialized items). */}
      {outstanding.length > 0 && (
        <SectionCard>
          <div className={isMobile ? 'px-4 py-2' : 'px-3 py-2'}>
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Signed out</span>
            <div className="mt-1">
              {outstanding.map(o => (
                <div key={o.key} className="flex justify-between items-baseline gap-4 py-2 border-b border-primary/5 last:border-b-0">
                  <span className={`text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{o.label}</span>
                  <span className="text-[10pt] font-medium text-secondary shrink-0 tabular-nums">×{o.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

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
            ...(currentUserId ? [{
              key: 'ownership',
              label: isMine ? 'Mark as cluster property' : 'Mark as mine',
              icon: isMine ? Users : UserCheck,
              onAction: toggleOwnership,
            } as ContextMenuItem] : []),
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
            { key: 'pmcs', label: 'PMCS', icon: Wrench, onAction: () => setShowPmcs(true) },
            { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: handleShareToChat },
            { key: 'enroll', label: item.visual_fingerprint ? 'Update Visual ID' : 'Enroll Visual ID', icon: ScanLine, onAction: onEnroll },
            ...(onStageTurnIn ? [{ key: 'turnin', label: 'Stage for turn-in', icon: PackageMinus, onAction: onStageTurnIn } as ContextMenuItem] : []),
            ...(onDelete && canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: onDelete } as ContextMenuItem] : []),
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
        containerRef={drawerRef}
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
        containerRef={drawerRef}
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
        containerRef={drawerRef}
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

      {/* PMCS — preview-overlay launched from the ellipsis menu (open faults to
          correct / clean-check / report + editable, deletable history). */}
      <PmcsSheet
        isOpen={showPmcs}
        onClose={() => setShowPmcs(false)}
        subjectId={item.id}
        clinicId={item.clinic_id}
        containerRef={drawerRef}
      />

      {shareToChatPicker}
    </div>
  )
})
