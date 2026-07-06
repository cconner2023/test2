import { useEffect, useRef, type ReactNode, type TouchEventHandler } from 'react';

export interface ContentWrapperProps {
    children: ReactNode;
    slideDirection?: 'left' | 'right' | '';
    swipeHandlers?: { onTouchStart: TouchEventHandler; onTouchMove: TouchEventHandler; onTouchEnd: TouchEventHandler };
    /** When true, wraps children in a scroll container (for scrollDisabled drawers with single-pane content) */
    scrollable?: boolean;
    /** When this value changes, the scroll container resets to the top. Only
     *  meaningful with `scrollable` (mirrors BaseDrawer's scrollResetKey for
     *  multi-view content that reuses one ContentWrapper scroller). */
    scrollResetKey?: string | number;
}

// Content wrapper with slide animation, optional swipe-back, and optional scroll container
export const ContentWrapper = ({
    children,
    slideDirection = '',
    swipeHandlers,
    scrollable = false,
    scrollResetKey,
}: ContentWrapperProps) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = 0;
    }, [scrollResetKey]);

    return (
        <div ref={ref} className={`h-full w-full ${scrollable ? 'overflow-y-auto overscroll-y-contain' : ''} ${slideClasses[slideDirection]}`} {...swipeHandlers}>
            {children}
        </div>
    );
};
