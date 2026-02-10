// Hooks/useServiceWorker.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>();
    const intervalRef = useRef<number>(0);

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
                // Skip check when offline to avoid unhandled network errors
                if (r) {
                    intervalRef.current = window.setInterval(async () => {
                        if (!navigator.onLine) {
                            console.log('[PWA] Skipping update check — offline');
                            return;
                        }
                        try {
                            console.log('[PWA] Checking for updates...');
                            await r.update();
                        } catch (error) {
                            console.log('[PWA] Update check failed (likely offline):', error);
                        }
                    }, 5 * 60 * 1000);
                }
            },
            onRegisterError(error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        });

        setUpdateSW(() => update);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const skipWaiting = useCallback(async () => {
        if (updateSW) {
            console.log('[PWA] Updating to new version...');
            setIsUpdating(true);
            try { localStorage.removeItem('updateDismissed'); } catch { /* storage unavailable */ }

            // Let Workbox's cleanupOutdatedCaches handle stale cache removal automatically.
            // Do NOT delete all caches here — the new SW needs time to activate and precache
            // before old caches are removed. Deleting everything creates a race condition where
            // the user lands on a page with no cache if the new SW hasn't finished precaching.

            await updateSW(true); // true = reload page
        }
    }, [updateSW]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            console.log('[PWA] Manual update check...');
            registration.update();
        }
    }, [registration]);

    const dismissTimeoutRef = useRef<number>(0);

    const dismissUpdate = useCallback(() => {
        setUpdateAvailable(false);
        try { localStorage.setItem('updateDismissed', 'true'); } catch { /* storage unavailable */ }

        // Auto-remove dismissal after 1 hour
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = window.setTimeout(() => {
            try { localStorage.removeItem('updateDismissed'); } catch { /* storage unavailable */ }
            dismissTimeoutRef.current = 0;
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
