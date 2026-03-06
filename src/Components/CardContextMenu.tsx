import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export interface CardContextMenuItem {
  key: string
  label: string
  icon: LucideIcon
  onAction: () => void
  destructive?: boolean
}

interface CardContextMenuProps {
  x: number
  y: number
  items: CardContextMenuItem[]
  onClose: () => void
}

export function CardContextMenu({ x, y, items, onClose }: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Dismiss on click-away
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Defer listener so the triggering event doesn't immediately dismiss
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    })

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])

  // Clamp position so menu stays within the viewport
  const menuHeight = items.length * 36 + 8
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - menuHeight),
    zIndex: 9999,
  }

  return createPortal(
    <div ref={menuRef} style={style}
      className="min-w-[140px] rounded-xl bg-themewhite2 shadow-lg border border-primary/10 py-1"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.key}
            onClick={() => { item.onAction(); onClose() }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-sm hover:bg-primary/5 active:bg-primary/10 transition-colors ${
              item.destructive ? 'text-themeredred' : 'text-primary'
            }`}
          >
            <Icon size={14} className={item.destructive ? 'text-themeredred/60' : 'text-tertiary/60'} />
            {item.label}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
