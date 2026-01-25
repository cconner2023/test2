// UpdateNotification.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../Hooks/useServiceWorker';

const UpdateNotification: React.FC = () => {
    const { updateAvailable, skipWaiting, dismissUpdate } = useServiceWorker();
    const [isVisible, setIsVisible] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Check if user dismissed the notification recently (within 24 hours)
    const isDismissedRecently = useCallback(() => {
        const dismissedTime = localStorage.getItem('updateDismissed');
        if (!dismissedTime) return false;

        const timeDiff = Date.now() - parseInt(dismissedTime);
        // Show again after 24 hours
        return timeDiff < 24 * 60 * 60 * 1000;
    }, []);

    useEffect(() => {
        if (updateAvailable && !isDismissedRecently()) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [updateAvailable, isDismissedRecently]);

    const handleUpdate = () => {
        setIsUpdating(true);
        skipWaiting();

        // Show updating state for a moment before reload
        setTimeout(() => {
            // The page will reload when the new service worker activates
        }, 1500);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        dismissUpdate();
        localStorage.setItem('updateDismissed', Date.now().toString());
    };

    const handleRemindLater = () => {
        setIsVisible(false);
        // Set reminder for 1 hour later
        localStorage.setItem('updateDismissed', Date.now().toString());

        // Auto-show again after 1 hour
        setTimeout(() => {
            localStorage.removeItem('updateDismissed');
            if (updateAvailable) {
                setIsVisible(true);
            }
        }, 60 * 60 * 1000);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideInUp">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4 text-white shadow-xl">
                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                <div className="bg-white/20 p-2 rounded-full">
                                    {isUpdating ? (
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Download className="h-5 w-5" />
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-lg">Update Available</p>
                                <p className="text-sm opacity-90 mt-1">
                                    {isUpdating
                                        ? 'Applying updates...'
                                        : 'A new version is ready. Update to get the latest features and fixes.'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {!isUpdating && (
                                <button
                                    onClick={handleRemindLater}
                                    className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition"
                                >
                                    Remind Later
                                </button>
                            )}

                            {isUpdating ? (
                                <button
                                    disabled
                                    className="px-6 py-2 bg-white/30 text-white font-medium rounded-lg cursor-not-allowed"
                                >
                                    Updating...
                                </button>
                            ) : (
                                <button
                                    onClick={handleUpdate}
                                    className="px-6 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition shadow-md"
                                >
                                    Update Now
                                </button>
                            )}

                            {!isUpdating && (
                                <button
                                    onClick={handleDismiss}
                                    className="p-2 hover:bg-white/10 rounded-full transition"
                                    aria-label="Dismiss"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;