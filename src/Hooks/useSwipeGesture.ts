import { useRef, useState, useCallback } from 'react';

interface UseSwipeGestureOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
    minVelocity?: number;
}

export const useSwipeGesture = ({
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    minVelocity = 0.3
}: UseSwipeGestureOptions = {}) => {
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchStartTime = useRef<number | null>(null);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
    const [swipeProgress, setSwipeProgress] = useState(0);

    const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        setIsSwiping(true);
        setSwipeProgress(0);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current || !touchStartTime.current) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX.current;
        const deltaY = currentY - touchStartY.current;
        const deltaTime = Date.now() - touchStartTime.current;

        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

        const velocity = Math.abs(isHorizontalSwipe ? deltaX : deltaY) / deltaTime;

        const progress = Math.min(Math.abs(isHorizontalSwipe ? deltaX : deltaY) / threshold, 1) * 100;
        setSwipeProgress(progress);

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            if (isHorizontalSwipe) {
                setSwipeDirection(deltaX > 0 ? 'right' : 'left');
            } else {
                setSwipeDirection(deltaY > 0 ? 'down' : 'up');
            }
        }
    }, [threshold]);

    const handleTouchEnd = useCallback((e: React.TouchEvent | TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current || !touchStartTime.current) {
            setIsSwiping(false);
            setSwipeDirection(null);
            setSwipeProgress(0);
            return;
        }

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - touchStartX.current;
        const deltaY = endY - touchStartY.current;
        const deltaTime = Date.now() - touchStartTime.current;

        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
        const distance = isHorizontalSwipe ? Math.abs(deltaX) : Math.abs(deltaY);
        const velocity = distance / deltaTime;

        if (distance > threshold && velocity > minVelocity) {
            if (isHorizontalSwipe) {
                if (deltaX > 0 && onSwipeRight) {
                    onSwipeRight();
                } else if (deltaX < 0 && onSwipeLeft) {
                    onSwipeLeft();
                }
            } else {
                if (deltaY > 0 && onSwipeDown) {
                    onSwipeDown();
                } else if (deltaY < 0 && onSwipeUp) {
                    onSwipeUp();
                }
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;
        touchStartTime.current = null;
        setIsSwiping(false);
        setSwipeDirection(null);

        setTimeout(() => setSwipeProgress(0), 150);
    }, [threshold, minVelocity, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        touchStartTime.current = Date.now();
        setIsSwiping(true);
        setSwipeProgress(0);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!touchStartX.current || !touchStartY.current || !touchStartTime.current) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = currentX - touchStartX.current;
        const deltaY = currentY - touchStartY.current;

        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
        const progress = Math.min(Math.abs(isHorizontalSwipe ? deltaX : deltaY) / threshold, 1) * 100;
        setSwipeProgress(progress);

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            if (isHorizontalSwipe) {
                setSwipeDirection(deltaX > 0 ? 'right' : 'left');
            } else {
                setSwipeDirection(deltaY > 0 ? 'down' : 'up');
            }
        }
    }, [threshold]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (!touchStartX.current || !touchStartY.current || !touchStartTime.current) {
            setIsSwiping(false);
            setSwipeDirection(null);
            setSwipeProgress(0);
            return;
        }

        const endX = e.clientX;
        const endY = e.clientY;
        const deltaX = endX - touchStartX.current;
        const deltaY = endY - touchStartY.current;
        const deltaTime = Date.now() - touchStartTime.current;

        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
        const distance = isHorizontalSwipe ? Math.abs(deltaX) : Math.abs(deltaY);
        const velocity = distance / deltaTime;

        if (distance > threshold && velocity > minVelocity) {
            if (isHorizontalSwipe) {
                if (deltaX > 0 && onSwipeRight) {
                    onSwipeRight();
                } else if (deltaX < 0 && onSwipeLeft) {
                    onSwipeLeft();
                }
            } else {
                if (deltaY > 0 && onSwipeDown) {
                    onSwipeDown();
                } else if (deltaY < 0 && onSwipeUp) {
                    onSwipeUp();
                }
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;
        touchStartTime.current = null;
        setIsSwiping(false);
        setSwipeDirection(null);
        setTimeout(() => setSwipeProgress(0), 150);
    }, [threshold, minVelocity, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

    return {
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        isSwiping,
        swipeDirection,
        swipeProgress
    };
};