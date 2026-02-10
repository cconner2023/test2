// Components/InstallPrompt.tsx
import React from 'react';
import { X, Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../Hooks/useInstallPrompt';

const InstallPrompt: React.FC = () => {
    const { showPrompt, install, dismiss, isInstalling, isIOS } = useInstallPrompt();

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            {/* Subtle backdrop */}
            <div
                className="absolute inset-0 bg-black/10 pointer-events-auto sm:bg-black/15 transition-opacity"
                onClick={dismiss}
            />
            {/* Notification card */}
            <div className="relative w-full sm:w-auto sm:max-w-sm mx-0 sm:mx-4 mb-0 sm:mb-0 pointer-events-auto animate-slideInUp">
                <div className="bg-themewhite rounded-t-2xl sm:rounded-2xl shadow-2xl border border-tertiary/10 overflow-hidden backdrop-blur-xl">
                    {/* Accent bar at top */}
                    <div className="h-1 bg-themegreen" />

                    <div className="px-5 py-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-themegreen/15 flex items-center justify-center flex-shrink-0">
                                    <Download className="h-5 w-5 text-themegreen" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Install App</p>
                                    <p className="text-xs text-tertiary mt-0.5">
                                        {isIOS
                                            ? 'Add to your home screen for quick access'
                                            : 'Install for offline access & quick launch'
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={dismiss}
                                className="p-1.5 rounded-lg hover:bg-themewhite2 active:scale-95 transition-all text-tertiary"
                                aria-label="Dismiss install prompt"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {isIOS ? (
                            /* iOS instructions */
                            <div className="mt-4 px-1">
                                <p className="text-xs text-tertiary leading-relaxed">
                                    Tap <Share className="inline h-3.5 w-3.5 text-themeblue2 -mt-0.5" /> in your browser toolbar, then select <span className="font-medium text-primary">"Add to Home Screen"</span>
                                </p>
                                <div className="flex justify-end mt-3">
                                    <button
                                        onClick={dismiss}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-tertiary bg-themewhite2 hover:bg-themegray1/40 active:scale-[0.97] transition-all"
                                    >
                                        Got it
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Standard install buttons */
                            <div className="flex items-center gap-2.5 mt-4">
                                <button
                                    onClick={dismiss}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-tertiary bg-themewhite2 hover:bg-themegray1/40 active:scale-[0.97] transition-all"
                                >
                                    Not Now
                                </button>
                                <button
                                    onClick={install}
                                    disabled={isInstalling}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-themegreen hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isInstalling ? (
                                        <>
                                            <Download className="h-3.5 w-3.5 animate-bounce" />
                                            Installing…
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-3.5 w-3.5" />
                                            Install
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
