/** PropertyBreadcrumb — the single "one level up" parent crumb shown above the
 *  current entity's title in a property detail header. Normalized to mirror the
 *  Admin drawer header breadcrumb: at most two levels (parent → current), where
 *  the current entity is the title and this crumb is its immediate parent.
 *
 *  The crumb recomputes from the current selection ("replenishes"), so tapping
 *  it walks the hierarchy up one level at a time — there is no separate back
 *  chevron (the left-side ⋯ menu mirrors the map overlays instead). */
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'

interface PropertyBreadcrumbProps {
  /** The location one level above the current entity. null → clinic root. */
  parentId: string | null
  locations: LocalPropertyLocation[]
  /** Root crumb label (clinic / cluster name), shown when parentId is null. */
  rootLabel: string
  /** Navigate up to this parent. null → root (reset zoom). */
  onNavigate: (locationId: string | null) => void
  className?: string
}

export function PropertyBreadcrumb({
  parentId,
  locations,
  rootLabel,
  onNavigate,
  className = '',
}: PropertyBreadcrumbProps) {
  const parent = parentId ? locations.find((l) => l.id === parentId) ?? null : null
  const label = parent ? parent.name : rootLabel

  return (
    <button
      type="button"
      onClick={() => onNavigate(parent ? parent.id : null)}
      className={`block max-w-full truncate text-left text-[10pt] text-tertiary hover:text-primary active:scale-95 transition-all ${className}`}
    >
      {label}
    </button>
  )
}
