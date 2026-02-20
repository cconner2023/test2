import { useRef, useCallback } from 'react';
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils';

/**
 * Horizontal page-swipe hook for mobile wizard/carousel navigation.
 *
 * Shares the same direction-lock + touch-tracking pattern as useSwipeBack,
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
    const dragRef = useRef<{
        startX: number;
        startY: number;
        lastX: number;
        locked: boolean | null; // null = undecided, true = horizontal, false = vertical
    } | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;
        const t = e.target as HTMLElement;
        if (t.closest('button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"]')) return;
        const touch = e.touches[0];
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, locked: null };
    }, [enabled]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const d = dragRef.current;
        if (!d) return;

        const touch = e.touches[0];
        const dx = touch.clientX - d.startX;
        const dy = touch.clientY - d.startY;

        // Direction lock dead zone
        if (d.locked === null) {
            if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return;
            d.locked = Math.abs(dx) > Math.abs(dy);
            if (!d.locked) { dragRef.current = null; return; }
        }
        if (!d.locked) return;

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
