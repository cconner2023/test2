/** MapOverlayBreadcrumb — the single "one level up" parent crumb shown above a
 *  selected feature's title in the map-overlay detail header. Deliberately kept
 *  as a near-clone of PropertyBreadcrumb so the two map-like drawers read the
 *  same: a feature's parent is its overlay, so this crumb is the overlay's name.
 *  Tapping it walks up to the overlay tree (mobile morphs the sheet back to its
 *  tree step; desktop deselects to reveal the rail tree). There is no separate
 *  back chevron — the crumb IS the walk-up affordance, mirroring property. */
interface MapOverlayBreadcrumbProps {
  /** Parent overlay name, shown as the crumb. */
  label: string
  /** Walk up one level — to the overlay tree. */
  onNavigate: () => void
  className?: string
}

export function MapOverlayBreadcrumb({
  label,
  onNavigate,
  className = '',
}: MapOverlayBreadcrumbProps) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className={`block max-w-full truncate text-left text-[10pt] text-tertiary hover:text-primary active:scale-95 transition-all ${className}`}
    >
      {label}
    </button>
  )
}
