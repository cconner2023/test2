// components/BaseDrawer.tsx
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { X, ChevronLeft } from 'lucide-react';
import { HeaderPill, PillButton } from './HeaderPill';
import { GESTURE_THRESHOLDS, clamp } from '../Utilities/GestureUtils';
import { DRAWER_TIMING } from '../Utilities/constants';
import { useIsMobile } from '../Hooks/useIsMobile';

/** Render prop type: children can receive handleClose for animated close */
type DrawerRenderProp = (handleClose: () => void) => ReactNode;

/** Configuration for the optional built-in drawer header */
export interface DrawerHeaderConfig {
    title: string;
    showBack?: boolean;
    onBack?: () => void;
    badge?: string;
    /** Optional content rendered before the back button / title on the left */
    leftContent?: ReactNode;
    /** Optional content rendered on the right side of the header (before the close button) */
    rightContent?: ReactNode;
    /** When true, the built-in close button is hidden (rightContent handles closing) */
    hideDefaultClose?: boolean;
    /** When true, rightContent fills the header width (title collapses) */
    rightContentFill?: boolean;
    /** Optional progress indicator rendered below the title row */
    progressDots?: ReactNode;
}

/** Private header component rendered by BaseDrawer when header config is provided */
function DrawerHeader({
    title,
    showBack = false,
    onBack,
    badge,
    leftContent,
    rightContent,
    hideDefaultClose = false,
    rightContentFill = false,
    progressDots,
    onClose,
    isMobile,
    headerFaded,
    blurMode = false,
}: DrawerHeaderConfig & { onClose: () => void; isMobile: boolean; headerFaded?: boolean; blurMode?: boolean }) {
    return (
        <div className={blurMode ? '' : 'shrink-0'}>
            {/* Drag handle — always visible on mobile */}
            {isMobile && (
                <div className="flex justify-center pt-1.5 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
                    <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                </div>
            )}
            {/* Collapsible title row */}
            <div
                className="overflow-hidden"
                data-drag-zone
                style={{
                    touchAction: 'none',
                    maxHeight: headerFaded ? 0 : 120,
                    opacity: headerFaded ? 0 : 1,
                    transform: headerFaded ? 'scale(0.97)' : 'scale(1)',
                    transition: 'max-height 300ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 200ms ease-out, transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    transformOrigin: 'top center',
                }}
            >
                <div className={`px-5 ${isMobile ? 'pb-2' : 'py-2.5'} ${headerFaded || blurMode ? '' : 'border-b border-tertiary/10'}`}>
                    <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-2 min-w-0 transition-all duration-200${rightContentFill ? ' w-0 overflow-hidden' : ''}`}>
                            {leftContent && <div className="shrink-0">{leftContent}</div>}
                            <div
                                className="shrink-0 overflow-hidden transition-all duration-200"
                                style={{
                                    width: showBack && onBack ? (isMobile ? 45 : 36) : 0,
                                    opacity: showBack && onBack ? 1 : 0,
                                }}
                            >
                                <HeaderPill>
                                    <PillButton icon={ChevronLeft} onClick={onBack!} label="Go back" compact={!isMobile} />
                                </HeaderPill>
                            </div>
                            <h2 className={`truncate ${isMobile ? 'text-[17px] font-semibold text-primary' : 'text-[15px] font-medium text-primary'}`}>
                                {title}
                            </h2>
                            {badge && (
                                <span className="text-[11px] font-semibold text-themeyellow bg-themeyellow/15 px-2 py-0.5 rounded-full shrink-0 tracking-wide">
                                    {badge}
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-2${rightContentFill ? ' flex-1 min-w-0' : rightContent ? ' flex-1 min-w-0 justify-end' : ' shrink-0'}`}>
                            {rightContent}
                            {!hideDefaultClose && (
                                <HeaderPill>
                                    <PillButton icon={X} onClick={onClose} label="Close" />
                                </HeaderPill>
                            )}
                        </div>
                    </div>
                    {progressDots}
                </div>
            </div>
        </div>
    );
}

interface BaseDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    /** Children can be ReactNode or a render function receiving handleClose */
    children: ReactNode | DrawerRenderProp;
    fullHeight?: string;
    disableDrag?: boolean;
    /** Backdrop opacity at full visibility. Default 0.3 */
    backdropOpacity?: number;
    /** Desktop panel column. 'right' overlays Column B (55%), 'left' overlays Column A (45%). Default 'right' */
    desktopPosition?: 'left' | 'right';
    /** If true, only render mobile drawer (no desktop modal). Default false */
    mobileOnly?: boolean;
    /** Extra className for the mobile drawer container */
    mobileClassName?: string;
    /** z-index class for mobile backdrop and drawer. Default 'z-60' */
    zIndex?: string;
    /** Override the desktop panel width class (e.g. 'w-[70%]'). When omitted,
     *  width is derived from desktopPosition (left=45%, right=55%). */
    desktopWidth?: string;
    /** Optional header config. When provided, BaseDrawer renders a standardized
     *  header with drag handle (mobile), title, back button (optional), and
     *  close button (always). Children render below the header. */
    header?: DrawerHeaderConfig;
    /** When true, mobile drawer expands to 100dvh with no border-radius,
     *  drag is disabled, and the built-in header is hidden (children provide their own). */
    mobileFullScreen?: boolean;
    /** When true, the drawer transforms into a compact card pushed upward,
     *  leaving the bottom portion of the column free for companion content. */
    cardMode?: boolean;
    /** When true on mobile, the drawer floats as an inset card with margin,
     *  full border-radius, and elevated shadow instead of sitting flush at the bottom. */
    mobileFloating?: boolean;
    /** When true, fades the DrawerHeader content row (title, buttons) while keeping the drag handle visible. */
    headerFaded?: boolean;
    /** When true, header floats over content with backdrop blur — content scrolls behind it. */
    blurHeader?: boolean;
}

export function BaseDrawer({
    isVisible,
    onClose,
    children,
    fullHeight = '90dvh',
    disableDrag = false,
    backdropOpacity = 0.95,
    desktopPosition = 'right',
    mobileOnly = false,
    mobileClassName = '',
    zIndex = 'z-60',
    desktopWidth,
    header,
    mobileFullScreen = false,
    cardMode = false,
    mobileFloating = false,
    headerFaded = false,
    blurHeader = false,
}: BaseDrawerProps) {
    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [desktopOpen, setDesktopOpen] = useState(false);

    const isMobile = useIsMobile();

    const useMobileLayout = mobileOnly || isMobile;

    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const timeoutRef = useRef<number | null>(null);
    const desktopOpenRef = useRef<number>(0);

    useEffect(() => {
        if (isVisible) {
            setIsMounted(true);
            setDrawerPosition(0);
            document.body.style.overflow = 'hidden';

            // Animate mobile drawer in (desktop ignores drawerPosition)
            setTimeout(() => {
                setDrawerPosition(100);
            }, DRAWER_TIMING.OPEN_DELAY);

            // Desktop: delay open state so the closed frame renders first,
            // allowing the CSS transition to animate.
            desktopOpenRef.current = window.setTimeout(() => {
                setDesktopOpen(true);
            }, DRAWER_TIMING.OPEN_DELAY);
        } else {
            // Start closing animation
            setDrawerPosition(0);
            setDesktopOpen(false);

            timeoutRef.current = setTimeout(() => {
                setIsMounted(false);
                document.body.style.overflow = '';
            }, DRAWER_TIMING.TRANSITION); // Match animation duration
        }

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (closeDelayRef.current) clearTimeout(closeDelayRef.current);
            if (desktopOpenRef.current) clearTimeout(desktopOpenRef.current);
        };
    }, [isVisible]);

    const closeDelayRef = useRef<number>(0);

    const animateToPosition = useCallback((targetPosition: number) => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }

        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = DRAWER_TIMING.TRANSITION;

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
                    }, DRAWER_TIMING.CLOSE_UNMOUNT_DELAY);
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
            enabled: !disableDrag && !(useMobileLayout && mobileFullScreen),
            axis: 'y',
            filterTaps: true,
            pointer: { touch: true },
        }
    );

    // Mobile: animated slide-down close; Desktop: immediate close
    const mobileHandleClose = useCallback(() => {
        animateToPosition(0);
    }, [animateToPosition]);

    const desktopHandleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    // Stable close handler that always dispatches to the current layout's handler
    const closeHandlerRef = useRef(mobileHandleClose);
    closeHandlerRef.current = useMobileLayout ? mobileHandleClose : desktopHandleClose;
    const handleClose = useCallback(() => { closeHandlerRef.current(); }, []);

    // Desktop column overlay — position and width based on target column
    const desktopAlignClass = desktopPosition === 'left' ? 'left-0' : 'right-0';
    const desktopWidthClass = desktopWidth ?? (desktopPosition === 'left' ? 'w-[45%]' : 'w-[55%]');

    // Resolve children ONCE — single React tree, no duplicate component instances
    const resolvedChildren = typeof children === 'function'
        ? (children as DrawerRenderProp)(handleClose)
        : children;

    if (!isMounted && !isVisible) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 ${zIndex} bg-black ${
                    useMobileLayout
                        ? (isDragging ? '' : 'transition-opacity duration-300 ease-out')
                        : 'transition-opacity duration-250 ease-out'
                }`}
                style={{
                    opacity: useMobileLayout
                        ? (drawerPosition / 100) * backdropOpacity
                        : desktopOpen ? 0.2 : 0,
                    pointerEvents: useMobileLayout
                        ? (drawerPosition > 0 ? 'auto' : 'none')
                        : (desktopOpen ? 'auto' : 'none'),
                }}
                onClick={handleClose}
            />

            {/* Drawer / Panel — single container that adapts to viewport */}
            <div
                className={useMobileLayout
                    ? `fixed ${mobileFloating ? 'left-3 right-3' : 'left-0 right-0'} ${zIndex} bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'} ${mobileClassName} ${header ? 'flex flex-col' : ''}`
                    : `absolute ${desktopAlignClass} top-0 ${desktopWidthClass} ${zIndex}
                        flex flex-col rounded-md border border-tertiary/20
                        shadow-lg shadow-black/8 backdrop-blur-xl bg-themewhite3/95
                        transform-gpu overflow-hidden text-primary/80 text-sm`
                }
                style={useMobileLayout ? {
                    height: cardMode ? '35dvh' : (mobileFullScreen ? '100dvh' : fullHeight),
                    maxHeight: cardMode ? '35dvh' : (mobileFullScreen ? '100dvh' : fullHeight),
                    width: mobileFloating ? undefined : '100%',
                    bottom: cardMode ? '55dvh' : (mobileFloating ? 12 : 0),
                    transform: `translateY(${100 - drawerPosition}%)`,
                    opacity: Math.min(1, drawerPosition / 60 + 0.2),
                    borderRadius: (cardMode || mobileFloating) ? '1.25rem' : (mobileFullScreen ? '0' : '1.25rem 1.25rem 0 0'),
                    willChange: isDragging ? 'transform' : 'auto',
                    boxShadow: (cardMode || mobileFloating)
                        ? '0 4px 30px rgba(0, 0, 0, 0.12)'
                        : (mobileFullScreen ? 'none' : '0 -4px 20px rgba(0, 0, 0, 0.1)'),
                    overflow: 'hidden',
                    visibility: isMounted ? 'visible' : 'hidden',
                } : {
                    bottom: cardMode ? '60%' : 0,
                    transition: 'opacity 250ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 300ms cubic-bezier(0.32, 0.72, 0, 1), bottom 300ms cubic-bezier(0.32, 0.72, 0, 1)',
                    opacity: desktopOpen ? 1 : 0,
                    transform: desktopOpen ? 'scale(1)' : 'scale(0.95)',
                    transformOrigin: desktopPosition === 'left' ? 'top left' : 'top right',
                    pointerEvents: desktopOpen ? 'auto' : 'none',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={header?.title}
                {...(useMobileLayout && !header ? bindDrawerDrag() : {})}
                onClick={useMobileLayout ? undefined : (e) => e.stopPropagation()}
            >
                {header ? (
                    blurHeader && useMobileLayout ? (
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                            {!(mobileFullScreen && useMobileLayout) && (
                                <div
                                    className="sticky top-0 z-10 backdrop-blur-xs bg-transparent"
                                    {...bindDrawerDrag()}
                                >
                                    <DrawerHeader
                                        title={header.title}
                                        showBack={header.showBack}
                                        onBack={header.onBack}
                                        badge={header.badge}
                                        rightContent={header.rightContent}
                                        hideDefaultClose={header.hideDefaultClose}
                                        rightContentFill={header.rightContentFill}
                                        progressDots={header.progressDots}
                                        onClose={handleClose}
                                        isMobile={useMobileLayout}
                                        headerFaded={headerFaded}
                                        blurMode
                                    />
                                </div>
                            )}
                            {resolvedChildren}
                        </div>
                    ) : (
                        <>
                            {!(mobileFullScreen && useMobileLayout) && (
                                <div {...(useMobileLayout ? bindDrawerDrag() : {})}>
                                    <DrawerHeader
                                        title={header.title}
                                        showBack={header.showBack}
                                        onBack={header.onBack}
                                        badge={header.badge}
                                        rightContent={header.rightContent}
                                        hideDefaultClose={header.hideDefaultClose}
                                        rightContentFill={header.rightContentFill}
                                        progressDots={header.progressDots}
                                        onClose={handleClose}
                                        isMobile={useMobileLayout}
                                        headerFaded={headerFaded}
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                                {resolvedChildren}
                            </div>
                        </>
                    )
                ) : resolvedChildren}
            </div>
        </>
    );
}
