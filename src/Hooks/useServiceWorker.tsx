import { useEffect, useState } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // In Vite, we use import.meta.env instead of process.env
        const isProduction = import.meta.env.PROD; // or import.meta.env.MODE === 'production'

        if ('serviceWorker' in navigator && isProduction) {
            const baseUrl = import.meta.env.BASE_URL || '/ADTMC/';
            const swUrl = `${baseUrl}service-worker.js`;

            navigator.serviceWorker
                .register(swUrl, { scope: baseUrl })
                .then((reg) => {
                    console.log('[App] Service Worker registered:', reg);
                    setRegistration(reg);

                    // Check for updates on page load
                    reg.update();

                    // Listen for controller change
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('[App] New service worker activated, reloading...');
                        window.location.reload();
                    });

                    // Listen for waiting service worker
                    if (reg.waiting) {
                        setUpdateAvailable(true);
                    }

                    // Listen for new worker installation
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
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'UPDATE_AVAILABLE') {
                    console.log('[App] Update detected');
                    setUpdateAvailable(true);
                }
            });

            // Check for updates when page becomes visible
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && registration) {
                    registration.update();
                }
            });

            // Also listen for window focus as an additional trigger
            window.addEventListener('focus', () => {
                if (registration) {
                    registration.update();
                }
            });
        }
    }, []);

    const skipWaiting = () => {
        if (registration?.waiting) {
            registration.waiting.postMessage('skipWaiting');
            setUpdateAvailable(false);
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