import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useOverlay } from '../../Hooks/useOverlay'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useHeldWhileOpen } from '../../Hooks/useHeldWhileOpen'

/**
 * PaneCard — the desktop lifted card floated over a split panel's main pane
 * (rail + main pane + card). It positions itself `absolute top-3 right-3
 * bottom-3`, so render it inside the main pane's `relative` box (or any
 * `relative` box whose right edge is the main pane's). The main pane never
 * shifts or pads to make room; instead the user drags the card by its header
 * (anywhere but a control) to uncover what's beneath. Headerless cards
 * (`header={false}`) aren't draggable.
 *
 * Enters and exits through `surface-motion` (drops in from above, lifts out on
 * close). Title, header actions and body are held through the exit, so callers
 * can null their state on close and the card still leaves with its content.
 *
 * Header = PaneHeader: optional back / eyebrow / leading, the title, then
 * `rightContent` (caller pills) and the close pill with `actions` folded in
 * (the Sheet prop names, so PaneSurface maps 1:1).
 *
 * PaneSurface is the adaptive wrapper: this card on desktop, a fit Sheet on
 * mobile. Use PaneCard directly only when mobile needs a different surface.
 *
 * Never hand-roll the `absolute top-3 right-3 w-[360px]` box: a card is a
 * PaneCard, and a non-card occupant of the same slot (a morph portal target)
 * is a PaneSlot.
 */
export type PaneSide = 'left' | 'right'

export interface PaneSlotProps {
    children?: ReactNode
    /** Edge the slot hangs from. Default right. */
    side?: PaneSide
    /** Px from that edge. Default 12 (Map clears its rail with 252). */
    inset?: number
    /** Slot width in px. Default 360. */
    width?: number
    /** Default 50. Lower it under a host's popovers (Calendar's view options). */
    zIndex?: number
    /** display:none, still mounted (forms keep state under a covering card). */
    hidden?: boolean
}

/** PaneSlot — the positioned box a PaneCard floats in, over the main pane's
 *  `relative` box. Pointer-transparent; the occupant opts back in. */
export function PaneSlot({ children, side = 'right', inset = 12, width = 360, zIndex = 50, hidden }: PaneSlotProps) {
    return (
        <div
            className={`absolute top-3 bottom-3 pointer-events-none flex flex-col ${hidden ? 'hidden' : ''}`}
            style={{ [side]: inset, width, zIndex, maxWidth: `calc(100% - ${inset + 12}px)` }}
        >
            {children}
        </div>
    )
}

export interface PaneCardProps extends Omit<PaneSlotProps, 'children'> {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    /** Above the title (a breadcrumb trail). */
    eyebrow?: ReactNode
    onBack?: () => void
    leading?: ReactNode
    /** Header-right cluster, before the close pill (pass your own HeaderPill). */
    rightContent?: ReactNode
    /** PillButtons folded INSIDE the close pill (Save, Check in …). */
    actions?: ReactNode
    /** Hide the close pill (the caller's rightContent carries its own). */
    hideClose?: boolean
    /** Dialog label when `title` is empty or absent from the header. Default title. */
    ariaLabel?: string
    /** LoadingOverlay over the card while a write runs. */
    loading?: boolean
    /** Body fills the card height and owns its own scroll (a chat thread). */
    fill?: boolean
    /** Body is a flex-1 column that owns its header / scroller; the card keeps
     *  content height (TC3 editors, Calendar's dispatch detail). */
    selfScroll?: boolean
    /** `false` drops the header row: the body renders its own. `title` still
     *  labels the dialog. */
    header?: false
    /** Pinned below the body (a screen's footer pills). */
    footer?: ReactNode
    /** Stay mounted while closed (hidden), for a host that portals into the
     *  body and needs the target to outlive a close. */
    keepMounted?: boolean
    /** Esc closes the card (desktop layered Esc). Default true; turn off when the
     *  host runs its own useEscBackout (drill-back, dirty guard). */
    closeOnEsc?: boolean
}

const DRAG_IGNORE = 'button, a, input, textarea, select, [role="button"], [contenteditable="true"]'

/** Header drag offset for a PaneCard. Clamped to the slot's offsetParent (the
 *  main pane) so the card can't be lost off-screen; reset on close and on
 *  window resize, since a stale offset can strand the card outside a resized pane. */
function usePaneDrag(mounted: boolean) {
    const boxRef = useRef<HTMLDivElement>(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const drag = useRef<{ px: number; py: number; ox: number; oy: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null)

    useEffect(() => { if (!mounted) setOffset({ x: 0, y: 0 }) }, [mounted])
    useEffect(() => {
        const reset = () => setOffset({ x: 0, y: 0 })
        window.addEventListener('resize', reset)
        return () => window.removeEventListener('resize', reset)
    }, [])

    const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 || (e.target as Element).closest(DRAG_IGNORE)) return
        const box = boxRef.current
        const parent = box?.parentElement?.offsetParent
        if (!box || !parent) return
        const r = box.getBoundingClientRect()
        const p = parent.getBoundingClientRect()
        drag.current = {
            px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y,
            minX: offset.x + p.left - r.left, maxX: offset.x + p.right - r.right,
            minY: offset.y + p.top - r.top, maxY: offset.y + p.bottom - r.bottom,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        setDragging(true)
    }, [offset])

    const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (!d) return
        setOffset({
            x: Math.min(d.maxX, Math.max(d.minX, d.ox + e.clientX - d.px)),
            y: Math.min(d.maxY, Math.max(d.minY, d.oy + e.clientY - d.py)),
        })
    }, [])

    const onPointerUp = useCallback(() => { drag.current = null; setDragging(false) }, [])

    return {
        boxRef,
        style: offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined,
        handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
        dragging,
    }
}

interface Held {
    title: string
    children: ReactNode
    eyebrow?: ReactNode
    rightContent?: ReactNode
    actions?: ReactNode
    footer?: ReactNode
    leading?: ReactNode
    header?: false
    selfScroll?: boolean
    hideClose?: boolean
    ariaLabel?: string
}

export function PaneCard({
    isOpen, onClose, title, children, eyebrow, onBack, leading, rightContent, actions,
    hideClose, ariaLabel, loading, fill, selfScroll, header, footer, keepMounted, closeOnEsc = true,
    side, inset, width, zIndex, hidden,
}: PaneCardProps) {
    const card = useOverlay(isOpen)
    // Every mode-dependent slot is held, so a card whose host flips mode on close
    // (a headerless detail → none) leaves in the shape it had.
    const shown = useHeldWhileOpen<Held>(isOpen, { title, children, eyebrow, rightContent, actions, footer, leading, header, selfScroll, hideClose, ariaLabel })
    useEscBackout(closeOnEsc && isOpen && !loading && !hidden, onClose)
    const drag = usePaneDrag(card.mounted)
    if (!card.mounted && !keepMounted) return null

    return (
        <PaneSlot side={side} inset={inset} width={width} zIndex={zIndex} hidden={hidden || !card.mounted}>
            {/* The drag offset lives on this wrapper, not the card: the card's
                transform belongs to surface-motion and would fight it. */}
            <div ref={drag.boxRef} style={drag.style} className={`flex flex-col min-h-0 ${fill ? 'h-full' : 'max-h-full'}`}>
            <div
                role="dialog"
                aria-label={shown.ariaLabel || shown.title}
                aria-hidden={!card.open || undefined}
                className={`relative flex flex-col min-h-0 ${fill ? 'h-full' : 'max-h-full'} rounded-2xl bg-themewhite3 border border-primary/15 shadow-xl overflow-hidden surface-motion ${
                    card.open ? 'pointer-events-auto' : 'surface-hidden-above'
                }`}
            >
                {shown.header !== false && (
                    <div {...drag.handle} className={`shrink-0 touch-none select-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
                    <PaneHeader
                        onBack={isOpen ? onBack : undefined}
                        eyebrow={shown.eyebrow}
                        leading={shown.leading}
                        title={shown.title}
                        actions={
                            <>
                                {shown.rightContent}
                                {!shown.hideClose && (
                                    <HeaderPill>
                                        {!loading && shown.actions}
                                        <PillButton icon={X} iconSize={18} onClick={onClose} label="Close" />
                                    </HeaderPill>
                                )}
                            </>
                        }
                    />
                    </div>
                )}
                {fill
                    ? <div className="flex-1 min-h-0">{shown.children}</div>
                    : shown.selfScroll
                        ? <div className="flex flex-col flex-1 min-h-0">{shown.children}</div>
                        : <div className="min-h-0 overflow-y-auto overscroll-contain">{shown.children}</div>}
                {shown.footer && <div className="shrink-0 border-t border-tertiary/10">{shown.footer}</div>}
                {loading !== undefined && <LoadingOverlay visible={loading} />}
            </div>
            </div>
        </PaneSlot>
    )
}

export interface PaneSurfaceProps extends Omit<PaneCardProps, 'fill' | 'selfScroll' | 'header' | 'footer' | 'keepMounted' | 'leading' | 'onBack' | 'eyebrow' | 'hideClose'> {
    /** Mobile Sheet cap, % of dvh. Default 80. */
    maxHeight?: number
    /** Mobile Sheet z-index. Default 1200 (clears the mobileFullScreen drawers). */
    zIndex?: number
}

/**
 * PaneSurface — the adaptive record / form / settings surface for split panels:
 * a PaneCard on desktop, a fit Sheet on mobile, from one set of props. Content
 * is held through the exit on both.
 */
export function PaneSurface({ maxHeight = 80, zIndex = 1200, ...card }: PaneSurfaceProps) {
    const isMobile = useIsMobile()
    const shown = useHeldWhileOpen(card.isOpen, card)
    if (!isMobile) return <PaneCard {...card} />
    return (
        <Sheet
            isOpen={card.isOpen}
            onClose={card.onClose}
            title={shown.title}
            height="fit"
            maxHeight={maxHeight}
            zIndex={zIndex}
            loading={card.loading}
            rightContent={shown.rightContent}
            actions={card.loading ? undefined : shown.actions}
        >
            {shown.children}
        </Sheet>
    )
}
