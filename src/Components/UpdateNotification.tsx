// Components/UpdateNotification.tsx
import React, { useEffect, useState } from 'react';
import { X, Download, Wifi } from 'lucide-react';
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
        // Load dismissed state from localStorage
        const dismissedState = localStorage.getItem('updateDismissed');
        if (dismissedState) {
            setDismissed(true);
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

    // Offline ready toast
    if (showOfflineToast && !isVisible) {
        return (
            <div className="fixed inset-x-0 bottom-0 z-50 animate-slideInUp">
                <div className="bg-green-600 px-4 py-3 text-white shadow-lg">
                    <div className="flex items-center justify-center space-x-3">
                        <Wifi className="h-5 w-5" />
                        <p className="font-medium">App ready for offline use</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isVisible || isUpdating) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideInUp">
            <div className="bg-blue-600 px-4 py-3 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Download className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Update Available</p>
                            <p className="text-sm opacity-90">
                                New version v{appVersion} is ready to install
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleUpdate}
                            className="rounded bg-white px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                            disabled={isUpdating}
                        >
                            {isUpdating ? 'Updating...' : 'Update Now'}
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="rounded px-3 py-2 text-sm font-medium hover:bg-blue-500"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;
