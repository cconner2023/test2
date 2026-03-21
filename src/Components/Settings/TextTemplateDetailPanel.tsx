import { useState, useCallback } from 'react';
import { Trash2, X, Check } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import { TemplateBuilder } from './TemplateBuilder';

interface TextTemplateDetailPanelProps {
    /** The expander to edit, or a seed with just abbr for new */
    expander: TextExpander | null;
    /** Whether this is a new template (vs editing existing) */
    isNew?: boolean;
    /** All existing abbreviations (for uniqueness validation) */
    existingAbbrs: string[];
    onSave: (expander: TextExpander, originalAbbr?: string) => void;
    onDelete?: (abbr: string) => void;
    /** Return to the list view */
    onCancel?: () => void;
}

export const TextTemplateDetailPanel = ({
    expander,
    isNew: isNewProp,
    existingAbbrs,
    onSave,
    onDelete,
    onCancel,
}: TextTemplateDetailPanelProps) => {
    const isNew = isNewProp ?? !expander;
    const [abbr, setAbbr] = useState(expander?.abbr ?? '');
    const [mode, setMode] = useState<'simple' | 'template'>(
        expander?.template?.length ? 'template' : 'simple',
    );
    const [expansion, setExpansion] = useState(expander?.expansion ?? '');
    const [templateNodes, setTemplateNodes] = useState<TemplateNode[]>(
        expander?.template ?? [],
    );
    const [abbrError, setAbbrError] = useState('');

    const handleSave = useCallback(() => {
        const trimmed = abbr.trim();
        if (!trimmed) { setAbbrError('Abbreviation required'); return; }
        if (/\s/.test(trimmed)) { setAbbrError('No spaces allowed'); return; }

        // Uniqueness — exclude self when editing an existing template
        const selfAbbr = isNew ? '' : (expander?.abbr ?? '');
        const otherAbbrs = existingAbbrs
            .filter(a => a.toLowerCase() !== selfAbbr.toLowerCase())
            .map(a => a.toLowerCase());
        if (otherAbbrs.includes(trimmed.toLowerCase())) {
            setAbbrError('Abbreviation already exists');
            return;
        }

        if (mode === 'simple' && !expansion.trim()) return;
        if (mode === 'template' && templateNodes.length === 0) return;

        const entry: TextExpander = mode === 'template'
            ? { abbr: trimmed, expansion: '', template: templateNodes }
            : { abbr: trimmed, expansion: expansion.trim() };

        onSave(entry, isNew ? undefined : expander?.abbr);
    }, [abbr, mode, expansion, templateNodes, existingAbbrs, expander, isNew, onSave]);

    const saveDisabled = mode === 'simple'
        ? !expansion.trim() || !abbr.trim()
        : templateNodes.length === 0 || !abbr.trim();

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">

                {/* ── Shortcut abbreviation ── */}
                <div>
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">
                        Shortcut
                    </p>
                    <div className="rounded-xl bg-themewhite2 px-4 py-3">
                        <input
                            type="text"
                            value={abbr}
                            onChange={(e) => { setAbbr(e.target.value); setAbbrError(''); }}
                            placeholder="e.g. htn, sob, cva"
                            className="w-full bg-transparent outline-none text-lg font-semibold text-primary placeholder:text-tertiary/30 font-mono"
                            autoFocus={isNew}
                        />
                        {abbrError && (
                            <p className="text-xs font-medium text-themeredred mt-1.5">{abbrError}</p>
                        )}
                    </div>
                </div>

                {/* ── Type toggle ── */}
                <div>
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">
                        Type
                    </p>
                    <div className="flex rounded-xl overflow-hidden border border-themeblue3/10 shadow-xs">
                        <button
                            onClick={() => setMode('simple')}
                            className={`flex-1 text-sm py-3 font-medium transition-colors active:scale-95 ${
                                mode === 'simple'
                                    ? 'bg-themeblue2 text-white'
                                    : 'bg-themewhite2 text-tertiary'
                            }`}
                        >
                            Simple
                        </button>
                        <button
                            onClick={() => setMode('template')}
                            className={`flex-1 text-sm py-3 font-medium transition-colors active:scale-95 ${
                                mode === 'template'
                                    ? 'bg-themeblue2 text-white'
                                    : 'bg-themewhite2 text-tertiary'
                            }`}
                        >
                            Template
                        </button>
                    </div>
                </div>

                {/* ── Content editor ── */}
                <div>
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">
                        {mode === 'simple' ? 'Expansion' : 'Template Blocks'}
                    </p>
                    <div className="rounded-xl bg-themewhite2 px-4 py-3">
                        {mode === 'simple' ? (
                            <textarea
                                value={expansion}
                                onChange={(e) => setExpansion(e.target.value)}
                                placeholder="Text that replaces the shortcut..."
                                className="w-full min-h-[140px] bg-transparent outline-none text-sm text-primary placeholder:text-tertiary/30 resize-none leading-relaxed"
                            />
                        ) : (
                            <TemplateBuilder
                                nodes={templateNodes}
                                onChange={setTemplateNodes}
                            />
                        )}
                    </div>
                </div>

                {/* ── Cancel / Save ── */}
                <div className="flex gap-1.5 justify-end">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                        >
                            <X size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveDisabled}
                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                    >
                        <Check size={18} />
                    </button>
                </div>

                {/* ── Delete (existing only) ── */}
                {!isNew && onDelete && (
                    <button
                        onClick={() => onDelete(expander.abbr)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-themeredred bg-themeredred/5 active:scale-[0.98] transition-all"
                    >
                        <Trash2 size={16} />
                        <span className="text-sm font-medium">Delete Template</span>
                    </button>
                )}
            </div>
        </div>
    );
};
