import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { MASTER_BLOCKS_TOP_LEVEL, MSK_CHILD_KEYS, MASTER_BLOCK_LIBRARY } from '../../Data/PhysicalExamData';
import type { CustomExamTemplate } from '../../Data/User';

export const PhysicalExamPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const templates = profile.customExamTemplates ?? [];

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editBlockKeys, setEditBlockKeys] = useState<string[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const save = useCallback((next: CustomExamTemplate[]) => {
        updateProfile({ customExamTemplates: next });
        syncProfileField({ custom_exam_templates: next });
    }, [updateProfile, syncProfileField]);

    const handleAdd = useCallback(() => {
        const id = crypto.randomUUID();
        setEditingId(id);
        setEditName('');
        setEditBlockKeys([]);
    }, []);

    const handleEdit = useCallback((t: CustomExamTemplate) => {
        setEditingId(t.id);
        setEditName(t.name);
        setEditBlockKeys([...t.blockIds]);
    }, []);

    const handleSave = useCallback(() => {
        if (!editingId || !editName.trim()) return;
        const entry: CustomExamTemplate = {
            id: editingId,
            name: editName.trim(),
            blockIds: editBlockKeys,
        };
        const exists = templates.some(t => t.id === editingId);
        const next = exists
            ? templates.map(t => t.id === editingId ? entry : t)
            : [...templates, entry];
        save(next);
        setEditingId(null);
    }, [editingId, editName, editBlockKeys, templates, save]);

    const handleCancel = useCallback(() => {
        setEditingId(null);
        setConfirmDeleteId(null);
    }, []);

    const handleDelete = useCallback((id: string) => {
        save(templates.filter(t => t.id !== id));
        setConfirmDeleteId(null);
        if (editingId === id) setEditingId(null);
    }, [templates, save, editingId]);

    const toggleBlock = useCallback((key: string) => {
        setEditBlockKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    }, []);

    const blockLabel = (key: string) =>
        MASTER_BLOCK_LIBRARY[key]?.label ?? key;

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Create reusable PE exam templates for quick provider note setup.
                </p>

                {/* Template list */}
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Templates</p>
                        <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                            {templates.length}
                        </span>
                    </div>

                    {/* Inline editor */}
                    {editingId && (
                        <div className="rounded-xl bg-themewhite2 divide-y divide-tertiary/10">
                            <div className="px-4 py-3">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Template name"
                                    className="w-full bg-transparent outline-none text-base font-semibold text-primary placeholder:text-tertiary"
                                    autoFocus
                                />
                            </div>

                            <div className="px-4 py-3.5">
                                <p className="text-[9pt] text-tertiary uppercase tracking-wider mb-1.5">Exam Blocks</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {MASTER_BLOCKS_TOP_LEVEL.map(block => {
                                        const selected = editBlockKeys.includes(block.key);
                                        return (
                                            <button
                                                key={block.key}
                                                type="button"
                                                onClick={() => toggleBlock(block.key)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                                                    selected
                                                        ? 'bg-themegreen/15 text-themegreen ring-1 ring-inset ring-themegreen/20'
                                                        : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                                                }`}
                                            >
                                                {block.label}
                                            </button>
                                        );
                                    })}
                                    {/* MSK child blocks */}
                                    {editBlockKeys.includes('msk') && MSK_CHILD_KEYS.map(childKey => {
                                        const child = MASTER_BLOCK_LIBRARY[childKey];
                                        if (!child) return null;
                                        const selected = editBlockKeys.includes(childKey);
                                        return (
                                            <button
                                                key={childKey}
                                                type="button"
                                                onClick={() => toggleBlock(childKey)}
                                                className={`px-2.5 py-1 rounded-full text-[9pt] font-medium transition-all active:scale-95 ${
                                                    selected
                                                        ? 'bg-themeblue3/15 text-themeblue3 ring-1 ring-inset ring-themeblue3/20'
                                                        : 'bg-tertiary/5 text-tertiary hover:bg-tertiary/10'
                                                }`}
                                            >
                                                {child.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {editBlockKeys.length > 0 && (
                                    <p className="text-[9pt] text-tertiary mt-2">
                                        {editBlockKeys.length} block{editBlockKeys.length !== 1 ? 's' : ''} selected
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-1.5 px-4 py-2.5">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                                >
                                    <X size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!editName.trim()}
                                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                                >
                                    <Check size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Existing templates */}
                    <div className="rounded-xl bg-themewhite2 overflow-hidden">
                        {templates.length > 0 ? (
                            <div className="divide-y divide-tertiary/8 px-2">
                                {templates.map(t => (
                                    <div key={t.id} className="flex items-center py-2.5 px-2 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-primary truncate">{t.name}</p>
                                            <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                                                {t.blockIds.length > 0
                                                    ? t.blockIds.map(blockLabel).join(', ')
                                                    : 'No blocks selected'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(t)}
                                            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        {confirmDeleteId === t.id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(t.id)}
                                                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-themeredred/10 text-themeredred active:scale-95 transition-all"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDeleteId(t.id)}
                                                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : !editingId ? (
                            <p className="text-sm text-tertiary py-4 text-center">
                                No exam templates configured
                            </p>
                        ) : null}
                    </div>

                    {/* Add button */}
                    {!editingId && (
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue3 text-sm font-medium hover:bg-themeblue3/12 active:scale-[0.98] transition-all"
                        >
                            <Plus size={16} />
                            Add Template
                        </button>
                    )}
                </section>
            </div>
        </div>
    );
};
