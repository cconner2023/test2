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
 * - `items`: when set, a tap opens an AnchoredMenu (list layout) pinned to the
 *   button and rising above it, instead of calling `onClick`. The FAB owns the open
 *   state, so callers hand in the options and nothing else. Pass `undefined` to
 *   fall back to `onClick` (Map does this while a draw mode is active, where the
 *   tap exits the mode).
 *
 * `shrink-0` is baked in: the Map FAB lives in a `flex flex-col` stack, and without
 * it a short viewport compressed the height while width held, rendering it oblong.
 */
import { useRef, useState } from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { PAD, RAIL_GLASS, THUMB } from '@/Components/primitives/SliderRail'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

interface AddFabProps {
  /** Fired on tap when no `items` are set. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** Menu options. When set, a tap opens them in an AnchoredMenu pinned to the FAB. */
  items?: ContextMenuItem[]
  /** Optional section header atop the menu (e.g. the scope the options act on). */
  menuHeader?: string
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
  /** Fill class; default `bg-themeblue3`. TC3 passes the casualty's band colour. */
  colorClass?: string
}

export function AddFab({
  onClick,
  items,
  menuHeader,
  label = 'Add',
  icon: Icon = Plus,
  size = 'md',
  tray = true,
  className = '',
  badge,
  disabled,
  colorClass = 'bg-themeblue3',
}: AddFabProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Last non-empty `items`, so the menu can finish its exit even when the caller
  // drops them on the same tap (Map: picking Route enters route mode, which
  // swaps the FAB to its exit-mode glyph and passes `items={undefined}`).
  const [heldItems, setHeldItems] = useState(items)
  if (items && items !== heldItems) setHeldItems(items)
  if (!items && menuOpen) setMenuOpen(false)
  const dim = size === 'lg' ? THUMB + 8 : THUMB
  const button = (
    <button
      ref={btnRef}
      type="button"
      onClick={(e) => (items ? setMenuOpen(true) : onClick?.(e))}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: dim, height: dim }}
      className={`relative shrink-0 rounded-full ${colorClass} text-white flex items-center justify-center ring-1 ring-white/40 shadow-md active:scale-95 transition-all duration-200 disabled:opacity-30 ${
        tray ? '' : `pointer-events-auto ${className}`
      }`}
    >
      <Icon className="w-5 h-5" />
      {badge}
    </button>
  )

  const menu = heldItems ? (
    <AnchoredMenu
      isOpen={menuOpen}
      anchorRef={btnRef}
      anchorRect={null}
      items={heldItems}
      onClose={() => setMenuOpen(false)}
      layout="list"
      align="right"
      direction="up"
      header={menuHeader}
    />
  ) : null

  if (!tray) return <>{button}{menu}</>

  return (
    <div
      style={{ padding: PAD }}
      className={`pointer-events-auto ${RAIL_GLASS} ${className}`}
    >
      {button}
      {menu}
    </div>
  )
}
