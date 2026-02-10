// components/BaseDrawer.tsx
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { GESTURE_THRESHOLDS, clamp } from '../Utilities/GestureUtils';

/** Render prop type: children can receive handleClose for animated close */
type DrawerRenderProp = (handleClose: () => void) => ReactNode;

interface BaseDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
    /** Children can be ReactNode or a render function receiving handleClose */
    children: ReactNode | DrawerRenderProp;
    fullHeight?: string;
    desktopWidth?: string;
    desktopMaxWidth?: string;
    disableDrag?: boolean;
    /** Backdrop opacity at full visibility. Default 0.9 */
    backdropOpacity?: number;
    /** Desktop panel origin position. Default 'right' */
    desktopPosition?: 'left' | 'right';
    /** Outer container max-width class for desktop. Default 'max-w-315' */
    desktopContainerMaxWidth?: string;
    /** Fixed height class for desktop panel. Default '' (auto) */
    desktopHeight?: string;
    /** If true, only render mobile drawer (no desktop modal). Default false */
    mobileOnly?: boolean;
    /** Extra className for the mobile drawer container */
    mobileClassName?: string;
    /** Desktop inner panel padding overrides. Default 'py-3 pl-3 pr-5' */
    desktopPanelPadding?: string;
    /** z-index class for mobile backdrop and drawer. Default 'z-60' */
    zIndex?: string;
    /** Desktop panel top offset. Default '0.5rem' */
    desktopTopOffset?: string;
}

export function BaseDrawer({
    isVisible,
    onClose,
    isMobile: externalIsMobile,
    children,
    fullHeight = '90dvh',
    desktopMaxWidth = 'max-w-md',
    disableDrag = false,
    backdropOpacity = 0.9,
    desktopPosition = 'right',
    desktopContainerMaxWidth = 'max-w-315',
    desktopHeight = '',
    mobileOnly = false,
    mobileClassName = '',
    desktopPanelPadding = 'py-3 pl-3 pr-5',
    zIndex = 'z-60',
    desktopTopOffset = '0.5rem',
}: BaseDrawerProps) {
    const [localIsMobile, setLocalIsMobile] = useState(
        () => window.matchMedia('(max-width: 767px)').matches
    );
    const isMobile = externalIsMobile ?? localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const timeoutRef = useRef<number | null>(null);

    // Fallback: only used when isMobile isn't passed externally.
    // matchMedia fires only on breakpoint crossing — no re-renders during normal resize.
    useEffect(() => {
        if (externalIsMobile === undefined) {
            const mql = window.matchMedia('(max-width: 767px)');
            const handler = (e: MediaQueryListEvent) => setLocalIsMobile(e.matches);
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
    }, [externalIsMobile]);

    useEffect(() => {
        if (isVisible) {
            setIsMounted(true);
            setDrawerPosition(isMobile ? 0 : 100);
            document.body.style.overflow = 'hidden';

            if (isMobile) {
                // Start opening animation for mobile
                setTimeout(() => {
                    setDrawerPosition(100);
                }, 10);
            }
        } else {
            // Start closing animation
            setDrawerPosition(0);

            timeoutRef.current = setTimeout(() => {
                setIsMounted(false);
                document.body.style.overflow = '';
            }, 300); // Match animation duration
        }

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (closeDelayRef.current) clearTimeout(closeDelayRef.current);
        };
    }, [isVisible, isMobile]);

    const closeDelayRef = useRef<number>(0);

    const animateToPosition = useCallback((targetPosition: number) => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }

        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = 300;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Cubic ease-out: 1 - (1 - t)^3
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    closeDelayRef.current = window.setTimeout(() => {
                        onClose();
                        setIsMounted(false);
                        closeDelayRef.current = 0;
                    }, 50);
                }
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    const bindDrawerDrag = useDrag(
        ({ active, first, movement: [, my], velocity: [, vy], direction: [, dy], event, cancel }) => {
            // Only allow drag from drag-zone elements
            if (first) {
                const target = event?.target as HTMLElement;
                if (!target?.closest('[data-drag-zone]')) {
                    cancel();
                    return;
                }
                dragStartPosition.current = drawerPosition;
            }

            if (active) {
                setIsDragging(true);
                const newPosition = clamp(dragStartPosition.current - (my * 0.8), 20, 100);
                setDrawerPosition(newPosition);
            } else {
                setIsDragging(false);
                // Swipe down closes, swipe up stays open
                if ((vy > GESTURE_THRESHOLDS.DRAWER_FLING_VELOCITY && dy > 0) || drawerPosition < 40) {
                    animateToPosition(0);
                } else {
                    animateToPosition(100);
                }
            }
        },
        {
            enabled: isMobile && !disableDrag,
            axis: 'y',
            filterTaps: true,
            pointer: { touch: true },
        }
    );

    const handleClose = useCallback(() => {
        if (isMobile) {
            animateToPosition(0);
        } else {
            onClose();
        }
    }, [isMobile, animateToPosition, onClose]);

    const mobileStyles = {
        translateY: 100 - drawerPosition,
        opacity: Math.min(1, drawerPosition / 60 + 0.2),
        height: fullHeight,
        borderRadius: '1.25rem 1.25rem 0 0',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
    };

    // Desktop position-dependent classes — slide-in from top with opacity
    const desktopAlignClass = desktopPosition === 'left' ? 'left-0' : 'right-0';
    const desktopOriginClass = desktopPosition === 'left' ? 'origin-top-left' : 'origin-top-right';

    // Resolve children: support both ReactNode and render prop
    const resolvedChildren = typeof children === 'function'
        ? (children as DrawerRenderProp)(handleClose)
        : children;

    if (!isMounted && !isVisible) return null;

    return (
        <>
            {/* Mobile Drawer */}
            <div className={mobileOnly ? '' : 'md:hidden'}>
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 ${zIndex} bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * backdropOpacity,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />

                {/* Drawer Container */}
                <div
                    className={`fixed left-0 right-0 ${zIndex} bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'} ${mobileClassName}`}
                    style={{
                        height: mobileStyles.height,
                        maxHeight: mobileStyles.height,
                        width: '100%',
                        bottom: 0,
                        transform: `translateY(${mobileStyles.translateY}%)`,
                        opacity: mobileStyles.opacity,
                        borderRadius: mobileStyles.borderRadius,
                        willChange: isDragging ? 'transform' : 'auto',
                        boxShadow: mobileStyles.boxShadow,
                        overflow: 'hidden',
                        visibility: isMounted ? 'visible' : 'hidden',
                    }}
                    {...bindDrawerDrag()}
                >
                    {resolvedChildren}
                </div>
            </div>

            {/* Desktop Modal */}
            {!mobileOnly && (
                <div className="hidden md:block">
                    {/* Backdrop */}
                    <div
                        className={`fixed inset-0 ${zIndex} bg-black transition-opacity duration-250 ease-out ${
                            isVisible ? 'opacity-20 pointer-events-auto' : 'opacity-0 pointer-events-none'
                        }`}
                        onClick={onClose}
                    />

                    {/* Panel — positioned relative to the max-w-315 content container */}
                    <div
                        className={`fixed inset-x-0 top-0 ${zIndex} flex justify-center pointer-events-none`}
                        style={{ paddingTop: desktopTopOffset }}
                    >
                        <div className={`${desktopContainerMaxWidth} w-full relative`}>
                            <div
                                className={`absolute ${desktopAlignClass} ${desktopPanelPadding}
                flex flex-col rounded-xl border border-tertiary/20
                shadow-lg shadow-black/8 backdrop-blur-xl bg-themewhite3/95
                transform-gpu overflow-hidden text-primary/80 text-sm
                ${desktopOriginClass} ${desktopMaxWidth} w-full ${desktopHeight || 'h-auto'}
                pointer-events-auto`}
                                style={{
                                    transition: 'opacity 250ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
                                    opacity: isVisible ? 1 : 0,
                                    transform: isVisible
                                        ? 'translateY(0) scale(1)'
                                        : `translateY(-8px) scale(0.97)`,
                                    pointerEvents: isVisible ? 'auto' : 'none',
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {resolvedChildren}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
