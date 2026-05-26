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

interface BottomIslandProps {
  children: ReactNode
  /** Optional right-aligned FAB element (already positioned `absolute right-4`). */
  fab?: ReactNode
  /** Stacking context for the wrapper. Default `z-20`; Map uses `z-[1000]`. */
  z?: string
  /** Extra classes on the pill bar. */
  barClassName?: string
  /** `data-tour` anchor for the bar (guided tours). */
  tour?: string
  /** ARIA role for the bar, e.g. 'tablist'. */
  role?: string
  /** ARIA label for the bar (use with role). */
  ariaLabel?: string
}

export function BottomIsland({ children, fab, z = 'z-20', barClassName = '', tour, role, ariaLabel }: BottomIslandProps) {
  return (
    <div className={`absolute bottom-4 inset-x-0 flex items-center justify-center ${z} pointer-events-none pb-[max(0rem,var(--sab,0px))]`}>
      <div
        data-tour={tour}
        role={role}
        aria-label={ariaLabel}
        className={`flex items-center gap-1 rounded-full bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm border border-tertiary/20 px-1 py-1 shadow-lg pointer-events-auto ${barClassName}`}
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
  /** `data-tour` anchor (guided tours). */
  tour?: string
  /** ARIA role, e.g. 'tab' for a tablist. Adds aria-selected when set. */
  role?: string
  disabled?: boolean
  /** The icon (or other glyph). Caller controls size. */
  children: ReactNode
}

export function IslandButton({ active = false, onClick, label, tour, role, disabled, children }: IslandButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tour={tour}
      aria-label={label}
      title={label}
      {...(role ? { role, 'aria-selected': active } : {})}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
        active ? 'bg-themeblue3 text-white shadow-sm' : 'text-tertiary hover:text-primary'
      } ${disabled ? 'opacity-30' : ''}`}
    >
      {children}
    </button>
  )
}
