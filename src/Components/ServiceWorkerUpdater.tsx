import { useState, useEffect } from 'react';

export function ServiceWorkerUpdater() {
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // Only in production
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            const initServiceWorker = async () => {
                try {
                    // Wait for the service worker to be ready
                    const reg = await navigator.serviceWorker.ready;
                    setRegistration(reg);

                    console.log('Service Worker is ready:', reg);

                    // Check if there's already a waiting service worker
                    if (reg.waiting) {
                        console.log('Found waiting service worker');
                        setShowUpdatePrompt(true);
                    }

                    // Listen for new service worker installation
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                console.log('Service Worker state changed:', newWorker.state);

                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('New service worker installed and waiting');
                                    setShowUpdatePrompt(true);
                                }

                                if (newWorker.state === 'activated') {
                                    console.log('New service worker activated');
                                    // If you want to auto-reload when new worker activates:
                                    // window.location.reload();
                                }
                            });
                        }
                    });

                    // Listen for controller change (when new service worker takes over)
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('Controller changed, reloading page...');
                        window.location.reload();
                    });

                    // Listen for messages from service worker
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        console.log('Message from service worker:', event.data);
                        if (event.data.type === 'SW_READY') {
                            console.log('Service Worker ready, version:', event.data.version);
                        }
                    });

                } catch (error) {
                    console.error('Service Worker initialization failed:', error);
                }
            };

            // Don't register manually - VitePWA handles registration
            // Just wait for it to be ready
            if (navigator.serviceWorker.controller) {
                console.log('Service Worker already controlling the page');
                initServiceWorker();
            } else {
                navigator.serviceWorker.register('/ADTMC/service-worker.js')
                    .then((reg) => {
                        console.log('Service Worker registered:', reg);
                        return initServiceWorker();
                    })
                    .catch((error) => {
                        console.error('Service Worker registration failed:', error);
                    });
            }
        }
    }, []);

    const handleUpdate = () => {
        if (registration?.waiting) {
            console.log('Sending SKIP_WAITING message to service worker');

            // Send message to skip waiting
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // The page will reload automatically when controllerchange event fires
            setShowUpdatePrompt(false);
        }
    };

    const handleDismiss = () => {
        setShowUpdatePrompt(false);
    };

    // Don't show in development
    if (!import.meta.env.PROD || !showUpdatePrompt) {
        return null;
    }

    return (
        <div
            className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-4 z-50 flex justify-between items-center shadow-lg animate-slideDown"
            style={{
                backgroundColor: '#646cff',
            }}
        >
            <style>
                {`
          @keyframes slideDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          .animate-slideDown {
            animation: slideDown 0.3s ease-out;
          }
        `}
            </style>
            <span className="text-sm font-medium">
                New update available!
            </span>
            <div className="flex gap-2">
                <button
                    onClick={handleUpdate}
                    className="bg-white text-blue-600 border-none px-4 py-2 rounded text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{ color: '#646cff' }}
                >
                    Update Now
                </button>
                <button
                    onClick={handleDismiss}
                    className="bg-transparent text-white border border-white/30 px-4 py-2 rounded text-sm font-medium cursor-pointer transition-colors hover:bg-white/10"
                >
                    Later
                </button>
            </div>
        </div>
    );
}