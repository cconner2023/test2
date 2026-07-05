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
  unitOfIssue: UnitOfIssue | null
  packSize: number | null
  /** Issue-unit authorized quantity (quantity_authorized, non-null here). */
  authorized: number
  /** On-hand in base (individual) units — property_items.quantity. */
  onHand: number
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
      unitOfIssue: it.unit_of_issue,
      packSize: it.pack_size,
      authorized: it.quantity_authorized as number,
      onHand: it.quantity,
    })
  }

  const groups: AuthGroup[] = []
  for (const [parentId, lines] of byParent) {
    lines.sort((a, b) => a.name.localeCompare(b.name))
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
