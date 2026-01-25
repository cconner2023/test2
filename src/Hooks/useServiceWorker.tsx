// useServiceWorker.tsx
import { useEffect, useState, useCallback } from 'react';

// Method 1: Using a simple hostname check (most reliable)
const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.local');

// Method 2: If using Create-React-App (CRA), you can use this:
// const isDevelopment = process.env.NODE_ENV === 'development'; // Only works with CRA setup

// Method 3: Using a build-time environment variable (if configured)
// const enableSW = import.meta.env?.VITE_ENABLE_SW !== 'false'; // Vite
// const enableSW = process.env.REACT_APP_ENABLE_SW !== 'false'; // CRA

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        // Skip if not in a secure context or service worker not supported
        if (!('serviceWorker' in navigator) || !window.isSecureContext) {
            console.log('[App] Service Worker not supported or not in secure context');
            return;
        }

        // Check support
        setIsSupported(true);

        // Skip service worker registration in development mode
        if (isDevelopment) {
            console.log('[App] Development mode detected, skipping Service Worker');

            // Clean up any existing service workers in development
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (const reg of registrations) {
                    console.log('[App] Unregistering SW in dev mode:', reg.scope);
                    reg.unregister();
                }
            });

            return;
        }

        console.log('[App] Production mode, registering Service Worker');

        const swUrl = '/ADTMC/sw.js?v=3.0';
        const scope = '/ADTMC/';

        // Clean up any existing registrations first
        navigator.serviceWorker.getRegistration(scope)
            .then(existingReg => {
                if (existingReg) {
                    console.log('[App] Found existing registration, unregistering...');
                    return existingReg.unregister();
                }
            })
            .then(() => {
                return navigator.serviceWorker.register(swUrl, {
                    scope,
                    updateViaCache: 'none'
                });
            })
            .then((reg) => {
                console.log('[App] Service Worker registered successfully:', reg.scope);
                setRegistration(reg);

                // Check if there's already a waiting worker
                if (reg.waiting) {
                    console.log('[App] Update already waiting');
                    setUpdateAvailable(true);
                }

                // Listen for new worker installation
                const handleUpdateFound = () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            console.log('[App] SW state changed:', newWorker.state);
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[App] New content is available and ready');
                                setUpdateAvailable(true);
                            }
                        });
                    }
                };

                reg.addEventListener('updatefound', handleUpdateFound);

                // Check for updates periodically (every hour)
                const updateInterval = setInterval(() => {
                    reg.update().catch(err => {
                        console.log('[App] Periodic update check failed:', err);
                    });
                }, 60 * 60 * 1000); // 1 hour

                // Check for updates on page focus
                const handleVisibilityChange = () => {
                    if (!document.hidden) {
                        console.log('[App] Page visible, checking for updates...');
                        reg.update().catch(err => {
                            console.log('[App] Update check failed:', err);
                        });
                    }
                };

                document.addEventListener('visibilitychange', handleVisibilityChange);
                window.addEventListener('focus', () => {
                    console.log('[App] Window focused, checking for updates...');
                    reg.update().catch(err => {
                        console.log('[App] Update check failed:', err);
                    });
                });

                // Cleanup function
                return () => {
                    clearInterval(updateInterval);
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    window.removeEventListener('focus', handleVisibilityChange);
                    reg.removeEventListener('updatefound', handleUpdateFound);
                };
            })
            .catch((error) => {
                console.error('[App] Service Worker registration failed:', error);
            });

        // Listen for messages from service worker
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'UPDATE_AVAILABLE') {
                console.log('[App] Update detected from service worker:', event.data.url);
                setUpdateAvailable(true);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Handle controller change (when new SW takes over)
        const handleControllerChange = () => {
            console.log('[App] New Service Worker activated, reloading page...');
            // Optional: Show a message before reloading
            if (window.confirm('New version loaded. Reload to see changes?')) {
                window.location.reload();
            }
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Cleanup event listeners
        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    const skipWaiting = useCallback(() => {
        if (registration?.waiting) {
            setIsUpdating(true);
            // Optional: Show custom UI instead of confirm
            const shouldUpdate = window.confirm('A new version is available. Update now?');

            if (shouldUpdate) {
                console.log('[App] Skipping waiting, activating new Service Worker');
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Set a timeout to reload if controller doesn't change
                setTimeout(() => {
                    if (isUpdating) {
                        console.log('[App] Forcing reload after update');
                        window.location.reload();
                    }
                }, 1000);
            } else {
                setIsUpdating(false);
            }
        }
    }, [registration, isUpdating]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            console.log('[App] Manually checking for update...');
            return registration.update();
        }
        return Promise.reject('No Service Worker registration found');
    }, [registration]);

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        registration,
        isUpdating,
        isSupported,
        isDevelopment
    };
}