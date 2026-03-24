import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TextCursor, ChevronDown, Check, X } from 'lucide-react';
import type { FieldInfo } from '../../Utilities/templateParser';

interface InsertFieldButtonProps {
    onInsert: (label: string, field: FieldInfo) => void;
}

export const InsertFieldButton = ({ onInsert }: InsertFieldButtonProps) => {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'pick' | 'variable' | 'dropdown'>('pick');
    const [label, setLabel] = useState('');
    const [options, setOptions] = useState('');
    const [defaultValue, setDefaultValue] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Position the portal popover above the trigger button
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePosition();

        const handle = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popoverRef.current && !popoverRef.current.contains(target) &&
                triggerRef.current && !triggerRef.current.contains(target)
            ) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handle);
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            document.removeEventListener('mousedown', handle);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open, updatePosition]);

    const handleClose = () => {
        setOpen(false);
        setMode('pick');
        setLabel('');
        setOptions('');
        setDefaultValue('');
    };

    const handleConfirm = () => {
        const trimmed = label.trim();
        if (!trimmed) return;

        if (mode === 'variable') {
            onInsert(trimmed, { type: 'variable' });
        } else if (mode === 'dropdown') {
            const opts = options.split('\n').map(o => o.trim()).filter(Boolean);
            if (opts.length === 0) return;
            const def = defaultValue.trim();
            onInsert(trimmed, {
                type: 'dropdown',
                options: opts,
                defaultValue: def && opts.includes(def) ? def : opts[0],
            });
        }
        handleClose();
    };

    const INPUT =
        'w-full text-sm px-3 py-2 rounded-lg border border-tertiary/10 bg-themewhite outline-none focus:border-themeblue2/30 text-primary placeholder:text-tertiary/30';

    const popover = open && createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[9999]"
            style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%) translateY(-8px)' }}
        >
            <div className="rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg min-w-[220px] overflow-hidden">
                {mode === 'pick' && (
                    <div className="p-2 space-y-1">
                        <p className="text-[9px] text-tertiary/40 uppercase tracking-wider px-2 py-1">
                            Insert field
                        </p>
                        <button
                            type="button"
                            onClick={() => setMode('variable')}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-themeblue2/8 active:scale-95 transition-all text-left"
                        >
                            <div className="w-7 h-7 rounded-lg bg-themeblue2/15 flex items-center justify-center shrink-0">
                                <TextCursor size={13} className="text-themeblue2" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">Variable</p>
                                <p className="text-[10px] text-tertiary/50">Free text input at runtime</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('dropdown')}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-themeblue2/8 active:scale-95 transition-all text-left"
                        >
                            <div className="w-7 h-7 rounded-lg bg-themeblue2/15 flex items-center justify-center shrink-0">
                                <ChevronDown size={13} className="text-themeblue2" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">Dropdown</p>
                                <p className="text-[10px] text-tertiary/50">Pick from preset options</p>
                            </div>
                        </button>
                    </div>
                )}

                {mode === 'variable' && (
                    <div className="p-3 space-y-2.5">
                        <p className="text-[10px] font-semibold text-themeblue2 uppercase tracking-wider">
                            Variable
                        </p>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
                                if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
                            }}
                            placeholder="Field label (e.g. chief complaint)"
                            className={INPUT}
                            autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                            >
                                <X size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!label.trim()}
                                className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'dropdown' && (
                    <div className="p-3 space-y-2.5">
                        <p className="text-[10px] font-semibold text-themeblue2 uppercase tracking-wider">
                            Dropdown
                        </p>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
                            }}
                            placeholder="Field label (e.g. severity)"
                            className={INPUT}
                            autoFocus
                        />
                        <textarea
                            value={options}
                            onChange={(e) => { setOptions(e.target.value); setDefaultValue(''); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
                            }}
                            placeholder={"Options (one per line)\nmild\nmoderate\nsevere"}
                            className={`${INPUT} min-h-[4rem] resize-none leading-5 font-mono`}
                        />
                        {/* Default selector — tap an option to mark as default */}
                        {(() => {
                            const opts = options.split('\n').map(o => o.trim()).filter(Boolean);
                            if (opts.length === 0) return null;
                            const def = defaultValue || opts[0];
                            return (
                                <div className="space-y-1">
                                    <p className="text-[9px] text-tertiary/40 uppercase tracking-wider">
                                        Default
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {opts.map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setDefaultValue(opt)}
                                                className={`text-[11px] px-2 py-1 rounded-full transition-all active:scale-95 ${
                                                    opt === def
                                                        ? 'bg-themeblue3 text-white'
                                                        : 'bg-tertiary/8 text-tertiary/60 hover:bg-tertiary/12'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                            >
                                <X size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!label.trim() || !options.split('\n').some(o => o.trim())}
                                className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-tour="expander-insert-field"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(!open); setMode('pick'); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all active:scale-95 ${
                    open
                        ? 'bg-themeblue2/15 text-themeblue2'
                        : 'bg-tertiary/8 text-tertiary/50 hover:bg-tertiary/12'
                }`}
                title="Insert field"
            >
                <span className="font-mono text-xs">[ ]</span>
            </button>
            {popover}
        </>
    );
};
