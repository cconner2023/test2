import { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { SectionCard } from '@/Components/primitives/Section'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { isLinContainer, groupAuthorized, fillersByLineKey, lineKeyOf } from '../../Utilities/propertyAuthorized'
import { useAuthStore } from '../../stores/useAuthStore'
import { fetchItemLedger } from '../../lib/propertyService'
import { ItemTimeline } from '../Timeline/ItemTimeline'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  items: LocalPropertyItem[]
  /** Auth-context component actions. When provided AND the viewed item is a LIN container, the
   *  Components section renders cards IDENTICAL to the Cluster Hand Receipt (name · nomenclature ·
   *  NSN · on-hand / authorized) with a trailing ellipsis (View · Edit · Delete = de-authorize);
   *  a row tap opens the component's own card. ADD lives in the host header ellipsis, not here.
   *  Omitted everywhere else → the plain read-only sub-item list. */
  onViewComponent?: (item: LocalPropertyItem) => void
  onEditComponent?: (item: LocalPropertyItem) => void
  onDeleteComponent?: (item: LocalPropertyItem) => void
  /** Locate a filler ON THE MAP from the "On hand" section (see below). Wired to the host's
   *  handleSelectItem. When omitted the fillers render as read-only rows. */
  onLocateFiller?: (item: LocalPropertyItem) => void
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

/**
 * The item detail BODY — info only. All item actions live in the shared
 * ItemActionMenu (mounted by PropertyPanel, opened from the header ellipsis); this
 * surface just reads the item: identity fields, the split-across-holders "Signed
 * out" fold, the "On hand" fillers (for an authorized line — the located stacks that
 * make up its aggregated on-hand, each tapping through to locate on the map), notes,
 * components, and the lifecycle timeline.
 */
export function PropertyItemDetail({ item, locations, holders, items, onViewComponent, onEditComponent, onDeleteComponent, onLocateFiller }: PropertyItemDetailProps) {
  const isMobile = useIsMobile()
  const currentUserId = useAuthStore(s => s.user?.id ?? null)

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

  const location = item.location_id ? locations.find(l => l.id === item.location_id) : null
  const holder = item.current_holder_id ? holders.get(item.current_holder_id) : null

  // Ownership (personal vs cluster) — read-only here for the Owner row; the toggle
  // lives in the shared ItemActionMenu. See personal-zone-pcs-rehome.md.
  const isMine = !!currentUserId && item.owner_user_id === currentUserId
  const ownerLabel = item.owner_user_id
    ? (isMine ? 'You' : holders.get(item.owner_user_id)?.displayName ?? 'Personal')
    : null
  const parentItem = item.parent_item_id ? items.find(i => i.id === item.parent_item_id) : null
  // Live physical components under this item (skip off-the-books rows).
  const subItems = items.filter(i => i.parent_item_id === item.id && !i.deleted_at && !i.turned_in_at)
  const isMissing = item.condition_code === 'missing'
  const expiry = expiryStatus(item.expiry_date ?? null)
  const isExpired = expiry === 'expired'
  // A LIN is a pure hand-receipt header (quantity 0, never stocked itself) — it must never wear
  // the Depleted badge; depletion is a property of its component lines, not the LIN.
  const isLin = isLinContainer(item)
  const isDepleted = !item.is_serialized && item.quantity <= 0 && !isLin

  // Auth-context Components for a LIN: the SAME tracked lines the Cluster Hand Receipt shows
  // (name · nomenclature · NSN · on-hand / authorized), reused verbatim from groupAuthorized so
  // the cards are identical and the on-hand aggregation never diverges. Only computed when the
  // host wired the component actions AND this is a LIN.
  const authLines = useMemo(
    () => (onViewComponent && isLin ? groupAuthorized(items).groups.find(g => g.skoId === item.id)?.lines ?? [] : null),
    [onViewComponent, isLin, items, item.id],
  )

  // "On hand" fillers — the located physical stacks that make up an AUTHORIZED line's on-hand.
  // A tracked line's on-hand is an AGGREGATE summed over every live row sharing its (LIN + NSN)
  // key (the target itself is location-less and holds no stock), so this is the only place the
  // user can see WHAT fills the line and WHERE. Only computed for a tracked line; a plain
  // physical item is itself a filler, not a line, so it never shows this section.
  const fillers = useMemo(
    () => (item.quantity_authorized != null ? fillersByLineKey(items).get(lineKeyOf(item)) ?? [] : []),
    [item, items],
  )

  // Component ellipsis (View · Edit · Delete=de-authorize) anchor.
  const [compMenu, setCompMenu] = useState<{ item: LocalPropertyItem; rect: DOMRect } | null>(null)

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
          <DetailRow label="Material/NSN" value={item.nsn} />
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

      {/* On hand — the located stacks that fill this authorized line (its on-hand is a sum
          across zones). Each row taps through to locate that stack on the map. */}
      {fillers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">On hand</span>
          </div>
          <SectionCard>
            {fillers.map(f => {
              const fLoc = f.location_id ? locations.find(l => l.id === f.location_id) : null
              const fHolder = f.current_holder_id ? holders.get(f.current_holder_id) : null
              // Where the stack sits: its zone, else its holder (signed out), else unplaced.
              const place = fLoc?.name ?? fHolder?.displayName ?? 'Unplaced'
              const rowInner = (
                <>
                  <div className="min-w-0 flex-1">
                    <span className={`block text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{f.name}</span>
                    {/* Serial is the ONLY identity that isn't self-evident in this LIN/NSN
                        context — surface it so two like stacks are tellable apart. */}
                    {f.serial_number && <span className="block text-[9pt] text-tertiary truncate">{f.serial_number}</span>}
                    <span className="block text-[9pt] text-tertiary truncate">{place}</span>
                  </div>
                  <span className="text-[10pt] font-medium text-secondary shrink-0 tabular-nums">×{f.quantity}</span>
                </>
              )
              const rowCls = `flex items-center gap-3 ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`
              return onLocateFiller ? (
                <button key={f.id} type="button" onClick={() => onLocateFiller(f)} className={`w-full text-left hover:bg-secondary/5 transition-colors ${rowCls}`}>
                  {rowInner}
                </button>
              ) : (
                <div key={f.id} className={rowCls}>{rowInner}</div>
              )
            })}
          </SectionCard>
        </div>
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

      {/* Components — auth context (LIN): cards IDENTICAL to the Cluster Hand Receipt (name ·
          nomenclature · NSN, on-hand / authorized centered right). Trailing ellipsis =
          View · Edit · Delete (de-authorize); a row tap opens the component's own card; the "+"
          adds a component parented to this LIN. No count indicator. */}
      {authLines ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Components</span>
          </div>
          <SectionCard>
            {authLines.length === 0 ? (
              <div className={`${isMobile ? 'px-4 py-3' : 'px-3 py-2'} text-[10pt] text-tertiary`}>
                No components assigned yet — add one with +
              </div>
            ) : (
              authLines.map(l => {
                const comp = items.find(i => i.id === l.itemId)
                return (
                  <div
                    key={l.itemId}
                    className={`group flex items-center gap-2 ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`}
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => comp && onViewComponent?.(comp)}>
                      <span className="block text-[10pt] text-primary truncate">{l.name}</span>
                      {l.nomenclature && <span className="block text-[9pt] text-tertiary truncate">{l.nomenclature}</span>}
                      {l.nsn && <span className="block text-[9pt] text-tertiary truncate">Material/NSN {l.nsn}</span>}
                    </button>
                    {/* On-hand / authorized, both in base (EA) units so the pair is directly comparable. */}
                    <span className="text-[10pt] text-tertiary tabular-nums shrink-0">{l.onHand} / {l.authorizedBase}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); comp && setCompMenu({ item: comp, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }) }}
                      aria-label="Component actions"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                )
              })
            )}
          </SectionCard>
        </div>
      ) : subItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Components</span>
          </div>
          <SectionCard>
            {subItems.map(sub => {
              const subLoc = sub.location_id ? locations.find(l => l.id === sub.location_id) : null
              // Where the component lives: its own location, else its holder (signed out).
              const subHolder = sub.current_holder_id ? holders.get(sub.current_holder_id) : null
              const place = subLoc?.name ?? subHolder?.displayName ?? null
              return (
                <div key={sub.id} className={`flex items-center gap-3 ${isMobile ? 'px-4 py-3' : 'px-3 py-2'} border-b border-primary/5 last:border-b-0`}>
                  <div className="min-w-0 flex-1">
                    <span className={`block text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{sub.name}</span>
                    <span className="block text-[9pt] text-tertiary truncate">
                      {place ?? 'Unplaced'}
                      {sub.serial_number && <span> · {sub.serial_number}</span>}
                    </span>
                  </div>
                  <span className="text-[10pt] font-medium text-secondary shrink-0 tabular-nums">×{sub.quantity}</span>
                </div>
              )
            })}
          </SectionCard>
        </div>
      )}

      {/* Component ellipsis menu (auth context) — View · Edit · Delete (de-authorize). */}
      {compMenu && (
        <LiftedRowMenu
          isOpen
          anchorRect={compMenu.rect}
          onClose={() => setCompMenu(null)}
          layout="list"
          align="right"
          items={[
            { key: 'view', label: 'View', icon: Eye, onAction: () => onViewComponent?.(compMenu.item) },
            { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditComponent?.(compMenu.item) },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteComponent?.(compMenu.item) },
          ]}
        />
      )}

      {/* Lifecycle timeline (creation, move, assign/transfer, edit, expend, faults) */}
      <ItemTimeline
        subjectId={item.id}
        clinicId={item.clinic_id}
        locations={locations}
        holders={holders}
      />

      <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />
    </div>
  )
}
