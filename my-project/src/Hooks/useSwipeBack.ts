import { useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 60;
const EDGE_ZONE = 40; // px from left edge of container — prevents conflict with in-content swipes

/**
 * Detects a right-swipe gesture starting from the left edge and fires the onBack callback.
 * Only activates when the touch begins within EDGE_ZONE px of the container's left edge,
 * matching native iOS back-gesture behavior and avoiding conflict with in-content swipe gestures.
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
        if (touch.clientX - containerLeft > EDGE_ZONE) return;
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, locked: null };
    }, [enabled, onBack]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const touch = e.touches[0];
        const dx = touch.clientX - d.startX;
        const dy = touch.clientY - d.startY;
        if (d.locked === null) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
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
        if (d.lastX - d.startX > SWIPE_THRESHOLD) {
            onBack?.();
        }
    }, [onBack]);

    return { onTouchStart, onTouchMove, onTouchEnd };
}
