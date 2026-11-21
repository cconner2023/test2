import { useRef, useState } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * A header PillButton that opens an anchored list menu. Two uses:
 *   - Add (`icon={Plus}`): [New x, New y, Multiselect]
 *   - Ellipsis (default icon): container-level secondary actions (cluster, import,
 *     export, share) or a form's modifiers (scope, type)
 * `side` picks the header edge:
 *   - 'left': its own pill on the header's left edge (stack `headerLeft`, Sheet
 *     `leftContent`, PaneHeader `leading`). Content panes and sheets.
 *   - 'right' (default): a bare button inside the close HeaderPill. Main drawers
 *     and the Add menu.
 * Renders nothing when `items` is empty, so callers pass a conditional list.
 */
export function HeaderMenuPill({ items, icon = MoreHorizontal, label = 'More actions', iconSize = 18, side = 'right' }: {
  items: ContextMenuItem[]
  icon?: LucideIcon
  label?: string
  iconSize?: number
  side?: 'left' | 'right'
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const button = <PillButton icon={icon} iconSize={iconSize} label={label} onClick={() => setOpen(true)} />
  return (
    <>
      <span ref={ref} className="inline-flex">
        {side === 'left' ? <HeaderPill>{button}</HeaderPill> : button}
      </span>
      <AnchoredMenu
        isOpen={open}
        anchorRect={null}
        anchorRef={ref}
        items={items}
        onClose={() => setOpen(false)}
        layout="list"
        align={side}
      />
    </>
  )
}
