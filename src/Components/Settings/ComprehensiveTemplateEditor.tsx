import { useState } from 'react';
import { ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react';
import { BASELINE_WRAPPERS, SYSTEM_BLOCKS, BLOCK_LIBRARY, COMPREHENSIVE_DEFAULT_BLOCK_IDS } from '../../Data/PhysicalExamData';
import type { ComprehensivePETemplate } from '../../Data/User';

interface ComprehensiveTemplateEditorProps {
    template: ComprehensivePETemplate | undefined;
    onChange: (template: ComprehensivePETemplate) => void;
    editing?: boolean;
}

const ADDABLE_BLOCKS = [...BASELINE_WRAPPERS, ...SYSTEM_BLOCKS];

export const ComprehensiveTemplateEditor = ({ template, onChange, editing = true }: ComprehensiveTemplateEditorProps) => {
    const [showPicker, setShowPicker] = useState(false);

    const blockIds = template?.blockIds ?? COMPREHENSIVE_DEFAULT_BLOCK_IDS;

    const move = (index: number, direction: -1 | 1) => {
        const next = [...blockIds];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= next.length) return;
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
        onChange({ ...template, blockIds: next });
    };

    const remove = (index: number) => {
        const next = blockIds.filter((_, i) => i !== index);
        onChange({ ...template, blockIds: next });
    };

    const addBlock = (key: string) => {
        if (blockIds.includes(key)) return;
        onChange({ ...template, blockIds: [...blockIds, key] });
        setShowPicker(false);
    };

    const availableToAdd = ADDABLE_BLOCKS.filter(b => !blockIds.includes(b.key));

    return (
        <section>
            <div className="pb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Comprehensive Template</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                    {blockIds.length}
                </span>
            </div>

            {/* Block picker — edit-gated */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
                editing && showPicker && availableToAdd.length > 0 ? 'max-h-80 opacity-100 mb-3' : 'max-h-0 opacity-0'
            }`}>
                <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 space-y-2">
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Add Block</p>
                    <div className="space-y-0.5">
                        {availableToAdd.map(b => (
                            <button
                                key={b.key}
                                onClick={() => addBlock(b.key)}
                                className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left text-sm text-primary hover:bg-themeblue2/5 transition-colors active:scale-95"
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowPicker(false)}
                        className="text-sm text-tertiary/60 hover:text-tertiary transition-colors active:scale-95 px-2 py-1"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Block list */}
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    {/* Add button — edit-gated, hidden when picker is open */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editing && !showPicker && availableToAdd.length > 0 ? 'max-h-14 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    }`}>
                        <button
                            onClick={() => setShowPicker(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-themeblue2/30 text-sm text-themeblue2 hover:bg-themeblue2/5 transition-colors active:scale-95"
                        >
                            Add Block
                        </button>
                    </div>

                    <div className="space-y-0.5">
                        {blockIds.map((key, index) => {
                            const block = BLOCK_LIBRARY[key];
                            const label = block?.label ?? key;
                            return (
                                <div
                                    key={key}
                                    className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-tertiary/5"
                                >
                                    <p className="text-sm font-medium text-primary flex-1 min-w-0 truncate">{label}</p>
                                    <div className={`flex items-center gap-0 overflow-hidden transition-all duration-200 ease-out ${
                                        editing ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'
                                    }`}>
                                        <button
                                            onClick={() => move(index, -1)}
                                            disabled={index === 0}
                                            className="shrink-0 p-1.5 rounded-full hover:bg-tertiary/10 transition-colors disabled:opacity-30 active:scale-95"
                                            aria-label={`Move ${label} up`}
                                        >
                                            <ChevronUp size={13} className="text-tertiary/50" />
                                        </button>
                                        <button
                                            onClick={() => move(index, 1)}
                                            disabled={index === blockIds.length - 1}
                                            className="shrink-0 p-1.5 rounded-full hover:bg-tertiary/10 transition-colors disabled:opacity-30 active:scale-95"
                                            aria-label={`Move ${label} down`}
                                        >
                                            <ChevronDown size={13} className="text-tertiary/50" />
                                        </button>
                                        <button
                                            onClick={() => remove(index)}
                                            className="shrink-0 p-1.5 rounded-full hover:bg-themeredred/10 transition-colors active:scale-95"
                                            aria-label={`Remove ${label}`}
                                        >
                                            <Trash2 size={13} className="text-themeredred/50" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};
