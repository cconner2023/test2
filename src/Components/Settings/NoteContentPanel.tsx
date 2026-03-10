import { useState, useCallback } from 'react';
import { FileText, Stethoscope, ClipboardList, TextCursorInput, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Shield } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import type { UserTypes, TextExpander, CustomPEBlock, PlanOrderTags, PlanOrderCategory, PlanOrderSet, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../../Data/User';
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
                            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                            autoFocus
                        />
                        <textarea
                            value={normalText}
                            onChange={(e) => setNormalText(e.target.value)}
                            placeholder="Normal text (e.g. VS: Reviewed, BP: Reviewed...)"
                            className="w-full min-h-[3rem] text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5"
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
                                    className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
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
                            className="text-[11px] px-3 py-1 rounded-md bg-themeblue3 text-white hover:bg-themeblue3/90 transition-colors"
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

// ── Plan Tag Manager ────────────────────────────────────────

interface PlanTagListProps {
    label: string;
    tags: string[];
    onChange: (tags: string[]) => void;
}

const PlanTagList = ({ label, tags, onChange }: PlanTagListProps) => {
    const [input, setInput] = useState('');

    const addTag = () => {
        const trimmed = input.trim();
        if (!trimmed || tags.includes(trimmed)) { setInput(''); return; }
        onChange([...tags, trimmed]);
        setInput('');
    };

    const removeTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-tertiary/70">{label}</p>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full border border-themeblue2/20 bg-themeblue2/5 text-tertiary"
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
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Type tag and press Enter"
                    className="flex-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                />
                <button
                    onClick={addTag}
                    className="text-[11px] px-2 py-1 rounded-md bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors shrink-0"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

interface PlanTagManagerProps {
    orderTags: PlanOrderTags;
    instructionTags: string[];
    onOrderTagsChange: (tags: PlanOrderTags) => void;
    onInstructionTagsChange: (tags: string[]) => void;
}

const PlanTagManager = ({ orderTags, instructionTags, onOrderTagsChange, onInstructionTagsChange }: PlanTagManagerProps) => {
    const handleOrderCategoryChange = (cat: PlanOrderCategory, tags: string[]) => {
        onOrderTagsChange({ ...orderTags, [cat]: tags });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Order Tags</p>
                {PLAN_ORDER_CATEGORIES.map(cat => (
                    <PlanTagList
                        key={cat}
                        label={PLAN_ORDER_LABELS[cat]}
                        tags={orderTags[cat]}
                        onChange={(tags) => handleOrderCategoryChange(cat, tags)}
                    />
                ))}
            </div>
            <div>
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-2">Instruction Tags</p>
                <PlanTagList
                    label="Instructions"
                    tags={instructionTags}
                    onChange={onInstructionTagsChange}
                />
            </div>
        </div>
    );
};

// ── Order Set Manager ───────────────────────────────────────

const ALL_PLAN_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];
const ALL_PLAN_BLOCK_LABELS: Record<PlanBlockKey, string> = {
    ...PLAN_ORDER_LABELS,
    instructions: 'Instructions',
};

interface OrderSetManagerProps {
    orderSets: PlanOrderSet[];
    orderTags: PlanOrderTags;
    instructionTags: string[];
    onChange: (sets: PlanOrderSet[]) => void;
}

const OrderSetManager = ({ orderSets, orderTags, instructionTags, onChange }: OrderSetManagerProps) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [presets, setPresets] = useState<Partial<Record<PlanBlockKey, string[]>>>({});
    const [error, setError] = useState('');

    const allTags: Record<PlanBlockKey, string[]> = {
        ...orderTags,
        instructions: instructionTags,
    };

    // Only show block categories that have tags configured
    const availableBlocks = ALL_PLAN_BLOCK_KEYS.filter(k => allTags[k].length > 0);

    const validate = (n: string, skipId?: string): string => {
        if (!n.trim()) return 'Name is required';
        if (orderSets.some(s => s.id !== skipId && s.name.toLowerCase() === n.trim().toLowerCase()))
            return 'Name already exists';
        return '';
    };

    const startAdd = () => {
        setEditingId(null);
        setName('');
        setPresets({});
        setError('');
        setIsAdding(true);
    };

    const startEdit = (os: PlanOrderSet) => {
        setIsAdding(false);
        setEditingId(os.id);
        setName(os.name);
        setPresets(JSON.parse(JSON.stringify(os.presets)));
        setError('');
    };

    const cancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setName('');
        setPresets({});
        setError('');
    };

    const togglePresetTag = (key: PlanBlockKey, tag: string) => {
        setPresets(prev => {
            const current = prev[key] ?? [];
            const next = current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag];
            return { ...prev, [key]: next };
        });
    };

    const save = () => {
        const err = validate(name, editingId ?? undefined);
        if (err) { setError(err); return; }

        // Strip empty arrays from presets
        const cleaned: Partial<Record<PlanBlockKey, string[]>> = {};
        for (const key of ALL_PLAN_BLOCK_KEYS) {
            const tags = presets[key];
            if (tags && tags.length > 0) cleaned[key] = tags;
        }

        if (editingId) {
            onChange(orderSets.map(s =>
                s.id === editingId ? { ...s, name: name.trim(), presets: cleaned } : s,
            ));
        } else {
            onChange([...orderSets, { id: crypto.randomUUID(), name: name.trim(), presets: cleaned }]);
        }
        cancel();
    };

    const handleDelete = (id: string) => {
        onChange(orderSets.filter(s => s.id !== id));
        if (editingId === id) cancel();
    };

    const isFormOpen = isAdding || editingId !== null;

    // Count total preset tags across all blocks
    const countPresetTags = (os: PlanOrderSet) =>
        ALL_PLAN_BLOCK_KEYS.reduce((sum, k) => sum + (os.presets[k]?.length ?? 0), 0);

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Order Sets</p>

            {/* Existing sets */}
            {orderSets.length > 0 && (
                <div className="space-y-1">
                    {orderSets.map(os => (
                        <div key={os.id} className="rounded-lg bg-themewhite3 border border-tertiary/10 overflow-hidden">
                            <div
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                                onClick={() => setExpandedId(prev => prev === os.id ? null : os.id)}
                            >
                                {expandedId === os.id
                                    ? <ChevronDown size={13} className="text-tertiary/50 shrink-0" />
                                    : <ChevronRight size={13} className="text-tertiary/50 shrink-0" />
                                }
                                <span className="text-xs font-medium text-primary truncate flex-1 min-w-0">
                                    {os.name}
                                </span>
                                <span className="text-[10px] text-tertiary/50 shrink-0">
                                    {countPresetTags(os)} tag{countPresetTags(os) !== 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(os); }}
                                    className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                                    aria-label={`Edit ${os.name}`}
                                >
                                    <Pencil size={13} className="text-tertiary/50" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(os.id); }}
                                    className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors"
                                    aria-label={`Delete ${os.name}`}
                                >
                                    <Trash2 size={13} className="text-themeredred/50" />
                                </button>
                            </div>
                            {expandedId === os.id && (
                                <div className="px-3 pb-2 space-y-1">
                                    {ALL_PLAN_BLOCK_KEYS.map(key => {
                                        const tags = os.presets[key];
                                        if (!tags || tags.length === 0) return null;
                                        return (
                                            <div key={key}>
                                                <p className="text-[10px] text-tertiary/60 font-medium">{ALL_PLAN_BLOCK_LABELS[key]}</p>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {tags.map((tag, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 text-[10px] rounded-full border border-themeblue2/20 bg-themeblue2/5 text-tertiary">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add/edit form */}
            {isFormOpen && (
                <div className="space-y-3 px-3 py-3 rounded-lg border border-themeblue2/20 bg-themeblue2/5">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        placeholder="Order set name (e.g. MSK, URI)"
                        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                        autoFocus
                    />
                    {availableBlocks.map(key => (
                        <div key={key} className="space-y-1">
                            <p className="text-[10px] text-tertiary/60 font-medium">{ALL_PLAN_BLOCK_LABELS[key]}</p>
                            <div className="flex flex-wrap gap-1">
                                {allTags[key].map(tag => {
                                    const selected = presets[key]?.includes(tag) ?? false;
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => togglePresetTag(key, tag)}
                                            className={`px-1.5 py-0.5 text-[10px] rounded-full border transition-colors ${
                                                selected
                                                    ? 'bg-themeblue2/20 border-themeblue2/40 text-primary font-medium'
                                                    : 'border-tertiary/20 bg-themewhite text-tertiary hover:bg-tertiary/5'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {error && <p className="text-[10px] text-themeredred">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button onClick={cancel} className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors">
                            Cancel
                        </button>
                        <button onClick={save} className="text-[11px] px-3 py-1 rounded-md bg-themeblue3 text-white hover:bg-themeblue3/90 transition-colors">
                            {editingId ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>
            )}

            {!isFormOpen && (
                <button
                    onClick={startAdd}
                    className="flex items-center gap-1.5 text-[11px] text-themeblue2 hover:text-themeblue2/80 transition-colors px-1 py-1"
                >
                    <Plus size={14} />
                    <span>Add Order Set</span>
                </button>
            )}
        </div>
    );
};

export const NoteContentPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const isDevRole = useAuthStore((s) => s.isDevRole);

    const tc3Mode = profile.tc3Mode ?? false;
    const includeHPI = profile.noteIncludeHPI ?? true;
    const includePE = profile.noteIncludePE ?? false;
    const peDepth = profile.peDepth ?? 'minimal';
    const customPEBlocks = profile.customPEBlocks ?? [];
    const includePlan = profile.noteIncludePlan ?? false;
    const planOrderTags = profile.planOrderTags ?? { referral: [], meds: [], radiology: [], lab: [] };
    const planInstructionTags = profile.planInstructionTags ?? [];
    const planOrderSets = profile.planOrderSets ?? [];
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
        if (fields.noteIncludePlan !== undefined) dbFields.note_include_plan = fields.noteIncludePlan;
        if (fields.planOrderTags !== undefined) dbFields.plan_order_tags = fields.planOrderTags;
        if (fields.planInstructionTags !== undefined) dbFields.plan_instruction_tags = fields.planInstructionTags;
        if (fields.planOrderSets !== undefined) dbFields.plan_order_sets = fields.planOrderSets;
        if (fields.tc3Mode !== undefined) dbFields.tc3_mode = fields.tc3Mode;

        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* Description */}
                <p className="text-xs text-tertiary leading-relaxed">
                    Customize how you write your notes. Enabled sections can still be toggled per note.
                </p>

                {/* TC3 Mode Toggle — dev-only */}
                {isDevRole && (
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-tertiary/15 bg-themewhite2 cursor-pointer"
                        onClick={() => handleUpdate({ tc3Mode: !tc3Mode })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ tc3Mode: !tc3Mode }); } }}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tc3Mode ? 'bg-themeredred/15' : 'bg-tertiary/10'}`}>
                            <Shield size={18} className={tc3Mode ? 'text-themeredred' : 'text-tertiary/50'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${tc3Mode ? 'text-primary' : 'text-tertiary'}`}>TC3 / Battle Injury</p>
                            <p className="text-[11px] text-tertiary/70 mt-0.5">
                                {tc3Mode
                                    ? 'Main content shows TC3 Card (DD 1380) for battle injury documentation.'
                                    : 'Switch to TCCC Casualty Card mode for battle injuries.'
                                }
                            </p>
                        </div>
                        <ToggleSwitch checked={tc3Mode} />
                    </div>
                )}

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

                {/* Plan */}
                <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                        onClick={() => handleUpdate({ noteIncludePlan: !includePlan })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ noteIncludePlan: !includePlan }); } }}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${includePlan ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                            <ClipboardList size={18} className={includePlan ? 'text-themeblue2' : 'text-tertiary/50'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${includePlan ? 'text-primary' : 'text-tertiary'}`}>Plan</p>
                            <p className="text-[11px] text-tertiary/70 mt-0.5">Orders and patient instructions</p>
                        </div>
                        <ToggleSwitch checked={includePlan} />
                    </div>

                    {/* Plan tag managers — shown when enabled */}
                    {includePlan && (
                        <div className="border-t border-tertiary/10 px-4 py-3">
                            <PlanTagManager
                                orderTags={planOrderTags}
                                instructionTags={planInstructionTags}
                                onOrderTagsChange={(tags) => handleUpdate({ planOrderTags: tags })}
                                onInstructionTagsChange={(tags) => handleUpdate({ planInstructionTags: tags })}
                            />
                        </div>
                    )}

                    {/* Order sets — shown when plan enabled and at least one tag exists */}
                    {includePlan && (
                        <div className="border-t border-tertiary/10 px-4 py-3">
                            <OrderSetManager
                                orderSets={planOrderSets}
                                orderTags={planOrderTags}
                                instructionTags={planInstructionTags}
                                onChange={(sets) => handleUpdate({ planOrderSets: sets })}
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
