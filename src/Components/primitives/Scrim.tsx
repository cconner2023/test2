import { useLayoutEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * Scrim — THE dimmed backdrop. One construction, app-wide.
 *
 * WHY THIS EXISTS (2026-07-24). The scrim had drifted to nine different values,
 * but the real defect was structural, not numeric: every consumer except
 * LiftedRowMenu wrote `bg-black` + element `opacity: 0.45`. When an element's
 * own opacity is < 1 the whole composited group — INCLUDING the backdrop-filter
 * output — is blended at that opacity, so 55% of the sharp, unblurred page
 * bleeds back through. The blur reads as a weak haze instead of a blur.
 * LiftedRowMenu put the alpha in the COLOR (`bg-black/45`) and kept element
 * opacity at 1, so its backdrop-filter renders at full strength. That is the
 * entire reason the lifted row looked right and modals/sheets/drawers didn't.
 *
 * THE INVARIANT: alpha lives in the class (`bg-black/45`). The `progress` prop
 * drives element opacity 0 -> 1 for the fade ONLY, and must reach exactly 1 at
 * rest. Never park this at a fractional opacity. There is deliberately no
 * opacity/intensity prop — the value is not tunable per consumer, because
 * per-consumer tuning is how it drifted to nine values in the first place.
 *
 * VARIANTS are the ONE sanctioned axis of difference, and they are a CLOSED set
 * of named constructions — not a number you pass in:
 *   • 'blur'  (default) — 45% black + 6px backdrop blur. Raised surfaces that
 *     sit OVER live content and want it legible behind them: sheets, modals,
 *     pickers, lifted rows.
 *   • 'solid' — 94% black, NO blur. Top-level surface SWAPS, where what's behind
 *     is meant to read as gone: the root left-nav slide-over. There is nothing
 *     worth blurring behind a near-opaque field, and the blur cost on a
 *     full-viewport layer that rides a drag is real on iOS Safari.
 *   • 'drawer' — 60% black, NO blur. BaseDrawer only. A drawer is still a
 *     surface swap, but it leaves a readable trace of where it opened from
 *     instead of the flat black field the nav wants. Same no-blur reasoning as
 *     'solid'; the shell behind is dim, not erased.
 * Adding a fourth variant means adding a NAME here, never a numeric prop.
 *
 * SCOPE (2026-07-25). A scrim dims the APP, never the browser window. The root
 * left-nav slide-over always got this right — its backdrop is a child of the
 * content column, so on desktop the letterboxing around the app card stays
 * clean. Every portalled surface got it wrong: `fixed inset-0` paints over the
 * whole viewport, so opening any drawer darkened the page margins too.
 * `scope='app'` (default) measures `#app-drawer-root` and pins the scrim to
 * that rect, matching its `md:rounded-md` corners. It is a measured rect rather
 * than a portal into the root because portalling would relocate the scrim in
 * the DOM and silently reorder painting against its own surface.
 * `scope='container'` opts out for scrims that are ALREADY correctly bounded by
 * a positioned ancestor — the two App.tsx slide-over backdrops (which ride the
 * transformed viewport strip, so a fixed rect would follow the transform) and
 * BaseOverlay's containerRef mode.
 *
 * See v2/conventions "ELEVATION — ONE SCRIM, ONE RAISED SURFACE, NO EDGES".
 */
export interface ScrimProps {
    /** Fade progress, 0 -> 1. Must be exactly 1 at rest, or the blur degrades.
     *  Drag-driven surfaces pass their travel fraction here. */
    progress: number
    /** Named construction. 'blur' (default) = 45% + 6px blur, for surfaces over
     *  live content. 'solid' = 94% black, no blur, for the root slide-overs.
     *  'drawer' = 60% black, no blur, for BaseDrawer. */
    variant?: 'blur' | 'solid' | 'drawer'
    /** 'fixed' (default) covers the viewport; 'absolute' scopes to the nearest
     *  positioned ancestor — use inside an already-portaled container.
     *  Ignored under scope='app', which pins to the measured app rect. */
    position?: 'fixed' | 'absolute'
    /** 'app' (default) clamps the scrim to the app shell's box. 'container'
     *  leaves positioning to the caller — only for scrims whose ancestor
     *  already bounds them to the app. */
    scope?: 'app' | 'container'
    /** Numeric z-index (inline). Prefer this. */
    zIndex?: number
    /** Tailwind z-index class, for consumers that thread one (e.g. BaseDrawer's `z-60`). */
    zIndexClass?: string
    /** Tap handler. Omit for a non-dismissing (blocking) scrim. */
    onClick?: () => void
    /** When false the scrim ignores pointer events entirely — a purely visual
     *  backdrop over a surface that must stay interactive. Default true. */
    interactive?: boolean
    /** CSS transition for the fade. Pass 'none' while dragging. */
    transition?: string
    /** Escape hatch for layout-only classes. Never pass colour or blur here. */
    className?: string
    style?: CSSProperties
}

/** Live rect of the app shell, or null when it isn't in the tree (public
 *  routes render outside it) — callers fall back to their own positioning. */
function useAppRect(enabled: boolean) {
    const [rect, setRect] = useState<DOMRect | null>(null)
    useLayoutEffect(() => {
        const el = enabled ? document.getElementById('app-drawer-root') : null
        if (!el) {
            setRect(null)
            return
        }
        const measure = () => setRect(el.getBoundingClientRect())
        measure()
        // Size changes come from the element; position changes only from the
        // window (the shell is centred), so both need watching.
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        window.addEventListener('resize', measure)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [enabled])
    return rect
}

export function Scrim({
    progress,
    variant = 'blur',
    position = 'fixed',
    scope = 'app',
    zIndex,
    zIndexClass = '',
    onClick,
    interactive = true,
    transition = 'opacity 300ms ease-out',
    className = '',
    style,
}: ScrimProps) {
    const shown = progress > 0
    const paint = variant === 'solid'
        ? 'bg-black/94'
        : variant === 'drawer'
            ? 'bg-black/60'
            : 'bg-black/45 backdrop-blur-[6px]'
    const appRect = useAppRect(scope === 'app')
    const box = appRect
        ? { position: 'fixed' as const, top: appRect.top, left: appRect.left, width: appRect.width, height: appRect.height }
        : null
    return (
        <div
            className={`${box ? 'md:rounded-md' : `${position} inset-0`} ${zIndexClass} ${paint} ${className}`}
            style={{
                ...box,
                opacity: Math.max(0, Math.min(1, progress)),
                transition,
                pointerEvents: interactive && shown ? 'auto' : 'none',
                ...(zIndex !== undefined ? { zIndex } : {}),
                ...style,
            }}
            onClick={onClick}
        />
    )
}
