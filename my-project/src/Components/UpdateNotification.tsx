// Components/UpdateNotification.tsx
import React, { useEffect, useState } from 'react';
import { X, Download, Wifi, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../Hooks/useServiceWorker';

const UpdateNotification: React.FC = () => {
    const {
        updateAvailable,
        offlineReady,
        skipWaiting,
        dismissUpdate,
        isUpdating,
        appVersion
    } = useServiceWorker();

    const [isVisible, setIsVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [showOfflineToast, setShowOfflineToast] = useState(false);

    useEffect(() => {
        // Load dismissed state from localStorage (timestamp-based, 1-hour expiry)
        try {
            const dismissedState = localStorage.getItem('updateDismissed');
            if (dismissedState) {
                const dismissedAt = parseInt(dismissedState, 10);
                if (!isNaN(dismissedAt) && Date.now() - dismissedAt < 60 * 60 * 1000) {
                    setDismissed(true);
                } else {
                    // Expired — clean up stale flag
                    localStorage.removeItem('updateDismissed');
                }
            }
        } catch {
            // localStorage unavailable — treat as not dismissed
        }
    }, []);

    useEffect(() => {
        // Show update notification
        if (updateAvailable && !dismissed) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [updateAvailable, dismissed]);

    useEffect(() => {
        // Show offline ready toast briefly
        if (offlineReady) {
            setShowOfflineToast(true);
            const timer = setTimeout(() => setShowOfflineToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [offlineReady]);

    const handleUpdate = () => {
        skipWaiting();
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setDismissed(true);
        dismissUpdate();
    };

    // Offline ready toast - theme-responsive
    if (showOfflineToast && !isVisible) {
        return (
            <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pointer-events-none animate-slideInUp">
                <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 px-6 py-4 flex items-center gap-3 pointer-events-auto backdrop-blur-xl">
                    <div className="w-10 h-10 rounded-full bg-themegreen/15 flex items-center justify-center flex-shrink-0">
                        <Wifi className="h-5 w-5 text-themegreen" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-primary">Ready for Offline Use</p>
                        <p className="text-xs text-tertiary/60">App cached successfully</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            {/* Subtle backdrop on mobile */}
            <div
                className="absolute inset-0 bg-black/10 pointer-events-auto sm:bg-black/15 transition-opacity"
                onClick={handleDismiss}
            />
            {/* Notification card */}
            <div className="relative w-full sm:w-auto sm:max-w-sm mx-0 sm:mx-4 mb-0 sm:mb-0 pointer-events-auto animate-slideInUp">
                <div className="bg-themewhite rounded-t-2xl sm:rounded-2xl shadow-2xl border border-tertiary/10 overflow-hidden backdrop-blur-xl">
                    {/* Accent bar at top */}
                    <div className="h-1 bg-themeblue2" />

                    <div className="px-5 py-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-themeblue2/15 flex items-center justify-center flex-shrink-0">
                                    <Download className="h-5 w-5 text-themeblue2" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Update Available</p>
                                    <p className="text-xs text-tertiary mt-0.5">
                                        Version {appVersion} is ready to install
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 rounded-lg hover:bg-themewhite2 active:scale-95 transition-all text-tertiary"
                                aria-label="Dismiss update notification"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2.5 mt-4">
                            <button
                                onClick={handleDismiss}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-tertiary bg-themewhite2 hover:bg-themegray1/40 active:scale-[0.97] transition-all"
                            >
                                Later
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={isUpdating}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-themeblue2 hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUpdating ? (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-3.5 w-3.5" />
                                        Update Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;
