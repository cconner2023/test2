/**
 * BottomIsland — the floating bottom-center control bar used across the app
 * (Calendar view switcher, Property list/scan/map, Admin tab switcher, Map
 * toolbar, Messages Chat|Calls). Previously hand-rolled per surface with drift;
 * this is the single source of truth for the translucent pill + safe-area +
 * pointer-events plumbing.
 *
 * - `children` are the bar contents (typically <IslandButton>s, but Map mixes
 *   in a text readout button).
 * - `fab` is an optional right-aligned slot — pass the surface's own
 *   `absolute right-4 …` FAB element (Calendar/Admin nest it here).
 * - `z` overrides the stacking context (Map needs `z-[1000]` above Leaflet).
 * - `barClassName` extends the bar (Map uses `max-w-[…]`).
 */
import type { ReactNode } from 'react'
import { GlassBand } from '@/Components/primitives/GlassBand'

interface BottomIslandProps {
  children: ReactNode
  /** Optional right-aligned FAB element (already positioned `absolute right-4`). */
  fab?: ReactNode
  /** Stacking context for the wrapper. Default `z-20`; Map uses `z-[1000]`. */
  z?: string
  /** Extra classes on the pill bar. */
  barClassName?: string
  /** ARIA role for the bar, e.g. 'tablist'. */
  role?: string
  /** ARIA label for the bar (use with role). */
  ariaLabel?: string
  /**
   * Glass footer: render a feathered frosted band behind the island
   * (mirror of the glass header) so content scrolls UP behind it instead of
   * stopping on a hard edge. The pill stays opaque on top (iMessage look).
   * v1: consumers keep their own bottom-content padding for clearance.
   */
  glass?: boolean
}

export function BottomIsland({ children, fab, z = 'z-20', barClassName = '', role, ariaLabel, glass = false }: BottomIslandProps) {
  return (
    <div className={`absolute bottom-0 inset-x-0 flex flex-col items-center justify-end ${z} pointer-events-none pb-[max(1rem,var(--sab,0px))]${glass ? ' pt-8' : ' pt-4'}`}>
      {glass && <GlassBand edge="bottom" className="inset-0" />}
      <div
        role={role}
        aria-label={ariaLabel}
        className={`flex items-center gap-1 rounded-full bg-themewhite3/90 backdrop-blur-sm px-1 py-1 surface-shadow pointer-events-auto ${barClassName}`}
      >
        {children}
      </div>
      {fab}
    </div>
  )
}

interface IslandButtonProps {
  /** Render in the active (selected) style. */
  active?: boolean
  onClick: () => void
  /** Accessible label — also the tooltip. */
  label: string
  /** ARIA role, e.g. 'tab' for a tablist. Adds aria-selected when set. */
  role?: string
  disabled?: boolean
  /** The icon (or other glyph). Caller controls size. */
  children: ReactNode
}

export function IslandButton({ active = false, onClick, label, role, disabled, children }: IslandButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...(role ? { role, 'aria-selected': active } : {})}
      className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
        active ? 'bg-themeblue3 text-white shadow-sm' : 'text-tertiary hover:text-primary'
      } ${disabled ? 'opacity-30' : ''}`}
    >
      {children}
    </button>
  )
}
