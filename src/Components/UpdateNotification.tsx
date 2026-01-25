// Components/UpdateNotification.tsx
import React, { useEffect, useState } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../Hooks/useServiceWorker';

const UpdateNotification: React.FC = () => {
    const {
        updateAvailable,
        contentUpdated,
        updatedUrl,
        skipWaiting,
        reloadForContentUpdate,
        isUpdating
    } = useServiceWorker();

    const [isVisible, setIsVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [notificationType, setNotificationType] = useState<'app' | 'content' | null>(null);

    useEffect(() => {
        // Load dismissed state from localStorage
        const dismissedState = localStorage.getItem('updateDismissed');
        if (dismissedState) {
            setDismissed(JSON.parse(dismissedState));
        }
    }, []);

    useEffect(() => {
        // Handle content updates first (they're more immediate)
        if (contentUpdated && !dismissed) {
            setNotificationType('content');
            setIsVisible(true);
        }
        // Then handle app updates
        else if (updateAvailable && !dismissed) {
            setNotificationType('app');
            setIsVisible(true);
        } else {
            setIsVisible(false);
            setNotificationType(null);
        }
    }, [updateAvailable, contentUpdated, dismissed]);

    const handleAppUpdate = () => {
        skipWaiting();
        localStorage.removeItem('updateDismissed');
    };

    const handleContentUpdate = () => {
        reloadForContentUpdate();
        localStorage.removeItem('updateDismissed');
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setDismissed(true);
        localStorage.setItem('updateDismissed', 'true');

        // Auto-remove dismissal after 1 hour
        setTimeout(() => {
            localStorage.removeItem('updateDismissed');
            setDismissed(false);
        }, 60 * 60 * 1000);
    };

    if (!isVisible || isUpdating) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideInUp">
            {notificationType === 'app' ? (
                <div className="bg-blue-600 px-4 py-3 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Download className="h-5 w-5" />
                            <div>
                                <p className="font-medium">App Update Available</p>
                                <p className="text-sm opacity-90">A new version of ADTMC is ready</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleAppUpdate}
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
            ) : notificationType === 'content' ? (
                <div className="bg-green-600 px-4 py-3 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <RefreshCw className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Content Updated</p>
                                <p className="text-sm opacity-90">
                                    {updatedUrl ? `Updated: ${updatedUrl.split('/').pop()}` : 'New content is available'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleContentUpdate}
                                className="rounded bg-white px-4 py-2 text-sm font-medium text-green-600 transition hover:bg-green-50"
                            >
                                Reload Now
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="rounded px-3 py-2 text-sm font-medium hover:bg-green-500"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default UpdateNotification;