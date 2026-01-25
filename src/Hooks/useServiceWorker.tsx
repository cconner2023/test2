// useServiceWorker.tsx
import { useEffect, useState, useCallback, useRef } from 'react';

const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

// Define the APP_VERSION that matches your service worker
const APP_VERSION = '3.0.1';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [swError, setSwError] = useState<string | null>(null);
    const [swState, setSwState] = useState<string>('idle');

    const isInitialMount = useRef(true);
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (isDevelopment) {
            console.log('[App] Dev mode - cleaning up SW');
            // Clean up any existing SW
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations()
                    .then(regs => {
                        regs.forEach(reg => {
                            console.log('[App] Unregistering:', reg.scope);
                            reg.unregister();
                        });
                    });
            }
            return;
        }

        // Production mode
        if (!('serviceWorker' in navigator)) {
            console.log('[App] SW not supported');
            return;
        }

        // Don't run on initial mount to prevent double registration
        if (!isInitialMount.current) {
            return;
        }

        isInitialMount.current = false;

        const initServiceWorker = async () => {
            try {
                setSwState('registering');

                // Use the correct path for GitHub Pages
                // Make sure this path matches where your sw.js is actually located
                const swUrl = `/ADTMC/sw.js?v=${APP_VERSION}`;
                const scope = '/ADTMC/';

                console.log('[App] Registering SW:', swUrl, 'with version:', APP_VERSION);

                // Check if already registered
                const existingReg = await navigator.serviceWorker.getRegistration(scope);
                if (existingReg) {
                    console.log('[App] Found existing registration');
                    registrationRef.current = existingReg;
                    setRegistration(existingReg);

                    // Check if the existing SW is the right version
                    if (existingReg.active) {
                        console.log('[App] Active SW version:', existingReg.active.scriptURL);
                    }
                } else {
                    // Register new
                    const reg = await navigator.serviceWorker.register(swUrl, {
                        scope: scope,
                        updateViaCache: 'none'
                    });

                    console.log('[App] SW registered successfully');
                    registrationRef.current = reg;
                    setRegistration(reg);
                }

                const reg = registrationRef.current;
                if (!reg) return;

                // Check for waiting worker
                if (reg.waiting) {
                    console.log('[App] Waiting worker found');
                    setUpdateAvailable(true);
                }

                // Listen for updates
                const handleUpdateFound = () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        setSwState('installing');

                        newWorker.addEventListener('statechange', () => {
                            console.log('[App] SW state:', newWorker.state);
                            setSwState(newWorker.state);

                            if (newWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('[App] New content available');
                                    setUpdateAvailable(true);
                                } else {
                                    console.log('[App] First install');
                                }
                            }
                        });
                    }
                };

                reg.addEventListener('updatefound', handleUpdateFound);

                // Listen for controller changes
                const handleControllerChange = () => {
                    console.log('[App] Controller changed');
                    // Show update banner instead of auto-reloading
                    setUpdateAvailable(true);
                };

                navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

                // Check for updates periodically (every 30 minutes)
                const updateCheckInterval = setInterval(() => {
                    if (reg) {
                        reg.update().catch(err => {
                            console.log('[App] Periodic update check failed:', err.message);
                        });
                    }
                }, 30 * 60 * 1000);

                // Check for updates when page becomes visible
                const handleVisibilityChange = () => {
                    if (!document.hidden && reg) {
                        console.log('[App] Page visible - checking for updates');
                        reg.update().catch(err => {
                            console.log('[App] Visibility update check failed:', err.message);
                        });
                    }
                };

                document.addEventListener('visibilitychange', handleVisibilityChange);

                // Cleanup
                return () => {
                    clearInterval(updateCheckInterval);
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    reg.removeEventListener('updatefound', handleUpdateFound);
                    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                };

            } catch (error) {
                console.error('[App] SW registration error:', error);
                setSwError(error instanceof Error ? error.message : 'Registration failed');
                setSwState('error');
            }
        };

        initServiceWorker();
    }, []);

    const skipWaiting = useCallback(async () => {
        if (registrationRef.current?.waiting) {
            setIsUpdating(true);
            console.log('[App] Skipping waiting...');

            // Post message to SW
            registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Force reload after a short delay
            setTimeout(() => {
                console.log('[App] Forcing reload after update');
                window.location.reload();
            }, 1000);
        }
    }, []);

    const checkForUpdate = useCallback(() => {
        if (registrationRef.current) {
            console.log('[App] Manual update check initiated');
            return registrationRef.current.update();
        }
        return Promise.reject('No registration');
    }, []);

    const unregisterSW = useCallback(async () => {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                await reg.unregister();
                console.log('[App] Unregistered:', reg.scope);
            }
            setRegistration(null);
            registrationRef.current = null;
            setUpdateAvailable(false);
        }
    }, []);

    return {
        updateAvailable,
        skipWaiting,
        checkForUpdate,
        unregisterSW,
        registration: registrationRef.current,
        isUpdating,
        swError,
        swState,
        isDevelopment,
        appVersion: APP_VERSION // Expose version for debugging
    };
}