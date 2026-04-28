import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface FloatingMenuProps {
  isOpen: boolean
  onClose: () => void
  /** Element the menu anchors to. Position is read on open and on each render while open. */
  anchorEl: HTMLElement | null
  /** Card width in px (clamped to 80vw). Default 280. */
  width?: number
  /** Force placement; default 'auto' picks the side with more room. */
  placement?: 'auto' | 'above' | 'below'
  children: ReactNode
}

/**
 * Anchored portal menu — sits above ALL overlay tiers (z-[200]/[201]) with a
 * click-catcher backdrop (no dim). Use for selectors and small inline editors
 * launched from inside another overlay. Visually integrates with the parent
 * surface instead of replacing it.
 *
 * Extracted from CategoryPicker (PlanBlockPreview.tsx). For full-screen edit
 * flows or confirmations use Modal / ConfirmDialog instead.
 */
export function FloatingMenu({
  isOpen,
  onClose,
  anchorEl,
  width = 280,
  placement = 'auto',
  children,
}: FloatingMenuProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!isOpen || !anchorEl) { setRect(null); return }
    setRect(anchorEl.getBoundingClientRect())
  }, [isOpen, anchorEl])

  if (!isOpen || !rect || typeof document === 'undefined') return null

  const winW = window.innerWidth
  const winH = window.innerHeight
  const menuWidth = Math.min(width, winW * 0.8)
  const menuLeft = Math.max(8, Math.min(rect.left, winW - menuWidth - 8))
  const spaceAbove = rect.top
  const spaceBelow = winH - rect.bottom
  const openUp = placement === 'above' || (placement === 'auto' && spaceAbove > spaceBelow)
  const menuBottom = winH - rect.top + 8
  const menuTop = rect.bottom + 8
  const maxHeight = Math.min(0.5 * winH, (openUp ? spaceAbove : spaceBelow) - 16)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      <div
        className="fixed z-[201] bg-themewhite rounded-2xl shadow-xl border border-tertiary/10 overflow-hidden"
        style={{
          left: menuLeft,
          ...(openUp ? { bottom: menuBottom } : { top: menuTop }),
          width: menuWidth,
          maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
