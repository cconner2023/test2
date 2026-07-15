import { useMemo, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { SearchInput } from '@/Components/primitives/SearchInput';
import type { TextExpander } from '@/Data/User';

/** A text template carrying merge provenance (see useMergedNoteContent.MergedTextExpander). */
type PickableExpander = TextExpander & {
    sourceClinicName?: string | null;
    sourceCollides?: boolean;
};

interface TextTemplatePickerProps {
    expanders: PickableExpander[];
    onPick: (expander: TextExpander) => void;
    onClose: () => void;
}

function previewOf(e: PickableExpander): string {
    if (e.template && e.template.length > 0) return `${e.template.length} step template`;
    const firstLine = e.expansion.split('\n')[0];
    const isMultiLine = e.expansion.includes('\n');
    return firstLine.length > 80
        ? firstLine.slice(0, 77) + '...'
        : firstLine + (isMultiLine ? ' ...' : '');
}

/**
 * Browse-and-insert panel for text templates — the discovery counterpart to the
 * abbreviation-triggered TextExpanderSuggestion. Opens from the Variable affordance
 * on a note editor so a user who doesn't know a template's abbr (especially
 * clinic/cluster-scoped ones) can still find and apply it. Applying a *templated*
 * entry starts its fill session via the host's onPick.
 */
export const TextTemplatePicker = ({ expanders, onPick, onClose }: TextTemplatePickerProps) => {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return expanders;
        return expanders.filter(
            (e) => e.abbr.toLowerCase().includes(q) || e.expansion.toLowerCase().includes(q),
        );
    }, [expanders, query]);

    return (
        <>
            {/* outside-click catcher */}
            <div className="fixed inset-0 z-20" onMouseDown={onClose} />
            <div
                onMouseDown={(e) => e.preventDefault()}
                className="absolute left-2 right-2 bottom-11 z-30 rounded-lg bg-themewhite border border-themeblue2/25 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 overflow-hidden flex flex-col max-h-[16rem]"
            >
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 border-b border-tertiary/8">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Search templates…"
                        autoFocus
                        className="flex-1"
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                        className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                        aria-label="Close templates"
                        tabIndex={-1}
                    >
                        <X size={16} className="text-tertiary" />
                    </button>
                </div>

                <div className="overflow-y-auto min-h-0">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-tertiary">
                            {expanders.length === 0 ? 'No text templates yet' : 'No matching templates'}
                        </div>
                    ) : (
                        filtered.map((s, i) => {
                            const hasTemplate = !!s.template && s.template.length > 0;
                            const sourceLabel = s.sourceClinicName ?? null;
                            return (
                                <div
                                    key={`${s.abbr}-${i}`}
                                    onClick={() => onPick(s)}
                                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer active:bg-themeblue2/12 ${i > 0 ? 'border-t border-tertiary/8' : ''}`}
                                >
                                    <code className="shrink-0 text-[9pt] font-mono font-semibold bg-themeblue2/10 text-themeblue2 px-1.5 py-0.5 rounded self-start mt-0.5">
                                        {s.abbr}
                                    </code>
                                    {hasTemplate && (
                                        <span className="shrink-0 self-start mt-0.5">
                                            <Layers size={11} className="text-themepurple/70" />
                                        </span>
                                    )}
                                    <span className="text-tertiary text-[10pt] shrink-0 self-start mt-0.5">&rarr;</span>
                                    <span className="text-sm text-tertiary truncate flex-1 min-w-0">{previewOf(s)}</span>
                                    {sourceLabel && (
                                        <span className="shrink-0 self-start mt-0.5 text-[8pt] font-medium text-themeblue2/80 bg-themeblue2/8 px-1.5 py-0.5 rounded-full max-w-[6rem] truncate">
                                            {sourceLabel}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};
