/**
 * GlassBand — the canonical frosted+masked backdrop for glass headers and glass
 * footers (bottom islands, composers). Single source of truth for the iOS
 * progressive-blur look: a translucent blurred band that feathers to nothing on
 * the content-facing edge so there's no hard CSS line where the blur ends.
 *
 * The tint must be the SAME token as the surface the band sits on, so it
 * composites to exactly that surface where nothing is behind the band and to
 * blurred content where something is. That identity is what keeps a glass band
 * seamless in both themes. Hence `surface`, which is a two-value switch, not a
 * colour: drawers sit at main-content level (themewhite), raised layers over the
 * scrim sit at themewhite3. Passing the wrong one shows up only in dark, where
 * the two tokens diverge — light themes alias them.
 *
 * Renders an absolutely-positioned, pointer-events-none, aria-hidden layer that
 * the parent positions (the parent owns `relative`/`absolute` placement). The
 * alpha and blur (`/15`, `backdrop-blur-[2px]`) are intentionally baked in — do
 * not override them per-surface; drift is what this primitive exists to kill.
 *
 * - `edge="top"` (header): blur fades DOWNWARD into the content below.
 * - `edge="bottom"` (footer / bottom island): blur fades UPWARD into the
 *   content scrolling up from beneath.
 *
 * Consumers: DrawerHeader (glassHeader), BottomIsland (glass), ChatDetailView
 * composer, WriteNoteHelpers, PropertyLocationMap — all 'content' except
 * BottomIsland, which floats over content rather than belonging to it.
 */
interface GlassBandProps {
  /** Which edge the band hugs — determines the feather direction. */
  edge: 'top' | 'bottom'
  /** Which surface the band belongs to. 'content' (default) = themewhite, the
   *  main-content/drawer level. 'raised' = themewhite3, for bands on a layer
   *  floating over the scrim. */
  surface?: 'content' | 'raised'
  /** Extra classes for positioning (e.g. inset-0, or bottom-0 inset-x-0 h-…). */
  className?: string
}

export function GlassBand({ edge, surface = 'content', className = '' }: GlassBandProps) {
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
      className={`absolute -z-10 pointer-events-none backdrop-blur-[2px] ${surface === 'raised' ? 'bg-themewhite3/15' : 'bg-themewhite/15'} ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  )
}
