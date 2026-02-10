// components/BaseDrawer.tsx
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { GESTURE_THRESHOLDS, SPRING_CONFIGS, VERTICAL_DRAG_CONFIG, clamp } from '../Utilities/GestureUtils';

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

    const [isDragging, setIsDragging] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const dragStartPosition = useRef(0);
    const rAFRef = useRef(0);
    const isMountedRef = useRef(false);

    // react-spring drives the drawer position (0 = closed, 100 = fully open)
    // Replaces the previous manual rAF animation loop
    const [springStyle, api] = useSpring(() => ({
        position: 0,
        config: SPRING_CONFIGS.snap,
    }));

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
            isMountedRef.current = true;
            document.body.style.overflow = 'hidden';

            // Stop any in-flight animations and clear stale onRest callbacks
            // This prevents the close animation's onRest from firing after the
            // open animation starts (which would call setIsMounted(false))
            api.stop();

            if (isMobile) {
                // Start at 0 then animate to 100 for slide-up entrance
                api.start({ position: 0, immediate: true });
                // Use rAF to ensure the initial position is painted before animating
                rAFRef.current = requestAnimationFrame(() => {
                    api.start({ position: 100, immediate: false, config: SPRING_CONFIGS.snap });
                });
            } else {
                // Desktop: jump to full position immediately
                api.start({ position: 100, immediate: true });
            }
        } else {
            // Cancel any pending open animation rAF
            if (rAFRef.current) {
                cancelAnimationFrame(rAFRef.current);
                rAFRef.current = 0;
            }
            // Only animate closed if currently mounted (skip no-op close on initial mount
            // which would register a stale onRest that interferes with future open animations)
            if (isMountedRef.current) {
                api.start({
                    position: 0,
                    immediate: false,
                    config: SPRING_CONFIGS.snap,
                    onRest: () => {
                        setIsMounted(false);
                        isMountedRef.current = false;
                        document.body.style.overflow = '';
                    },
                });
            }
        }
        return () => {
            // Cleanup: cancel pending rAF on effect re-run or unmount
            if (rAFRef.current) {
                cancelAnimationFrame(rAFRef.current);
                rAFRef.current = 0;
            }
        };
    }, [isVisible, isMobile, api]);

    const bindDrawerDrag = useDrag(
        ({ active, first, movement: [, my], velocity: [, vy], direction: [, dy], event, cancel }) => {
            // 1. GUARD — only allow drag from drag-zone elements
            if (first) {
                const target = event?.target as HTMLElement;
                if (!target?.closest('[data-drag-zone]')) {
                    cancel();
                    return;
                }
                // Capture current spring value as drag start position
                dragStartPosition.current = springStyle.position.get();
            }

            if (active) {
                // 2. COMPUTE — apply dampening and clamp to valid range
                setIsDragging(true);
                const newPosition = clamp(
                    dragStartPosition.current - (my * GESTURE_THRESHOLDS.DRAWER_DRAG_DAMPENING),
                    GESTURE_THRESHOLDS.DRAWER_MIN_POSITION,
                    100,
                );
                // 3. ANIMATE — immediate position update during drag
                api.start({ position: newPosition, immediate: true });
            } else {
                setIsDragging(false);
                const currentPosition = springStyle.position.get();

                // 4. CALLBACK + ANIMATE — close or snap back
                if ((vy > GESTURE_THRESHOLDS.DRAWER_FLING_VELOCITY && dy > 0) || currentPosition < GESTURE_THRESHOLDS.DRAWER_CLOSE_THRESHOLD) {
                    // Close: animate to 0, then fire onClose
                    api.start({
                        position: 0,
                        config: SPRING_CONFIGS.fling,
                        onRest: () => {
                            onClose();
                            setIsMounted(false);
                            isMountedRef.current = false;
                        },
                    });
                } else {
                    // Snap back to fully open
                    api.start({ position: 100, config: SPRING_CONFIGS.snap });
                }
            }
        },
        {
            ...VERTICAL_DRAG_CONFIG,
            enabled: isMobile && !disableDrag,
        }
    );

    const handleClose = useCallback(() => {
        if (isMobile) {
            // Animate closed, then fire onClose
            api.start({
                position: 0,
                config: SPRING_CONFIGS.snap,
                onRest: () => {
                    onClose();
                    setIsMounted(false);
                    isMountedRef.current = false;
                },
            });
        } else {
            onClose();
        }
    }, [isMobile, api, onClose]);

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
                {/* Backdrop — animated opacity driven by spring */}
                <animated.div
                    className={`fixed inset-0 ${zIndex} bg-black`}
                    style={{
                        opacity: springStyle.position.to(p => (p / 100) * backdropOpacity),
                        pointerEvents: springStyle.position.to(p => p > 0 ? 'auto' : 'none') as unknown as string,
                    }}
                    onClick={handleClose}
                />

                {/* Drawer Container — animated transform driven by spring */}
                <animated.div
                    className={`fixed left-0 right-0 ${zIndex} bg-themewhite3 ${mobileClassName}`}
                    style={{
                        height: fullHeight,
                        maxHeight: fullHeight,
                        width: '100%',
                        bottom: 0,
                        transform: springStyle.position.to(p => `translateY(${100 - p}%)`),
                        opacity: springStyle.position.to(p => Math.min(1, p / 60 + 0.2)),
                        borderRadius: '1.25rem 1.25rem 0 0',
                        willChange: isDragging ? 'transform' : 'auto',
                        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden',
                        visibility: isMounted ? 'visible' : 'hidden',
                    }}
                    {...bindDrawerDrag()}
                >
                    {resolvedChildren}
                </animated.div>
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
