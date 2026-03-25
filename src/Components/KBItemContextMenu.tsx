import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pin } from 'lucide-react'

interface KBItemContextMenuProps {
    isPinned: boolean
    position: { x: number; y: number }
    onTogglePin: () => void
    onClose: () => void
}

const MENU_WIDTH = 160
const MENU_HEIGHT = 48

export function KBItemContextMenu({ isPinned, position, onTogglePin, onClose }: KBItemContextMenuProps) {
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

    const clampedX = Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)
    const clampedY = Math.min(position.y, window.innerHeight - MENU_HEIGHT - 8)

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
                className="w-[160px] rounded-xl bg-themewhite shadow-lg border border-tertiary/15 py-1 transform-gpu"
            >
                <button
                    onClick={() => {
                        onTogglePin()
                        onClose()
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-primary/80 hover:bg-primary/5 active:bg-primary/10 active:scale-95 transition-all transform-gpu"
                >
                    <Pin size={16} className={isPinned ? 'fill-themeblue2 text-themeblue2' : 'text-tertiary/60'} />
                    {isPinned ? 'Unpin' : 'Pin'}
                </button>
            </div>
        </>,
        document.body,
    )
}
