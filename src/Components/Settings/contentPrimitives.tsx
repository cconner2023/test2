import { useCallback, useState, type ReactNode } from 'react'
import { Check, Eye, Pencil, MessageSquare, FileSpreadsheet, Trash2 } from 'lucide-react'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { OverlayStack, type CardMorphHost, type StackNav } from '@/Components/primitives/OverlayStack'
import { PaneStack, type StackScreen } from '@/Components/primitives/PaneStack'
import { liftSnapshot, type LiftSnapshot } from '../liftPress'

/**
 * Shared App Content pieces (Plan, Order Sets, Text Templates).
 *
 *   ContentStack     — the editor surface: PaneStack (Sheet on mobile) or, on
 *                      desktop Settings, a morph into the subpage card's slot.
 *                      Never an anchored overlay.
 *   useRowMenu       — tap a row → the row lifts and its actions drop beneath it.
 *   itemMenuItems    — the standard per-item list [Open, Edit, Share, Export, Delete].
 *   SelectBox        — multiselect checkbox glyph.
 */

export function ContentStack({ isOpen, onClose, initial, screens, cardHost, navRef }: {
  isOpen: boolean
  onClose: () => void
  initial: { key: string; params?: unknown }
  screens: Record<string, StackScreen>
  cardHost?: CardMorphHost
  navRef?: React.MutableRefObject<StackNav | null>
}) {
  if (cardHost) {
    return <OverlayStack isOpen={isOpen} onClose={onClose} initial={initial} screens={screens} cardHost={cardHost} navRef={navRef} />
  }
  return <PaneStack isOpen={isOpen} onClose={onClose} initial={initial} screens={screens} navRef={navRef} maxHeight={85} />
}

export function useRowMenu() {
  const [menu, setMenu] = useState<(LiftSnapshot & { items: ContextMenuItem[] }) | null>(null)
  const open = useCallback((el: HTMLElement, items: ContextMenuItem[]) => {
    if (items.length === 0) return
    setMenu({ ...liftSnapshot(el), items })
  }, [])
  const node: ReactNode = menu ? (
    <LiftedRowMenu
      isOpen
      anchorRect={menu.rect}
      row={<div dangerouslySetInnerHTML={{ __html: menu.html }} />}
      onClose={() => setMenu(null)}
      layout="list"
      items={menu.items}
    />
  ) : null
  return { open, node }
}

/** Per-item actions. Edit / Delete only when the viewer may edit the item (cluster
 *  items are read-only to non-supervisors — they can still open, share, export). */
export function itemMenuItems({ onOpen, onEdit, onShare, onExport, onDelete, canEdit }: {
  onOpen?: () => void
  onEdit?: () => void
  onShare?: () => void
  onExport?: () => void
  onDelete?: () => void
  canEdit: boolean
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (onOpen) items.push({ key: 'open', label: 'Open', icon: Eye, onAction: onOpen })
  if (onEdit && canEdit) items.push({ key: 'edit', label: 'Edit', icon: Pencil, onAction: onEdit })
  if (onShare) items.push({ key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: onShare })
  if (onExport) items.push({ key: 'export', label: 'Export CSV', icon: FileSpreadsheet, onAction: onExport })
  if (onDelete && canEdit) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: onDelete })
  return items
}

export function SelectBox({ checked }: { checked: boolean }) {
  return (
    <span className={`w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-themeblue2 border-themeblue2' : 'border-tertiary/40'}`}>
      {checked && <Check size={11} className="text-white" strokeWidth={3} />}
    </span>
  )
}
