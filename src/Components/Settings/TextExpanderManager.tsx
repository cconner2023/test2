import { TextCursorInput, Layers, Check, X } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';

const templatePreview = (nodes: TemplateNode[]): string =>
    nodes.map(n => {
        switch (n.type) {
            case 'text': return n.content;
            case 'step': return `[${n.label}]`;
            case 'choice': return `[${n.label}]`;
            case 'branch': return `[${n.triggerField}]`;
        }
    }).join(' - ');

const expansionPreview = (e: TextExpander): string => {
    if (e.template && e.template.length > 0) return templatePreview(e.template);
    return e.expansion;
};

interface TextExpanderManagerProps {
    expanders: TextExpander[];
    editing?: boolean;
    stagedDeletes: Set<string>;
    stagedAdds: TextExpander[];
    onToggleDelete: (abbr: string) => void;
    onUnstageAdd: (abbr: string) => void;
    /** Tap a card in non-edit mode to view/edit */
    onCardTap?: (expander: TextExpander) => void;
    /** Abbreviation input field */
    inputAbbr: string;
    onInputAbbrChange: (value: string) => void;
    onInputAbbrSubmit: () => void;
    inputError: string;
    onClearInput: () => void;
}

export const TextExpanderManager = ({
    expanders, editing = false,
    stagedDeletes, stagedAdds, onToggleDelete, onUnstageAdd,
    onCardTap,
    inputAbbr, onInputAbbrChange, onInputAbbrSubmit, inputError, onClearInput,
}: TextExpanderManagerProps) => {
    const totalCount = expanders.length + stagedAdds.length - stagedDeletes.size;
    const hasItems = expanders.length > 0 || stagedAdds.length > 0;

    return (
        <section>
            <div className="pb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Templates</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                    {totalCount}
                </span>
            </div>

            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">

                    {/* Add input — edit-gated */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editing ? 'max-h-16 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    }`}>
                        <div className="relative">
                            <div className="flex items-center gap-1.5">
                                <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                    <input
                                        type="text"
                                        value={inputAbbr}
                                        onChange={(e) => onInputAbbrChange(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onInputAbbrSubmit(); } }}
                                        placeholder="New shortcut..."
                                        className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                                    />
                                </div>
                                {inputAbbr.trim() && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={onClearInput}
                                            className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onInputAbbrSubmit}
                                            className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                        >
                                            <Check size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                            {inputError && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 z-10">
                                    <p className="text-xs font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center">
                                        {inputError}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Template list */}
                    {hasItems ? (
                        <div className="space-y-0.5">
                            {expanders.map(e => {
                                const isTemplate = e.template && e.template.length > 0;
                                const isMarkedDelete = stagedDeletes.has(e.abbr);
                                const Icon = isTemplate ? Layers : TextCursorInput;
                                const iconBg = isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                                const iconColor = isTemplate ? 'text-themepurple' : 'text-themeblue2';

                                return (
                                    <div
                                        key={e.abbr}
                                        onClick={
                                            editing
                                                ? () => onToggleDelete(e.abbr)
                                                : onCardTap
                                                    ? () => onCardTap(e)
                                                    : undefined
                                        }
                                        className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors ${
                                            isMarkedDelete
                                                ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-[0.98]'
                                                : editing
                                                    ? 'cursor-pointer active:scale-[0.98] hover:bg-themeredred/5'
                                                    : onCardTap
                                                        ? 'cursor-pointer active:scale-[0.98]'
                                                        : ''
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                            <Icon size={14} className={iconColor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${
                                                isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                            }`}>{e.abbr}</p>
                                            <p className={`text-[11px] mt-0.5 leading-relaxed ${
                                                isMarkedDelete ? 'text-themeredred/30' : 'text-tertiary/50'
                                            }`}>
                                                {expansionPreview(e)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}

                            {stagedAdds.map(e => {
                                const isTemplate = e.template && e.template.length > 0;
                                const Icon = isTemplate ? Layers : TextCursorInput;
                                const iconBg = isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                                const iconColor = isTemplate ? 'text-themepurple' : 'text-themeblue2';

                                return (
                                    <div
                                        key={`add-${e.abbr}`}
                                        onClick={editing ? () => onUnstageAdd(e.abbr) : undefined}
                                        className="flex items-start gap-3 py-2 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98] transition-all"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                            <Icon size={14} className={iconColor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-primary truncate">{e.abbr}</p>
                                            <p className="text-[11px] text-tertiary/50 mt-0.5 leading-relaxed">
                                                {expansionPreview(e)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary/50 py-2 text-center">
                            No templates configured
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
