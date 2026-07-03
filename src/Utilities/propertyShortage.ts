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

/** Stable aggregation key: LIN, else NSN, else name (all normalized). LIN-FIRST so
 *  substitutable NSNs under one Line Item Number (e.g. CAT + SOF-T tourniquets) pool into
 *  a single shortage line — the LIN is the Army's interchangeability group. Falls back to
 *  NSN-exact only when there is no LIN. (Serialized/SI rows are matched 1:1 upstream and
 *  never reach this fungible pool.) */
function keyOf(it: { nsn: string | null; lin: string | null; name: string }): string {
  const lin = (it.lin ?? '').trim().toLowerCase()
  if (lin) return 'lin:' + lin
  const nsn = (it.nsn ?? '').trim().toLowerCase()
  if (nsn) return 'nsn:' + nsn
  return 'name:' + it.name.trim().toLowerCase()
}

/** Authorized quantity converted to BASE (individual/EA) units — issue-unit authorized
 *  (`quantity_authorized`, e.g. 6 PR) × pack_size (base per issue unit, e.g. 2) = 12 base,
 *  directly comparable to on-hand `quantity` (always stored in base units). pack_size
 *  null/0 → 1 (no split below the issue unit). */
function authBase(it: { quantity_authorized: number | null; pack_size: number | null }): number {
  if (it.quantity_authorized == null) return 0
  const factor = it.pack_size && it.pack_size > 0 ? it.pack_size : 1
  return it.quantity_authorized * factor
}

export function computeShortages(
  items: LocalPropertyItem[],
  /** Items STAGED for turn-in (open pending turn_in marker) — counted as on-hand 0 so
   *  staging surfaces the shortage immediately (the turned-in stock has left the line,
   *  even though it isn't verified/turned_in_at yet). A staged authorization-tracked line
   *  still appears as short; a staged loose stack just drops out of the on-hand sum. */
  stagedTurnInIds: Set<string> = new Set(),
): ShortageReport {
  // Turned-in items (turned_in_at set) have left the books — exclude them so a
  // turned-in line can't count as on-hand and mask a real shortage.
  const live = items.filter((it) => !it.deleted_at && !it.turned_in_at)
  const nameById = new Map(live.map((it) => [it.id, it.name]))
  const tracked = live.filter((it) => it.quantity_authorized != null)
  // Effective on-hand: staged-for-turn-in stock counts as 0 (it's leaving for supply).
  const onHandOf = (it: LocalPropertyItem) => (stagedTurnInIds.has(it.id) ? 0 : it.quantity)

  // Per-line shortfalls.
  const lines: ShortageLine[] = []
  for (const it of tracked) {
    // Authorized normalized to base (individual) units so a PR/SET line compares to
    // individually-placed on-hand stock (see authBase). onHand is already base.
    const authorized = authBase(it)
    const onHand = onHandOf(it)
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
  for (const it of live) ensure(it).onHand += onHandOf(it)
  for (const it of tracked) ensure(it).authorized += authBase(it)

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
