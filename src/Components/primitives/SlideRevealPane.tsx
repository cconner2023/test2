import { forwardRef, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { DRAWER_TIMING } from '@/Utilities/constants';

/**
 * Desktop split-pane reveal that mimics the app's SideNav pan (App.tsx:522).
 *
 * WHY: the old split-pane consumers animated the pane's OWN `width`
 * (`w-0` <-> `w-[W]`) via `transition-all`. Two problems:
 *   1. `width` is a layout property — not GPU-composited, relayouts every frame.
 *   2. The pane's fixed-width inner content gets crushed to 0 and stretched back
 *      out each frame → the visible squish/reflow jank.
 *
 * HOW (the SideNav trick): the content pane is ALWAYS laid out at its natural
 * `width` (`shrink-0`, so flex can't squish it) and never reflows. An
 * `overflow-hidden` shell reserves/releases layout space by animating its width
 * (an empty clip window — cheap), while the content pane itself slides in/out
 * with a GPU `translateX`. Content stays crisp; the motion is composited.
 *
 * - `side="left"`  — a rail that collapses: content slides out to the LEFT.
 * - `side="right"` — a detail pane that opens: content slides in from the RIGHT.
 *
 * The shell is a `shrink-0` flex item, so sibling panes (e.g. a `flex-1` center)
 * still expand/contract as this one opens or closes — same layout behavior as the
 * width-collapse it replaces, minus the jank. The forwarded ref lands on the
 * content pane (the element with the real width), so consumers that scope an
 * overlay / measure the pane keep working.
 */
interface SlideRevealPaneProps {
    /** When true the pane is revealed at `width`; false collapses it to a 0-width clip. */
    open: boolean;
    /** Edge the content anchors to. 'left' = collapsing rail; 'right' = revealing detail. */
    side: 'left' | 'right';
    /** Open width in px. Content is permanently laid out at this width and never reflows. */
    width: number;
    /** Classes for the content pane itself (borders, bg, `relative`, …). */
    className?: string;
    /** Inline style merged onto the content pane (e.g. CSS-var overrides). */
    style?: CSSProperties;
    /** Keep children mounted while collapsed (rails — cheap, avoids remount flash).
     *  Default false: children unmount after the close transition (heavy detail panes). */
    keepMounted?: boolean;
    /** Optional — omit when the forwarded ref is used purely as a portal target
     *  (content is appended imperatively rather than rendered as React children). */
    children?: ReactNode;
}

const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

export const SlideRevealPane = forwardRef<HTMLDivElement, SlideRevealPaneProps>(
    function SlideRevealPane({ open, side, width, className = '', style, keepMounted = false, children }, ref) {
        // Keep content mounted through the close transition so it slides out (not just
        // vanishes), then unmount — unless keepMounted holds it permanently.
        const [mounted, setMounted] = useState(open);
        useEffect(() => {
            if (open) {
                setMounted(true);
                return;
            }
            if (keepMounted) return;
            const t = window.setTimeout(() => setMounted(false), DRAWER_TIMING.TRANSITION);
            return () => window.clearTimeout(t);
        }, [open, keepMounted]);

        const showChildren = open || keepMounted || mounted;
        // Off-screen resting transform when collapsed: rail exits left, detail exits right.
        const closedTransform = side === 'right' ? 'translateX(100%)' : 'translateX(-100%)';

        return (
            <div
                className="shrink-0 flex overflow-hidden"
                style={{ width: open ? width : 0, transition: `width ${DRAWER_TIMING.TRANSITION}ms ${EASING}` }}
            >
                <div
                    ref={ref}
                    // Collapsed content is translated off-screen but stays in the DOM —
                    // hide it from assistive tech so a closed rail/detail isn't announced.
                    aria-hidden={open ? undefined : true}
                    className={`shrink-0 flex flex-col ${className}`}
                    style={{
                        width,
                        transform: open ? 'translateX(0)' : closedTransform,
                        transition: `transform ${DRAWER_TIMING.TRANSITION}ms ${EASING}`,
                        willChange: 'transform',
                        ...style,
                    }}
                >
                    {showChildren && children}
                </div>
            </div>
        );
    },
);
