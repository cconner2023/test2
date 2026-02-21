import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { TextExpander } from '../../Data/User';

interface TextExpanderManagerProps {
    expanders: TextExpander[];
    onChange: (expanders: TextExpander[]) => void;
}

export const TextExpanderManager = ({ expanders, onChange }: TextExpanderManagerProps) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [abbr, setAbbr] = useState('');
    const [expansion, setExpansion] = useState('');
    const [error, setError] = useState('');

    const validate = (a: string, exp: string, skipIndex?: number): string => {
        if (!a.trim()) return 'Abbreviation is required';
        if (/\s/.test(a)) return 'Abbreviation cannot contain spaces';
        if (!exp.trim()) return 'Expansion text is required';
        const duplicate = expanders.some(
            (e, i) => i !== skipIndex && e.abbr.toLowerCase() === a.trim().toLowerCase(),
        );
        if (duplicate) return 'Abbreviation already exists';
        return '';
    };

    const startAdd = () => {
        setEditingIndex(null);
        setAbbr('');
        setExpansion('');
        setError('');
        setIsAdding(true);
    };

    const startEdit = (index: number) => {
        const e = expanders[index];
        setIsAdding(false);
        setEditingIndex(index);
        setAbbr(e.abbr);
        setExpansion(e.expansion);
        setError('');
    };

    const cancel = () => {
        setIsAdding(false);
        setEditingIndex(null);
        setAbbr('');
        setExpansion('');
        setError('');
    };

    const save = () => {
        const skipIndex = editingIndex ?? undefined;
        const err = validate(abbr, expansion, skipIndex);
        if (err) { setError(err); return; }

        const entry: TextExpander = { abbr: abbr.trim(), expansion: expansion.trim() };
        if (editingIndex !== null) {
            const next = [...expanders];
            next[editingIndex] = entry;
            onChange(next);
        } else {
            onChange([...expanders, entry]);
        }
        cancel();
    };

    const handleDelete = (index: number) => {
        onChange(expanders.filter((_, i) => i !== index));
        if (editingIndex === index) cancel();
    };

    const isFormOpen = isAdding || editingIndex !== null;

    return (
        <div className="space-y-2">
            {/* Existing expanders list */}
            {expanders.length > 0 && (
                <div className="space-y-1">
                    {expanders.map((e, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themewhite3 border border-tertiary/10"
                        >
                            <code className="shrink-0 text-[11px] font-mono font-semibold bg-themeblue2/10 text-themeblue2 px-1.5 py-0.5 rounded">
                                {e.abbr}
                            </code>
                            <span className="text-tertiary/40 text-xs shrink-0">&rarr;</span>
                            <span className="text-xs text-tertiary truncate flex-1 min-w-0">{e.expansion}</span>
                            <button
                                onClick={() => startEdit(i)}
                                className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                                aria-label={`Edit ${e.abbr}`}
                            >
                                <Pencil size={13} className="text-tertiary/50" />
                            </button>
                            <button
                                onClick={() => handleDelete(i)}
                                className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors"
                                aria-label={`Delete ${e.abbr}`}
                            >
                                <Trash2 size={13} className="text-themeredred/50" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Inline add/edit form */}
            {isFormOpen && (
                <div className="space-y-2 px-3 py-3 rounded-lg border border-themeblue2/20 bg-themeblue2/5">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={abbr}
                            onChange={(e) => { setAbbr(e.target.value); setError(''); }}
                            placeholder="Abbr"
                            className="w-20 shrink-0 text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                            autoFocus
                        />
                        <input
                            type="text"
                            value={expansion}
                            onChange={(e) => { setExpansion(e.target.value); setError(''); }}
                            placeholder="Expansion text"
                            className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                        />
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
                            {editingIndex !== null ? 'Update' : 'Add'}
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
                    <span>Add Template</span>
                </button>
            )}
        </div>
    );
};
