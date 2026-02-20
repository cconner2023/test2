import type React from 'react';

export interface ContentWrapperProps {
    children: React.ReactNode;
    slideDirection: 'left' | 'right' | '';
    swipeHandlers?: { onTouchStart: React.TouchEventHandler; onTouchMove: React.TouchEventHandler; onTouchEnd: React.TouchEventHandler };
}

// Content wrapper with slide animation and optional swipe-back
export const ContentWrapper = ({
    children,
    slideDirection,
    swipeHandlers,
}: ContentWrapperProps) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${slideClasses[slideDirection]}`} {...swipeHandlers}>
            {children}
        </div>
    );
};
