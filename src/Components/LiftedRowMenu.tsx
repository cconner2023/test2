import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { ActionPill } from './ActionPill'
import { MenuItemButton, contextMenuItemVariant, type ContextMenuItem } from './ContextMenu'

interface AnchoredMenuProps {
  isOpen: boolean
  /** Bounding rect the menu anchors to — the long-pressed/right-clicked row, or
   *  the trigger button (ellipsis / selector). */
  anchorRect: DOMRect | null
  /** Visual clone of the row — rendered floating, lifted off the list (iOS peek).
   *  OMIT for ellipsis / selector menus: with no clone the menu still dims the bg
   *  and rises into place (same lifted feel) — it just has no row to lift. */
  row?: ReactNode
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
  /** Backdrop. Defaults to 'dim' (fade-in dim+blur) for BOTH the lifted-row peek
   *  and clone-less ellipsis/selector menus — so the no-clone case keeps the same
   *  lifted feel. Pass 'plain' to opt back into a transparent context-preserving
   *  catcher (true dropdown). */
  backdrop?: 'dim' | 'plain'
  /** Optional uppercase section header at the top of a list card (selectors). */
  header?: string
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
const HEADER_H = 30  // section-header height (list layout, when `header` set)

/** A single row in the vertical list-card. Mirrors ActionSheet's option rows
 *  (the calendar add-FAB menu): icon-left, `text-[10pt] font-medium`, divider
 *  between rows. */
function MenuListRow({ item, onSelect }: { item: ContextMenuItem; onSelect: (item: ContextMenuItem) => void }) {
  const variant = contextMenuItemVariant(item)
  const isDisabled = variant === 'disabled'
  const Icon = item.icon
  const rowCx = `w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors ${
    item.selected ? 'bg-themeblue3/8' : ''
  } ${isDisabled ? 'cursor-default' : 'active:bg-black/[0.06]'}`
  const inner = (
    <>
      {item.node ? (
        <span className="shrink-0 flex items-center justify-center w-4 h-4">{item.node}</span>
      ) : (
        Icon && <Icon size={16} className={`shrink-0 ${isDisabled ? 'text-tertiary' : 'text-primary'}`} />
      )}
      <span className={`text-[10pt] truncate flex-1 ${item.selected ? 'font-semibold' : 'font-medium'} ${isDisabled ? 'text-tertiary' : 'text-primary'}`}>
        {item.label}
      </span>
    </>
  )
  // A real <a href> is the only form that reliably launches mailto:/tel: in the
  // installed shell — onSelect still closes the menu. See src/lib/mailto.ts.
  if (item.href && !isDisabled) {
    return (
      <a href={item.href} onClick={() => onSelect(item)} aria-label={item.label} className={rowCx}>
        {inner}
      </a>
    )
  }
  return (
    <button
      disabled={item.disabled}
      onClick={() => onSelect(item)}
      aria-label={item.label}
      className={rowCx}
    >
      {inner}
    </button>
  )
}

/**
 * Anchored portal menu — the single menu primitive.
 *
 * WITH a `row` clone (iOS "peek"): the pressed row lifts off the list — scales up,
 * gains a shadow (reads as selected) — and slides upward just enough to make room
 * for the action menu that drops in beneath it, over a dimmed/blurred backdrop.
 * Shared by mobile (long-press) and desktop (right-click) object rows.
 *
 * WITHOUT a `row` (ellipsis menus, selectors): no clone to lift, but it keeps the
 * same lifted feel — the dim+blur backdrop still fades in and the menu card RISES
 * up into place off the anchor (rather than a flat dropdown). Pass backdrop='plain'
 * to opt back into a transparent context-preserving dropdown.
 *
 * `LiftedRowMenu` is a back-compat alias for callers that pass a clone.
 */
export function AnchoredMenu({ isOpen, anchorRect, row, items, onClose, bare = false, align = 'left', layout = 'pill', reactions, backdrop, header }: AnchoredMenuProps) {
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

  const hasClone = !!row
  // Dim by default (fade-in bg) for clone peeks AND clone-less menus alike — the
  // no-clone case shouldn't read as a flat dropdown. 'plain' opts out.
  const dimmed = backdrop ? backdrop === 'dim' : true

  const isList = layout === 'list'
  // Reactions ride as the top row of the list-card (horizontal emoji row).
  const showReactRow = isList && !submenuItems && !!reactions?.length
  const showHeader = isList && !submenuItems && !!header
  const menuH = isList
    ? activeItems.length * ROW_H + (showReactRow ? STRIP_H : 0) + (showHeader ? HEADER_H : 0) + LIST_PAD
    : MENU_H
  const menuW = isList ? LIST_W : activeItems.length * 40 + 12

  // ── Vertical placement ──
  let lift = 0
  let menuTop: number
  let openUp = false
  if (hasClone) {
    // Peek: pop the row up by a baseline so it visibly detaches; lift further if
    // needed for the menu to clear the bottom edge. Never let the row top cross
    // the safe area, and never lift more than the room above allows.
    const bottomNeed = (anchorRect.bottom + GAP + menuH + SAFE) - vh
    const desiredLift = Math.max(BASE_LIFT, bottomNeed)
    const maxLift = Math.max(0, anchorRect.top - SAFE)
    lift = Math.min(desiredLift, maxLift)
    menuTop = anchorRect.bottom - lift + GAP
  } else {
    // Dropdown: drop below the anchor, flip above when there isn't room.
    const spaceBelow = vh - anchorRect.bottom
    openUp = spaceBelow < menuH + GAP + SAFE && anchorRect.top > spaceBelow
    menuTop = openUp ? anchorRect.top - GAP - menuH : anchorRect.bottom + GAP
    menuTop = Math.max(SAFE, Math.min(menuTop, vh - menuH - SAFE))
  }

  const rawLeft = align === 'right' ? anchorRect.right - menuW : anchorRect.left
  const menuLeft = Math.max(SAFE, Math.min(rawLeft, vw - menuW - SAFE))
  const cloneOrigin = bare ? (align === 'right' ? 'right bottom' : 'left bottom') : 'center bottom'
  const vAlign = openUp ? 'bottom' : 'top'
  const menuOrigin = `${vAlign} ${align === 'right' ? 'right' : 'left'}`
  // Entrance: a clone-peek menu settles DOWN beneath the lifted row; a clone-less
  // menu RISES UP into place (echoes the lifted feel) instead of dropping flat.
  const menuHidden = hasClone ? 'scale(0.92) translateY(-8px)' : 'scale(0.96) translateY(12px)'

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9998 }}>
      {/* Backdrop — dim+blur for peek, transparent catcher for dropdowns */}
      <div
        className={`absolute inset-0 ${dimmed ? 'bg-black/45 backdrop-blur-[6px]' : ''}`}
        style={dimmed ? { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease-out' } : undefined}
        onMouseDown={onClose}
        onTouchStart={onClose}
      />

      {/* Lifted row clone (peek only) */}
      {hasClone && (
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
      )}

      {/* Action menu */}
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
            transform: visible ? 'scale(1) translateY(0)' : menuHidden,
            opacity: visible ? 1 : 0,
            transformOrigin: menuOrigin,
            transition:
              'transform 260ms cubic-bezier(0.34, 1.45, 0.64, 1) 70ms, opacity 200ms ease-out 70ms, box-shadow 260ms ease-out',
          }}
        >
          {/* Section header — selectors */}
          {showHeader && (
            <p className="px-4 pt-2.5 pb-1.5 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{header}</p>
          )}
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
          {activeItems.map((item) =>
            item.render ? (
              // Custom renderer owns its button + click + status feedback; the menu
              // does NOT auto-close (dismiss via backdrop tap). In the vertical list
              // the label is NOT a dead sibling — the WHOLE row is the tap target: a
              // tap anywhere forwards to the rendered control, so the animated icon
              // still drives the action and shows in-place status. The render() wrapper
              // is pointer-events-none so a tap can't hit the inner button directly,
              // which keeps the forward firing exactly once (no double-trigger).
              <div
                key={item.key}
                onClick={(e) => e.currentTarget.querySelector('button')?.click()}
                className="w-full flex items-center gap-3 py-1.5 px-3 cursor-pointer active:bg-black/[0.06] transition-colors"
              >
                <span className="shrink-0 flex items-center justify-center pointer-events-none">{item.render()}</span>
                <span className="text-[10pt] font-medium text-primary truncate flex-1 pointer-events-none">{item.label}</span>
              </div>
            ) : (
              <MenuListRow
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
        </div>
      ) : (
        <ActionPill
          ref={menuRef}
          style={{
            position: 'absolute',
            left: menuLeft,
            top: menuTop,
            transform: visible ? 'scale(1) translateY(0)' : menuHidden,
            opacity: visible ? 1 : 0,
            transformOrigin: menuOrigin,
            transition:
              'transform 260ms cubic-bezier(0.34, 1.45, 0.64, 1) 70ms, opacity 200ms ease-out 70ms',
          }}
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
      )}
    </div>,
    document.body,
  )
}

/** Back-compat alias — callers that pass a `row` clone (the iOS peek). */
export const LiftedRowMenu = AnchoredMenu
