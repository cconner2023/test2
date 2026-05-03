import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ActionButton } from './ActionButton'
import { ActionPill } from './ActionPill'

export interface ContextMenuItem {
  key: string
  label: string
  icon: LucideIcon
  onAction?: () => void
  destructive?: boolean
  disabled?: boolean
  /** When set, tapping this item swaps the menu to show these items instead of running onAction. */
  submenu?: ContextMenuItem[]
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
        {activeItems.map((item) => (
          <ActionButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            variant={item.disabled ? 'disabled' : item.destructive ? 'danger' : 'default'}
            iconSize={14}
            onClick={() => {
              if (item.submenu) { setSubmenuItems(item.submenu); return }
              item.onAction?.()
              onClose()
            }}
          />
        ))}
      </ActionPill>
    </>,
    document.body,
  )
}
