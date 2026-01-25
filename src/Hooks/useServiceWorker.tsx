import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Use the current script path to determine the service worker URL
            const swUrl = './sw.js';

            // Remove existing service workers first to avoid conflicts
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => {
                    for (let reg of registrations) {
                        reg.unregister();
                    }
                })
                .then(() => {
                    return navigator.serviceWorker.register(swUrl, {
                        scope: './',
                        updateViaCache: 'none'
                    });
                })
                .then((reg) => {
                    console.log('[App] Service Worker registered:', reg);
                    setRegistration(reg);

                    // Check if there's a waiting service worker
                    if (reg.waiting) {
                        console.log('[App] Update waiting');
                        setUpdateAvailable(true);
                    }

                    // Listen for updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;

                        console.log('[App] Update found:', newWorker);

                        newWorker.addEventListener('statechange', () => {
                            console.log('[App] New worker state:', newWorker.state);

                            if (newWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // New content is available
                                    console.log('[App] New content available');
                                    setUpdateAvailable(true);
                                } else {
                                    // First install
                                    console.log('[App] Content cached for offline use');
                                }
                            }
                        });
                    });

                    // Check for updates periodically
                    const checkForUpdates = () => {
                        console.log('[App] Checking for updates...');
                        reg.update();
                    };

                    // Check on page focus
                    window.addEventListener('focus', checkForUpdates);

                    // Check every 5 minutes
                    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

                    return () => {
                        window.removeEventListener('focus', checkForUpdates);
                        clearInterval(interval);
                    };
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });

            // Listen for controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[App] Controller changed, reloading page...');
                window.location.reload();
            });
        } else {
            console.log('[App] Service workers are not supported');
        }
    }, []);

    const skipWaiting = useCallback(() => {
        if (registration?.waiting) {
            console.log('[App] Skipping waiting phase');
            setIsUpdating(true);
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Reload after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }, [registration]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            console.log('[App] Manually checking for update');
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