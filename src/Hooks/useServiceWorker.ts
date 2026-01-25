// Hooks/useServiceWorker.ts
import { useEffect, useState, useCallback, useRef } from 'react';

interface ServiceWorkerMessageData {
    type: string;
    url?: string;
    urls?: string[];
}

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [contentUpdated, setContentUpdated] = useState(false);
    const [updatedUrl, setUpdatedUrl] = useState('');
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Use refs to track state without triggering re-renders
    const updateAvailableRef = useRef(false);
    const skipWaitingCalledRef = useRef(false);

    // Set up content update checking
    const setupContentUpdateChecking = useCallback((reg: ServiceWorkerRegistration) => {
        const checkForContentUpdates = () => {
            if (reg?.active && !skipWaitingCalledRef.current) {
                console.log('[App] Checking for content updates...');
                const message: ServiceWorkerMessageData = {
                    type: 'CHECK_UPDATES',
                    urls: [
                        '/ADTMC/index.html',
                        '/ADTMC/App.css',
                        '/ADTMC/manifest.json'
                    ]
                };
                reg.active.postMessage(message);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !skipWaitingCalledRef.current) {
                checkForContentUpdates();
            }
        };

        const handleLoad = () => {
            if (!skipWaitingCalledRef.current) {
                checkForContentUpdates();
            }
        };

        // Check when page becomes visible
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Check on page load
        window.addEventListener('load', handleLoad);

        // Check every 5 minutes
        const interval = setInterval(checkForContentUpdates, 5 * 60 * 1000);

        // Initial check
        checkForContentUpdates();

        // Return cleanup function
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('load', handleLoad);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            console.log('[App] Service workers are not supported');
            return;
        }

        // Prevent multiple registrations
        if (registration) return;

        const swUrl = '/ADTMC/sw.js';

        navigator.serviceWorker.register(swUrl, {
            scope: '/ADTMC/',
            updateViaCache: 'none'
        })
            .then((reg: ServiceWorkerRegistration) => {
                console.log('[App] Service Worker registered at scope:', reg.scope);
                setRegistration(reg);

                // Check for waiting service worker (app update)
                if (reg.waiting && !updateAvailableRef.current && !skipWaitingCalledRef.current) {
                    console.log('[App] App update waiting');
                    updateAvailableRef.current = true;
                    setUpdateAvailable(true);
                }

                // Listen for app updates
                const handleUpdateFound = () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;

                    const handleStateChange = () => {
                        if (newWorker.state === 'installed') {
                            // Don't show update notification on first install
                            if (navigator.serviceWorker.controller &&
                                !updateAvailableRef.current &&
                                !skipWaitingCalledRef.current) {
                                console.log('[App] New app version available');
                                updateAvailableRef.current = true;
                                setUpdateAvailable(true);
                            }
                        }
                    };

                    newWorker.addEventListener('statechange', handleStateChange);
                };

                reg.addEventListener('updatefound', handleUpdateFound);

                // Set up content update checking
                const cleanupContentChecking = setupContentUpdateChecking(reg);

                // Return cleanup function
                return () => {
                    reg.removeEventListener('updatefound', handleUpdateFound);
                    cleanupContentChecking();
                };
            })
            .catch((error: Error) => {
                console.error('[App] Service Worker registration failed:', error);
            });

        // Listen for content update messages from service worker
        const handleMessage = (event: MessageEvent) => {
            const data = event.data as ServiceWorkerMessageData;
            if (data?.type === 'CONTENT_UPDATED' && !skipWaitingCalledRef.current) {
                console.log('[App] Content updated:', data.url);
                setContentUpdated(true);
                if (data.url) {
                    setUpdatedUrl(data.url);
                }
            }
        };

        // Listen for controller change (app update applied)
        const handleControllerChange = () => {
            console.log('[App] New service worker activated, reloading...');
            // Clear the update flag before reloading
            updateAvailableRef.current = false;
            skipWaitingCalledRef.current = false;
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, [setupContentUpdateChecking, registration]);

    const skipWaiting = useCallback(() => {
        if (registration?.waiting && !skipWaitingCalledRef.current) {
            console.log('[App] Skipping waiting phase for app update');
            setIsUpdating(true);
            skipWaitingCalledRef.current = true;
            updateAvailableRef.current = false;
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Auto-reload after 1 second if controllerchange doesn't fire
            setTimeout(() => {
                if (!skipWaitingCalledRef.current) {
                    window.location.reload();
                }
            }, 1000);
        }
    }, [registration]);

    const checkForUpdate = useCallback(() => {
        if (registration && !skipWaitingCalledRef.current) {
            console.log('[App] Checking for app update...');
            registration.update();
        }
    }, [registration]);

    const reloadForContentUpdate = useCallback(() => {
        console.log('[App] Reloading for content update');
        setContentUpdated(false);
        window.location.reload();
    }, []);

    return {
        updateAvailable,      // App update (service worker)
        contentUpdated,       // Content update (files changed)
        updatedUrl,           // Which URL was updated
        skipWaiting,          // Skip to new app version
        checkForUpdate,       // Check for app updates
        reloadForContentUpdate, // Reload for content updates
        registration,
        isUpdating
    };
}