import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SectionCard } from '../Section'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { useAuthStore } from '../../stores/useAuthStore'
import { fetchItemLedger } from '../../lib/propertyService'
import { ItemTimeline } from '../Timeline/ItemTimeline'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  items: LocalPropertyItem[]
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
 * out" fold, notes, components, and the lifecycle timeline.
 */
export function PropertyItemDetail({ item, locations, holders, items }: PropertyItemDetailProps) {
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
  const subItems = items.filter(i => i.parent_item_id === item.id)
  const isMissing = item.condition_code === 'missing'
  const expiry = expiryStatus(item.expiry_date ?? null)
  const isExpired = expiry === 'expired'
  const isDepleted = !item.is_serialized && item.quantity <= 0

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
    </div>
  )
}
