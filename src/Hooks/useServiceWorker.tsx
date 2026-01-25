import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const swUrl = '/ADTMC/sw.js?v=2.6.1'; // Add version query string
            const scope = '/ADTMC/';

            navigator.serviceWorker
                .register(swUrl, { scope, updateViaCache: 'none' }) // Important for iOS
                .then((reg) => {
                    console.log('[App] Service Worker registered:', reg.scope);
                    setRegistration(reg);

                    // Handle updates
                    if (reg.waiting) {
                        console.log('[App] Update waiting');
                        setUpdateAvailable(true);
                    }

                    // Listen for installing service worker
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[App] New content is available');
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });

                    // Check for updates on page focus
                    const handleVisibilityChange = () => {
                        if (!document.hidden && reg) {
                            reg.update();
                        }
                    };

                    document.addEventListener('visibilitychange', handleVisibilityChange);
                    window.addEventListener('focus', handleVisibilityChange);

                    return () => {
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                        window.removeEventListener('focus', handleVisibilityChange);
                    };
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                    console.log('[App] Update detected from service worker');
                    setUpdateAvailable(true);
                }
            });

            // Handle controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[App] Controller changed, reloading...');
                window.location.reload();
            });
        }
    }, []);

    const skipWaiting = useCallback(() => {
        if (registration && registration.waiting) {
            setIsUpdating(true);
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }, [registration]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            registration.update();
        }
    }, [registration]);

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        registration,
        isUpdating
    };
}