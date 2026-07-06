/**
 * AddFab — the canonical bottom-right circular "add" floating action button.
 *
 * Replaces 4 hand-rolled copies that had drifted (Property/Calendar/Admin used
 * a `w-11` button inside a bordered translucent tray; Map used a bare `w-12`
 * mode-toggle button with a status badge). They shared a recipe — square dim +
 * `rounded-full` + centered icon — but none carried `shrink-0`, so any FAB that
 * landed in a flex container (the Map stack) squished off-axis and rendered
 * oblong. This primitive bakes in `shrink-0` so the circle holds everywhere.
 *
 * The primitive owns SHAPE + chrome (size, rounding, tray, badge, shrink-0).
 * The CALLER owns PLACEMENT — pass positioning via `className` (e.g.
 * `absolute bottom-4 right-4`, or nothing when it's a flex child like Map).
 *
 * - `tray` (default true): wrap the button in the bordered translucent tray
 *   (Property/Calendar/Admin). `tray={false}` for a bare button (Map).
 * - `size`: 'md' = w-11 h-11 (default); 'lg' = w-12 h-12 (Map's larger FAB).
 * - `icon`: glyph component, default `Plus`, rendered at `w-5 h-5`. Map swaps
 *   this per draw mode.
 * - `badge`: optional overlay node (Map's recording dot).
 */
import { Plus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface AddFabProps {
  onClick: () => void
  /** aria-label + tooltip. Default 'Add'. */
  label?: string
  /** `data-tour` anchor on the button (guided tours). */
  tour?: string
  /** Glyph component; default `Plus`. Rendered at `w-5 h-5`. */
  icon?: LucideIcon
  /** 'md' = w-11 h-11 (default); 'lg' = w-12 h-12. */
  size?: 'md' | 'lg'
  /** Wrap in the bordered translucent tray. Default true; pass false for a bare button. */
  tray?: boolean
  /** Positioning + extra classes on the OUTERMOST node (tray, or button when tray=false). */
  className?: string
  /** Optional overlay badge (e.g. a recording dot), anchored to the button. */
  badge?: ReactNode
  disabled?: boolean
}

export function AddFab({
  onClick,
  label = 'Add',
  tour,
  icon: Icon = Plus,
  size = 'md',
  tray = true,
  className = '',
  badge,
  disabled,
}: AddFabProps) {
  const dim = size === 'lg' ? 'w-12 h-12' : 'w-11 h-11'
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tour={tour}
      aria-label={label}
      title={label}
      className={`relative shrink-0 ${dim} rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200 disabled:opacity-30 ${
        tray ? '' : `shadow-lg pointer-events-auto ${className}`
      }`}
    >
      <Icon className="w-5 h-5" />
      {badge}
    </button>
  )

  if (!tray) return button

  return (
    <div className={`rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto ${className}`}>
      {button}
    </div>
  )
}
