import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ActionButton, type ActionButtonVariant } from './ActionButton'
import { ActionPill } from './ActionPill'

export interface ContextMenuItem {
  key: string
  label: string
  /** Lucide icon — required unless `node` supplies a custom glyph. */
  icon?: LucideIcon
  /** Custom glyph (e.g. a themed reaction SVG). Wins over `icon` when set. */
  node?: ReactNode
  onAction?: () => void
  /** When set, the item renders as a real `<a href>` (reliable mailto/tel launch —
   *  see src/lib/mailto.ts). `onAction` is unnecessary; the menu still auto-closes
   *  on select via native navigation. Ignored when the item is disabled. */
  href?: string
  destructive?: boolean
  disabled?: boolean
  /** Explicit ActionButton variant — wins over destructive/disabled. Use for 'success' etc. */
  variant?: ActionButtonVariant
  /** When set, tapping this item swaps the menu to show these items instead of running onAction. */
  submenu?: ContextMenuItem[]
  /** Marks the item as the current selection (selector menus) — list rows render
   *  a highlighted/checked state. Ignored by the horizontal pill layout. */
  selected?: boolean
  /** Fully custom button renderer. When set, the item owns its own button + click and the
   *  menu does NOT auto-close on select. Use for status-aware buttons (ActionIconButton
   *  spinner/done) or stateful copy-tint buttons, and for buttons that carry their own
   *  data-tour anchor. Wins over icon/node/onAction. Rendered verbatim in horizontal/pill
   *  layouts; in the vertical list layout the whole row becomes the tap target (a tap
   *  anywhere forwards to the rendered control) so the label isn't a dead zone. */
  render?: () => ReactNode
}

/** Render a single menu item — a custom-glyph button when `node` is set, else an ActionButton. */
export function MenuItemButton({ item, onSelect }: { item: ContextMenuItem; onSelect: (item: ContextMenuItem) => void }) {
  if (item.node) {
    return (
      <button
        aria-label={item.label}
        title={item.label}
        onClick={() => onSelect(item)}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue2/8 active:scale-95 transition-all"
      >
        {item.node}
      </button>
    )
  }
  return (
    <ActionButton
      icon={item.icon!}
      label={item.label}
      variant={contextMenuItemVariant(item)}
      iconSize={14}
      href={item.href}
      onClick={() => onSelect(item)}
    />
  )
}

/** Resolve an item's ActionButton variant: explicit variant wins, else disabled > destructive > default. */
export function contextMenuItemVariant(item: ContextMenuItem): ActionButtonVariant {
  return item.variant ?? (item.disabled ? 'disabled' : item.destructive ? 'danger' : 'default')
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [submenuItems, setSubmenuItems] = useState<ContextMenuItem[] | null>(null)
  const activeItems = submenuItems ?? items

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    function handleDismiss(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleDismiss)
      document.addEventListener('touchstart', handleDismiss)
    })
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousedown', handleDismiss)
      document.removeEventListener('touchstart', handleDismiss)
    }
  }, [onClose])

  const pillWidth = activeItems.length * 40 + 8
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(x, window.innerWidth - pillWidth - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - 52)),
    zIndex: 9999,
    transform: visible ? 'scale(1)' : 'scale(0.95)',
    opacity: visible ? 1 : 0,
    transformOrigin: 'top left',
    transition: 'transform 150ms ease-out, opacity 150ms ease-out',
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onMouseDown={onClose}
        onTouchStart={onClose}
      />
      <ActionPill
        ref={menuRef}
        style={style}
        className="transform-gpu"
      >
        {activeItems.map((item) =>
          item.render ? (
            <Fragment key={item.key}>{item.render()}</Fragment>
          ) : (
            <MenuItemButton
              key={item.key}
              item={item}
              onSelect={(it) => {
                if (it.submenu) { setSubmenuItems(it.submenu); return }
                it.onAction?.()
                onClose()
              }}
            />
          ),
        )}
      </ActionPill>
    </>,
    document.body,
  )
}
