/**
 * Authorized-list fold — the "complete BOM" view of every authorization-tracked line,
 * grouped by SKO parent. Pure client-side over the already-loaded property items
 * (offline-first; no new query). Sibling of propertyShortage.ts: that fold derives the
 * SHORTAGE (authorized − on-hand); this one exposes the raw authorized structure so the
 * user can VIEW and EDIT the whole list, not just what's short.
 *
 * `quantity_authorized == null` = not tracked → never in the list. A tracked child sits
 * under its SKO parent's group; a tracked top-level item lands in the null "Top-level"
 * bucket (rendered last).
 */
import type { LocalPropertyItem, UnitOfIssue } from '../Types/PropertyTypes'

export interface AuthLine {
  itemId: string
  name: string
  /** Component ROLE / doctrinal identity ("Tourniquet", "Chest Seal") — the middle row,
   *  between the product name and NSN. */
  nomenclature: string | null
  nsn: string | null
  /** Line Item Number (MTOE catalog id) — the primary sort key within a group. */
  lin: string | null
  unitOfIssue: UnitOfIssue | null
  packSize: number | null
  /** Issue-unit authorized quantity (quantity_authorized, non-null here) — the value the
   *  user edits. May be a pack unit (PR/SET/BOT) that is NOT directly comparable to onHand. */
  authorized: number
  /** Authorized converted to BASE (individual/EA) units via pack_size — directly comparable
   *  to onHand. Same conversion the shortage fold uses (authorizedBaseUnits). */
  authorizedBase: number
  /** On-hand in base (individual) units — property_items.quantity. */
  onHand: number
}

/** Issue-unit authorized quantity → BASE (individual/EA) units. `quantity_authorized`
 *  (e.g. 6 PR) × pack_size (base per issue unit, e.g. 2) = 12 base, directly comparable to
 *  on-hand `quantity` (always base). pack_size null/0 → 1 (no split below the issue unit).
 *  SINGLE SOURCE OF TRUTH for the authorized→base conversion — shared with
 *  propertyShortage.computeShortages so the view and the shortage math never diverge. */
export function authorizedBaseUnits(quantityAuthorized: number | null, packSize: number | null): number {
  if (quantityAuthorized == null) return 0
  const factor = packSize && packSize > 0 ? packSize : 1
  return quantityAuthorized * factor
}

export interface AuthGroup {
  /** SKO parent item id; null = the top-level (parentless) bucket. */
  skoId: string | null
  /** SKO parent's name; null = top-level bucket (rendered as "Top-level items"). */
  skoName: string | null
  lines: AuthLine[]
  /** Σ authorizedBase over the group's lines — the LIN's total required base (EA) qty. */
  authorizedBaseTotal: number
  /** Σ min(onHand, authorizedBase) over the lines — how much of the requirement is FILLED
   *  (per-line capped so an overage on one component can't mask a shortfall on another). */
  filledBase: number
  /** Group fill as a whole-number percent (0–100), filledBase / authorizedBaseTotal. 0 when
   *  nothing is authorized yet (a freshly-built, component-less LIN). */
  fillPercent: number
}

export interface AuthorizedList {
  groups: AuthGroup[]
  /** Count of authorization-tracked lines — feeds the empty state alongside linCount. */
  trackedCount: number
  /** Count of PHR LIN containers (see isLinContainer). trackedCount + linCount === 0 = a
   *  truly empty hand receipt → the "build LINs first" empty state. */
  linCount: number
}

/** A PHR LIN container (the cluster's hand-receipt line): a live, TOP-LEVEL item that carries
 *  a LIN code and is NOT authorization-tracked itself. It's a pure header the component lines
 *  hang under — it holds no quantity_authorized, so it never multiplies or contributes its own
 *  shortage. This is the (no-migration) marker that distinguishes a LIN from a loose top-level
 *  item; New-LIN mode in PropertyItemForm writes exactly this shape (name + lin, everything
 *  else null/0). */
export function isLinContainer(it: {
  parent_item_id: string | null
  lin: string | null
  quantity_authorized: number | null
  deleted_at?: string | null
  turned_in_at: string | null
}): boolean {
  return (
    it.parent_item_id == null &&
    it.quantity_authorized == null &&
    !!(it.lin && it.lin.trim()) &&
    !it.deleted_at &&
    !it.turned_in_at
  )
}

/** A ZONE-SHADOW: an item that IS the hand-receipt identity of a property_locations zone
 *  (a vehicle/case/bag that is itself accountable property). It's a COUNTED COMPONENT under
 *  its parent LIN — NOT a LIN header — but carries `represents_location_id` = the zone it is.
 *  That field, not isLinContainer, is what separates it from loose stock located in the same
 *  zone, and it's the map/tree pin-exclusion marker (the zone already draws itself). Live rows
 *  only. See the zone-shadow-component model. */
export function isZoneShadow(it: {
  represents_location_id?: string | null
  deleted_at?: string | null
  turned_in_at: string | null
}): boolean {
  return !!it.represents_location_id && !it.deleted_at && !it.turned_in_at
}

/** An AUTHORIZED TARGET (decoupled model): a tracked line (quantity_authorized set) with NO
 *  location. It's the "what we should have" target — one per (LIN + NSN) — that lives ONLY in
 *  the Cluster Hand Receipt; its on-hand is the SUM of all located physical stock matching its
 *  (LIN + NSN), wherever that stock sits. Because it has no location it never pins on the
 *  map/tree (a depleted target simply shows short in the receipt). Physical stock is untracked,
 *  located, and scoped under the same LIN (parent_item_id), so it renders on the map/tree. */
export function isAuthTarget(it: {
  quantity_authorized: number | null
  location_id: string | null
  deleted_at?: string | null
  turned_in_at: string | null
}): boolean {
  return it.quantity_authorized != null && it.location_id == null && !it.deleted_at && !it.turned_in_at
}

/** COMPOSITE (LIN + NSN) key — the single source shared by the shortage fold and the authorized
 *  view so on-hand aggregation never diverges. Scope = the item's parent LIN (else its own LIN
 *  string, else a "top" bucket); identity = NSN (else name). A target and the physical stock
 *  that fills it share this key when the stock sits under the same LIN with the same NSN. */
export function lineKeyOf(it: { nsn: string | null; lin: string | null; name: string; parent_item_id: string | null }): string {
  const scope = it.parent_item_id
    ? 'p:' + it.parent_item_id
    : ((it.lin ?? '').trim() ? 'lin:' + (it.lin ?? '').trim().toLowerCase() : 'top')
  const nsn = (it.nsn ?? '').trim().toLowerCase()
  const ident = nsn ? 'nsn:' + nsn : 'name:' + it.name.trim().toLowerCase()
  return scope + '||' + ident
}

/** The PHYSICAL STOCK behind each line's on-hand count, indexed by (LIN + NSN) line key —
 *  the "what's filling this" set. A line's `onHand` is the SUM over every live row sharing
 *  its key; this exposes the individual rows so the Cluster Hand Receipt and Shortages panels
 *  can drill from an aggregated line to the located stacks that fill it (tap → locate on map).
 *
 *  Excludes: location-less AUTHORIZED TARGETS (the requirement rows carry the key but hold no
 *  physical stock — see isAuthTarget) and any zero-on-hand row. Each key's fillers therefore
 *  sum to that line's onHand, and every one is a real, locatable stack. Sorted by qty desc. */
export function fillersByLineKey(items: LocalPropertyItem[]): Map<string, LocalPropertyItem[]> {
  const m = new Map<string, LocalPropertyItem[]>()
  for (const it of items) {
    if (it.deleted_at || it.turned_in_at || it.quantity <= 0 || isAuthTarget(it)) continue
    const k = lineKeyOf(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  for (const arr of m.values()) arr.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
  return m
}

/** Group every authorization-tracked line by its SKO parent. Live items only
 *  (turned-in / deleted rows have left the book). */
export function groupAuthorized(items: LocalPropertyItem[]): AuthorizedList {
  const live = items.filter((it) => !it.deleted_at && !it.turned_in_at)
  const nameById = new Map(live.map((it) => [it.id, it.name]))
  const tracked = live.filter((it) => it.quantity_authorized != null)
  const containers = live.filter(isLinContainer)

  // On-hand per (LIN + NSN), summed over ALL live stock of that key — the decoupled model: a
  // target's on-hand is everything that counts for it (located physical stock across zones +
  // any qty carried on the target row itself), not just its own row.
  const onHandByKey = new Map<string, number>()
  for (const it of live) {
    const k = lineKeyOf(it)
    onHandByKey.set(k, (onHandByKey.get(k) ?? 0) + it.quantity)
  }

  const byParent = new Map<string | null, AuthLine[]>()
  // Seed a group for every LIN container so a freshly-built LIN shows (with zero items) before
  // any component is assigned — the PHR is the LIN list, not just the lines under it.
  for (const c of containers) if (!byParent.has(c.id)) byParent.set(c.id, [])
  for (const it of tracked) {
    const key = it.parent_item_id ?? null
    let arr = byParent.get(key)
    if (!arr) {
      arr = []
      byParent.set(key, arr)
    }
    arr.push({
      itemId: it.id,
      name: it.name,
      nomenclature: it.nomenclature,
      nsn: it.nsn,
      lin: it.lin,
      unitOfIssue: it.unit_of_issue,
      packSize: it.pack_size,
      authorized: it.quantity_authorized as number,
      authorizedBase: authorizedBaseUnits(it.quantity_authorized, it.pack_size),
      onHand: onHandByKey.get(lineKeyOf(it)) ?? it.quantity,
    })
  }

  const groups: AuthGroup[] = []
  for (const [parentId, lines] of byParent) {
    // Components list ALPHABETICALLY by name (nomenclature/NSN break ties) — a plain A→Z
    // read within each LIN, not the MTOE/LIN-code ordering.
    lines.sort((a, b) =>
      a.name.localeCompare(b.name) ||
      (a.nomenclature ?? '').localeCompare(b.nomenclature ?? '') ||
      (a.nsn ?? '').localeCompare(b.nsn ?? ''),
    )
    // Per-LIN fill rollup: Σ authorized vs Σ filled (each line capped at its own authorized so
    // an overage can't paper over another component's shortfall).
    const authorizedBaseTotal = lines.reduce((s, l) => s + l.authorizedBase, 0)
    const filledBase = lines.reduce((s, l) => s + Math.min(l.onHand, l.authorizedBase), 0)
    const fillPercent = authorizedBaseTotal > 0 ? Math.round((filledBase / authorizedBaseTotal) * 100) : 0
    groups.push({
      skoId: parentId,
      skoName: parentId ? nameById.get(parentId) ?? null : null,
      lines,
      authorizedBaseTotal,
      filledBase,
      fillPercent,
    })
  }
  // SKO groups alpha by name; the top-level (null) bucket always sorts last.
  groups.sort((a, b) => {
    if (a.skoId === null) return 1
    if (b.skoId === null) return -1
    return (a.skoName ?? '').localeCompare(b.skoName ?? '')
  })

  return { groups, trackedCount: tracked.length, linCount: containers.length }
}
