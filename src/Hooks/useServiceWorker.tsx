// useServiceWorker.tsx
import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const swUrl = '/ADTMC/sw.js?v=2.6.1';
            const scope = '/ADTMC/';

            navigator.serviceWorker
                .register(swUrl, { scope, updateViaCache: 'none' })
                .then((reg) => {
                    console.log('[App] Service Worker registered:', reg.scope);
                    setRegistration(reg);

                    // Check if there's already a waiting worker
                    if (reg.waiting) {
                        console.log('[App] Found waiting service worker');
                        setWaitingWorker(reg.waiting);
                        setUpdateAvailable(true);
                    }

                    // Listen for updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[App] New service worker installed and waiting');
                                    setWaitingWorker(newWorker);
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });

                    // Check for updates periodically
                    const handleVisibilityChange = () => {
                        if (!document.hidden && reg) {
                            reg.update();
                        }
                    };

                    document.addEventListener('visibilitychange', handleVisibilityChange);
                    window.addEventListener('focus', handleVisibilityChange);

                    // Set up periodic update check (every 30 minutes)
                    const updateInterval = setInterval(() => {
                        reg.update();
                    }, 30 * 60 * 1000);

                    return () => {
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                        window.removeEventListener('focus', handleVisibilityChange);
                        clearInterval(updateInterval);
                    };
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });

            // Listen for custom messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'UPDATE_AVAILABLE') {
                    console.log('[App] Update detected from service worker');
                    setUpdateAvailable(true);
                }
            });
        }
    }, []);

    const skipWaiting = useCallback(() => {
        if (waitingWorker) {
            console.log('[App] Telling waiting worker to skip waiting');
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });

            // Listen for state change to know when it's activated
            waitingWorker.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') {
                    console.log('[App] Waiting worker activated, reloading page');
                    window.location.reload();
                }
            });
        }
    }, [waitingWorker]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            registration.update();
        }
    }, [registration]);

    const dismissUpdate = useCallback(() => {
        setUpdateAvailable(false);
        // Optionally store dismissal in localStorage for a period
        localStorage.setItem('updateDismissed', Date.now().toString());
    }, []);

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        dismissUpdate,
        registration,
        waitingWorker
    };
}