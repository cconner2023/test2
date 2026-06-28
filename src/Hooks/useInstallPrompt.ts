// Hooks/useInstallPrompt.ts
import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── Module-level capture ────────────────────────────────────
// beforeinstallprompt can fire before React mounts (especially on
// desktop where Chrome doesn't gate it behind a user-engagement
// heuristic). Capture it at the module level so we never lose it.
let _capturedPrompt: BeforeInstallPromptEvent | null = null;
const _listeners = new Set<(e: BeforeInstallPromptEvent) => void>();

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        _capturedPrompt = e as BeforeInstallPromptEvent;
        _listeners.forEach(fn => fn(_capturedPrompt!));
    });
}

/**
 * useInstallCapability — exposes the PWA install affordance without any of its
 * own surfacing/cooldown logic. The consumer (ProvisionalDeviceModal) owns when
 * to show; this hook only answers "can we install, and how":
 *  - isIOS / isStandalone: platform facts for choosing copy.
 *  - canInstall: a beforeinstallprompt was captured → a one-tap Install button
 *    is possible (desktop / Android). iOS never sets this (manual Add-to-Home).
 *  - install(): triggers the native prompt.
 */
export function useInstallCapability() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(_capturedPrompt);
    const [isInstalling, setIsInstalling] = useState(false);

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(typeof window !== 'undefined' && (window as any).MSStream);
    const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true
    );

    // Subscribe for events that fire after mount; consume any already captured.
    useEffect(() => {
        const handler = (e: BeforeInstallPromptEvent) => setDeferredPrompt(e);
        _listeners.add(handler);
        if (_capturedPrompt) setDeferredPrompt(_capturedPrompt);
        return () => { _listeners.delete(handler); };
    }, []);

    // Clear once the app is actually installed.
    useEffect(() => {
        const onInstalled = () => { setDeferredPrompt(null); _capturedPrompt = null; };
        window.addEventListener('appinstalled', onInstalled);
        return () => window.removeEventListener('appinstalled', onInstalled);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        setIsInstalling(true);
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') { setDeferredPrompt(null); _capturedPrompt = null; }
        setIsInstalling(false);
    }, [deferredPrompt]);

    return { isIOS, isStandalone, canInstall: !!deferredPrompt, install, isInstalling };
}
