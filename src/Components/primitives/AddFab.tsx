/**
 * AddFab — the canonical bottom-right circular "add" floating action button.
 *
 * Geometry and chrome are borrowed wholesale from {@link SliderRail}: the tray IS
 * the rail's glass track and the button IS its thumb, at the same diameter with the
 * same ring. A tray FAB therefore reads as a one-stop rail parked beside the
 * multi-stop one, and its height matches the bottom island it sits next to.
 *
 * The primitive owns SHAPE + chrome (size, rounding, tray, badge, shrink-0). The
 * CALLER owns PLACEMENT — pass positioning via `className` (e.g.
 * `absolute bottom-4 right-4`, or nothing when it's a flex child like Map).
 *
 * - `tray` (default true): wrap the button in the glass track (Property/Calendar/
 *   Admin). `tray={false}` for a bare button (Map).
 * - `size`: 'md' = thumb-sized, matching a rail stop (default); 'lg' = 48px, for
 *   Map's standalone draw-mode FAB, which carries the canvas on its own — it stays
 *   a step above the thumb, so it tracks THUMB rather than sitting at a fixed px.
 * - `icon`: glyph component, default `Plus`, rendered at `w-5 h-5`. Map swaps this
 *   per draw mode.
 * - `badge`: optional overlay node (Map's recording dot).
 *
 * `shrink-0` is baked in: the Map FAB lives in a `flex flex-col` stack, and without
 * it a short viewport compressed the height while width held, rendering it oblong.
 */
import { Plus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PAD, RAIL_GLASS, THUMB } from '@/Components/primitives/SliderRail'

interface AddFabProps {
  onClick: () => void
  /** aria-label + tooltip. Default 'Add'. */
  label?: string
  /** Glyph component; default `Plus`. Rendered at `w-5 h-5`. */
  icon?: LucideIcon
  /** 'md' = rail-thumb diameter (default); 'lg' = one step above it. */
  size?: 'md' | 'lg'
  /** Wrap in the glass track. Default true; pass false for a bare button. */
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
  icon: Icon = Plus,
  size = 'md',
  tray = true,
  className = '',
  badge,
  disabled,
}: AddFabProps) {
  const dim = size === 'lg' ? THUMB + 8 : THUMB
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: dim, height: dim }}
      className={`relative shrink-0 rounded-full bg-themeblue3 text-white flex items-center justify-center ring-1 ring-white/40 shadow-md active:scale-95 transition-all duration-200 disabled:opacity-30 ${
        tray ? '' : `pointer-events-auto ${className}`
      }`}
    >
      <Icon className="w-5 h-5" />
      {badge}
    </button>
  )

  if (!tray) return button

  return (
    <div
      style={{ padding: PAD }}
      className={`pointer-events-auto ${RAIL_GLASS} ${className}`}
    >
      {button}
    </div>
  )
}
