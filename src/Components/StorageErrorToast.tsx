// Components/StorageErrorToast.tsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface StorageErrorToastProps {
    message: string | null;
    onDismiss: () => void;
}

/**
 * Toast notification shown when a localStorage operation fails
 * (e.g., QuotaExceededError or storage unavailable).
 * Auto-dismisses after 5 seconds or on user tap.
 */
const StorageErrorToast: React.FC<StorageErrorToastProps> = ({ message, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            // Small delay for enter animation
            requestAnimationFrame(() => setVisible(true));
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onDismiss, 300); // Wait for exit animation
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    return (
        <div
            className={`fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 pointer-events-none transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <div
                className="bg-themewhite rounded-2xl shadow-2xl border border-themeredred/20 px-6 py-4 flex items-center gap-3 pointer-events-auto backdrop-blur-xl cursor-pointer max-w-sm"
                onClick={() => {
                    setVisible(false);
                    setTimeout(onDismiss, 300);
                }}
                role="alert"
            >
                <div className="w-10 h-10 rounded-full bg-themeredred/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-themeredred" />
                </div>
                <div>
                    <p className="text-sm font-medium text-primary">Storage Error</p>
                    <p className="text-xs text-tertiary/80">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default StorageErrorToast;
