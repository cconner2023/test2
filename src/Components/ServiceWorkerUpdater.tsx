// src/Components/ServiceWorkerUpdater.tsx
import { useEffect, useState } from 'react';

export function ServiceWorkerUpdater() {
    const [showNotification, setShowNotification] = useState(false);
    const [updateUrl, setUpdateUrl] = useState('');
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            // Register service worker
            navigator.serviceWorker.register('/ADTMC/sw.js', {
                scope: '/ADTMC/'
            })
                .then(reg => {
                    setRegistration(reg);
                    console.log('Service Worker registered:', reg.scope);

                    // Check if there's already a waiting service worker
                    if (reg.waiting) {
                        console.log('Found waiting service worker');
                        setShowNotification(true);
                    }

                    // Listen for updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('New service worker installed and waiting');
                                    setShowNotification(true);
                                }
                            });
                        }
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });

            // Listen for controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Controller changed, reloading page...');
                window.location.reload();
            });

            // Listen for custom messages (optional - for content updates)
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data.type === 'CONTENT_UPDATED') {
                    console.log('Content updated:', event.data.url);
                    setUpdateUrl(event.data.url);
                    setShowNotification(true);
                }
            });
        }
    }, []);

    const handleReload = () => {
        if (registration?.waiting) {
            // Tell service worker to skip waiting and activate
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            // The page will reload automatically via controllerchange event
        } else {
            // Fallback: just reload
            window.location.reload();
        }
        setShowNotification(false);
    };

    const handleDismiss = () => {
        setShowNotification(false);
    };

    if (!showNotification) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm animate-slideIn">
            <style>
                {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
            </style>
            <div className="font-semibold mb-2">New Version Available</div>
            <div className="text-sm mb-3 opacity-90">
                {updateUrl ? `Content updated: ${updateUrl.split('/').pop()}` : 'A new version is ready'}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleReload}
                    className="bg-white text-blue-600 px-4 py-2 rounded font-semibold flex-1 hover:bg-gray-100 transition"
                >
                    Update
                </button>
                <button
                    onClick={handleDismiss}
                    className="bg-transparent text-white border border-white/30 px-3 py-2 rounded hover:bg-white/10 transition"
                >
                    Later
                </button>
            </div>
        </div>
    );
}