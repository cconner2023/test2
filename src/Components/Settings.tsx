import { useEffect, useState, useRef } from 'react';
import { X, Moon, Sun, Shield, HelpCircle } from 'lucide-react';

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
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Animate drawer open/close
    useEffect(() => {
        if (isVisible) {
            setDragOffset(0);
            // Small delay for animation
            setTimeout(() => setDrawerOpen(true), 10);
        } else {
            setDrawerOpen(false);
        }
    }, [isVisible]);

    // Handle drag start
    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        e.preventDefault();
        e.stopPropagation();
    };

    // Handle drag move
    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        // Only allow dragging downward
        if (deltaY > 0) {
            setDragOffset(deltaY);
        }

        e.preventDefault();
        e.stopPropagation();
    };

    // Handle drag end
    const handleDragEnd = () => {
        if (!isDragging) return;

        setIsDragging(false);

        // If dragged more than 100px, close the drawer
        if (dragOffset > 100) {
            handleClose();
        } else {
            // Animate back to position
            setDragOffset(0);
        }
    };

    const handleClose = () => {
        setDrawerOpen(false);
        setTimeout(onClose, 200);
    };

    const handleAction = (action: () => void, id: number) => {
        action();
        // Close settings if id > 1 (only Import Note at id=1 closes)
        if (id > 1) {
            handleClose();
        }
    };

    const voidAction = () => {
        // Do nothing for now
    };

    // Settings options
    const settingsOptions = [
        {
            icon: isDarkMode ? <Sun size={18} /> : <Moon size={18} />,
            label: 'Toggle Theme',
            action: onToggleTheme,
            color: 'text-primary',
            id: 0
        },
        {
            icon: <Shield size={18} />,
            label: 'Release Notes',
            action: voidAction,
            color: 'text-tertiary',
            id: 4
        },
        {
            icon: <HelpCircle size={18} />,
            label: 'Help & Support',
            action: voidAction,
            color: 'text-tertiary',
            id: 5
        }
    ];

    // Calculate backdrop opacity based on drag offset
    const backdropOpacity = Math.max(0.3 - (dragOffset / 500), 0);

    // For mobile view - iOS style drawer with draggable handle
    if (isMobile) {
        return (
            <>
                {/* Backdrop overlay */}
                {isVisible && (
                    <div
                        className="fixed inset-0 bg-black z-40 transition-opacity duration-300"
                        style={{
                            opacity: isDragging ? backdropOpacity : (drawerOpen ? 0.3 : 0)
                        }}
                        onClick={handleClose}
                    />
                )}

                {/* Drawer - Almost full screen with top spacing */}
                <div
                    ref={drawerRef}
                    className={`fixed left-0 right-0 z-50 bg-themewhite3 shadow-lg transform transition-transform duration-300 ease-out ${isDragging ? '' : (drawerOpen ? 'translate-y-0' : 'translate-y-full')
                        }`}
                    style={{
                        height: 'calc(100vh - 0.6rem)',
                        top: '0.6rem',
                        borderTopLeftRadius: '2rem',
                        borderTopRightRadius: '2rem',
                        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
                        transform: isDragging ? `translateY(${dragOffset}px)` :
                            drawerOpen ? 'translate-y-0' : 'translate-y-full',
                    }}
                >
                    {/* iOS Drag Handle/Notch - Enhanced for dragging */}
                    <div
                        className="flex justify-center pt-3 pb-1 active:cursor-grab"
                        onTouchStart={handleDragStart}
                        onTouchMove={handleDragMove}
                        onTouchEnd={handleDragEnd}
                        onMouseDown={handleDragStart}
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        style={{ touchAction: 'none' }}
                    >
                        <div className="w-12 h-1.5 bg-tertiary/30 rounded-full transition-all duration-200 hover:h-2 active:h-2 active:w-14" />
                    </div>

                    {/* Header with iOS Liquid Glass Close Button */}
                    <div className="relative flex items-center justify-center px-5 py-4 border-b border-tertiary/10">
                        {/* Centered title */}
                        <h2 className="text-lg font-semibold text-primary">Settings</h2>

                        {/* iOS Liquid Glass Close Button */}
                        <button
                            onClick={handleClose}
                            className="absolute right-4 p-2 rounded-full hover:bg-themewhite2 transition-colors"
                            aria-label="Close settings"
                        >
                            <X size={20} className="text-tertiary" />
                        </button>
                    </div>

                    {/* Settings List */}
                    <div className="overflow-y-auto space-y-2 px-2 py-2" style={{ height: 'calc(100vh - 2rem - 110px)' }}>
                        {settingsOptions.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAction(option.action, option.id)}
                                className="flex items-center w-full px-4 py-3 hover:bg-themewhite2 active:bg-themewhite2/70 transition-colors rounded-lg"
                            >
                                <div className={`mr-3 ${option.color}`}>{option.icon}</div>
                                <span className="flex-1 text-left text-sm text-primary font-normal">
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Version info at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-tertiary/10 bg-themewhite">
                        <div className="text-center">
                            <p className="text-sm text-tertiary/60">Version 2.6.0</p>
                            <p className="text-xs text-tertiary/40 mt-2">ADTMC MEDCOM PAM 40-7-21</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // For desktop view - regular settings page with absolute positioning
    return (
        <div className="absolute inset-0 z-50 bg-themewhite">
            <div className="h-full w-full animate-AppearIn">
                <div className="bg-themewhite rounded-lg p-6 max-w-2xl mx-auto">
                    {/* Header */}
                    <button
                        onClick={handleClose}
                        className="absolute right-4 p-2 rounded-full hover:bg-themewhite2 transition-colors"
                        aria-label="Close settings"
                    >
                        <X size={20} className="text-tertiary" />
                    </button>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {settingsOptions.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAction(option.action, option.id)}
                                className="flex flex-col items-center justify-center p-6 bg-themewhite2 rounded-xl hover:bg-themewhite2/80 transition-all active:scale-95"
                            >
                                <div className={`mb-3 ${option.color}`}>{option.icon}</div>
                                <span className="text-sm font-medium text-primary">{option.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Version info */}
                    <div className="mt-12 pt-6 border-t border-tertiary/10">
                        <div className="text-center">
                            <p className="text-sm text-tertiary/60">Version 2.6.0</p>
                            <p className="text-xs text-tertiary/40 mt-2">ADTMC MEDCOM PAM 40-7-21</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};