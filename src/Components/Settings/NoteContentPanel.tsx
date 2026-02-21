import { useState, useCallback } from 'react';
import { FileText, Stethoscope, TextCursorInput, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes, TextExpander, CustomPEBlock } from '../../Data/User';
import { ToggleSwitch } from './ToggleSwitch';
import { TextExpanderManager } from './TextExpanderManager';

type PEDepth = 'minimal' | 'expanded' | 'custom';

const PE_DEPTH_OPTIONS: { value: PEDepth; label: string; description: string }[] = [
    { value: 'minimal', label: 'Minimal', description: 'Vitals + free-text findings only' },
    { value: 'expanded', label: 'Expanded', description: 'Expanded vitals + category-specific items, all normal' },
    { value: 'custom', label: 'Custom', description: 'User-defined exam blocks with normal/abnormal tags' },
];

// ── Custom PE Blocks inline manager ──────────────────────────

interface CustomPEBlockManagerProps {
    blocks: CustomPEBlock[];
    onChange: (blocks: CustomPEBlock[]) => void;
}

const CustomPEBlockManager = ({ blocks, onChange }: CustomPEBlockManagerProps) => {
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

    const toggleExpanded = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const isFormOpen = isAdding || editingId !== null;

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Custom Exam Blocks</p>

            {/* Existing blocks list */}
            {blocks.length > 0 && (
                <div className="space-y-1">
                    {blocks.map((block) => (
                        <div
                            key={block.id}
                            className="rounded-lg bg-themewhite3 border border-tertiary/10 overflow-hidden"
                        >
                            <div
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                                onClick={() => toggleExpanded(block.id)}
                            >
                                {expandedId === block.id
                                    ? <ChevronDown size={13} className="text-tertiary/50 shrink-0" />
                                    : <ChevronRight size={13} className="text-tertiary/50 shrink-0" />
                                }
                                <span className="text-xs font-medium text-primary truncate flex-1 min-w-0">
                                    {block.name}
                                </span>
                                <span className="text-[10px] text-tertiary/50 shrink-0">
                                    {block.abnormalTags.length} tag{block.abnormalTags.length !== 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(block); }}
                                    className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                                    aria-label={`Edit ${block.name}`}
                                >
                                    <Pencil size={13} className="text-tertiary/50" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(block.id); }}
                                    className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors"
                                    aria-label={`Delete ${block.name}`}
                                >
                                    <Trash2 size={13} className="text-themeredred/50" />
                                </button>
                            </div>
                            {expandedId === block.id && (
                                <div className="px-3 pb-2 space-y-1">
                                    <p className="text-[10px] text-tertiary/60">
                                        <span className="font-medium">Normal: </span>
                                        {block.normalText || <span className="italic">none</span>}
                                    </p>
                                    {block.abnormalTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {block.abnormalTags.map((tag, i) => (
                                                <span
                                                    key={i}
                                                    className="px-1.5 py-0.5 text-[10px] rounded-full border border-themeredred/20 bg-themeredred/5 text-tertiary"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Inline add/edit form */}
            {isFormOpen && (
                <div className="space-y-2 px-3 py-3 rounded-lg border border-themeblue2/20 bg-themeblue2/5">
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder="Block name (e.g. VS, CARDIO)"
                            className="w-full text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                            autoFocus
                        />
                        <textarea
                            value={normalText}
                            onChange={(e) => setNormalText(e.target.value)}
                            placeholder="Normal text (e.g. VS: Reviewed, BP: Reviewed...)"
                            className="w-full min-h-[3rem] text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5"
                        />
                        <div>
                            <p className="text-[10px] text-tertiary/50 mb-1">Abnormal Tags</p>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                    {tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full border border-themeredred/20 bg-themeredred/5 text-tertiary"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => removeTag(i)}
                                                className="ml-0.5 hover:text-themeredred transition-colors"
                                                aria-label={`Remove ${tag}`}
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                    placeholder="Type tag and press Enter"
                                    className="flex-1 text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                                />
                                <button
                                    onClick={addTag}
                                    className="text-[11px] px-2 py-1 rounded-md bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors shrink-0"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                    {error && <p className="text-[10px] text-themeredred">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={cancel}
                            className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={save}
                            className="text-[11px] px-3 py-1 rounded-md bg-themeblue2 text-white hover:bg-themeblue2/90 transition-colors"
                        >
                            {editingId ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>
            )}

            {/* Add button */}
            {!isFormOpen && (
                <button
                    onClick={startAdd}
                    className="flex items-center gap-1.5 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors px-1 py-1"
                >
                    <Plus size={14} />
                    <span>Add Block</span>
                </button>
            )}
        </div>
    );
};

export const NoteContentPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();

    const includeHPI = profile.noteIncludeHPI ?? true;
    const includePE = profile.noteIncludePE ?? false;
    const peDepth = profile.peDepth ?? 'minimal';
    const customPEBlocks = profile.customPEBlocks ?? [];
    const textExpanderEnabled = profile.textExpanderEnabled ?? true;
    const textExpanders = profile.textExpanders ?? [];

    /** Update locally (instant) and push to Supabase in the background */
    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);

        const dbFields: Record<string, unknown> = {};
        if (fields.noteIncludeHPI !== undefined) dbFields.note_include_hpi = fields.noteIncludeHPI;
        if (fields.noteIncludePE !== undefined) dbFields.note_include_pe = fields.noteIncludePE;
        if (fields.peDepth !== undefined) dbFields.pe_depth = fields.peDepth;
        if (fields.textExpanderEnabled !== undefined) dbFields.text_expander_enabled = fields.textExpanderEnabled;
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;
        if (fields.customPEBlocks !== undefined) dbFields.custom_pe_blocks = fields.customPEBlocks;

        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* Description */}
                <p className="text-xs text-tertiary leading-relaxed">
                    Customize how you write your notes. Enabled sections can still be toggled per note.
                </p>

                {/* HPI */}
                <div
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-tertiary/15 bg-themewhite2 cursor-pointer"
                    onClick={() => handleUpdate({ noteIncludeHPI: !includeHPI })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ noteIncludeHPI: !includeHPI }); } }}
                >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${includeHPI ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <FileText size={18} className={includeHPI ? 'text-themeblue2' : 'text-tertiary/50'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${includeHPI ? 'text-primary' : 'text-tertiary'}`}>HPI</p>
                        <p className="text-[11px] text-tertiary/70 mt-0.5">History of Present Illness</p>
                    </div>
                    <ToggleSwitch checked={includeHPI} />
                </div>

                {/* Physical Exam */}
                <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                        onClick={() => handleUpdate({ noteIncludePE: !includePE })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ noteIncludePE: !includePE }); } }}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${includePE ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                            <Stethoscope size={18} className={includePE ? 'text-themeblue2' : 'text-tertiary/50'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${includePE ? 'text-primary' : 'text-tertiary'}`}>Physical Exam</p>
                            <p className="text-[11px] text-tertiary/70 mt-0.5">Category-specific physical exam</p>
                        </div>
                        <ToggleSwitch checked={includePE} />
                    </div>

                    {/* PE Depth — nested, shown when enabled */}
                    {includePE && (
                        <div className="border-t border-tertiary/10 px-4 py-3 space-y-1.5">
                            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">PE Depth</p>
                            {PE_DEPTH_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleUpdate({ peDepth: option.value })}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                                        ${peDepth === option.value
                                            ? 'border-themeblue2/25 bg-themeblue2/10'
                                            : 'border-tertiary/15 bg-themewhite hover:bg-themewhite/80'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                        ${peDepth === option.value ? 'border-themeblue2' : 'border-tertiary/30'}`}
                                    >
                                        {peDepth === option.value && (
                                            <div className="w-2 h-2 rounded-full bg-themeblue2" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${peDepth === option.value ? 'text-primary' : 'text-tertiary'}`}>
                                            {option.label}
                                        </p>
                                        <p className="text-[11px] text-tertiary/70 mt-0.5">{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Custom PE Blocks — shown when PE enabled and depth is 'custom' */}
                    {includePE && peDepth === 'custom' && (
                        <div className="border-t border-tertiary/10 px-4 py-3">
                            <CustomPEBlockManager
                                blocks={customPEBlocks}
                                onChange={(next: CustomPEBlock[]) => handleUpdate({ customPEBlocks: next })}
                            />
                        </div>
                    )}
                </div>

                {/* Text Expander */}
                <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                        onClick={() => handleUpdate({ textExpanderEnabled: !textExpanderEnabled })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ textExpanderEnabled: !textExpanderEnabled }); } }}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${textExpanderEnabled ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                            <TextCursorInput size={18} className={textExpanderEnabled ? 'text-themeblue2' : 'text-tertiary/50'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${textExpanderEnabled ? 'text-primary' : 'text-tertiary'}`}>Text Templates</p>
                            <p className="text-[11px] text-tertiary/70 mt-0.5">Think autotext or asutype, but specific to your user account. You don't have to filter through 10,000 Genesis options</p>
                        </div>
                        <ToggleSwitch checked={textExpanderEnabled} />
                    </div>

                    {/* Abbreviations — nested, shown when enabled */}
                    {textExpanderEnabled && (
                        <div className="border-t border-tertiary/10 px-4 py-3">
                            <TextExpanderManager
                                expanders={textExpanders}
                                onChange={(next: TextExpander[]) => handleUpdate({ textExpanders: next })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
