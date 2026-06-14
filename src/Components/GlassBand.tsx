/**
 * GlassBand — the canonical frosted+masked backdrop used for glass headers and
 * glass footers (bottom islands). Single source of truth for the iOS
 * progressive-blur look: a translucent blurred band that feathers to nothing on
 * the content-facing edge so there's no hard CSS line where the blur ends.
 *
 * Renders an absolutely-positioned, pointer-events-none, aria-hidden layer that
 * the parent positions (the parent owns `relative`/`absolute` placement). The
 * frost values (`backdrop-blur-[2px] bg-themewhite3/15`) are intentionally
 * baked in — do not override them per-surface; drift is what this primitive
 * exists to kill.
 *
 * - `edge="top"` (header): blur fades DOWNWARD into the content below.
 * - `edge="bottom"` (footer / bottom island): blur fades UPWARD into the
 *   content scrolling up from beneath.
 *
 * Consumers: DrawerHeader (glass mode), BottomIsland (glass), ChatDetailView
 * composer.
 */
interface GlassBandProps {
  /** Which edge the band hugs — determines the feather direction. */
  edge: 'top' | 'bottom'
  /** Extra classes for positioning (e.g. inset-0, or bottom-0 inset-x-0 h-…). */
  className?: string
}

export function GlassBand({ edge, className = '' }: GlassBandProps) {
  // The mask keeps the band opaque against its own edge and feathers to
  // transparent toward the content. Top header → fade down; bottom footer →
  // fade up (mirror).
  const mask =
    edge === 'top'
      ? 'linear-gradient(to bottom, black 55%, transparent 100%)'
      : 'linear-gradient(to top, black 55%, transparent 100%)'
  return (
    <div
      aria-hidden
      className={`absolute -z-10 pointer-events-none backdrop-blur-[2px] bg-themewhite3/15 ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  )
}
