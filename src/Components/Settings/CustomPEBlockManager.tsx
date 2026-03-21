import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Pencil, Trash2, CircleX } from 'lucide-react';
import type { CustomPEBlock } from '../../Data/User';

interface CustomPEBlockManagerProps {
    blocks: CustomPEBlock[];
    onChange: (blocks: CustomPEBlock[]) => void;
    editing?: boolean;
}

export const CustomPEBlockManager = ({ blocks, onChange, editing = true }: CustomPEBlockManagerProps) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [normalText, setNormalText] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [error, setError] = useState('');

    const validate = (n: string, skipId?: string): string => {
        if (!n.trim()) return 'Block name is required';
        const duplicate = blocks.some(
            (b) => b.id !== skipId && b.name.toLowerCase() === n.trim().toLowerCase(),
        );
        if (duplicate) return 'Block name already exists';
        return '';
    };

    const startAdd = () => {
        setEditingId(null);
        setName('');
        setNormalText('');
        setTags([]);
        setTagInput('');
        setError('');
        setIsAdding(true);
    };

    const startEdit = (block: CustomPEBlock) => {
        setIsAdding(false);
        setEditingId(block.id);
        setName(block.name);
        setNormalText(block.normalText);
        setTags([...block.abnormalTags]);
        setTagInput('');
        setError('');
    };

    const cancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setName('');
        setNormalText('');
        setTags([]);
        setTagInput('');
        setError('');
    };

    const addTag = () => {
        const trimmed = tagInput.trim();
        if (!trimmed) return;
        if (tags.includes(trimmed)) { setTagInput(''); return; }
        setTags([...tags, trimmed]);
        setTagInput('');
    };

    const removeTag = (index: number) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    const save = () => {
        const err = validate(name, editingId ?? undefined);
        if (err) { setError(err); return; }

        if (editingId) {
            const next = blocks.map(b =>
                b.id === editingId
                    ? { ...b, name: name.trim(), normalText: normalText.trim(), abnormalTags: tags }
                    : b,
            );
            onChange(next);
        } else {
            const newBlock: CustomPEBlock = {
                id: crypto.randomUUID(),
                name: name.trim(),
                normalText: normalText.trim(),
                abnormalTags: tags,
            };
            onChange([...blocks, newBlock]);
        }
        cancel();
    };

    const handleDelete = (id: string) => {
        onChange(blocks.filter(b => b.id !== id));
        if (editingId === id) cancel();
    };

    const isFormOpen = editing && (isAdding || editingId !== null);

    return (
        <section>
            <div className="pb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Custom Exam Blocks</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                    {blocks.length}
                </span>
            </div>

            {/* Inline add/edit form — edit-gated */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
                isFormOpen ? 'max-h-[600px] opacity-100 mb-3' : 'max-h-0 opacity-0'
            }`}>
                <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 space-y-3">
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
                        {editingId ? 'Edit Block' : 'New Block'}
                    </p>

                    <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder="Block name (e.g. VS, CARDIO)"
                            className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                            autoFocus
                        />
                    </div>

                    <textarea
                        value={normalText}
                        onChange={(e) => setNormalText(e.target.value)}
                        placeholder="Normal text (e.g. VS: Reviewed, BP: Reviewed...)"
                        className="w-full min-h-[3rem] px-3.5 py-2.5 rounded-xl text-sm text-primary border border-themeblue3/10 shadow-xs bg-themewhite focus:border-themeblue1/30 focus:outline-none transition-all placeholder:text-tertiary/30 resize-none leading-5"
                    />

                    {/* Abnormal tags */}
                    <div>
                        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-1.5">
                            Abnormal Tags
                        </p>
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                    placeholder="Add abnormal tag..."
                                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                                />
                            </div>
                            {tagInput.trim() && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setTagInput('')}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addTag}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                        {tags.length > 0 && (
                            <div className="space-y-0.5">
                                {tags.map((tag, i) => (
                                    <div
                                        key={i}
                                        onClick={() => removeTag(i)}
                                        className="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer active:scale-95 hover:bg-themeredred/5 transition-colors"
                                    >
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-themeredred/10 shrink-0">
                                            <CircleX size={12} className="text-themeredred/60" />
                                        </div>
                                        <p className="text-sm text-primary">{tag}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="text-xs font-medium text-center py-1.5 px-4 rounded-full text-themeredred bg-themeredred/5">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2 justify-end pt-1">
                        <button
                            onClick={cancel}
                            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full text-tertiary hover:bg-tertiary/10 transition-colors active:scale-95"
                        >
                            <X size={14} />
                            Cancel
                        </button>
                        <button
                            onClick={save}
                            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-themeblue3 text-white hover:bg-themeblue3/90 transition-colors active:scale-95"
                        >
                            <Check size={14} />
                            {editingId ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Blocks list */}
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    {/* Add button — edit-gated, hidden when form is open */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editing && !isFormOpen ? 'max-h-14 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    }`}>
                        <button
                            onClick={startAdd}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-themeblue2/30 text-sm text-themeblue2 hover:bg-themeblue2/5 transition-colors active:scale-95"
                        >
                            Add Block
                        </button>
                    </div>

                    {blocks.length > 0 ? (
                        <div className="space-y-0.5">
                            {blocks.map((block) => {
                                const isExpanded = expandedId === block.id;
                                return (
                                    <div key={block.id}>
                                        <div
                                            className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-tertiary/5 cursor-pointer active:scale-[0.98]"
                                            onClick={() => setExpandedId(prev => prev === block.id ? null : block.id)}
                                        >
                                            {isExpanded
                                                ? <ChevronDown size={14} className="text-tertiary/50 shrink-0" />
                                                : <ChevronRight size={14} className="text-tertiary/50 shrink-0" />
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-primary truncate">{block.name}</p>
                                                <p className="text-[10px] text-tertiary/50">
                                                    {block.abnormalTags.length} tag{block.abnormalTags.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className={`flex items-center gap-0 overflow-hidden transition-all duration-200 ease-out ${
                                                editing ? 'max-w-20 opacity-100' : 'max-w-0 opacity-0'
                                            }`}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEdit(block); }}
                                                    className="shrink-0 p-1.5 rounded-full hover:bg-tertiary/10 transition-colors active:scale-95"
                                                    aria-label={`Edit ${block.name}`}
                                                >
                                                    <Pencil size={13} className="text-tertiary/50" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(block.id); }}
                                                    className="shrink-0 p-1.5 rounded-full hover:bg-themeredred/10 transition-colors active:scale-95"
                                                    aria-label={`Delete ${block.name}`}
                                                >
                                                    <Trash2 size={13} className="text-themeredred/50" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        <div className={`overflow-hidden transition-all duration-300 ease-out ${
                                            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                        }`}>
                                            <div className="pl-8 pr-2 pb-2 space-y-2">
                                                <div>
                                                    <p className="text-[10px] font-semibold text-tertiary/40 tracking-widest uppercase mb-0.5">Normal</p>
                                                    <p className="text-sm text-tertiary/70 py-0.5 px-2">
                                                        {block.normalText || <span className="italic">Not set</span>}
                                                    </p>
                                                </div>
                                                {block.abnormalTags.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-tertiary/40 tracking-widest uppercase mb-0.5">Abnormal Tags</p>
                                                        <div className="space-y-0.5">
                                                            {block.abnormalTags.map((tag, i) => (
                                                                <p key={i} className="text-sm text-tertiary/70 py-0.5 px-2">
                                                                    {tag}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary/50 py-2 text-center">
                            {editing ? 'Create your first exam block' : 'No custom blocks configured'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
