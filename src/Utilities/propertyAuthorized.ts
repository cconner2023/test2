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
}

export interface AuthorizedList {
  groups: AuthGroup[]
  /** Count of authorization-tracked lines — 0 drives the "upload a BOM" empty state. */
  trackedCount: number
}

/** Group every authorization-tracked line by its SKO parent. Live items only
 *  (turned-in / deleted rows have left the book). */
export function groupAuthorized(items: LocalPropertyItem[]): AuthorizedList {
  const live = items.filter((it) => !it.deleted_at && !it.turned_in_at)
  const nameById = new Map(live.map((it) => [it.id, it.name]))
  const tracked = live.filter((it) => it.quantity_authorized != null)

  const byParent = new Map<string | null, AuthLine[]>()
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
      nsn: it.nsn,
      lin: it.lin,
      unitOfIssue: it.unit_of_issue,
      packSize: it.pack_size,
      authorized: it.quantity_authorized as number,
      authorizedBase: authorizedBaseUnits(it.quantity_authorized, it.pack_size),
      onHand: it.quantity,
    })
  }

  const groups: AuthGroup[] = []
  for (const [parentId, lines] of byParent) {
    // Sort by LIN (the MTOE ordering); untagged lines sink to the bottom, then name.
    lines.sort((a, b) => {
      if (a.lin && b.lin) return a.lin.localeCompare(b.lin) || a.name.localeCompare(b.name)
      if (a.lin) return -1
      if (b.lin) return 1
      return a.name.localeCompare(b.name)
    })
    groups.push({
      skoId: parentId,
      skoName: parentId ? nameById.get(parentId) ?? null : null,
      lines,
    })
  }
  // SKO groups alpha by name; the top-level (null) bucket always sorts last.
  groups.sort((a, b) => {
    if (a.skoId === null) return 1
    if (b.skoId === null) return -1
    return (a.skoName ?? '').localeCompare(b.skoName ?? '')
  })

  return { groups, trackedCount: tracked.length }
}
