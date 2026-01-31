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
    const [isDragging, setIsDragging] = useState(false);
    const [drawerHeight, setDrawerHeight] = useState(0);
    const [velocity, setVelocity] = useState(0);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartTime = useRef(0);
    const lastY = useRef(0);
    const lastTime = useRef(0);
    const animationFrame = useRef(0);

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Reset drawer position when opened/closed
    useEffect(() => {
        if (isVisible) {
            setDrawerHeight(isMobile ? 85 : 100); // 85% height on mobile, full on desktop
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerHeight(0);
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, [isVisible, isMobile]);

    const handleClose = useCallback(() => {
        setDrawerHeight(0);
        setTimeout(onClose, 300);
    }, [onClose]);

    // Touch/Mouse handlers with momentum
    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile) return;

        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        dragStartTime.current = Date.now();
        lastY.current = clientY;
        lastTime.current = Date.now();

        e.stopPropagation();
    };

    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        // Calculate velocity for momentum
        const currentTime = Date.now();
        const deltaTime = currentTime - lastTime.current;
        if (deltaTime > 0) {
            const currentVelocity = (clientY - lastY.current) / deltaTime;
            setVelocity(currentVelocity * 100); // Scale for better sensitivity
        }

        lastY.current = clientY;
        lastTime.current = currentTime;

        // Only allow dragging downward (closing)
        if (deltaY > 0) {
            const newHeight = Math.max(85 - (deltaY / 10), 0); // Convert drag to height percentage
            setDrawerHeight(newHeight);
        }

        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;

        setIsDragging(false);

        // Apply momentum
        const momentum = velocity * 5; // Scale momentum

        if (momentum > 1.5 || drawerHeight < 70) {
            // Close with momentum or if dragged more than 15%
            handleClose();
        } else {
            // Snap back to original position
            setDrawerHeight(85);
        }

        setVelocity(0);
    };

    // Smooth animation for non-drag changes
    const animateHeight = useCallback((targetHeight: number) => {
        const startHeight = drawerHeight;
        const startTime = Date.now();
        const duration = 300;

        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentHeight = startHeight + (targetHeight - startHeight) * easeProgress;

            setDrawerHeight(currentHeight);

            if (progress < 1) {
                animationFrame.current = requestAnimationFrame(animate);
            }
        };

        animationFrame.current = requestAnimationFrame(animate);
    }, [drawerHeight]);

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
            action: () => window.open('https://github.com/your-repo/releases', '_blank'),
            color: 'text-tertiary',
            id: 4
        },
        {
            icon: <HelpCircle size={20} />,
            label: 'Help & Support',
            action: () => window.open('https://github.com/your-repo/issues', '_blank'),
            color: 'text-tertiary',
            id: 5
        }
    ];

    if (!isVisible && !isMobile) return null;

    // Mobile Drawer
    if (isMobile) {
        return (
            <>
                {/* Backdrop with fade effect */}
                <div
                    className={`fixed inset-0 z-[9998] transition-all duration-300 ${drawerHeight > 0 ? 'bg-black/30' : 'bg-transparent pointer-events-none'
                        }`}
                    style={{
                        opacity: drawerHeight / 85,
                    }}
                    onClick={handleClose}
                />

                {/* Drawer Container */}
                <div
                    ref={drawerRef}
                    className={`fixed z-[9999] bg-themewhite3 rounded-t-3xl shadow-2xl transition-all duration-300 ease-out ${isDragging ? '' : 'transform'
                        }`}
                    style={{
                        height: `${drawerHeight}vh`,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        transform: isDragging ? 'none' : `translateY(${100 - drawerHeight}vh)`,
                        touchAction: 'none',
                        willChange: 'transform, height',
                    }}
                >
                    {/* Drag Handle Area */}
                    <div
                        className="flex justify-center pt-3 pb-2 active:cursor-grab active:bg-themewhite2/50 rounded-t-3xl"
                        onTouchStart={handleDragStart}
                        onTouchMove={handleDragMove}
                        onTouchEnd={handleDragEnd}
                        onMouseDown={handleDragStart}
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                    >
                        <div className="w-14 h-1.5 bg-tertiary/30 rounded-full transition-all duration-200 active:scale-110 active:bg-tertiary/40" />
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

                    {/* Settings Content */}
                    <div className="overflow-y-auto h-[calc(100vh-140px)] px-4 py-3">
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
            </>
        );
    }

    // Desktop Modal
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9998] bg-black/30 animate-fadeIn"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div
                    className="bg-themewhite rounded-2xl shadow-2xl max-w-md w-full animate-slideUp"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-tertiary/10">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-primary">Settings</h2>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
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
                                        if (option.id > 1) handleClose();
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