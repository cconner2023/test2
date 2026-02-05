// Hooks/useServiceWorker.ts
import { useEffect, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>();

    // Store the update function from registerSW
    const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

    useEffect(() => {
        const update = registerSW({
            immediate: true,
            onNeedRefresh() {
                console.log('[PWA] New content available, update needed');
                setUpdateAvailable(true);
            },
            onOfflineReady() {
                console.log('[PWA] App ready to work offline');
                setOfflineReady(true);
            },
            onRegistered(r) {
                console.log('[PWA] Service Worker registered:', r?.scope);
                setRegistration(r);

                // Check for updates periodically (every 5 minutes)
                if (r) {
                    setInterval(() => {
                        console.log('[PWA] Checking for updates...');
                        r.update();
                    }, 5 * 60 * 1000);
                }
            },
            onRegisterError(error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        });

        setUpdateSW(() => update);
    }, []);

    const skipWaiting = useCallback(async () => {
        if (updateSW) {
            console.log('[PWA] Updating to new version...');
            setIsUpdating(true);
            localStorage.removeItem('updateDismissed');

            // Force cache bust by clearing caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('[PWA] Clearing cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }

            await updateSW(true); // true = reload page
        }
    }, [updateSW]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            console.log('[PWA] Manual update check...');
            registration.update();
        }
    }, [registration]);

    const dismissUpdate = useCallback(() => {
        setUpdateAvailable(false);
        localStorage.setItem('updateDismissed', 'true');

        // Auto-remove dismissal after 1 hour
        setTimeout(() => {
            localStorage.removeItem('updateDismissed');
        }, 60 * 60 * 1000);
    }, []);

    return {
        updateAvailable,
        offlineReady,
        skipWaiting,
        checkForUpdate,
        dismissUpdate,
        registration,
        isUpdating,
        appVersion: __APP_VERSION__
    };
}
