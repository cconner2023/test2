/**
 * Sub-cluster = intra-clinic render/grouping layer (ONE flat level, e.g. platoon
 * or squad inside a battalion-level clinic). Same clinicVault — this is RENDER
 * ONLY, never an access boundary. See v2/supervisor sub-cluster drawer.
 *
 * Filter is a three-state sentinel (avoids the init-effect race + stale-on-
 * clinic-switch bugs a plain `null = all` would hit):
 *   null      → UNSET: fall back to the viewer's default lens (their squad)
 *   'all'     → explicit show-everything (HQ drill-out)
 *   string[]  → explicit subset of sub-cluster ids
 */
export type SubClusterFilter = string[] | 'all' | null

/** HQ / unassigned bucket id used for grouping + filter rows (real ids are uuids). */
export const HQ_BUCKET = '__hq__'

/**
 * Resolve the effective set of sub-cluster ids to show, or `null` for "no
 * narrowing" (show everything). HQ/common items (sub_cluster_id == null) are
 * ALWAYS visible regardless and must be handled by the caller's filter clause.
 */
export function effectiveSubClusters(
  filter: SubClusterFilter,
  viewerSubClusterId: string | null | undefined,
): string[] | null {
  if (filter === 'all') return null
  if (Array.isArray(filter)) return filter
  // UNSET → default lens: squad members see their squad; HQ (null) sees all.
  return viewerSubClusterId ? [viewerSubClusterId] : null
}

/**
 * Shared visibility test for a tagged entity (calendar event / property item).
 * HQ-bucket entities (sub_cluster_id == null) are common → always visible.
 */
export function passesSubClusterFilter(
  entitySubClusterId: string | null | undefined,
  effective: string[] | null,
): boolean {
  if (effective === null) return true
  if (entitySubClusterId == null) return true // HQ / common — always shown
  return effective.includes(entitySubClusterId)
}

/**
 * Shared squad-lens test for a property ITEM — the single source the tree AND the
 * map filter on, so the two surfaces can never drift. Bypasses (always pass):
 *   - lens === null            → no narrowing in effect
 *   - cross-cluster item       → a followed item from another clinic carries a
 *                                sub_cluster_id from a foreign namespace; never narrow it
 *   - viewer owns or holds it  → personal property is always visible to its person
 *   - HQ / common (null tag)   → shared pool, visible to every sub-cluster
 * Otherwise: visible only when its sub_cluster_id is in the active lens.
 */
export function itemPassesLens(
  item: {
    clinic_id: string
    owner_user_id?: string | null
    current_holder_id?: string | null
    sub_cluster_id?: string | null
  },
  opts: { lens: string[] | null; primaryClinicId?: string | null; currentUserId?: string | null },
): boolean {
  const { lens, primaryClinicId, currentUserId } = opts
  if (lens === null) return true
  if (primaryClinicId != null && item.clinic_id !== primaryClinicId) return true
  if (currentUserId != null && (item.owner_user_id === currentUserId || item.current_holder_id === currentUserId)) return true
  if (item.sub_cluster_id == null) return true
  return lens.includes(item.sub_cluster_id)
}

/**
 * Location ids that make up the viewer's PERSONAL member-zone(s): every zone whose
 * `holder_user_id` is the viewer, PLUS all descendant zones under them. Feeds the
 * "My property" filter so anything physically placed in the viewer's own zone counts
 * as theirs — not just items they own outright or hold by custody. Empty when there
 * is no user id. Skips soft-deleted zones.
 */
export function collectHolderZoneIds(
  locations: Array<{ id: string; parent_id: string | null; holder_user_id?: string | null; deleted_at?: string | null }>,
  userId: string | null | undefined,
): Set<string> {
  const out = new Set<string>()
  if (!userId) return out
  const childrenByParent = new Map<string | null, string[]>()
  for (const l of locations) {
    if (l.deleted_at) continue
    const arr = childrenByParent.get(l.parent_id)
    if (arr) arr.push(l.id)
    else childrenByParent.set(l.parent_id, [l.id])
  }
  const stack = locations.filter((l) => !l.deleted_at && l.holder_user_id === userId).map((l) => l.id)
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    const kids = childrenByParent.get(id)
    if (kids) for (const k of kids) stack.push(k)
  }
  return out
}

/**
 * The "My property" test — the SINGLE source the tree AND the map filter on, so the
 * two surfaces can't drift. An item is the viewer's when they:
 *   - OWN it            → owner_user_id === me (personal property, travels on PCS)
 *   - are SIGNED FOR it → current_holder_id === me (custody holder)
 *   - STORE it          → it sits in the viewer's member-zone or a sub-zone under it
 * Staged turn-in stock is a separate clinic-wide bypass handled by the caller.
 */
export function itemIsMine(
  item: { owner_user_id?: string | null; current_holder_id?: string | null; location_id?: string | null },
  opts: { currentUserId: string | null | undefined; myZoneIds?: Set<string> | null },
): boolean {
  const { currentUserId, myZoneIds } = opts
  if (!currentUserId) return false
  if (item.owner_user_id === currentUserId) return true
  if (item.current_holder_id === currentUserId) return true
  if (myZoneIds && item.location_id != null && myZoneIds.has(item.location_id)) return true
  return false
}
