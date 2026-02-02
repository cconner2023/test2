import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp } from 'lucide-react';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
}

interface SettingsContentProps {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
}

// Single SettingsContent component that uses Tailwind responsive classes
const SettingsContent = ({ settingsOptions, onItemClick }: SettingsContentProps) => (
    <>
        {/* Drag Handle - Only visible on mobile */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
            <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
        </div>

        {/* Header - Responsive sizing */}
        <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-primary md:text-2xl">Settings</h2>
                <button
                    onClick={() => onItemClick(-1)}
                    className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all"
                    aria-label="Close"
                >
                    <X size={24} className="text-tertiary" />
                </button>
            </div>
        </div>

        {/* Content Area - Different layout for mobile/desktop */}
        <div className="overflow-y-auto h-[calc(85vh-80px)] md:overflow-visible md:h-auto">
            <div className="px-4 py-3 md:p-6">
                {/* Mobile: space-y-1, Desktop: grid gap-3 */}
                <div className="space-y-1 md:grid md:grid-cols-1 md:gap-3">
                    {settingsOptions.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                option.action();
                                onItemClick(option.id);
                            }}
                            className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98] 
                                     transition-all rounded-xl group
                                     md:px-5 md:py-4"
                        >
                            <div className={`mr-4 ${option.color} md:group-hover:scale-110 md:transition-transform`}>
                                {option.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium md:text-lg">
                                {option.label}
                            </span>
                            {/* Chevron - Only on mobile */}
                            <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                        </button>
                    ))}
                </div>

                {/* Version Info - Responsive text sizes */}
                <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60 font-medium md:text-base">Version 2.6.0</p>
                        <p className="text-xs text-tertiary/40 mt-1 md:text-sm">ADTMC MEDCOM PAM 40-7-21</p>
                    </div>
                </div>
            </div>
        </div>
    </>
);

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    isMobile: externalIsMobile,
}: SettingsDrawerProps) => {
    // Use external isMobile if provided, otherwise fallback to local detection
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile !== undefined ? externalIsMobile : localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    // Check if mobile (only if not provided externally)
    useEffect(() => {
        if (externalIsMobile === undefined) {
            const checkMobile = () => setLocalIsMobile(window.innerWidth < 768);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, [externalIsMobile]);

    // Handle visibility changes
    useEffect(() => {
        if (isVisible) {
            setDrawerPosition(100);
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerPosition(0);
            document.body.style.overflow = '';
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = 0;
            }
        };
    }, [isVisible]);

    // Smooth animation function
    const animateToPosition = useCallback((targetPosition: number) => {
        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = 300;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    setTimeout(onClose, 50);
                }
            }
        };

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    // Handle drag start
    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile) return;

        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        dragStartPosition.current = drawerPosition;
        lastYRef.current = clientY;
        lastTimeRef.current = performance.now();
        velocityRef.current = 0;

        e.stopPropagation();
    };

    // Handle drag move
    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        // Calculate velocity
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
            velocityRef.current = (clientY - lastYRef.current) / deltaTime;
        }

        lastYRef.current = clientY;
        lastTimeRef.current = currentTime;

        const dragSensitivity = 0.8;
        const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * dragSensitivity)));

        setDrawerPosition(newPosition);

        e.preventDefault();
        e.stopPropagation();
    };

    // Handle drag end with momentum
    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;

        setIsDragging(false);

        const shouldClose = velocityRef.current > 0.3 || drawerPosition < 40;
        const shouldOpen = velocityRef.current < -0.3 || drawerPosition > 60;

        if (shouldClose) {
            animateToPosition(0);
        } else if (shouldOpen) {
            animateToPosition(100);
        } else {
            animateToPosition(drawerPosition > 50 ? 100 : 0);
        }
    };

    // Handle close with animation
    const handleClose = () => {
        animateToPosition(0);
    };

    // Handle item clicks
    const handleItemClick = (id: number) => {
        if (id > 1 || id === -1) {
            if (isMobile) {
                handleClose();
            } else {
                onClose();
            }
        }
    };

    // Settings options (shared between mobile and desktop)
    const settingsOptions = [
        {
            icon: isDarkMode ? <Sun size={20} /> : <Moon size={20} />,
            label: 'Toggle Theme',
            action: onToggleTheme,
            color: 'text-primary',
            id: 0
        },
        {
            icon: <Shield size={20} />,
            label: 'Release Notes',
            action: () => null,
            color: 'text-tertiary',
            id: 4
        },
        {
            icon: <HelpCircle size={20} />,
            label: 'Help & Support',
            action: () => null,
            color: 'text-tertiary',
            id: 5
        }
    ];

    // Mobile drawer styles
    const mobileTranslateY = 100 - drawerPosition;
    const mobileOpacity = Math.min(1, drawerPosition / 60 + 0.2);

    // Shared content props
    const contentProps = {
        settingsOptions,
        onItemClick: handleItemClick
    };

    return (
        <>
            {/* Mobile Container */}
            <div
                ref={drawerRef}
                className="md:hidden"
            >
                <div
                    className={`fixed left-0 right-0 z-40 bg-themewhite3 shadow-2xl ${isDragging ? '' : 'transition-all duration-200 ease-out'
                        }`}
                    style={{
                        height: '99vh',
                        maxHeight: '100vh',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}vh)`,
                        opacity: mobileOpacity,
                        borderTopLeftRadius: '1.5rem',
                        borderTopRightRadius: '1.5rem',
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
                        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.15)',
                    }}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                >
                    <SettingsContent {...contentProps} />
                </div>
            </div>

            {/* Desktop Container */}
            <div className="hidden md:block">
                <div
                    className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-out ${isVisible
                        ? 'visible pointer-events-auto'
                        : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    <div
                        className={`fixed right-16 top-15 z-50 py-3 pl-3 pr-5 
                        flex flex-col rounded-xl
                        border border-tertiary/20 
                        shadow-[0_2px_4px_0] shadow-themewhite2/20
                        backdrop-blur-md bg-themewhite2/10
                        transform-gpu
                        overflow-hidden
                        text-primary/80 text-sm
                        origin-top-right
                        transition-all duration-300 ease-out
                        max-w-md 
                        w-full 
                        ${isVisible
                                ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                : "opacity-0 scale-x-20 scale-y-20 -translate-x-10 -translate-y-2 pointer-events-none"
                            }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SettingsContent {...contentProps} />
                    </div>
                </div>
            </div>
        </>
    );
};