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
// LOADING MORPH (opt-in, fit only) — pass `loading`. The sheet passes through
// THREE settled shapes on ONE continuous element (no DOM swap): (1) a blank
// sheet vessel slides up to acknowledge the tap → (2) it collapses inward to a
// settled HUD puck that HOLDS for the whole load → (3) when `loading` clears the
// puck expands into the full content sheet, the HUD dissolving as the content
// fades in. Phases: enter → collapse → hud → expand → done. Consumers that never
// pass `loading` are byte-identical to before (gated on the prop being present).
//
// Always portals to document.body so it escapes a parent drawer's transformed,
// glass-header-isolated stacking context (the original reason SubDrawer existed).
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSpring, animated } from '@react-spring/web';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { HeaderPill, PillButton } from './HeaderPill';
import { HudLoader } from './HudLoader';
import { DRAWER_TIMING } from '../Utilities/constants';
import { Z, OverlayStackContext, STACK_BUMP } from './BaseOverlay';

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
    /** Optional rich title node — replaces the plain `title` text in the header
     *  slot (e.g. a breadcrumb stacked above a name). `title` is still used for
     *  the dialog aria-label. */
    titleNode?: ReactNode;
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

    /** OPT-IN loading morph (fit only). While true the card is a HUD puck; on
     *  false it grows into the full sheet as the HUD dissolves into the content.
     *  Omit entirely to keep the classic (non-morph) behavior. */
    loading?: boolean;
    /** HUD diameter for the loading puck. Default 88. */
    hudSize?: number;
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
    titleNode,
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
    loading,
    hudSize = 88,
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

    // 'fit': measure the non-scrolling chrome (handle + header) so the scroll
    // body can take an EXPLICIT max-height. iOS Safari won't create a scroll
    // region for a flex-shrink child under a max-height-only parent (no definite
    // height) — it lays the child out full-height and the card's overflow-hidden
    // clips the tail, making content unreachable. Capping the body directly fixes
    // it. min-h-0 alone isn't enough here.
    const fitChromeRef = useRef<HTMLDivElement>(null);
    const [fitChromeH, setFitChromeH] = useState(0);
    useEffect(() => {
        if (isSnap || !isMounted || !fitChromeRef.current) return;
        const el = fitChromeRef.current;
        const measure = () => setFitChromeH(el.offsetHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isSnap, isMounted, isOpen]);

    // ── LOADING MORPH (opt-in, fit only) — explicit 3-shape phase machine ────
    // `loading === undefined` ⇒ consumer didn't opt in ⇒ classic path only.
    // The SAME element passes through three settled shapes, no DOM swap (the
    // swap was the old "close"): (1) a sheet vessel slides up → (2) collapses
    // to a settled HUD puck that HOLDS for the whole load → (3) expands into
    // the settled content sheet. Phases: enter → collapse → hud → expand → done.
    // (A `check` dwell — HUD morphing to a checkmark — will slot in at hud→expand.)
    type MorphPhase = 'enter' | 'collapse' | 'hud' | 'expand' | 'done';
    const opted = loading !== undefined && !isSnap;
    const [phase, setPhase] = useState<MorphPhase>('done');
    const phaseRef = useRef<MorphPhase>(phase);
    phaseRef.current = phase;
    // Opted fit sheets ALWAYS render through the morph element (even at 'done',
    // where it's pixel-identical to the classic card) so we never swap subtrees.
    const morphActive = opted;
    // Puck shapes — the settled HUD loader (shape 2).
    const isPuck = phase === 'collapse' || phase === 'hud';
    const isPuckRef = useRef(isPuck);
    isPuckRef.current = isPuck;

    const PUCK_W = 140;
    const PUCK_H = hudSize + 56;

    // Measure the wrapper width (target full width) + the real content height we
    // grow into. Live (ResizeObserver) so async content still lands correctly.
    // Content is mounted (faded) the whole time, so it measures even under the
    // puck — but skip height updates while collapsed (content is squeezed to
    // PUCK_W there, so its scrollHeight is bogus). At full width (enter/expand/
    // done) the measurement is true; the puck just retains the last good height.
    const wrapRef = useRef<HTMLDivElement>(null);
    const morphContentRef = useRef<HTMLDivElement>(null);
    const [wrapW, setWrapW] = useState(0);
    const [fullH, setFullH] = useState(0);
    useEffect(() => {
        if (!morphActive) return;
        const measure = () => {
            if (wrapRef.current) setWrapW(wrapRef.current.offsetWidth);
            if (morphContentRef.current && !isPuckRef.current) {
                const capPx = Math.min((maxHeight / 100) * window.innerHeight, window.innerHeight - 24);
                setFullH(Math.min(morphContentRef.current.scrollHeight, capPx));
            }
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (morphContentRef.current) ro.observe(morphContentRef.current);
        return () => ro.disconnect();
    }, [morphActive, maxHeight, isMounted]);

    // Shape-1 vessel height — a sheet-looking blank that slides up before it
    // collapses. Tracks the eventual content height when known, else a neutral
    // ~42dvh fallback so the vessel reads as a sheet on the first paint.
    const vesselH = fullH || (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.42) : 320);
    const fullW = wrapW || PUCK_W;
    const targetW = isPuck ? PUCK_W : fullW;
    const targetH = phase === 'enter' ? vesselH : isPuck ? PUCK_H : (fullH || PUCK_H);

    const morphCfg = { tension: 210, friction: 24 };
    const morph = useSpring({
        width: targetW,
        height: targetH,
        // The vessel (shape 1) snaps to full size and rides in on the CSS slide —
        // only the collapse → puck and puck → sheet actually animate their size.
        immediate: phase === 'enter',
        config: morphCfg,
        onRest: () => {
            if (phaseRef.current === 'collapse') setPhase('hud');
            else if (phaseRef.current === 'expand') setPhase('done');
        },
    });
    // HUD: blank through the vessel, fades in as it collapses to the puck, then
    // dissolves outward as the sheet expands.
    const hudFade = useSpring({
        opacity: isPuck ? 1 : 0,
        scale: phase === 'expand' || phase === 'done' ? 1.08 : 1,
        config: morphCfg,
    });
    // Content: blank through vessel + puck, fades in a beat into the expand.
    // ONLY the expand fade-in animates — hiding is instant (immediate), so the
    // vessel is truly blank on entry and the initial 'done' frame never bleeds
    // the settled sheet through the slide-in (that bleed was the pre-collapse flash).
    const contentFade = useSpring({
        opacity: phase === 'expand' || phase === 'done' ? 1 : 0,
        immediate: phase !== 'expand',
        delay: phase === 'expand' ? 90 : 0,
        config: morphCfg,
    });

    // ── Phase transitions ────────────────────────────────────────────────────
    // Entrance: `loading` rising drives the sheet vessel in (shape 1). If a
    // settled sheet is re-loading, collapse straight to the puck instead.
    useEffect(() => {
        if (!opted) return;
        if (loading) setPhase(p => (p === 'done' && shown ? 'collapse' : 'enter'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, opted]);
    // Vessel → puck: let the slide-up land, then collapse inward (shape 2).
    useEffect(() => {
        if (phase !== 'enter') return;
        const t = window.setTimeout(() => setPhase('collapse'), DRAWER_TIMING.TRANSITION);
        return () => window.clearTimeout(t);
    }, [phase]);
    // Settled puck → expand once the load clears (shape 3). The future checkmark
    // dwell slots in right here, between `hud` settling and the expand.
    useEffect(() => {
        if (phase === 'hud' && !loading) setPhase('expand');
    }, [phase, loading]);

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

    // Frosted dim — mirrors LiftedRowMenu's clone scrim (bg-black/45 + 6px blur)
    // so block/dismiss sheets soft-blur what's underneath (e.g. a calendar
    // BottomIsland/FAB) instead of leaving it visible through a weak flat dim.
    const resolvedBackdropOpacity = backdropOpacity ?? 0.45;
    const heightDvh = isSnap ? (isFull ? expanded : peek) : undefined;

    // Slide transform. Fit mode adds the live drag offset (px) on top of the
    // slide; snap mode only slides. Hidden state tucks fully below the bottom
    // inset gap (100% + the gap) so no sliver of the floating card peeks up.
    const translate = shown
        ? (fitDraggable && dragY ? `translateY(${dragY}px)` : 'translateY(0)')
        : 'translateY(calc(100% + 1rem))';

    // ── Reusable 'fit' chrome + body (shared by classic + morph paths) ──────
    const fitChrome = (
        <div ref={fitChromeRef} className="shrink-0">
            {/* Plain in-flow header. Drag handle (optional) is the drag-zone; the
                title row appears only if it has content. */}
            {draggable && (
                <div
                    className="flex justify-center pt-2 pb-1"
                    data-drag-zone
                    style={{ touchAction: 'none' }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                </div>
            )}
            {(title || titleNode || leftContent || rightContent || actions || !hideClose) && (
                <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-2 border-b border-primary/6">
                    <div className="flex items-center gap-2 min-w-0">
                        {leftContent && <div className="shrink-0">{leftContent}</div>}
                        {titleNode
                            ? <div className="min-w-0 flex-1">{titleNode}</div>
                            : title && <span className="truncate text-[13pt] font-semibold text-primary min-w-0">{title}</span>}
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
        </div>
    );
    // Explicit cap (card cap minus chrome) so iOS Safari makes this a real scroll
    // region instead of clipping the tail.
    const fitBody = (
        <div
            className="min-h-0 overflow-y-auto overscroll-y-contain"
            style={{ maxHeight: `calc(min(${maxHeight}dvh, 100dvh - 1.5rem) - ${fitChromeH}px)` }}
        >
            {children}
        </div>
    );

    return createPortal(
        // Publish a stack ceiling so pickers / modals / confirm dialogs opened
        // INSIDE the sheet (PreviewOverlay, BaseOverlay-based) auto-stack above
        // it, even though the sheet portals to body at a high z.
        <OverlayStackContext.Provider value={zIndex + STACK_BUMP}>
            {/* Backdrop — omitted entirely for 'none' so what's underneath stays
                interactive. 'dismiss' closes on tap; 'block' is non-dismissing. */}
            {backdrop !== 'none' && (
                <div
                    className="fixed inset-0 bg-black backdrop-blur-[6px] transition-opacity duration-300 ease-out"
                    style={{
                        zIndex,
                        opacity: shown ? resolvedBackdropOpacity : 0,
                        pointerEvents: shown ? 'auto' : 'none',
                    }}
                    onClick={backdrop === 'dismiss' ? handleClose : undefined}
                />
            )}

            {morphActive ? (
                // ── Loading morph: a HUD puck that grows into the full sheet ──
                // The wrapper spans the sheet's full footprint and slides; the
                // card inside springs its width/height from puck → full so it
                // container-transforms. HUD ↔ content crossfade rides the grow.
                <div
                    ref={wrapRef}
                    className="fixed left-2 right-2 flex justify-center transition-transform duration-300 ease-out"
                    style={{
                        zIndex: zIndex + 1,
                        bottom: 'max(0.5rem, calc(var(--sab, 0px) + 0.5rem))',
                        transform: translate,
                    }}
                >
                    <animated.div
                        className="relative bg-themewhite3 text-primary overflow-hidden"
                        style={{
                            width: morph.width,
                            height: morph.height,
                            borderRadius: '1.5rem',
                            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.12)',
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                    >
                        {/* Real chrome + body, measured + faded (becomes the sheet). */}
                        <animated.div ref={morphContentRef} style={{ opacity: contentFade.opacity }}>
                            {fitChrome}
                            {fitBody}
                        </animated.div>
                        {/* HUD layer — transparent, centered, dissolves outward. */}
                        <animated.div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{
                                opacity: hudFade.opacity,
                                transform: hudFade.scale.to((s) => `scale(${s})`),
                                pointerEvents: 'none',
                            }}
                        >
                            <HudLoader size={hudSize} />
                        </animated.div>
                    </animated.div>
                </div>
            ) : (
                // ── Classic card (snap, or settled/non-opted fit) ──
                <div
                    className={`fixed left-2 right-2 bg-themewhite3 text-primary flex flex-col overflow-hidden ${
                        isDragging ? '' : 'transition-[transform,height] duration-300 ease-out'
                    }`}
                    style={{
                        zIndex: zIndex + 1,
                        bottom: 'max(0.5rem, calc(var(--sab, 0px) + 0.5rem))',
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
                                            {titleNode
                                                ? <div className="min-w-0 flex-1">{titleNode}</div>
                                                : <h2 className="truncate text-[13pt] font-semibold text-primary min-w-0">{title}</h2>}
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
                                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain isolate"
                                style={{ paddingTop: headerHeight }}
                            >
                                {children}
                            </div>
                        </>
                    ) : (
                        <>
                            {fitChrome}
                            {fitBody}
                        </>
                    )}
                </div>
            )}
        </OverlayStackContext.Provider>,
        document.body,
    );
}
