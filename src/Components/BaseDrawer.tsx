// components/BaseDrawer.tsx
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

interface BaseDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
    children: ReactNode;
    initialStage?: 'partial' | 'full';
    partialHeight?: string;
    fullHeight?: string;
    desktopWidth?: string;
    desktopMaxWidth?: string;
    disableDrag?: boolean;
}

export function BaseDrawer({
    isVisible,
    onClose,
    isMobile: externalIsMobile,
    children,
    initialStage = 'partial',
    partialHeight = '45dvh',
    fullHeight = '90dvh',
    desktopWidth = 'w-full',
    desktopMaxWidth = 'max-w-md',
    disableDrag = false
}: BaseDrawerProps) {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile ?? localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [drawerStage, setDrawerStage] = useState<'partial' | 'full'>(initialStage);
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
            setDrawerStage(initialStage);
            setDrawerPosition(0); // Start from bottom for animation
            document.body.style.overflow = 'hidden';

            // Start opening animation
            setTimeout(() => {
                setDrawerPosition(100);
            }, 10);
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
    }, [isVisible, initialStage]);

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

            const isSwipingDown = velocityRef.current > 0.3;
            const isSwipingUp = velocityRef.current < -0.3;

            if (drawerStage === 'partial') {
                if (isSwipingUp) {
                    setDrawerStage('full');
                    animateToPosition(100);
                } else if (isSwipingDown || drawerPosition < 40) {
                    animateToPosition(0);
                } else {
                    animateToPosition(100);
                }
            } else {
                if (velocityRef.current > 0.6 || drawerPosition < 30) {
                    animateToPosition(0);
                } else if (isSwipingDown || drawerPosition < 70) {
                    setDrawerStage('partial');
                    animateToPosition(100);
                } else {
                    animateToPosition(100);
                }
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
        height: drawerStage === 'partial' ? partialHeight : fullHeight,
        horizontalPadding: drawerStage === 'partial' ? '0.4rem' : '0',
        bottomPadding: drawerStage === 'partial' ? '1.5rem' : '0',
        borderRadius: drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0',
        boxShadow: drawerStage === 'partial'
            ? '0 4px 2px rgba(0, 0, 0, 0.05)'
            : '0 -4px 20px rgba(0, 0, 0, 0.1)',
        width: drawerStage === 'partial' ? 'calc(100% - 0.8rem)' : '100%',
    };

    if (!isMounted && !isVisible) return null;

    return (
        <>
            {/* Mobile Drawer */}
            <div className="md:hidden">
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * 0.9,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />

                {/* Drawer Container */}
                <div
                    className={`fixed left-0 right-0 z-70 bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: mobileStyles.height,
                        maxHeight: mobileStyles.height,
                        marginLeft: mobileStyles.horizontalPadding,
                        marginRight: mobileStyles.horizontalPadding,
                        marginBottom: mobileStyles.bottomPadding,
                        width: mobileStyles.width,
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
                    {children}
                </div>
            </div>

            {/* Desktop Modal */}
            <div className="hidden md:block">
                <div
                    className={`fixed inset-0 z-60 flex items-start justify-center transition-all duration-300 ease-out ${isVisible ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div
                        className={`absolute inset-0 bg-black transition-opacity duration-300 ease-out ${isVisible ? 'opacity-30' : 'opacity-0'
                            }`}
                    />

                    {/* Modal Container */}
                    <div className={`${desktopMaxWidth} ${desktopWidth} relative z-70`}>
                        <div
                            className={`absolute right-2 top-2 py-3 pl-3 pr-5
                flex flex-col rounded-xl border border-tertiary/20
                shadow-[0_2px_4px_0] shadow-themewhite2/20 backdrop-blur-md bg-themewhite2/10
                transform-gpu overflow-hidden text-primary/80 text-sm
                origin-top-right transition-all duration-300 ease-out w-full h-auto
                ${isVisible
                                    ? "scale-100 opacity-100 translate-y-0"
                                    : "scale-95 opacity-0 -translate-y-2"
                                }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}