import { useRef, useCallback } from 'react';
import { GESTURE_THRESHOLDS, isInteractiveTarget, applyDirectionLock } from '../Utilities/GestureUtils';
import type { DragState } from '../Utilities/GestureUtils';

/**
 * Horizontal page-swipe hook for mobile wizard/carousel navigation.
 *
 * Shares direction-lock + interactive-target helpers with useSwipeBack,
 * but triggers page navigation (left/right) instead of a back action.
 *
 * @param onSwipeLeft  Called when the user swipes left (next page)
 * @param onSwipeRight Called when the user swipes right (previous page)
 * @param enabled      Gate to disable the gesture (e.g. desktop)
 */
export function usePageSwipe(
    onSwipeLeft: () => void,
    onSwipeRight: () => void,
    enabled = true,
) {
    const dragRef = useRef<DragState | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;
        if (isInteractiveTarget(e.target as HTMLElement)) return;
        const touch = e.touches[0];
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, locked: null };
    }, [enabled]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const touch = e.touches[0];
        if (!applyDirectionLock(d, touch.clientX - d.startX, touch.clientY - d.startY)) {
            if (d.locked === false) dragRef.current = null;
            return;
        }
        d.lastX = touch.clientX;
        e.preventDefault();
    }, []);

    const onTouchEnd = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.locked !== true) return;

        const swipeDx = d.lastX - d.startX;

        // Swipe left (negative dx) -> next page; swipe right (positive dx) -> previous page
        if (swipeDx < -GESTURE_THRESHOLDS.PAGE_SWIPE_THRESHOLD) {
            onSwipeLeft();
        } else if (swipeDx > GESTURE_THRESHOLDS.PAGE_SWIPE_THRESHOLD) {
            onSwipeRight();
        }
    }, [onSwipeLeft, onSwipeRight]);

    return { onTouchStart, onTouchMove, onTouchEnd };
}
