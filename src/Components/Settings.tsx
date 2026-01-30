// Components/SettingsDrawer.tsx
import { useEffect, useState } from 'react';
import { X, Moon, Sun, Download, Shield, Bell, HelpCircle } from 'lucide-react';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onImportClick: () => void;
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    onImportClick,
}: SettingsDrawerProps) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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
            // Small delay for animation
            setTimeout(() => setDrawerOpen(true), 10);
        } else {
            setDrawerOpen(false);
        }
    }, [isVisible]);

    const handleClose = () => {
        setDrawerOpen(false);
        setTimeout(onClose, 300); // Wait for animation to complete
    };

    const handleAction = (action: () => void, id: number) => {
        action();
        if (id = 1) {
            handleClose()
        }
    };

    const voidAction = () => {
        null
    }

    // Settings options
    const settingsOptions = [
        {
            icon: isDarkMode ? <Sun size={18} /> : <Moon size={18} />,
            label: isDarkMode ? 'Light Mode' : 'Dark Mode',
            action: onToggleTheme,
            color: 'text-primary',
            id: 0
        },
        {
            icon: <Download size={18} />,
            label: 'Import Note',
            action: onImportClick,
            color: 'text-primary',
            id: 1
        },
        {
            icon: <Shield size={18} />,
            label: 'Release Notes',
            action: voidAction,
            color: 'text-tertiary',
            id: 4
        },
        {
            icon: <Bell size={18} />,
            label: 'User Account',
            action: voidAction,
            color: 'text-tertiary',
            id: 3
        },
        {
            icon: <HelpCircle size={18} />,
            label: 'Help & Support',
            action: voidAction,
            color: 'text-tertiary',
            id: 5
        }
    ];

    // For mobile view - iOS style drawer
    if (isMobile) {
        return (
            <>
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${isVisible ? 'opacity-50' : 'opacity-0 pointer-events-none'
                        }`}
                    onClick={handleClose}
                />

                {/* Drawer */}
                <div
                    className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite rounded-t-2xl shadow-lg transform transition-transform duration-300 ease-out ${drawerOpen ? 'translate-y-0' : 'translate-y-full'
                        }`}
                    style={{
                        maxHeight: '85vh',
                    }}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1.5 bg-tertiary/20 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-tertiary/10">
                        <h2 className="text-lg font-semibold text-primary">Settings</h2>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-full hover:bg-themewhite2 transition-colors"
                            aria-label="Close settings"
                        >
                            <X size={20} className="text-tertiary" />
                        </button>
                    </div>

                    {/* Settings List */}
                    <div className="overflow-y-auto space-y-2 px-2 py-2" style={{ maxHeight: 'calc(85vh - 80px)' }}>
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
                                {option.label === 'Import Note' && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                        New
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Version info at bottom */}
                    <div className="px-5 py-4 border-t border-tertiary/10">
                        <div className="text-center">
                            <p className="text-xs text-tertiary/60">Version 1.0.0</p>
                            <p className="text-xs text-tertiary/40 mt-1">© 2024 Your App Name</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // For desktop view - regular settings page
    return (
        <div className="h-full w-full animate-AppearIn">
            <div className="bg-themewhite rounded-lg p-6 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-semibold text-primary">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-themewhite2 transition-colors"
                        aria-label="Close settings"
                    >
                        <X size={20} className="text-tertiary" />
                    </button>
                </div>

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
                            {option.label === 'Import Note' && (
                                <span className="mt-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                    New Feature
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Version info */}
                <div className="mt-12 pt-6 border-t border-tertiary/10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60">Version 1.0.0</p>
                        <p className="text-xs text-tertiary/40 mt-2">© 2024 Your App Name. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};