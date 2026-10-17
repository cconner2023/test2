/* Modal tokens: bg-themewhite rounded-2xl shadow-2xl border-tertiary/10. Ref: UpdateNotification
   z-[110]: mounted outside LockGate so it stays reachable from login, lock and a wedged boot. */
import React, { useEffect, useState } from 'react';
import { Bug, Copy, Trash2, X } from 'lucide-react';
import { clearDiag, formatDiag, getBootSeq, getDiagEntries, subscribeDiag } from '../lib/diagLog';

/** Boots back from the current one whose warnings/errors still raise the pill. */
const BOOT_WINDOW = 2;

const DiagnosticsPill: React.FC = () => {
    const [, setTick] = useState(0);
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => subscribeDiag(() => setTick(t => t + 1)), []);

    const entries = getDiagEntries();
    const boot = getBootSeq();
    const errorCount = entries.filter(e => (e.level === 'error' || e.level === 'warn') && e.boot > boot - BOOT_WINDOW).length;

    if (!open && errorCount === 0) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatDiag());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable — text is selectable */ }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed left-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-[110] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themewhite shadow-2xl border border-tertiary/10 text-[10pt] text-primary active:scale-95 transition-all animate-surface-in"
            >
                <Bug size={14} className="text-themeredred" />
                {errorCount} {errorCount === 1 ? 'issue' : 'issues'}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/15" onClick={() => setOpen(false)} />
            <div className="relative w-full sm:max-w-lg max-h-[80vh] flex flex-col bg-themewhite rounded-t-2xl sm:rounded-2xl shadow-2xl border border-tertiary/10 animate-surface-in pb-[env(safe-area-inset-bottom,0px)]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                    <p className="text-sm font-semibold text-primary">Diagnostics</p>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleCopy} className="w-9 h-9 rounded-full flex items-center justify-center text-primary active:scale-95" aria-label="Copy log">
                            <Copy size={16} />
                        </button>
                        <button type="button" onClick={clearDiag} className="w-9 h-9 rounded-full flex items-center justify-center text-primary active:scale-95" aria-label="Clear log">
                            <Trash2 size={16} />
                        </button>
                        <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center text-primary active:scale-95" aria-label="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>
                {copied && <p className="px-4 pt-2 text-[10pt] text-tertiary">Copied.</p>}
                <pre className="flex-1 overflow-auto px-4 py-3 text-[9pt] leading-snug text-primary whitespace-pre-wrap break-words select-text">
                    {formatDiag(entries) || 'No entries.'}
                </pre>
            </div>
        </div>
    );
};

export default DiagnosticsPill;
