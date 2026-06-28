/**
 * Shortage fold — derives "what's short / what to order" from authorized vs present
 * quantities. Pure client-side over the already-loaded property items (offline-first;
 * no new query). null `quantity_authorized` = not tracked → never a shortage.
 *
 * Two views:
 *  - lines:  per-line shortfall (authorized − on-hand for each tracked item). The
 *            inventory/layout view. Nesting-aware: each line carries its SKO parent
 *            name when it's a kit component, so the SKO layer (step 4) is purely additive.
 *  - orders: cluster requisition list, aggregated by NSN (→ LIN → name). Σauthorized
 *            (tracked lines) vs Σpresent (ALL live stock of that key, tracked or loose —
 *            you don't requisition what you already have somewhere). order = the true
 *            cluster shortfall to requisition.
 */
import type { LocalPropertyItem } from '../Types/PropertyTypes'

export interface ShortageLine {
  itemId: string
  name: string
  nomenclature: string | null
  nsn: string | null
  lin: string | null
  serialNumber: string | null
  authorized: number
  onHand: number
  short: number
  /** SKO parent name when this line is a kit component; null = top-level. */
  skoName: string | null
}

export interface OrderLine {
  nsn: string | null
  lin: string | null
  name: string
  authorized: number
  onHand: number
  order: number
}

export interface ShortageReport {
  lines: ShortageLine[]
  orders: OrderLine[]
  /** Count of authorization-tracked lines (quantity_authorized != null). 0 = nothing
   *  to report yet — drives the "upload a BOM" empty state. */
  trackedCount: number
}

/** Stable aggregation key: NSN, else LIN, else name (all normalized). */
function keyOf(it: { nsn: string | null; lin: string | null; name: string }): string {
  const nsn = (it.nsn ?? '').trim().toLowerCase()
  if (nsn) return 'nsn:' + nsn
  const lin = (it.lin ?? '').trim().toLowerCase()
  if (lin) return 'lin:' + lin
  return 'name:' + it.name.trim().toLowerCase()
}

export function computeShortages(items: LocalPropertyItem[]): ShortageReport {
  const live = items.filter((it) => !it.deleted_at)
  const nameById = new Map(live.map((it) => [it.id, it.name]))
  const tracked = live.filter((it) => it.quantity_authorized != null)

  // Per-line shortfalls.
  const lines: ShortageLine[] = []
  for (const it of tracked) {
    const authorized = it.quantity_authorized as number
    const onHand = it.quantity
    const short = Math.max(0, authorized - onHand)
    if (short > 0) {
      lines.push({
        itemId: it.id,
        name: it.name,
        nomenclature: it.nomenclature,
        nsn: it.nsn,
        lin: it.lin,
        serialNumber: it.serial_number,
        authorized,
        onHand,
        short,
        skoName: it.parent_item_id ? nameById.get(it.parent_item_id) ?? null : null,
      })
    }
  }
  lines.sort((a, b) => b.short - a.short)

  // Cluster requisition aggregate.
  type Agg = { nsn: string | null; lin: string | null; name: string; authorized: number; onHand: number }
  const agg = new Map<string, Agg>()
  const ensure = (it: LocalPropertyItem): Agg => {
    const k = keyOf(it)
    let a = agg.get(k)
    if (!a) {
      a = { nsn: it.nsn, lin: it.lin, name: it.name, authorized: 0, onHand: 0 }
      agg.set(k, a)
    }
    return a
  }
  for (const it of live) ensure(it).onHand += it.quantity
  for (const it of tracked) ensure(it).authorized += it.quantity_authorized as number

  const orders: OrderLine[] = []
  for (const a of agg.values()) {
    if (a.authorized <= 0) continue
    const order = Math.max(0, a.authorized - a.onHand)
    if (order > 0) {
      orders.push({ nsn: a.nsn, lin: a.lin, name: a.name, authorized: a.authorized, onHand: a.onHand, order })
    }
  }
  orders.sort((a, b) => b.order - a.order)

  return { lines, orders, trackedCount: tracked.length }
}
