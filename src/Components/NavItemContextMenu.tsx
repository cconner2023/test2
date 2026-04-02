import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pin, ChevronUp, ChevronDown, EyeOff } from 'lucide-react'

interface NavItemContextMenuProps {
  action: string
  label: string
  isStarred: boolean
  isHidden: boolean
  position: { x: number; y: number }
  onStar: () => void
  onHide: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onClose: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

const MENU_WIDTH = 180
const ROW_HEIGHT = 40
const PADDING_Y = 8

export function NavItemContextMenu({
  isStarred,
  position,
  onStar,
  onHide,
  onMoveUp,
  onMoveDown,
  onClose,
  canMoveUp,
  canMoveDown,
}: NavItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

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

  const menuHeight = 4 * ROW_HEIGHT + PADDING_Y
  const clampedX = Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 8)

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, clampedX),
    top: Math.max(8, clampedY),
    zIndex: 9999,
    transform: visible ? 'scale(1)' : 'scale(0.95)',
    opacity: visible ? 1 : 0,
    transformOrigin: 'top left',
    transition: 'transform 150ms ease-out, opacity 150ms ease-out',
  }

  const options = [
    {
      key: 'star',
      label: isStarred ? 'Unpin' : 'Pin',
      icon: Pin,
      onAction: onStar,
      disabled: false,
      destructive: false,
      closesMenu: true,
      iconClass: isStarred ? 'fill-themeblue2 text-themeblue2' : 'text-tertiary/60',
    },
    {
      key: 'move-up',
      label: 'Move Up',
      icon: ChevronUp,
      onAction: onMoveUp,
      disabled: !canMoveUp,
      destructive: false,
      closesMenu: false,
      iconClass: 'text-tertiary/60',
    },
    {
      key: 'move-down',
      label: 'Move Down',
      icon: ChevronDown,
      onAction: onMoveDown,
      disabled: !canMoveDown,
      destructive: false,
      closesMenu: false,
      iconClass: 'text-tertiary/60',
    },
    {
      key: 'hide',
      label: 'Hide',
      icon: EyeOff,
      onAction: onHide,
      disabled: false,
      destructive: true,
      closesMenu: true,
      iconClass: 'text-themeredred/60',
    },
  ]

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onMouseDown={onClose}
        onTouchStart={onClose}
      />
      <div
        ref={menuRef}
        style={style}
        className="w-[180px] rounded-xl bg-themewhite shadow-lg border border-tertiary/15 py-1 transform-gpu"
      >
        {options.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.key}
              disabled={opt.disabled}
              onClick={() => {
                opt.onAction()
                if (opt.closesMenu) onClose()
              }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors active:scale-95 transform-gpu ${
                opt.disabled
                  ? 'opacity-40 cursor-default'
                  : opt.destructive
                    ? 'text-themeredred hover:bg-primary/5 active:bg-primary/10'
                    : 'text-primary/80 hover:bg-primary/5 active:bg-primary/10'
              }`}
            >
              <Icon size={16} className={opt.disabled ? 'text-tertiary/40' : opt.iconClass} />
              {opt.label}
            </button>
          )
        })}
      </div>
    </>,
    document.body,
  )
}
