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
