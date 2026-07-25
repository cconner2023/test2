import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSpring, useTransition, animated } from '@react-spring/web'
import type { ReactNode, RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { Scrim } from '@/Components/primitives/Scrim'
import { PopoverHeader } from '@/Components/PreviewOverlay'
import { MenuItemButton, contextMenuItemVariant, type ContextMenuItem, type MenuCardRow, type SearchLevelSpec } from '@/Components/primitives/ContextMenu'
export type { SearchLevelSpec, MenuCardRow } from '@/Components/primitives/ContextMenu'

interface AnchoredMenuProps {
  isOpen: boolean
  /** Bounding rect the menu anchors to — the long-pressed/right-clicked row, or
   *  the trigger button (ellipsis / selector). Ignored when `anchorRef` is set. */
  anchorRect: DOMRect | null
  /** Live trigger element. When set, the menu re-measures its rect on
   *  scroll / resize / visualViewport changes instead of freezing a snapshot — so
   *  an iOS keyboard collapse (which reflows the layout after the tap) re-pins the
   *  menu to the button's true position rather than stranding it at the top.
   *  Takes precedence over `anchorRect`. */
  anchorRef?: RefObject<HTMLElement | null>
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
  /** Open the menu DIRECTLY into a searchable card list (list layout only) — the
   *  filter field + scrollable cards are the ROOT level, no tap-through. Use when the
   *  whole surface is a "browse & pick from a filtered list" (e.g. the note-editor
   *  text-template picker). When set, `items` is ignored for the root. */
  rootSearch?: SearchLevelSpec
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
const BACK_HEADER_H = 52 // PopoverHeader height (back chevron + title + close), submenu only

// Searchable-level geometry (a drill-in `search` level: back header + filter + cards)
const SEARCH_W = 300      // wider card so label/sub cards breathe (vs 216 for plain rows)
const SEARCHBAR_H = 46    // filter field row
const SEARCH_BODY_H = 240 // FIXED scroll-body height — constant so typing never resizes/re-places the card
const SEARCH_LEVEL_H = BACK_HEADER_H + SEARCHBAR_H + SEARCH_BODY_H

/** One drill level: a plain menu (root or a pushed submenu) OR a searchable card list. */
type Level =
  | { kind: 'menu'; key: string; title?: string; items: ContextMenuItem[]; reactRow: boolean; sectionHeader: boolean }
  | { kind: 'search'; key: string; spec: SearchLevelSpec }

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

/** A rich card row for a searchable level — circular icon tile · label/sub, optional
 *  drill chevron. Mirrors the object-picker's row shape (icon tile + two lines) so
 *  every "share an object" surface reads the same. */
function MenuCardListRow({ row, onSelect }: { row: MenuCardRow; onSelect: (row: MenuCardRow) => void }) {
  const Icon = row.icon
  return (
    <button
      onClick={() => onSelect(row)}
      aria-label={row.label}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.06] transition-colors"
    >
      {row.node ?? (Icon ? (
        <div className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-themeblue3" />
        </div>
      ) : null)}
      <div className="min-w-0 flex-1">
        <p className="text-[11pt] font-medium text-primary truncate">{row.label}</p>
        {row.sub && <p className="text-[9pt] text-tertiary truncate">{row.sub}</p>}
      </div>
      {row.drill && <ChevronRight size={16} className="text-tertiary shrink-0" />}
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
export function AnchoredMenu({ isOpen, anchorRect: anchorRectProp, anchorRef, row, items, onClose, bare = false, align = 'left', layout = 'pill', reactions, backdrop, header, rootSearch }: AnchoredMenuProps) {
  const [visible, setVisible] = useState(false)
  // Live-anchor rect — re-measured from `anchorRef` on any reflow (see prop doc).
  const [liveRect, setLiveRect] = useState<DOMRect | null>(null)
  // Drill stack — empty = root. A pushed level is a plain submenu (`menu`) or a
  // searchable card list (`search`); arbitrary depth (the object picker uses 2:
  // Map → overlays → features). Each pushed level shows a Back chevron (PopoverHeader)
  // so the user pops one level instead of being trapped until the whole menu dismisses.
  const [stack, setStack] = useState<Level[]>([])
  // Shared filter query for the active search level. Reset on every push/pop.
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const isList = layout === 'list'
  const atRoot = stack.length === 0
  const showReactRow = isList && atRoot && !!reactions?.length
  const showHeader = isList && atRoot && !!header

  const ROOT: Level = rootSearch
    ? { kind: 'search', key: 'root', spec: rootSearch }
    : { kind: 'menu', key: 'root', items, reactRow: showReactRow, sectionHeader: showHeader }
  const current: Level = stack[stack.length - 1] ?? ROOT
  const activeItems = current.kind === 'menu' ? current.items : items

  const pushMenu = (title: string, sub: ContextMenuItem[]) =>
    setStack((s) => [...s, { kind: 'menu', key: `m:${s.length}:${title}`, title, items: sub, reactRow: false, sectionHeader: false }])
  const pushSearch = (spec: SearchLevelSpec) =>
    setStack((s) => [...s, { kind: 'search', key: `s:${s.length}:${spec.title}`, spec }])
  const back = () => setStack((s) => s.slice(0, -1))
  // Reset the filter whenever drill depth changes (enter/leave a search level).
  useEffect(() => { setQuery('') }, [stack.length])

  // ── Drill-down morph (list layout) — mirrors ActionSheet's add-FAB drilldown ──
  // Descending into a submenu (Quantity / Logistics on the property item menu)
  // cross-slides the new level in from the right and springs the card height so it
  // grows/shrinks in place instead of hard-swapping its rows. Reset when closed.
  const [contentH, setContentH] = useState<number>()
  const roRef = useRef<ResizeObserver | null>(null)
  const sizerRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!node) return
    const measure = () => setContentH(node.offsetHeight)
    measure()
    roRef.current = new ResizeObserver(measure)
    roRef.current.observe(node)
  }, [])
  const firstH = useRef(true)
  const heightSpring = useSpring({
    height: contentH ?? 0,
    immediate: firstH.current, // snap the first measured height; morph on later swaps
    config: { tension: 320, friction: 30 },
  })
  useEffect(() => { if (contentH != null) firstH.current = false }, [contentH])

  // Slide direction: descending (push) slides the new level in from the right, Back
  // pops it out to the right. depth = stack length (root is 0).
  const depth = stack.length
  const prevDepth = useRef(0)
  const slideDir = depth >= prevDepth.current ? 1 : -1
  useEffect(() => { prevDepth.current = depth }, [depth])

  const levelTransitions = useTransition(current, {
    keys: (l) => l.key,
    from: { opacity: 0, transform: `translateX(${slideDir * 14}px)` },
    enter: { opacity: 1, transform: 'translateX(0px)' },
    leave: { opacity: 0, transform: `translateX(${slideDir * -14}px)` },
    initial: { opacity: 1, transform: 'translateX(0px)' }, // no slide on first open
    config: { tension: 320, friction: 30 },
  })

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      setStack([])
      setQuery('')
      firstH.current = true
      setContentH(undefined)
      return
    }
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  // Re-read the trigger's rect on scroll / resize / visualViewport changes so an
  // iOS keyboard collapse re-pins the menu instead of freezing a stale snapshot.
  useEffect(() => {
    if (!isOpen || !anchorRef) { setLiveRect(null); return }
    const measure = () => { const el = anchorRef.current; if (el) setLiveRect(el.getBoundingClientRect()) }
    measure()
    const vvp = window.visualViewport
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('scroll', measure, { passive: true, capture: true })
    vvp?.addEventListener('resize', measure)
    vvp?.addEventListener('scroll', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      vvp?.removeEventListener('resize', measure)
      vvp?.removeEventListener('scroll', measure)
    }
  }, [isOpen, anchorRef])

  const anchorRect = anchorRef ? liveRect : anchorRectProp
  if (!isOpen || !anchorRect) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  const hasClone = !!row
  // Dim by default (fade-in bg) for clone peeks AND clone-less menus alike — the
  // no-clone case shouldn't read as a flat dropdown. 'plain' opts out.
  const dimmed = backdrop ? backdrop === 'dim' : true

  // Widen the card when the menu drills into searchable card lists (label/sub rows
  // need room); plain menus keep the tight 216 width. Constant across the flow so a
  // drill never jumps the width.
  const hasSearch = !!rootSearch || items.some((i) => i.search)
  const listW = hasSearch ? SEARCH_W : LIST_W
  const menuH = isList
    ? (current.kind === 'search'
        ? SEARCH_LEVEL_H
        : activeItems.length * ROW_H + (showReactRow ? STRIP_H : 0) + (showHeader ? HEADER_H : 0) + (!atRoot ? BACK_HEADER_H : 0) + LIST_PAD)
    : MENU_H
  // Pill submenus prepend a Back chevron tile — reserve its width.
  const menuW = isList ? listW : (activeItems.length + (!atRoot ? 1 : 0)) * 40 + 12

  // Stable reference height spanning the root menu AND every submenu it can drill
  // into. Placement DECISIONS (open up/down, peek lift, clamps) key off this — never
  // the live `menuH` — so drilling into a shorter/taller submenu can't flip the
  // menu's direction or shove its anchored edge to a new spot. The card still renders
  // at its live `menuH`, morphing in place (growing/shrinking) from the fixed edge.
  const listRowsH = (rows: number, backHdr: boolean) =>
    rows * ROW_H + (backHdr ? BACK_HEADER_H : 0) + LIST_PAD
  const rootListH = listRowsH(items.length, false) + (showReactRow ? STRIP_H : 0) + (showHeader ? HEADER_H : 0)
  const submenuMaxH = items.reduce(
    (m, it) => (it.submenu ? Math.max(m, listRowsH(it.submenu.length, true)) : m),
    0,
  )
  // Search levels are a fixed height regardless of result count (the body scrolls),
  // so a single constant bounds them for placement.
  const searchMaxH = hasSearch ? SEARCH_LEVEL_H : 0
  const stableH = isList ? Math.max(rootListH, submenuMaxH, searchMaxH) : MENU_H

  // ── Vertical placement ──
  let lift = 0
  let menuTop: number
  let openUp = false
  if (hasClone) {
    // Peek: pop the row up by a baseline so it visibly detaches; lift further if
    // needed for the menu to clear the bottom edge. Never let the row top cross
    // the safe area, and never lift more than the room above allows. Size the lift
    // for the tallest state so a drill-down never re-lifts the row.
    const bottomNeed = (anchorRect.bottom + GAP + stableH + SAFE) - vh
    const desiredLift = Math.max(BASE_LIFT, bottomNeed)
    const maxLift = Math.max(0, anchorRect.top - SAFE)
    lift = Math.min(desiredLift, maxLift)
    menuTop = anchorRect.bottom - lift + GAP
  } else {
    // Dropdown: drop below the anchor, flip above when there isn't room. Decide with
    // the tallest state so the direction is chosen once and holds across drill-downs.
    const spaceBelow = vh - anchorRect.bottom
    openUp = spaceBelow < stableH + GAP + SAFE && anchorRect.top > spaceBelow
    // Anchor the edge that stays put: top edge when dropping down, bottom edge when
    // flipping up (`anchorRect.top - GAP` fixed, live menuH grows the card upward).
    menuTop = openUp ? anchorRect.top - GAP - menuH : anchorRect.bottom + GAP
    // Clamp against the stable height so a shorter submenu doesn't get pulled to a
    // new offset — since the direction already guarantees the tallest state fits.
    menuTop = Math.max(SAFE, Math.min(menuTop, vh - stableH - SAFE))
  }

  const rawLeft = align === 'right' ? anchorRect.right - menuW : anchorRect.left
  const menuLeft = Math.max(SAFE, Math.min(rawLeft, vw - menuW - SAFE))
  const cloneOrigin = bare ? (align === 'right' ? 'right bottom' : 'left bottom') : 'center bottom'
  const vAlign = openUp ? 'bottom' : 'top'
  const menuOrigin = `${vAlign} ${align === 'right' ? 'right' : 'left'}`
  // Entrance: a clone-peek menu settles DOWN beneath the lifted row; a clone-less
  // menu RISES UP into place (echoes the lifted feel) instead of dropping flat.
  const menuHidden = hasClone ? 'scale(0.92) translateY(-8px)' : 'scale(0.96) translateY(12px)'

  const renderRow = (item: ContextMenuItem) =>
    item.render ? (
      // Custom renderer owns its button + click + status feedback; the whole row is
      // the tap target and forwards to the inner button (pointer-events-none wrapper
      // keeps it firing once). The menu does NOT auto-close (dismiss via backdrop).
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
          if (it.submenu) { pushMenu(it.label, it.submenu); return }
          // `search` drills into a searchable card list; `onAction` (if present)
          // fires once as a side-effect (e.g. a lazy fetch) right before the drill.
          if (it.search) { it.onAction?.(); pushSearch(it.search); return }
          it.onAction?.()
          onClose()
        }}
      />
    )

  const selectCard = (spec: SearchLevelSpec, r: MenuCardRow) => {
    if (r.drill) { pushSearch(r.drill); return }
    spec.onPick?.(r)
    onClose()
  }

  // One drill level — a searchable card list (`search`), a pushed submenu (Back header
  // + rows), or the root (optional react strip / section header + rows). Rendered by
  // both the invisible sizer and each cross-sliding transition layer, so leaving/
  // entering levels keep their own content.
  const renderLevel = (lvl: Level) => {
    if (lvl.kind === 'search') {
      const rows = lvl.spec.rows(query)
      return (
        <div>
          <PopoverHeader title={lvl.spec.title} onBack={lvl.key === 'root' ? undefined : back} onClose={onClose} />
          <div className="border-b border-tertiary/10 px-2 py-1.5">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={lvl.spec.placeholder ?? 'Filter…'}
              className="!bg-transparent !border-transparent !shadow-none text-[10pt]"
            />
          </div>
          {/* Drill-in search levels keep a FIXED body (constant height so typing
              never re-places a deeply-anchored card). A ROOT search — the whole
              surface is the picker — instead FITS its content up to the same cap,
              then scrolls, so it hugs like every other AnchoredMenu list and rides
              the shared height-spring morph. */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={lvl.key === 'root' ? { maxHeight: SEARCH_BODY_H } : { height: SEARCH_BODY_H }}
          >
            {rows.length === 0 ? (
              <p className="text-[10pt] text-tertiary text-center py-10">{lvl.spec.emptyText ?? 'No results'}</p>
            ) : (
              rows.map((r) => <MenuCardListRow key={r.id} row={r} onSelect={(row) => selectCard(lvl.spec, row)} />)
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="divide-y divide-black/[0.06]">
        {lvl.key !== 'root' ? (
          <PopoverHeader title={lvl.title ?? ''} onBack={back} onClose={onClose} />
        ) : (
          <>
            {lvl.reactRow && (
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
            {lvl.sectionHeader && (
              <p className="px-4 pt-2.5 pb-1.5 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{header}</p>
            )}
          </>
        )}
        {lvl.items.map(renderRow)}
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9998 }}>
      {/* Backdrop — dim+blur for peek, transparent catcher for dropdowns */}
      {/* Scrim is visual only (interactive={false}); the catcher below owns
          dismissal, because this menu closes on PRESS (mousedown/touchstart)
          rather than click — Scrim's onClick would fire too late. */}
      {dimmed && (
        <Scrim
          progress={visible ? 1 : 0}
          position="absolute"
          interactive={false}
          transition="opacity 200ms ease-out"
        />
      )}
      <div
        className="absolute inset-0"
        onMouseDown={onClose}
        onTouchStart={onClose}
      />

      {/* Lifted row clone (peek only) */}
      {hasClone && (
        <div
          className={
            bare
              ? 'absolute pointer-events-none'
              : 'absolute rounded-2xl bg-themewhite3 overflow-hidden pointer-events-none'
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
        <animated.div
          ref={menuRef}
          className="absolute rounded-2xl bg-themewhite3 overflow-hidden select-none"
          style={{
            left: menuLeft,
            // Down/peek: top is fixed, height grows downward. Open-up: keep the bottom
            // edge planted (anchorRect.top − GAP) so the card grows/shrinks upward as
            // the height springs between levels — no jump at the anchored edge.
            top: openUp
              ? heightSpring.height.to((h) => Math.max(SAFE, anchorRect.top - GAP - h))
              : menuTop,
            width: menuW,
            height: heightSpring.height,
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
          {/* Invisible sizer — the settling level, measured so the height spring has a
              target. The visible levels are absolute, so they can't size the card. */}
          <div ref={sizerRef} aria-hidden className="invisible absolute inset-x-0 top-0">
            {renderLevel(current)}
          </div>
          {/* Cross-sliding levels: descending pushes the new level in from the right,
              Back pops the old one out — over the morphing height. */}
          {levelTransitions((style, lvl) => (
            <animated.div style={style} className="absolute inset-x-0 top-0">
              {renderLevel(lvl)}
            </animated.div>
          ))}
        </animated.div>
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
          {/* Submenu Back tile — pill layout can't host a full header, so drill-out
              rides as a leading chevron button. */}
          {!atRoot && (
            <button
              onClick={back}
              aria-label="Back"
              title={current.kind === 'menu' ? current.title : ''}
              className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {activeItems.map((item) =>
            item.render ? (
              <Fragment key={item.key}>{item.render()}</Fragment>
            ) : (
              <MenuItemButton
                key={item.key}
                item={item}
                onSelect={(it) => {
                  if (it.submenu) { pushMenu(it.label, it.submenu); return }
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
