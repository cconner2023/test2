import { useRef, useCallback } from 'react';
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils';

/**
 * Lightweight left-edge swipe-back detector using vanilla touch events.
 *
 * Intentionally separate from useSwipeNavigation, which uses @use-gesture
 * for velocity-based column-level navigation. This hook:
 *   - Uses zero-dependency touch events (no @use-gesture)
 *   - Only activates from the left edge of the container
 *   - Returns React touch handlers (onTouchStart/Move/End)
 *
 * useSwipeNavigation by contrast:
 *   - Uses @use-gesture/react for velocity + threshold detection
 *   - Operates on the full container width (not edge-only)
 *   - Returns bind() props from useDrag
 */
export function useSwipeBack(onBack: (() => void) | undefined, enabled = true) {
    const dragRef = useRef<{
        startX: number;
        startY: number;
        lastX: number;
        locked: boolean | null; // null = undecided, true = horizontal, false = vertical
    } | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled || !onBack) return;
        const t = e.target as HTMLElement;
        if (t.closest('button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"]')) return;
        const touch = e.touches[0];
        // Only activate from the left edge of the container
        const containerLeft = e.currentTarget.getBoundingClientRect().left;
        if (touch.clientX - containerLeft > GESTURE_THRESHOLDS.EDGE_ZONE) return;
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, locked: null };
    }, [enabled, onBack]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const touch = e.touches[0];
        const dx = touch.clientX - d.startX;
        const dy = touch.clientY - d.startY;
        if (d.locked === null) {
            if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return;
            d.locked = Math.abs(dx) > Math.abs(dy);
            if (!d.locked) { dragRef.current = null; return; }
        }
        if (!d.locked) return;
        d.lastX = touch.clientX;
    }, []);

    const onTouchEnd = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.locked !== true) return;
        if (d.lastX - d.startX > GESTURE_THRESHOLDS.SWIPE_BACK_THRESHOLD) {
            onBack?.();
        }
    }, [onBack]);

    return { onTouchStart, onTouchMove, onTouchEnd };
}
