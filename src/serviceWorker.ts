// src/utils/serviceWorker.ts
let registration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker() {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
        const swPath = '/ADTMC/service-worker.js';
        const scope = '/ADTMC/';

        // Register service worker
        navigator.serviceWorker.register(swPath, { scope: scope })
            .then(reg => {
                registration = reg;
                console.log('SW registered successfully with scope:', reg.scope);

                // Check for content updates when page becomes visible
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && registration?.active) {
                        checkForContentUpdates();
                    }
                });

                // Check for content updates on page load
                window.addEventListener('load', function () {
                    if (registration?.active) {
                        checkForContentUpdates();
                    }
                });

                // Listen for content update messages from service worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data.type === 'CONTENT_UPDATED') {
                        console.log('Content updated:', event.data.url);
                        // Show notification to user
                        showUpdateNotificationUI(event.data.url);
                    }
                });

                // Listen for controller change (when new service worker takes over)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('New service worker activated, reloading page');
                    window.location.reload();
                });

                // If there's already a waiting service worker, prompt user
                if (reg.waiting) {
                    showNewVersionNotification(reg.waiting);
                }

                // Listen for new service worker installation
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    // Add null check here
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        console.log('Service worker state:', newWorker.state);

                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is installed and waiting
                            showNewVersionNotification(newWorker);
                        }

                        if (newWorker.state === 'activated') {
                            console.log('New service worker activated');
                        }
                    });
                });
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    }
}

// Function to check for content updates
function checkForContentUpdates() {
    if (registration?.active) {
        console.log('Checking for content updates...');
        // Send message to service worker to check for updates
        registration.active.postMessage({
            type: 'CHECK_UPDATES',
            urls: [
                '/ADTMC/',
                '/ADTMC/index.html',
                '/ADTMC/manifest.json'
            ]
        });
    }
}

// Show UI notification for content updates
function showUpdateNotificationUI(url: string) {
    // Create a custom notification UI
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #646cff;
    color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

    const style = document.createElement('style');
    style.textContent = `
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
  `;
    document.head.appendChild(style);

    notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">Content Updated</div>
    <div style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
      New content is available for: ${url.split('/').pop()}
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="sw-reload" style="
        background: white;
        color: #646cff;
        border: none;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      ">Reload</button>
      <button id="sw-dismiss" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      ">Later</button>
    </div>
  `;

    document.body.appendChild(notification);

    // Handle reload button
    notification.querySelector('#sw-reload')?.addEventListener('click', () => {
        window.location.reload();
    });

    // Handle dismiss button
    notification.querySelector('#sw-dismiss')?.addEventListener('click', () => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.remove();
            style.remove();
        }
    }, 10000);
}

// Show notification for new version (new service worker)
function showNewVersionNotification(worker: ServiceWorker) {
    if (confirm('A new version of the app is available. Update now?')) {
        worker.postMessage({ action: 'skipWaiting' });
    }
}

// Manual update check function (can be called from a button)
export function checkForUpdates() {
    if (registration) {
        registration.update().then(() => {
            checkForContentUpdates();
            alert('Update check completed');
        });
    }
}