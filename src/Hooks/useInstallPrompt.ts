// Hooks/useInstallPrompt.ts
import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'installPromptDismissed';

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Detect iOS (no beforeinstallprompt support)
        const ua = navigator.userAgent;
        const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        setIsIOS(ios);

        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as any).standalone === true;
        if (isStandalone) return;

        // Check if user previously dismissed
        try {
            const dismissed = localStorage.getItem(DISMISSED_KEY);
            if (dismissed) {
                const dismissedAt = parseInt(dismissed, 10);
                // Re-show after 7 days
                if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
                localStorage.removeItem(DISMISSED_KEY);
            }
        } catch { /* storage unavailable */ }

        // Show iOS manual install hint
        if (ios) {
            setShowPrompt(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Hide prompt if app gets installed
    useEffect(() => {
        const handler = () => {
            setShowPrompt(false);
            setDeferredPrompt(null);
        };
        window.addEventListener('appinstalled', handler);
        return () => window.removeEventListener('appinstalled', handler);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        setIsInstalling(true);
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
        setIsInstalling(false);
    }, [deferredPrompt]);

    const dismiss = useCallback(() => {
        setShowPrompt(false);
        try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch { /* storage unavailable */ }
    }, []);

    return { showPrompt, install, dismiss, isInstalling, isIOS };
}
