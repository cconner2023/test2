import type React from 'react';

export interface ContentWrapperProps {
    children: React.ReactNode;
    slideDirection?: 'left' | 'right' | '';
    swipeHandlers?: { onTouchStart: React.TouchEventHandler; onTouchMove: React.TouchEventHandler; onTouchEnd: React.TouchEventHandler };
    /** When true, wraps children in a scroll container (for scrollDisabled drawers with single-pane content) */
    scrollable?: boolean;
}

// Content wrapper with slide animation, optional swipe-back, and optional scroll container
export const ContentWrapper = ({
    children,
    slideDirection = '',
    swipeHandlers,
    scrollable = false,
}: ContentWrapperProps) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${scrollable ? 'overflow-y-auto overscroll-y-contain' : ''} ${slideClasses[slideDirection]}`} {...swipeHandlers}>
            {children}
        </div>
    );
};
