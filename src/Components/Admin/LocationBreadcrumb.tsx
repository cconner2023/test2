import { useMemo, Fragment } from 'react'
import type { AdminLocation } from '../../lib/adminService'

/**
 * Walk locations.parent_id chain root→leaf for a given id. Depth-bounded to
 * match the trigger guard (32) — silently truncates rather than throwing on
 * cycles so a malformed row can't crash the picker.
 */
export function getLocationAncestry(
  locationId: string | null | undefined,
  allLocations: AdminLocation[],
): AdminLocation[] {
  if (!locationId) return []
  const byId = new Map(allLocations.map(l => [l.id, l]))
  const chain: AdminLocation[] = []
  const seen = new Set<string>()
  let cursor: string | null = locationId
  let depth = 0
  while (cursor && depth < 32) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const node = byId.get(cursor)
    if (!node) break
    chain.push(node)
    cursor = node.parent_id
    depth++
  }
  return chain.reverse()
}

interface LocationBreadcrumbProps {
  locationId: string | null | undefined
  allLocations: AdminLocation[]
  /** Render only ancestors, excluding the leaf — useful when the leaf is shown elsewhere. */
  excludeLeaf?: boolean
  /** Override default tertiary text styling. */
  className?: string
}

/**
 * Renders a `›`-separated breadcrumb of a location's ancestry. Pure — caller
 * supplies the full locations list. Returns null when there's no chain to show.
 */
export function LocationBreadcrumb({
  locationId,
  allLocations,
  excludeLeaf = false,
  className = 'text-[9pt] text-tertiary',
}: LocationBreadcrumbProps) {
  const chain = useMemo(() => {
    const full = getLocationAncestry(locationId, allLocations)
    return excludeLeaf ? full.slice(0, -1) : full
  }, [locationId, allLocations, excludeLeaf])

  if (chain.length === 0) return null

  return (
    <span className={className}>
      {chain.map((node, idx) => (
        <Fragment key={node.id}>
          {idx > 0 && <span className="mx-1 opacity-50">›</span>}
          <span>{node.installation}{node.sub_area ? ` — ${node.sub_area}` : ''}</span>
        </Fragment>
      ))}
    </span>
  )
}
