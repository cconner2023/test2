// useServiceWorker.tsx
import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // Only register if service workers are supported
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }

        // Register the service worker
        const swUrl = '/ADTMC/sw.js';
        const scope = '/ADTMC/';

        navigator.serviceWorker.register(swUrl, { scope })
            .then((reg) => {
                console.log('Service Worker registered:', reg.scope);
                setRegistration(reg);

                // Check if there's a waiting worker
                if (reg.waiting) {
                    setUpdateAvailable(true);
                }

                // Listen for updates
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
                console.error('Service Worker registration failed:', error);
            });

        // Listen for controller changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });

        // Clean up: Check for updates when page becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden && registration) {
                registration.update();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const skipWaiting = useCallback(() => {
        if (registration && registration.waiting) {
            // Post message to skip waiting
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }, [registration]);

    return {
        updateAvailable,
        skipWaiting,
        registration
    };
}