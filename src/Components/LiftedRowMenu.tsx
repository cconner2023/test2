import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { ActionButton } from './ActionButton'
import { ActionPill } from './ActionPill'
import type { ContextMenuItem } from './ContextMenu'

interface LiftedRowMenuProps {
  isOpen: boolean
  /** Bounding rect of the row that was long-pressed / right-clicked. */
  anchorRect: DOMRect | null
  /** Visual clone of the row — rendered floating, lifted off the list. */
  row: ReactNode
  items: ContextMenuItem[]
  onClose: () => void
  /** Skip the white card wrapper — the clone brings its own surface (e.g. a chat
   *  bubble). Uses a shape-following drop-shadow instead of a box shadow. */
  bare?: boolean
  /** Which edge of the anchor the menu aligns to. Defaults to 'left'. */
  align?: 'left' | 'right'
}

const MENU_H = 52    // ActionPill height (36px button + padding)
const GAP = 12       // space between lifted row and menu
const SAFE = 12      // viewport edge padding
const BASE_LIFT = 34 // baseline upward pop so the row always visibly detaches

/**
 * iOS-style "peek" context menu. The pressed row lifts off the list — scales up
 * slightly, gains a shadow (reads as selected) — and slides upward just enough to
 * make room for a horizontal action pill that drops in directly beneath it.
 * Shared by mobile (long-press) and desktop (right-click) messaging rows.
 */
export function LiftedRowMenu({ isOpen, anchorRect, row, items, onClose, bare = false, align = 'left' }: LiftedRowMenuProps) {
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) { setVisible(false); return }
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  if (!isOpen || !anchorRect) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Always pop the row up by a baseline so it visibly detaches; lift further if
  // needed for the menu to clear the bottom edge. Never let the row top cross the
  // safe area, and never lift more than the room above allows.
  const bottomNeed = (anchorRect.bottom + GAP + MENU_H + SAFE) - vh
  const desiredLift = Math.max(BASE_LIFT, bottomNeed)
  const maxLift = Math.max(0, anchorRect.top - SAFE)
  const lift = Math.min(desiredLift, maxLift)

  const menuTop = anchorRect.bottom - lift + GAP
  const pillWidth = items.length * 40 + 12
  const rawLeft = align === 'right' ? anchorRect.right - pillWidth : anchorRect.left
  const menuLeft = Math.max(SAFE, Math.min(rawLeft, vw - pillWidth - SAFE))
  const cloneOrigin = bare ? (align === 'right' ? 'right bottom' : 'left bottom') : 'center bottom'

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9998 }}>
      {/* Dimming backdrop — tap anywhere to dismiss */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease-out' }}
        onMouseDown={onClose}
        onTouchStart={onClose}
      />

      {/* Lifted row clone */}
      <div
        className={
          bare
            ? 'absolute pointer-events-none'
            : 'absolute rounded-2xl bg-themewhite overflow-hidden pointer-events-none ring-1 ring-black/5'
        }
        style={{
          left: anchorRect.left,
          top: anchorRect.top,
          width: anchorRect.width,
          ...(bare
            ? { filter: visible ? 'drop-shadow(0 14px 26px rgba(0,0,0,0.30))' : 'none' }
            : { boxShadow: visible ? '0 18px 44px rgba(0,0,0,0.28)' : '0 0 0 rgba(0,0,0,0)' }),
          transform: visible ? `translateY(${-lift}px) scale(1.05)` : 'translateY(0) scale(1)',
          transformOrigin: cloneOrigin,
          transition:
            'transform 320ms cubic-bezier(0.2, 1.5, 0.5, 1), filter 320ms ease-out, box-shadow 320ms ease-out',
        }}
      >
        {row}
      </div>

      {/* Action pill below the lifted row */}
      <ActionPill
        ref={menuRef}
        style={{
          position: 'absolute',
          left: menuLeft,
          top: menuTop,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-8px)',
          opacity: visible ? 1 : 0,
          transformOrigin: 'top left',
          transition:
            'transform 260ms cubic-bezier(0.34, 1.45, 0.64, 1) 70ms, opacity 200ms ease-out 70ms',
        }}
      >
        {items.map((item) => (
          <ActionButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            variant={item.disabled ? 'disabled' : item.destructive ? 'danger' : 'default'}
            iconSize={14}
            onClick={() => {
              if (item.submenu) return
              item.onAction?.()
              onClose()
            }}
          />
        ))}
      </ActionPill>
    </div>,
    document.body,
  )
}
