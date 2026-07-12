import { useState, useRef, type ReactNode } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * OverlayActionRail — splits a morph-overlay screen's action set across the two
 * chrome slots so a crowded footer never grows past two buttons.
 *
 * The problem it solves: an OverlayStack detail screen (e.g. MemberEditPopover)
 * accumulated up to FOUR footer ActionButtons (Loans · Transfer · Reset · Remove).
 * That reads as a button soup and pushes the destructive action into the crowd.
 *
 * The rule (mirrors the >2 → ellipsis convention used by OverlayActionMenu for
 * card corners, applied here to a screen's footer):
 *   - RESERVED actions (delete / reset — the ones that must stay one tap away and
 *     visually distinct) pin to the footer-left pill, capped at 2.
 *   - Everything else — plus any reserved beyond the cap — collapses into a single
 *     MoreHorizontal ellipsis riding the header's LEFT edge (HeaderPill trigger →
 *     AnchoredMenu vertical list, align="left"), matching the ellipsis-left
 *     convention established by the provider PE-block menu.
 *
 * Returns the two ready-to-drop nodes for a StackScreen: `footer` and `headerLeft`.
 * Both are undefined when their bucket is empty (no empty pill, no bare ellipsis).
 * The header-left slot is honored by any shell that renders StackScreen.headerLeft
 * (the PreviewOverlay card shell + the provider pane).
 */

export interface OverlayRailAction {
  key: string
  icon: LucideIcon
  label: string
  onClick: () => void
  /** Pin to the footer-left pill (delete / reset). Up to 2; extras overflow into
   *  the header ellipsis. Non-reserved actions always overflow. */
  reserved?: boolean
  /** Footer ActionButton variant; `danger` also styles the menu row destructive. */
  variant?: 'default' | 'danger'
}

const MAX_RESERVED = 2

// The header-left ellipsis — owns its own open state + anchor so the rail builder
// can stay a pure function (no hook, safe to call inside a screens map literal).
function OverlayRailEllipsis({ items }: { items: ContextMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={anchor} className="flex">
        <HeaderPill>
          <PillButton icon={MoreHorizontal} iconSize={18} label="More actions" onClick={() => setOpen(true)} />
        </HeaderPill>
      </div>
      <AnchoredMenu isOpen={open} anchorRef={anchor} layout="list" align="left" onClose={() => setOpen(false)} items={items} />
    </>
  )
}

export function buildOverlayActionRail(actions: OverlayRailAction[]): { footer?: ReactNode; headerLeft?: ReactNode } {
  const reserved: OverlayRailAction[] = []
  const overflow: OverlayRailAction[] = []
  for (const a of actions) {
    if (a.reserved && reserved.length < MAX_RESERVED) reserved.push(a)
    else overflow.push(a)
  }

  const footer = reserved.length > 0 ? (
    <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
      {reserved.map((a) => (
        <ActionButton key={a.key} icon={a.icon} label={a.label} variant={a.variant} onClick={a.onClick} />
      ))}
    </div>
  ) : undefined

  const menuItems: ContextMenuItem[] = overflow.map((a) => ({
    key: a.key,
    label: a.label,
    icon: a.icon,
    destructive: a.variant === 'danger',
    onAction: a.onClick,
  }))
  const headerLeft = overflow.length > 0 ? <OverlayRailEllipsis items={menuItems} /> : undefined

  return { footer, headerLeft }
}
