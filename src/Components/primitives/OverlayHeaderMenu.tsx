import { HeaderMenuPill } from '@/Components/primitives/HeaderMenuPill'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * The header ellipsis: object-level secondary actions (Edit first, Share, Export,
 * Delete) in an anchored vertical list, so the footer stays on the primary commit.
 * AnchoredMenu portals above an open PreviewOverlay. Renders nothing when `items`
 * is empty, so callers can pass a conditionally-empty list (new vs. edit mode).
 *
 * `align` is the header edge:
 *   - 'left': a specific item's header (detail pane, item sheet, drilled screen).
 *     Its own pill in the left slot (stack `headerLeft`, Sheet `leftContent`,
 *     PaneHeader `leading`).
 *   - 'right' (default): rail / list / sheet-root and main-drawer headers. A bare
 *     button inside the close HeaderPill.
 */
export function OverlayHeaderMenu({ items, align = 'right', label }: { items: ContextMenuItem[]; align?: 'left' | 'right'; label?: string }) {
  return <HeaderMenuPill items={items} side={align} label={label} />
}
