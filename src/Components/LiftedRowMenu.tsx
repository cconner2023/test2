import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { ActionPill } from './ActionPill'
import { MenuItemButton, contextMenuItemVariant, type ContextMenuItem } from './ContextMenu'

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
  /** Menu shape: 'pill' = horizontal icon tiles (default); 'list' = vertical
   *  iOS-style text rows (icon-left, label). */
  layout?: 'pill' | 'list'
  /** Reaction glyphs — rendered as a horizontal icon strip (the icon context
   *  menu) ABOVE the lifted row. List layout only. */
  reactions?: ContextMenuItem[]
}

const MENU_H = 52    // ActionPill height (36px button + padding)
const GAP = 12       // space between lifted row and menu
const SAFE = 12      // viewport edge padding
const BASE_LIFT = 34 // baseline upward pop so the row always visibly detaches

// Vertical list-card geometry
const LIST_W = 216   // fixed card width
const ROW_H = 40     // approx per-row height (py-2.5 + 10pt line) — geometry estimate
const LIST_PAD = 0   // card has no extra vertical padding (rows are full-bleed)
const STRIP_H = 52   // reaction-strip height (pill + reserve)

/** A single row in the vertical list-card. Mirrors ActionSheet's option rows
 *  (the calendar add-FAB menu): icon-left, `text-[10pt] font-medium`, divider
 *  between rows. */
function MenuListRow({ item, onSelect }: { item: ContextMenuItem; onSelect: (item: ContextMenuItem) => void }) {
  const variant = contextMenuItemVariant(item)
  const isDisabled = variant === 'disabled'
  const Icon = item.icon
  return (
    <button
      disabled={item.disabled}
      onClick={() => onSelect(item)}
      aria-label={item.label}
      className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors ${
        isDisabled ? 'cursor-default' : 'active:bg-black/[0.06]'
      }`}
    >
      {item.node ? (
        <span className="shrink-0 flex items-center justify-center w-4 h-4">{item.node}</span>
      ) : (
        Icon && <Icon size={16} className={`shrink-0 ${isDisabled ? 'text-tertiary' : 'text-primary'}`} />
      )}
      <span className={`text-[10pt] font-medium truncate flex-1 ${isDisabled ? 'text-tertiary' : 'text-primary'}`}>
        {item.label}
      </span>
    </button>
  )
}

/**
 * iOS-style "peek" context menu. The pressed row lifts off the list — scales up
 * slightly, gains a shadow (reads as selected) — and slides upward just enough to
 * make room for a horizontal action pill that drops in directly beneath it.
 * Shared by mobile (long-press) and desktop (right-click) messaging rows.
 */
export function LiftedRowMenu({ isOpen, anchorRect, row, items, onClose, bare = false, align = 'left', layout = 'pill', reactions }: LiftedRowMenuProps) {
  const [visible, setVisible] = useState(false)
  const [submenuItems, setSubmenuItems] = useState<ContextMenuItem[] | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeItems = submenuItems ?? items

  useEffect(() => {
    if (!isOpen) { setVisible(false); setSubmenuItems(null); return }
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  if (!isOpen || !anchorRect) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  const isList = layout === 'list'
  // Reactions ride as the top row of the list-card (horizontal emoji row).
  const showReactRow = isList && !submenuItems && !!reactions?.length
  const menuH = isList
    ? activeItems.length * ROW_H + (showReactRow ? STRIP_H : 0) + LIST_PAD
    : MENU_H
  const menuW = isList ? LIST_W : activeItems.length * 40 + 12

  // Always pop the row up by a baseline so it visibly detaches; lift further if
  // needed for the menu to clear the bottom edge. Never let the row top cross the
  // safe area, and never lift more than the room above allows.
  const bottomNeed = (anchorRect.bottom + GAP + menuH + SAFE) - vh
  const desiredLift = Math.max(BASE_LIFT, bottomNeed)
  const maxLift = Math.max(0, anchorRect.top - SAFE)
  const lift = Math.min(desiredLift, maxLift)

  const menuTop = anchorRect.bottom - lift + GAP
  const rawLeft = align === 'right' ? anchorRect.right - menuW : anchorRect.left
  const menuLeft = Math.max(SAFE, Math.min(rawLeft, vw - menuW - SAFE))
  const cloneOrigin = bare ? (align === 'right' ? 'right bottom' : 'left bottom') : 'center bottom'
  const menuOrigin = align === 'right' ? 'top right' : 'top left'

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9998 }}>
      {/* Dimming backdrop — tap anywhere to dismiss */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[6px]"
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

      {/* Action menu below the lifted row */}
      {isList ? (
        <div
          ref={menuRef}
          className="absolute rounded-2xl bg-themewhite overflow-hidden ring-1 ring-black/5 divide-y divide-black/[0.06] select-none"
          style={{
            left: menuLeft,
            top: menuTop,
            width: menuW,
            paddingTop: LIST_PAD / 2,
            paddingBottom: LIST_PAD / 2,
            WebkitTouchCallout: 'none',
            touchAction: 'manipulation',
            boxShadow: visible ? '0 18px 44px rgba(0,0,0,0.28)' : '0 0 0 rgba(0,0,0,0)',
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-8px)',
            opacity: visible ? 1 : 0,
            transformOrigin: menuOrigin,
            transition:
              'transform 260ms cubic-bezier(0.34, 1.45, 0.64, 1) 70ms, opacity 200ms ease-out 70ms, box-shadow 260ms ease-out',
          }}
        >
          {/* React row — horizontal emoji glyphs, top row of the same card */}
          {showReactRow && (
            <div className="flex items-center justify-between px-3" style={{ height: STRIP_H }}>
              {reactions!.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { r.onAction?.(); onClose() }}
                  aria-label={r.label}
                  title={r.label}
                  className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                >
                  {r.node}
                </button>
              ))}
            </div>
          )}
          {activeItems.map((item) => (
            <MenuListRow
              key={item.key}
              item={item}
              onSelect={(it) => {
                if (it.submenu) { setSubmenuItems(it.submenu); return }
                it.onAction?.()
                onClose()
              }}
            />
          ))}
        </div>
      ) : (
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
          {activeItems.map((item) => (
            <MenuItemButton
              key={item.key}
              item={item}
              onSelect={(it) => {
                if (it.submenu) { setSubmenuItems(it.submenu); return }
                it.onAction?.()
                onClose()
              }}
            />
          ))}
        </ActionPill>
      )}
    </div>,
    document.body,
  )
}
