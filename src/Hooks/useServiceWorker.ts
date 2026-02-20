// Hooks/useServiceWorker.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { createLogger } from '../Utilities/Logger';

const logger = createLogger('PWA');
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_DISMISS_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Manages the PWA service worker lifecycle: registration, periodic update checks,
 * version-aware update prompting, skip-waiting, and dismissal with auto-expiry.
 */
export function useServiceWorker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>();
    const intervalRef = useRef<number>(0);

    // Store the update function from registerSW
    const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

    // Reference to updateSW for use inside registerSW callbacks
    const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

    useEffect(() => {
        const update = registerSW({
            immediate: true,
            async onNeedRefresh() {
                logger.info('New content available, checking version...');
                try {
                    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`);
                    const { version: newVersion } = await res.json();
                    if (newVersion === __APP_VERSION__) {
                        logger.info('Same version, applying update silently');
                        if (updateSWRef.current) await updateSWRef.current(true);
                        return;
                    }
                    logger.info(`New version ${newVersion} (current: ${__APP_VERSION__}), prompting user`);
                } catch (e) {
                    logger.warn('Could not fetch version.json, showing update prompt', e);
                }
                setUpdateAvailable(true);
            },
            onOfflineReady() {
                logger.info('App ready to work offline');
                setOfflineReady(true);
            },
            onRegistered(r) {
                logger.info('Service Worker registered:', r?.scope);
                setRegistration(r);

                // Check for updates periodically (every 5 minutes)
                if (r) {
                    intervalRef.current = window.setInterval(() => {
                        logger.debug('Checking for updates...');
                        r.update();
                    }, UPDATE_CHECK_INTERVAL_MS);
                }
            },
            onRegisterError(error) {
                logger.error('Service Worker registration failed:', error);
            }
        });

        updateSWRef.current = update;
        setUpdateSW(() => update);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const skipWaiting = useCallback(async () => {
        if (updateSW) {
            logger.info('Updating to new version...');
            setIsUpdating(true);
            try { localStorage.removeItem('updateDismissed'); } catch { /* storage unavailable */ }
            try { localStorage.setItem('postUpdateNav', 'release-notes'); } catch { /* storage unavailable */ }

            // Workbox cleanupOutdatedCaches handles old cache removal automatically.
            // Do NOT clear caches here — the new SW's precache is already populated
            // and deleting it would break offline loading after the reload.
            await updateSW(true); // true = reload page
        }
    }, [updateSW]);

    const checkForUpdate = useCallback(() => {
        if (registration) {
            logger.debug('Manual update check...');
            registration.update();
        }
    }, [registration]);

    const dismissTimeoutRef = useRef<number>(0);

    const dismissUpdate = useCallback(() => {
        setUpdateAvailable(false);
        try { localStorage.setItem('updateDismissed', Date.now().toString()); } catch { /* storage unavailable */ }

        // Auto-remove dismissal after 1 hour
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = window.setTimeout(() => {
            try { localStorage.removeItem('updateDismissed'); } catch { /* storage unavailable */ }
            dismissTimeoutRef.current = 0;
        }, UPDATE_DISMISS_TIMEOUT_MS);
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
