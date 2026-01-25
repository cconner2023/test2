// src/Components/ServiceWorkerUpdater.tsx
import { useEffect, useState } from 'react';

export function ServiceWorkerUpdater() {
    const [showNotification, setShowNotification] = useState(false);
    const [updateUrl, setUpdateUrl] = useState('');

    useEffect(() => {
        // Listen for messages from service worker
        if ('serviceWorker' in navigator) {
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
        window.location.reload();
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
            <div className="font-semibold mb-2">Content Updated</div>
            <div className="text-sm mb-3 opacity-90">
                New content is available for: {updateUrl.split('/').pop()}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleReload}
                    className="bg-white text-blue-600 px-4 py-2 rounded font-semibold flex-1 hover:bg-gray-100 transition"
                >
                    Reload
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