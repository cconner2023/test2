/**
 * BottomIsland — the floating bottom-center control used across the app (Calendar
 * view switcher, Property list/scan/map, Admin tab switcher, Map toolbar, Messages
 * Chat|Calls). Owns the safe-area, glass-footer and pointer-events plumbing; the
 * control itself is a horizontal {@link SliderRail}, the same one the property
 * FloorSlider and TC3 casualty ladder use vertically.
 *
 * TWO MODES:
 * - `stops` (preferred): a real slider. The thumb rides to the active stop, drag
 *   sweeps it and live-selects as it crosses each one. Use `momentary` on a stop
 *   that fires an action rather than switching destination (Property's camera,
 *   Calendar's view options) — those ignore drag-cross and the thumb springs back.
 * - `children`: a plain bar for content that is NOT a selector and so has nothing
 *   for a thumb to ride. Only the Map toolbar qualifies: a basemap toggle, a
 *   variable-width coordinate readout and a locate button. It still gets the rail's
 *   glass chrome and height so the two read as one system.
 *
 * `fab` is an optional right-aligned slot — pass the surface's own
 * `absolute right-4 …` AddFab. `z` overrides stacking (Map needs `z-[1000]` above
 * Leaflet). `barClassName` extends the bar/track (Map uses `max-w-[…]`).
 */
import type { ReactNode } from 'react'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { PAD, SliderRail, THUMB, type SliderStop } from '@/Components/primitives/SliderRail'

interface BottomIslandProps {
  /** Slider mode: the selectable stops. Mutually exclusive with `children`. */
  stops?: SliderStop[]
  /** Slider mode: currently active stop id. */
  activeId?: string | null
  /** Slider mode: called with the stop id on tap, drag-cross or release. */
  onSelect?: (id: string) => void
  /** Bar mode: raw bar contents (Map's mixed toolbar). */
  children?: ReactNode
  /** Optional right-aligned FAB element (already positioned `absolute right-4`). */
  fab?: ReactNode
  /** Stacking context for the wrapper. Default `z-20`; Map uses `z-[1000]`. */
  z?: string
  /** Extra classes on the bar / track. */
  barClassName?: string
  /** ARIA role. Default 'tablist' in slider mode (these are view switchers). */
  role?: string
  /** ARIA label for the control. */
  ariaLabel?: string
  /**
   * Glass footer: render a feathered frosted band behind the island (mirror of the
   * glass header) so content scrolls UP behind it instead of stopping on a hard
   * edge. Consumers keep their own bottom-content padding for clearance.
   */
  glass?: boolean
}

export function BottomIsland({
  stops,
  activeId = null,
  onSelect,
  children,
  fab,
  z = 'z-20',
  barClassName = '',
  role,
  ariaLabel,
  glass = false,
}: BottomIslandProps) {
  return (
    <div className={`absolute bottom-0 inset-x-0 flex flex-col items-center justify-end ${z} pointer-events-none pb-[max(1rem,var(--sab,0px))]${glass ? ' pt-8' : ' pt-4'}`}>
      {glass && <GlassBand edge="bottom" surface="raised" className="inset-0" />}
      {stops && onSelect ? (
        <SliderRail
          stops={stops}
          activeId={activeId}
          onSelect={onSelect}
          orientation="horizontal"
          role={role ?? 'tablist'}
          label={ariaLabel ?? 'View'}
          className={`pointer-events-auto ${barClassName}`}
        />
      ) : (
        <div
          role={role}
          aria-label={ariaLabel}
          // Same glass recipe and height as the rail track, so the Map's mixed
          // toolbar sits at the same altitude as every real slider.
          className={`flex items-center gap-1 rounded-full border border-white/40 bg-themewhite2/60 shadow-lg backdrop-blur-md pointer-events-auto dark:border-white/10 dark:bg-themewhite3/50 ${barClassName}`}
          style={{ padding: PAD, minHeight: THUMB + 2 * PAD }}
        >
          {children}
        </div>
      )}
      {fab}
    </div>
  )
}
