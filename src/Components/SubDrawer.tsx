// components/SubDrawer.tsx
//
// A drawer-within-a-drawer. When a mobile BaseDrawer (a full panel) needs to
// open a secondary surface, nesting another BaseDrawer fails: the parent panel
// is a transformed, often glass-header-isolated stacking context, so the nested
// drawer gets trapped beneath the parent's floating header. SubDrawer sidesteps
// that entirely — it portals to document.body (escaping the parent's transform
// and isolation) and presents as a bottom sheet.
//
// UX contract (distinct from BaseDrawer):
//  - Opens to a ~40% peek. Drag up expands toward full; drag down returns to
//    peek. Drag NEVER dismisses — the X button is the only close path.
//  - Full-width, rounded top, dim backdrop. The backdrop blocks the surface
//    underneath but does NOT close on tap.
//  - Content scrolls within the sheet.
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDrag } from '@use-gesture/react';
import { X } from 'lucide-react';
import { HeaderPill, PillButton } from './HeaderPill';
import { clamp } from '../Utilities/GestureUtils';
import { DRAWER_TIMING } from '../Utilities/constants';
import { useKeyboardInset } from '../Hooks/useKeyboardInset';

interface SubDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    /** Optional content rendered before the title on the left of the header. */
    leftContent?: ReactNode;
    /** Optional content rendered on the right of the header, before the close button. */
    rightContent?: ReactNode;
    /** Peek height as a percentage of the dynamic viewport (dvh). Default 40. */
    peekPercent?: number;
    /** Expanded (drag-up) cap as a percentage of dvh. Default 92. */
    expandedPercent?: number;
    /** z-index class for backdrop + sheet. Default 'z-[1200]' (above nested
     *  BaseDrawers, which top out around z-[1010]). */
    zIndex?: string;
    /** Backdrop opacity at full peek. Default 0.4. */
    backdropOpacity?: number;
    /** Suppress the dim backdrop so the surface underneath (e.g. the map) stays
     *  visible and interactive outside the sheet's footprint. Default false. */
    noBackdrop?: boolean;
}

export function SubDrawer({
    isVisible,
    onClose,
    title,
    children,
    leftContent,
    rightContent,
    peekPercent = 40,
    expandedPercent = 92,
    zIndex = 'z-[1200]',
    backdropOpacity = 0.4,
    noBackdrop = false,
}: SubDrawerProps) {
    const peek = Math.min(peekPercent, expandedPercent);
    const expanded = expandedPercent;

    // `visible` is the dvh currently revealed: 0 = closed, [peek, expanded] open.
    const [visible, setVisible] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const keyboardInset = useKeyboardInset();
    const animationFrameId = useRef<number>(0);
    const closeTimeoutRef = useRef<number | null>(null);
    const dragStartVisible = useRef(0);

    // dvh → px conversion for translating drag movement (px) into dvh.
    const dvhPx = () => (typeof window !== 'undefined' ? window.innerHeight / 100 : 8);

    const animateTo = useCallback((target: number, onDone?: () => void) => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        const start = visible;
        const startTime = performance.now();
        const duration = DRAWER_TIMING.TRANSITION;
        const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
            setVisible(start + (target - start) * eased);
            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(step);
            } else {
                animationFrameId.current = 0;
                if (onDone) {
                    closeTimeoutRef.current = window.setTimeout(() => {
                        onDone();
                        closeTimeoutRef.current = null;
                    }, DRAWER_TIMING.CLOSE_UNMOUNT_DELAY);
                }
            }
        };
        animationFrameId.current = requestAnimationFrame(step);
    }, [visible]);

    useEffect(() => {
        if (isVisible) {
            setIsMounted(true);
            setVisible(0);
            const t = window.setTimeout(() => animateTo(peek), DRAWER_TIMING.OPEN_DELAY);
            return () => window.clearTimeout(t);
        }
        // External close (parent set isVisible false) — slide down then unmount.
        // onClose already fired (parent drove the close), so just unmount.
        if (isMounted) animateTo(0, () => setIsMounted(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]);

    useEffect(() => () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    }, []);

    const handleClose = useCallback(() => {
        animateTo(0, () => { setIsMounted(false); onClose(); });
    }, [animateTo, onClose]);

    const bindDrag = useDrag(
        ({ active, first, movement: [, my], velocity: [, vy], direction: [, dy], event, cancel }) => {
            if (first) {
                const target = event?.target as HTMLElement;
                if (!target?.closest('[data-drag-zone]')) { cancel(); return; }
                dragStartVisible.current = visible;
            }
            if (active) {
                setIsDragging(true);
                // Drag up (my < 0) reveals more; clamp between peek and expanded —
                // never below peek, so drag can't dismiss.
                setVisible(clamp(dragStartVisible.current - my / dvhPx(), peek, expanded));
            } else {
                setIsDragging(false);
                const midpoint = (peek + expanded) / 2;
                const flung = vy > 0.5;
                if (flung) {
                    animateTo(dy > 0 ? peek : expanded); // fling down→peek, up→expanded
                } else {
                    animateTo(visible >= midpoint ? expanded : peek);
                }
            }
        },
        { axis: 'y', filterTaps: true, pointer: { touch: true } }
    );

    if (!isMounted && !isVisible) return null;

    const translateDvh = expanded - visible; // 0 = expanded, larger = lower

    return createPortal(
        <>
            {/* Backdrop — dims + blocks the surface underneath. Non-dismissing.
                Omitted entirely when noBackdrop, so the map stays interactive. */}
            {!noBackdrop && (
                <div
                    className={`fixed inset-0 ${zIndex} bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (Math.min(visible, peek) / peek) * backdropOpacity,
                        pointerEvents: visible > 0 ? 'auto' : 'none',
                    }}
                />
            )}
            {/* Sheet */}
            <div
                className={`fixed left-0 right-0 ${zIndex} bg-themewhite3 flex flex-col text-primary ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                style={{
                    height: `${expanded}dvh`,
                    bottom: keyboardInset,
                    transform: `translateY(${translateDvh}dvh)`,
                    borderRadius: '1.25rem 1.25rem 0 0',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
                    willChange: isDragging ? 'transform' : 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                {/* Header — drag zone + title + close */}
                <div className="shrink-0" {...bindDrag()}>
                    <div className="flex justify-center pt-1.5 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                    </div>
                    <div className="px-4 pb-2 border-b border-tertiary/10" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {leftContent && <div className="shrink-0">{leftContent}</div>}
                                <h2 className="truncate text-[13pt] font-semibold text-primary min-w-0">{title}</h2>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {rightContent}
                                <HeaderPill>
                                    <PillButton icon={X} onClick={handleClose} label="Close" />
                                </HeaderPill>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-[max(0px,var(--sab,0px))]">
                    {children}
                </div>
            </div>
        </>,
        document.body,
    );
}
