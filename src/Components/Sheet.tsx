// components/Sheet.tsx
//
// Sheet — the single bottom-sheet primitive. Replaces the old BottomSheet
// (fixed-maxHeight, BaseOverlay-based) and SubDrawer (peek/full snap, glass
// header). Both were "rounded card sliding up from the bottom"; this folds them
// into one component with two HEIGHT MODES:
//
//   • 'fit'  — the sheet hugs its content up to a dvh cap, then scrolls. Plain
//              in-flow header (or none). Drag the handle down to dismiss. This
//              is the default and the canonical contact-card / action-list look.
//   • 'snap' — two discrete heights (peek / full); the grab handle taps to
//              toggle and overscrolling past a content edge snaps between them.
//              Glass large-title header floats over the content (iOS style).
//              Closes via the X button only (no drag-to-dismiss). This is the
//              ported SubDrawer behavior — proven on iOS, do not reintroduce
//              continuous finger-tracked height (it fought the inner scroll).
//
// Always portals to document.body so it escapes a parent drawer's transformed,
// glass-header-isolated stacking context (the original reason SubDrawer existed).
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { HeaderPill, PillButton } from './HeaderPill';
import { DRAWER_TIMING } from '../Utilities/constants';
import { Z } from './BaseOverlay';

type SheetHeight = 'fit' | 'snap';
type SheetBackdrop = 'dismiss' | 'block' | 'none';

interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;

    /** Height behavior. Default 'fit' (hug content up to maxHeight, then scroll). */
    height?: SheetHeight;
    /** 'fit' cap as a percentage of the dynamic viewport (dvh). Default 90. */
    maxHeight?: number;
    /** 'snap' lower height as a percentage of dvh. Default 40. */
    peekHeight?: number;
    /** 'snap' upper height as a percentage of dvh. Default 92. */
    fullHeight?: number;

    /** Optional header title. Omit (with hideClose) for a pure content card. */
    title?: string;
    /** Hide the built-in close affordance (consumer renders its own / none). */
    hideClose?: boolean;
    /** Header-left cluster (before the title). */
    leftContent?: ReactNode;
    /** Header-right cluster (before the close button). */
    rightContent?: ReactNode;
    /** PillButtons folded INSIDE the close pill so actions read as one cluster. */
    actions?: ReactNode;

    /** Backdrop behavior. 'dismiss' = tap closes (default), 'block' = dims but
     *  non-dismissing, 'none' = no backdrop (surface underneath stays live). */
    backdrop?: SheetBackdrop;
    /** Backdrop opacity when shown. Default 0.5 (dismiss) / 0.4 (block). */
    backdropOpacity?: number;

    /** 'fit' only: show the drag handle + enable drag-down-to-dismiss. Default true. */
    draggable?: boolean;
    /** Base z-index. Default Z.SHEET. */
    zIndex?: number;
}

export function Sheet({
    isOpen,
    onClose,
    children,
    height = 'fit',
    maxHeight = 90,
    peekHeight = 40,
    fullHeight = 92,
    title,
    hideClose,
    leftContent,
    rightContent,
    actions,
    backdrop = height === 'snap' ? 'block' : 'dismiss',
    backdropOpacity,
    draggable = true,
    // Snap sheets historically open nested over a BaseDrawer (which tops out
    // around z-[1010]) — default high so they aren't trapped underneath. Fit
    // sheets live in the numeric Z token world (action sheets, cards).
    zIndex = height === 'snap' ? 1200 : Z.SHEET,
}: SheetProps) {
    const isSnap = height === 'snap';

    // ── Shared mount / slide lifecycle (ported from SubDrawer) ──────────────
    const [isMounted, setIsMounted] = useState(false);
    const [shown, setShown] = useState(false); // drives translateY slide in/out
    const unmountTimer = useRef<number | null>(null);

    useEffect(() => {
        if (unmountTimer.current) {
            clearTimeout(unmountTimer.current);
            unmountTimer.current = null;
        }
        if (isOpen) {
            setIsMounted(true);
            setShown(false);
            setIsFull(false); // snap: always open at peek
            setDragY(0);      // fit: reset drag offset
            const t = window.setTimeout(() => setShown(true), DRAWER_TIMING.OPEN_DELAY);
            return () => window.clearTimeout(t);
        }
        // Parent closed us — slide down (CSS), then unmount.
        setShown(false);
        unmountTimer.current = window.setTimeout(() => {
            setIsMounted(false);
            unmountTimer.current = null;
        }, DRAWER_TIMING.TRANSITION);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => () => {
        if (unmountTimer.current) window.clearTimeout(unmountTimer.current);
    }, []);

    // Internal close: slide down, then unmount + notify parent (after the slide
    // so content stays painted through the close animation).
    const handleClose = useCallback(() => {
        setShown(false);
        if (unmountTimer.current) window.clearTimeout(unmountTimer.current);
        unmountTimer.current = window.setTimeout(() => {
            setIsMounted(false);
            unmountTimer.current = null;
            onClose();
        }, DRAWER_TIMING.TRANSITION);
    }, [onClose]);

    // ── 'snap' state: which of the two discrete heights, + overscroll snap ──
    const peek = Math.min(peekHeight, fullHeight);
    const expanded = fullHeight;
    const canToggle = isSnap && expanded > peek;
    const [isFull, setIsFull] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const lastTouchY = useRef(0);
    const overscroll = useRef(0);
    const OVERSCROLL_SNAP = 64; // px of pull past the edge to flip state

    // Glass header (snap): measure the floating header so the scroll body can
    // pad to clear it (and slide up behind it).
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        if (!isSnap || !isMounted || !headerRef.current) return;
        const el = headerRef.current;
        const measure = () => setHeaderHeight(el.offsetHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isSnap, isMounted, isOpen]);

    const toggleExpanded = useCallback(() => {
        if (!canToggle) return;
        setIsFull(f => !f);
    }, [canToggle]);

    // Overscroll-driven snap: accumulate travel once the scroll body is pinned
    // at an edge, flip state past OVERSCROLL_SNAP. Reset when it leaves the edge.
    const applyOverscroll = useCallback((delta: number) => {
        if (!canToggle) return;
        const el = scrollRef.current;
        if (!el) return;
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if (!isFull && atBottom && delta < 0) {
            overscroll.current += -delta;
            if (overscroll.current > OVERSCROLL_SNAP) { setIsFull(true); overscroll.current = 0; }
        } else if (isFull && atTop && delta > 0) {
            overscroll.current += delta;
            if (overscroll.current > OVERSCROLL_SNAP) { setIsFull(false); overscroll.current = 0; }
        } else {
            overscroll.current = 0;
        }
    }, [canToggle, isFull]);

    // ── 'fit' state: drag-down-to-dismiss offset ───────────────────────────
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const fitDraggable = !isSnap && draggable;

    // Unified touch handlers: snap mode feeds overscroll; fit mode tracks a
    // dismiss drag started from the handle.
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        lastTouchY.current = e.touches[0].clientY;
        overscroll.current = 0;
        if (fitDraggable) {
            const target = e.target as HTMLElement;
            if (target.closest('[data-drag-zone]')) {
                dragStartY.current = e.touches[0].clientY;
                setIsDragging(true);
            }
        }
    }, [fitDraggable]);
    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const y = e.touches[0].clientY;
        if (isSnap) {
            applyOverscroll(y - lastTouchY.current);
            lastTouchY.current = y;
        } else if (isDragging) {
            setDragY(Math.max(0, y - dragStartY.current));
        }
    }, [isSnap, isDragging, applyOverscroll]);
    const onTouchEnd = useCallback(() => {
        overscroll.current = 0;
        if (!isSnap && isDragging) {
            setIsDragging(false);
            if (dragY > 80) handleClose();
            else setDragY(0);
        }
    }, [isSnap, isDragging, dragY, handleClose]);
    const onWheel = useCallback((e: React.WheelEvent) => {
        if (isSnap) applyOverscroll(-e.deltaY);
    }, [isSnap, applyOverscroll]);

    if (!isMounted && !isOpen) return null;

    const resolvedBackdropOpacity = backdropOpacity ?? (backdrop === 'block' ? 0.4 : 0.5);
    const heightDvh = isSnap ? (isFull ? expanded : peek) : undefined;

    // Slide transform. Fit mode adds the live drag offset (px) on top of the
    // slide; snap mode only slides. Hidden state tucks fully below the bottom
    // inset gap (100% + the gap) so no sliver of the floating card peeks up.
    const translate = shown
        ? (fitDraggable && dragY ? `translateY(${dragY}px)` : 'translateY(0)')
        : 'translateY(calc(100% + 1rem))';

    return createPortal(
        <>
            {/* Backdrop — omitted entirely for 'none' so what's underneath stays
                interactive. 'dismiss' closes on tap; 'block' is non-dismissing. */}
            {backdrop !== 'none' && (
                <div
                    className="fixed inset-0 bg-black transition-opacity duration-300 ease-out"
                    style={{
                        zIndex,
                        opacity: shown ? resolvedBackdropOpacity : 0,
                        pointerEvents: shown ? 'auto' : 'none',
                    }}
                    onClick={backdrop === 'dismiss' ? handleClose : undefined}
                />
            )}

            {/* Sheet card — floating inset card on mobile: side margins, a
                bottom gap (safe-area aware), and ALL FOUR corners rounded so it
                reads as a card rather than a flush-to-edge drawer. Snap: fixed
                dvh height that animates between peek/full. Fit: no height —
                hugs content, capped by maxHeight, then scrolls. */}
            <div
                className={`fixed left-3 right-3 bg-themewhite3 text-primary flex flex-col overflow-hidden ${
                    isDragging ? '' : 'transition-[transform,height] duration-300 ease-out'
                }`}
                style={{
                    zIndex: zIndex + 1,
                    bottom: 'max(0.75rem, calc(var(--sab, 0px) + 0.75rem))',
                    height: isSnap ? `${heightDvh}dvh` : undefined,
                    maxHeight: isSnap ? undefined : `min(${maxHeight}dvh, calc(100dvh - 1.5rem))`,
                    transform: translate,
                    borderRadius: '1.5rem',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.12)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                {isSnap ? (
                    <>
                        {/* Glass header — floats as a blurred translucent overlay;
                            content scrolls up behind it (iOS large-title style). */}
                        <div
                            ref={headerRef}
                            className="absolute top-0 inset-x-0 z-10 backdrop-blur-[2px] bg-themewhite3/15"
                        >
                            <button
                                type="button"
                                onClick={toggleExpanded}
                                disabled={!canToggle}
                                aria-label={canToggle ? (isFull ? 'Minimize' : 'Expand') : undefined}
                                className="w-full flex items-center justify-center gap-1.5 pt-1.5 pb-1 disabled:cursor-default"
                                style={{ touchAction: 'manipulation' }}
                            >
                                <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                                {canToggle && (
                                    isFull
                                        ? <ChevronDown size={12} className="text-tertiary/50" />
                                        : <ChevronUp size={12} className="text-tertiary/50" />
                                )}
                            </button>
                            <div className="px-4 pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {leftContent && <div className="shrink-0">{leftContent}</div>}
                                        <h2 className="truncate text-[13pt] font-semibold text-primary min-w-0">{title}</h2>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {rightContent}
                                        {!hideClose && (
                                            <HeaderPill>
                                                {actions}
                                                <PillButton icon={X} onClick={handleClose} label="Close" />
                                            </HeaderPill>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Scroll body — fills the sheet behind the glass header. */}
                        <div
                            ref={scrollRef}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onWheel={onWheel}
                            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain isolate pb-[max(0px,var(--sab,0px))]"
                            style={{ paddingTop: headerHeight }}
                        >
                            {children}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Plain in-flow header. Drag handle (optional) is the
                            drag-zone; the title row appears only if it has content. */}
                        {draggable && (
                            <div
                                className="flex justify-center pt-2 pb-1 shrink-0"
                                data-drag-zone
                                style={{ touchAction: 'none' }}
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                            >
                                <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                            </div>
                        )}
                        {(title || leftContent || rightContent || actions || !hideClose) && (
                            <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-2 shrink-0 border-b border-primary/6">
                                <div className="flex items-center gap-2 min-w-0">
                                    {leftContent && <div className="shrink-0">{leftContent}</div>}
                                    {title && <span className="truncate text-[13pt] font-semibold text-primary min-w-0">{title}</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {rightContent}
                                    {!hideClose && (
                                        <HeaderPill>
                                            {actions}
                                            <PillButton icon={X} onClick={handleClose} label="Close" />
                                        </HeaderPill>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="min-h-0 overflow-y-auto overscroll-y-contain">{children}</div>
                    </>
                )}
            </div>
        </>,
        document.body,
    );
}
