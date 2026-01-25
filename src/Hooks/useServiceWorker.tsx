// useServiceWorker.tsx
import { useEffect, useState, useCallback } from 'react';

const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [swError, setSwError] = useState<string | null>(null);

    useEffect(() => {
        // Don't register in dev mode
        if (isDevelopment) {
            console.log('[App] Dev mode - cleaning up any existing SW');
            navigator.serviceWorker?.getRegistrations()
                .then(regs => {
                    regs.forEach(reg => {
                        console.log('[App] Unregistering SW:', reg.scope);
                        reg.unregister();
                    });
                });
            return;
        }

        // Check if service workers are supported
        if (!('serviceWorker' in navigator)) {
            console.log('[App] Service Worker not supported');
            return;
        }

        // Ensure we're in HTTPS or localhost
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            console.warn('[App] Service Worker requires HTTPS in production');
            return;
        }

        const registerSW = async () => {
            try {
                // First, clean up any existing registrations
                const existingReg = await navigator.serviceWorker.getRegistration('/ADTMC/');
                if (existingReg) {
                    await existingReg.unregister();
                    console.log('[App] Unregistered existing SW');
                }

                // Register new service worker
                const swUrl = './sw.js?v=' + Date.now(); // Add timestamp to prevent caching
                const reg = await navigator.serviceWorker.register(swUrl, {
                    scope: './',
                    updateViaCache: 'none' // Important for GitHub Pages
                });

                console.log('[App] Service Worker registered:', reg.scope);
                setRegistration(reg);
                setSwError(null);

                // Check for waiting worker
                if (reg.waiting) {
                    console.log('[App] Found waiting worker');
                    setUpdateAvailable(true);
                }

                // Listen for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        console.log('[App] New SW installing:', newWorker.state);

                        newWorker.addEventListener('statechange', () => {
                            console.log('[App] SW state changed:', newWorker.state);
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[App] Update ready');
                                setUpdateAvailable(true);
                            }
                        });
                    }
                });

                // Listen for controller changes
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('[App] Controller changed, reloading...');
                    // Wait a bit for new controller to be ready
                    setTimeout(() => {
                        window.location.reload();
                    }, 100);
                });

                // Listen for messages from SW
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'RELOAD_PAGE') {
                        console.log('[App] Received RELOAD_PAGE message');
                        window.location.reload();
                    }
                });

                // Check for updates on page focus
                const checkForUpdate = () => {
                    if (!document.hidden && reg) {
                        console.log('[App] Checking for updates...');
                        reg.update().catch(err => {
                            console.log('[App] Update check:', err.message);
                        });
                    }
                };

                document.addEventListener('visibilitychange', checkForUpdate);
                window.addEventListener('focus', checkForUpdate);

                // Cleanup
                return () => {
                    document.removeEventListener('visibilitychange', checkForUpdate);
                    window.removeEventListener('focus', checkForUpdate);
                };

            } catch (error) {
                console.error('[App] SW registration failed:', error);
                setSwError(error instanceof Error ? error.message : 'Unknown error');
            }
        };

        registerSW();
    }, []);

    const skipWaiting = useCallback(() => {
        if (registration?.waiting) {
            setIsUpdating(true);
            console.log('[App] Sending SKIP_WAITING to SW');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Fallback reload after 3 seconds
            setTimeout(() => {
                if (isUpdating) {
                    console.log('[App] Fallback reload');
                    window.location.reload();
                }
            }, 3000);
        }
    }, [registration, isUpdating]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            return registration.update();
        }
        return Promise.reject('No registration');
    }, [registration]);

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        registration,
        isUpdating,
        swError,
        isDevelopment
    };
}