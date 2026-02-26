import { useRef, useCallback } from 'react';
import { GESTURE_THRESHOLDS, isInteractiveTarget, applyDirectionLock } from '../Utilities/GestureUtils';
import type { DragState } from '../Utilities/GestureUtils';

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
    const dragRef = useRef<DragState | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled || !onBack) return;
        if (isInteractiveTarget(e.target as HTMLElement)) return;
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
        if (!applyDirectionLock(d, touch.clientX - d.startX, touch.clientY - d.startY)) {
            if (d.locked === false) dragRef.current = null;
            return;
        }
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
