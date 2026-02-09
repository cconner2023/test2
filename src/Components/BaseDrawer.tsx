// components/BaseDrawer.tsx
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

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
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile ?? localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (externalIsMobile === undefined) {
            const checkMobile = () => setLocalIsMobile(window.innerWidth < 768);
            checkMobile();
            const resizeHandler = () => checkMobile();
            window.addEventListener('resize', resizeHandler);
            return () => window.removeEventListener('resize', resizeHandler);
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
            animationFrameId.current && cancelAnimationFrame(animationFrameId.current);
            timeoutRef.current && clearTimeout(timeoutRef.current);
        };
    }, [isVisible, isMobile]);

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
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    setTimeout(() => {
                        onClose();
                        setIsMounted(false);
                    }, 50);
                }
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    const handleDragInteraction = {
        start: (e: React.TouchEvent | React.MouseEvent) => {
            if (!isMobile || disableDrag) return;
            const target = e.target as HTMLElement;
            if (!target.closest('[data-drag-zone]')) return;

            setIsDragging(true);
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            dragStartY.current = clientY;
            dragStartPosition.current = drawerPosition;
            lastYRef.current = clientY;
            lastTimeRef.current = performance.now();
            velocityRef.current = 0;

            e.stopPropagation();
        },

        move: (e: React.TouchEvent | React.MouseEvent) => {
            if (!isDragging || !isMobile || disableDrag) return;

            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const deltaY = clientY - dragStartY.current;

            const currentTime = performance.now();
            const deltaTime = currentTime - lastTimeRef.current;
            if (deltaTime > 0) {
                velocityRef.current = (clientY - lastYRef.current) / deltaTime;
            }

            lastYRef.current = clientY;
            lastTimeRef.current = currentTime;

            const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * 0.8)));
            setDrawerPosition(newPosition);

            e.stopPropagation();
        },

        end: () => {
            if (!isDragging || !isMobile || disableDrag) return;
            setIsDragging(false);

            // Always full height — swipe down closes, swipe up stays open
            if (velocityRef.current > 0.5 || drawerPosition < 40) {
                // Fast swipe down or dragged far enough down → close
                animateToPosition(0);
            } else {
                // Snap back to full height
                animateToPosition(100);
            }
        }
    };

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
                    onTouchStart={handleDragInteraction.start}
                    onTouchMove={handleDragInteraction.move}
                    onTouchEnd={handleDragInteraction.end}
                    onMouseDown={handleDragInteraction.start}
                    onMouseMove={handleDragInteraction.move}
                    onMouseUp={handleDragInteraction.end}
                    onMouseLeave={handleDragInteraction.end}
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
