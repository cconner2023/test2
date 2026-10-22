// Components/StorageErrorToast.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { UI_TIMING } from '../Utilities/constants';
import { onErrorToast, type ErrorToast } from '../lib/errorFeedback';

interface StorageErrorToastProps {
    message: string | null;
    onDismiss: () => void;
    title?: string;
}

/**
 * Toast notification shown when a localStorage operation fails
 * (e.g., QuotaExceededError or storage unavailable).
 * Auto-dismisses after 5 seconds or on user tap.
 */
const StorageErrorToast: React.FC<StorageErrorToastProps> = ({ message, onDismiss, title = 'Storage Error' }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            // Small delay for enter animation
            requestAnimationFrame(() => setVisible(true));
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onDismiss, UI_TIMING.SLIDE_ANIMATION); // Wait for exit animation
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    return (
        <div
            className={`fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 pointer-events-none surface-motion ${
                visible ? '' : 'surface-hidden-below'
            }`}
        >
            <div
                className="bg-themewhite rounded-2xl shadow-2xl border border-themeredred/20 px-6 py-4 flex items-center gap-3 pointer-events-auto backdrop-blur-xl cursor-pointer max-w-sm"
                onClick={() => {
                    setVisible(false);
                    setTimeout(onDismiss, UI_TIMING.SLIDE_ANIMATION);
                }}
                role="alert"
                aria-live="assertive"
            >
                <div className="w-10 h-10 rounded-full bg-themeredred/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-themeredred" />
                </div>
                <div>
                    <p className="text-sm font-medium text-primary">{title}</p>
                    <p className="text-[10pt] text-tertiary">{message}</p>
                </div>
            </div>
        </div>
    );
};

/** App-root host: shows whatever `emitErrorToast` sends. */
export const ErrorToastHost: React.FC = () => {
    const [toast, setToast] = useState<ErrorToast | null>(null);
    useEffect(() => onErrorToast(setToast), []);
    const dismiss = useCallback(() => setToast(null), []);
    return <StorageErrorToast message={toast?.message ?? null} title={toast?.title} onDismiss={dismiss} />;
};

export default StorageErrorToast;
