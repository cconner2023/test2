import { useEffect, useState } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // Use Vite's environment detection
        const isProduction = import.meta.env.PROD;

        if ('serviceWorker' in navigator) {
            // Always register in production, optional in development
            if (!isProduction) {
                // In dev, we might not want to use service worker
                console.log('[App] Skipping service worker in development');
                return;
            }

            const baseUrl = import.meta.env.BASE_URL || '/ADTMC/';
            const swUrl = `${baseUrl}sw.js`;

            navigator.serviceWorker
                .register(swUrl, { scope: baseUrl })
                .then((reg) => {
                    console.log('[App] Service Worker registered:', reg.scope);
                    setRegistration(reg);

                    // Check for updates
                    reg.update();

                    // Handle waiting service worker
                    if (reg.waiting) {
                        setUpdateAvailable(true);
                    }

                    // Listen for new service worker installation
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;

                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });

                    // Listen for controller change (page reload needed)
                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (!refreshing) {
                            refreshing = true;
                            // You can choose to auto-reload or let user decide
                            // window.location.reload();
                        }
                    });
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'UPDATE_AVAILABLE') {
                    console.log('[App] Update detected from service worker');
                    setUpdateAvailable(true);
                }
            });

            // Check for updates when page becomes visible
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible' && registration) {
                    registration.update();
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }, []);

    const skipWaiting = () => {
        if (registration?.waiting) {
            registration.waiting.postMessage('skipWaiting');
            setUpdateAvailable(false);
            // Optionally reload immediately
            setTimeout(() => window.location.reload(), 100);
        }
    };

    const checkForUpdate = () => {
        if (registration) {
            registration.update();
        }
    };

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        registration
    };
}