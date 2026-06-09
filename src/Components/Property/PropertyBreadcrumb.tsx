/** PropertyBreadcrumb — clickable location-ancestry path, styled like the Admin
 *  LocationBreadcrumb (standard size, tertiary, not bold) and rendered at the top
 *  of the detail surface (desktop right pane / mobile sheet). Tapping the root
 *  resets to all-zones; tapping an ancestor zooms to it. */
import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'

/** Walk parent_id root→leaf. Depth-bounded; tolerates cycles/missing rows. */
export function getPropertyAncestry(
  locationId: string | null | undefined,
  locations: LocalPropertyLocation[],
): LocalPropertyLocation[] {
  if (!locationId) return []
  const byId = new Map(locations.map((l) => [l.id, l]))
  const chain: LocalPropertyLocation[] = []
  const seen = new Set<string>()
  let cursor: string | null = locationId
  let depth = 0
  while (cursor && depth < 32) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const node = byId.get(cursor)
    if (!node) break
    chain.push(node)
    cursor = node.parent_id ?? null
    depth++
  }
  return chain.reverse()
}

interface PropertyBreadcrumbProps {
  /** Current leaf location (selected zone / open item's location). null = root. */
  locationId: string | null
  locations: LocalPropertyLocation[]
  /** Root crumb label (clinic / cluster name). */
  rootLabel: string
  /** Navigate to a crumb. null → root (reset zoom). */
  onNavigate: (locationId: string | null) => void
  /** Drop the leaf crumb (when the leaf name is already shown as the host title). */
  excludeLeaf?: boolean
  className?: string
}

export function PropertyBreadcrumb({
  locationId,
  locations,
  rootLabel,
  onNavigate,
  excludeLeaf = false,
  className = '',
}: PropertyBreadcrumbProps) {
  const full = getPropertyAncestry(locationId, locations)
  const chain = excludeLeaf ? full.slice(0, -1) : full

  // Single line; the LAST crumb takes remaining width and ellipsizes, earlier
  // crumbs stay fixed (admin title pattern — "both in the title with …").
  const lastIdx = chain.length - 1
  const rootIsLast = chain.length === 0

  return (
    <div className={`flex items-center gap-x-1 text-[10pt] min-w-0 overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={`${rootIsLast ? 'min-w-0 flex-1 truncate text-left' : 'shrink-0'} text-tertiary hover:text-primary active:scale-95 transition-all`}
      >
        {rootLabel}
      </button>
      {chain.map((node, idx) => {
        const isLast = idx === lastIdx
        // With excludeLeaf every remaining crumb is an ancestor (clickable);
        // otherwise the last crumb is the current leaf (static).
        const isCurrent = !excludeLeaf && isLast
        const sizing = isLast ? 'min-w-0 flex-1 truncate text-left' : 'shrink-0'
        return (
          <Fragment key={node.id}>
            <ChevronRight size={12} className="shrink-0 text-tertiary/40" />
            {isCurrent ? (
              <span className={`${sizing} text-secondary`} aria-current="location">{node.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(node.id)}
                className={`${sizing} text-tertiary hover:text-primary active:scale-95 transition-all`}
              >
                {node.name}
              </button>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
