/**
 * Shortage fold — derives "what's short / what to order" from authorized vs present
 * quantities. Pure client-side over the already-loaded property items (offline-first;
 * no new query). null `quantity_authorized` = not tracked → never a shortage.
 *
 * KEYING (the PHR / LIN+NSN model — see .claude/Projects/_ideas/phr-lin-nsn-auth-items.md):
 *  - lines  are keyed by the COMPOSITE (assigned-LIN + NSN). "Assigned LIN" = the item's
 *           parent (the LIN it's signed under), so the same NSN authorized in six different
 *           sets is six independent lines — only stock ASSIGNED to a set counts toward that
 *           set's shortage. Different NSNs under the same LIN are also separate lines
 *           (nomenclature/name are display labels, never the math).
 *  - orders are keyed by NSN ACROSS LINs — the requisition buys an NSN once regardless of how
 *           many sets it's short in (count-local, order-global).
 */
import type { LocalPropertyItem } from '../Types/PropertyTypes'
import { authorizedBaseUnits, isCustomPar, lineKeyOf } from './propertyAuthorized'

export interface ShortageLine {
  /** Representative item id for the aggregated (LIN+NSN) line — a React key, not a 1:1
   *  identity (several same-(LIN+NSN) rows across locations sum into one line). */
  itemId: string
  name: string
  nomenclature: string | null
  nsn: string | null
  lin: string | null
  serialNumber: string | null
  authorized: number
  onHand: number
  short: number
  /** SKO/LIN parent name when this line is a kit component; null = top-level. */
  skoName: string | null
  /** CUSTOM (wishlist / provider-par) line — top-level tracked stock that isn't on the MTOE
   *  (see isCustomPar). Surfaces short like any other line, but is EXCLUDED from the DA 2062
   *  supply annex (self-ordered, not requisitioned) and groups under the "Custom" branch. */
  custom: boolean
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

// lineKeyOf (count-LOCAL composite (LIN + NSN) key) is the shared source in propertyAuthorized
// so the shortage math and the authorized view's on-hand aggregation never diverge.

/** ORDER key = NSN ACROSS LINs (else name). This is the order-GLOBAL key: the requisition
 *  aggregates a given NSN's shortfall over every LIN so it's bought once — you don't
 *  requisition what you already hold somewhere. (Serialized/SI rows are matched 1:1 upstream
 *  and never reach this fungible pool.) */
function orderKeyOf(it: { nsn: string | null; name: string }): string {
  const nsn = (it.nsn ?? '').trim().toLowerCase()
  if (nsn) return 'nsn:' + nsn
  return 'name:' + it.name.trim().toLowerCase()
}

/** Authorized quantity converted to BASE (individual/EA) units, directly comparable to
 *  on-hand `quantity`. Thin adapter over the shared authorizedBaseUnits (single source of
 *  truth in propertyAuthorized) so the shortage math and the authorized view never diverge. */
function authBase(it: { quantity_authorized: number | null; pack_size: number | null }): number {
  return authorizedBaseUnits(it.quantity_authorized, it.pack_size)
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

  // ── Per-line shortfalls, aggregated by (LIN + NSN). Authorized comes from the tracked
  //    rows; on-hand from ALL live stock sharing the key (tracked or loose) that is assigned
  //    to the same LIN — so split-across-locations stock of one NSN in one set sums into a
  //    single line. A line surfaces only when authorized > 0 and short > 0.
  type LineAgg = { rep: LocalPropertyItem; authorized: number; onHand: number }
  const lineAgg = new Map<string, LineAgg>()
  const ensureLine = (it: LocalPropertyItem): LineAgg => {
    const k = lineKeyOf(it)
    let a = lineAgg.get(k)
    if (!a) {
      a = { rep: it, authorized: 0, onHand: 0 }
      lineAgg.set(k, a)
    }
    return a
  }
  for (const it of live) ensureLine(it).onHand += onHandOf(it)
  // Authorized pass: tracked rows own the authorized qty AND are the display representative
  // (their name/NSN/nomenclature is the authorized product, not some loose row's).
  for (const it of tracked) {
    const a = ensureLine(it)
    a.authorized += authBase(it)
    a.rep = it
  }

  const lines: ShortageLine[] = []
  for (const a of lineAgg.values()) {
    if (a.authorized <= 0) continue
    const short = Math.max(0, a.authorized - a.onHand)
    if (short <= 0) continue
    const it = a.rep
    lines.push({
      itemId: it.id,
      name: it.name,
      nomenclature: it.nomenclature,
      nsn: it.nsn,
      lin: it.lin,
      serialNumber: it.serial_number,
      authorized: a.authorized,
      onHand: a.onHand,
      short,
      skoName: it.parent_item_id ? nameById.get(it.parent_item_id) ?? null : null,
      custom: isCustomPar(it),
    })
  }
  lines.sort((a, b) => b.short - a.short)

  // ── Cluster requisition aggregate, keyed by NSN across LINs. Σauthorized over tracked
  //    lines vs Σpresent over ALL live stock of that NSN (tracked or loose — you don't
  //    requisition what you already have somewhere).
  type Agg = { nsn: string | null; lin: string | null; name: string; authorized: number; onHand: number }
  const agg = new Map<string, Agg>()
  const ensure = (it: LocalPropertyItem): Agg => {
    const k = orderKeyOf(it)
    let a = agg.get(k)
    if (!a) {
      a = { nsn: it.nsn, lin: it.lin, name: it.name, authorized: 0, onHand: 0 }
      agg.set(k, a)
    }
    return a
  }
  // Custom (wishlist) lines are self-ordered — keep them out of the cluster requisition entirely
  // (both the on-hand pool and the authorized demand). Loose stock (quantity_authorized null) is
  // NOT custom, so it still counts toward what you already hold.
  for (const it of live) if (!isCustomPar(it)) ensure(it).onHand += onHandOf(it)
  for (const it of tracked) if (!isCustomPar(it)) ensure(it).authorized += authBase(it)

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
