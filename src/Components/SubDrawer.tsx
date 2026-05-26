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
//  - THREE discrete states only: minimal (peek), full (expanded), closed. There
//    is NO drag-to-resize — the old continuous height tracking fought the inner
//    scroll and glitched on iOS. Tapping the grab handle SNAPS between peek and
//    full; the X button closes. Transitions are pure CSS, like BottomSheet.
//  - The sheet's HEIGHT (not a translate offset) is what snaps between peek and
//    full, so the scroll region equals the revealed height in BOTH states — the
//    user can scroll the whole body at peek without expanding to full.
//  - Glass header (iOS large-title): the header floats as a blurred translucent
//    overlay and content scrolls up behind it. Header height is measured and
//    applied as the content's paddingTop.
//  - Full-width, rounded top, optional dim backdrop. The backdrop blocks the
//    surface underneath but does NOT close on tap.
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { HeaderPill, PillButton } from './HeaderPill';
import { DRAWER_TIMING } from '../Utilities/constants';

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
    /** Expanded (tap-to-expand) height as a percentage of dvh. Default 92. */
    expandedPercent?: number;
    /** z-index class for backdrop + sheet. Default 'z-[1200]' (above nested
     *  BaseDrawers, which top out around z-[1010]). */
    zIndex?: string;
    /** Backdrop opacity when open. Default 0.4. */
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
    const canToggle = expanded > peek;

    const [isMounted, setIsMounted] = useState(false);
    // `shown` drives the slide (translateY 0 vs 100%); `isFull` drives which of
    // the two discrete heights the sheet snaps to. Both animate via CSS — nothing
    // tracks a finger, so there is no in-between height to stutter on iOS.
    const [shown, setShown] = useState(false);
    const [isFull, setIsFull] = useState(false);

    const unmountTimer = useRef<number | null>(null);

    // Glass header: measure the floating header so the scroll body can pad to
    // clear it (and slide up behind it).
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        if (!isMounted || !headerRef.current) return;
        const el = headerRef.current;
        const measure = () => setHeaderHeight(el.offsetHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isMounted, isVisible]);

    // Open / external-close lifecycle.
    useEffect(() => {
        if (unmountTimer.current) {
            clearTimeout(unmountTimer.current);
            unmountTimer.current = null;
        }
        if (isVisible) {
            setIsMounted(true);
            setShown(false);
            setIsFull(false); // always open at peek
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
    }, [isVisible]);

    useEffect(() => () => {
        if (unmountTimer.current) window.clearTimeout(unmountTimer.current);
    }, []);

    // X button: slide down, then unmount + notify parent (after the slide so the
    // content stays painted through the close animation).
    const handleClose = useCallback(() => {
        setShown(false);
        if (unmountTimer.current) window.clearTimeout(unmountTimer.current);
        unmountTimer.current = window.setTimeout(() => {
            setIsMounted(false);
            unmountTimer.current = null;
            onClose();
        }, DRAWER_TIMING.TRANSITION);
    }, [onClose]);

    // Grab-handle tap: snap between peek and full. No-op when the consumer
    // configured peek === expanded (single-height sheet).
    const toggleExpanded = useCallback(() => {
        if (!canToggle) return;
        setIsFull(f => !f);
    }, [canToggle]);

    if (!isMounted && !isVisible) return null;

    const heightDvh = isFull ? expanded : peek;

    return createPortal(
        <>
            {/* Backdrop — dims + blocks the surface underneath. Non-dismissing.
                Omitted entirely when noBackdrop, so the map stays interactive. */}
            {!noBackdrop && (
                <div
                    className={`fixed inset-0 ${zIndex} bg-black transition-opacity duration-300 ease-out`}
                    style={{
                        opacity: shown ? backdropOpacity : 0,
                        pointerEvents: shown ? 'auto' : 'none',
                    }}
                />
            )}
            {/* Sheet — HEIGHT snaps between peek/full; translateY only slides it
                in/out. overflow-hidden clips the glass header to the rounded top. */}
            <div
                className={`fixed left-0 right-0 ${zIndex} bg-themewhite3 flex flex-col text-primary overflow-hidden transition-[transform,height] duration-300 ease-out`}
                style={{
                    height: `${heightDvh}dvh`,
                    bottom: 0,
                    transform: `translateY(${shown ? 0 : 100}%)`,
                    borderRadius: '1.25rem 1.25rem 0 0',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                {/* Glass header — floats as a blurred translucent overlay; content
                    scrolls up behind it (iOS large-title style). */}
                <div
                    ref={headerRef}
                    className={`absolute top-0 inset-x-0 z-10 backdrop-blur-[2px] bg-themewhite3/15`}
                >
                    {/* Grab handle — taps to toggle peek/full */}
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
                                <HeaderPill>
                                    <PillButton icon={X} onClick={handleClose} label="Close" />
                                </HeaderPill>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Scrollable content — fills the full sheet height (behind the
                    glass header), padded to clear it. Scroll region therefore
                    equals the revealed height at BOTH peek and full. */}
                <div
                    className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain isolate pb-[max(0px,var(--sab,0px))]"
                    style={{ paddingTop: headerHeight }}
                >
                    {children}
                </div>
            </div>
        </>,
        document.body,
    );
}
