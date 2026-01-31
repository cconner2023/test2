import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp } from 'lucide-react';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
}: SettingsDrawerProps) => {
    const [isMobile, setIsMobile] = useState(false);
    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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

    // Handle drag move - FIXED: Drag DOWN to close
    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current; // FIXED: Positive = dragging DOWN

        // Calculate velocity
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
            velocityRef.current = (clientY - lastYRef.current) / deltaTime;
        }

        lastYRef.current = clientY;
        lastTimeRef.current = currentTime;

        // FIXED: Dragging DOWN reduces position (closes drawer)
        const dragSensitivity = 0.8;
        const newPosition = Math.min(100, Math.max(0, dragStartPosition.current - (deltaY * dragSensitivity)));

        setDrawerPosition(newPosition);

        e.preventDefault();
        e.stopPropagation();
    };

    // Handle drag end with momentum - FIXED
    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;

        setIsDragging(false);

        // FIXED: Positive velocity = dragging down (should close)
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

    // Settings options
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

    // Mobile Drawer
    if (isMobile) {
        const translateY = 100 - drawerPosition;
        const opacity = Math.min(1, drawerPosition / 60 + 0.2);

        return (
            <div
                ref={drawerRef}
                className={`fixed left-0 right-0 z-40 bg-themewhite3 shadow-2xl ${isDragging ? '' : 'transition-all duration-200 ease-out'
                    }`}
                style={{
                    height: '99vh',
                    maxHeight: '100vh',
                    bottom: 0,
                    transform: `translateY(${translateY}vh)`,
                    opacity: opacity,
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
                {/* Drag Handle Area */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className={`w-14 h-1.5 rounded-full transition-all duration-150 ${isDragging ? 'bg-primary scale-110' : 'bg-tertiary/30'
                        }`} />
                </div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-tertiary/10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-primary">Settings</h2>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                            aria-label="Close"
                        >
                            <X size={24} className="text-tertiary" />
                        </button>
                    </div>
                </div>

                {/* Settings Content - Scrollable */}
                <div className="overflow-y-auto h-[calc(85vh-80px)]">
                    <div className="px-4 py-3">
                        <div className="space-y-1">
                            {settingsOptions.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        option.action();
                                        if (option.id > 1) handleClose();
                                    }}
                                    className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:bg-themewhite2/70 
                                             active:scale-[0.98] transition-all rounded-xl"
                                >
                                    <div className={`mr-4 ${option.color}`}>{option.icon}</div>
                                    <span className="flex-1 text-left text-base text-primary font-medium">
                                        {option.label}
                                    </span>
                                    <ChevronUp size={16} className="text-tertiary/40 rotate-90" />
                                </button>
                            ))}
                        </div>

                        {/* Version Info */}
                        <div className="mt-8 pt-6 border-t border-tertiary/10">
                            <div className="text-center">
                                <p className="text-sm text-tertiary/60 font-medium">Version 2.6.0</p>
                                <p className="text-xs text-tertiary/40 mt-1">ADTMC MEDCOM PAM 40-7-21</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Desktop Modal - Using the same pattern as SideMenu
    return (
        <>
            {/* Desktop Modal Container - Always rendered, visibility controlled by classes */}
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-out ${isVisible
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            >
                {/* Modal Content - Using the same animation pattern as SideMenu */}
                <div
                    className={`border border-tertiary/20 shadow-[0_2px_4px_0] shadow-themewhite2/20 backdrop-blur-md bg-themewhite2/10 transform-gpu overflow-hidden text-primary/80 rounded-2xl max-w-md w-full transform transition-all duration-300 ease-out ${isVisible
                        ? 'translate-y-0 scale-100 opacity-100'
                        : 'translate-y-4 scale-70 opacity-0'
                        }`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        transformOrigin: 'top right'
                    }}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-tertiary/10">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-primary">Settings</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-themewhite active:scale-95 transition-all"
                                aria-label="Close"
                            >
                                <X size={24} className="text-tertiary" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 gap-3">
                            {settingsOptions.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        option.action();
                                        if (option.id > 1) onClose();
                                    }}
                                    className="flex items-center px-5 py-4 hover:bg-themewhite2 active:scale-[0.98] 
                                             transition-all rounded-xl group"
                                >
                                    <div className={`mr-4 ${option.color} group-hover:scale-110 transition-transform`}>
                                        {option.icon}
                                    </div>
                                    <span className="flex-1 text-left text-lg text-primary font-medium">
                                        {option.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Version Info */}
                        <div className="mt-10 pt-6 border-t border-tertiary/10">
                            <div className="text-center">
                                <p className="text-base text-tertiary/60 font-medium">Version 2.6.0</p>
                                <p className="text-sm text-tertiary/40 mt-1">ADTMC MEDCOM PAM 40-7-21</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};