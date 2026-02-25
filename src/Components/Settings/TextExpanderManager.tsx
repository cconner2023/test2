import { useState } from 'react';
import { Pencil, Trash2, Plus, Layers } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import { TemplateBuilder } from './TemplateBuilder';

interface TextExpanderManagerProps {
    expanders: TextExpander[];
    onChange: (expanders: TextExpander[]) => void;
}

type EditorMode = 'simple' | 'template';

export const TextExpanderManager = ({ expanders, onChange }: TextExpanderManagerProps) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [abbr, setAbbr] = useState('');
    const [expansion, setExpansion] = useState('');
    const [templateNodes, setTemplateNodes] = useState<TemplateNode[]>([]);
    const [editorMode, setEditorMode] = useState<EditorMode>('simple');
    const [error, setError] = useState('');

    const validate = (a: string, exp: string, mode: EditorMode, nodes: TemplateNode[], skipIndex?: number): string => {
        if (!a.trim()) return 'Abbreviation is required';
        if (/\s/.test(a)) return 'Abbreviation cannot contain spaces';
        if (mode === 'simple' && !exp.trim()) return 'Expansion text is required';
        if (mode === 'template' && nodes.length === 0) return 'Template must have at least one node';
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
        setTemplateNodes([]);
        setEditorMode('simple');
        setError('');
        setIsAdding(true);
    };

    const startEdit = (index: number) => {
        const e = expanders[index];
        setIsAdding(false);
        setEditingIndex(index);
        setAbbr(e.abbr);
        setExpansion(e.expansion);
        setTemplateNodes(e.template ?? []);
        setEditorMode(e.template && e.template.length > 0 ? 'template' : 'simple');
        setError('');
    };

    const cancel = () => {
        setIsAdding(false);
        setEditingIndex(null);
        setAbbr('');
        setExpansion('');
        setTemplateNodes([]);
        setEditorMode('simple');
        setError('');
    };

    const save = () => {
        const skipIndex = editingIndex ?? undefined;
        const err = validate(abbr, expansion, editorMode, templateNodes, skipIndex);
        if (err) { setError(err); return; }

        const entry: TextExpander = editorMode === 'template'
            ? { abbr: abbr.trim(), expansion: '', template: templateNodes }
            : { abbr: abbr.trim(), expansion: expansion.trim() };

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
                            {e.template && e.template.length > 0 && (
                                <span className="shrink-0 text-[9px] font-medium text-themepurple bg-themepurple/10 px-1.5 py-0.5 rounded">
                                    <Layers size={9} className="inline mr-0.5 -mt-px" />template
                                </span>
                            )}
                            <span className="text-tertiary/40 text-xs shrink-0">&rarr;</span>
                            <span className="text-xs text-tertiary truncate flex-1 min-w-0">
                                {e.template && e.template.length > 0
                                    ? `${e.template.length} block${e.template.length !== 1 ? 's' : ''}`
                                    : <>{ e.expansion.split('\n')[0]}{e.expansion.includes('\n') ? ' ...' : ''}</>
                                }
                            </span>
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
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={abbr}
                            onChange={(e) => { setAbbr(e.target.value); setError(''); }}
                            placeholder="Abbreviation"
                            className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                            autoFocus
                        />

                        {/* Simple / Template toggle */}
                        <div className="flex rounded-md overflow-hidden border border-tertiary/20">
                            <button
                                onClick={() => { setEditorMode('simple'); setError(''); }}
                                className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${editorMode === 'simple' ? 'bg-themeblue2 text-white' : 'bg-themewhite text-tertiary hover:bg-tertiary/5'}`}
                            >
                                Simple
                            </button>
                            <button
                                onClick={() => { setEditorMode('template'); setError(''); }}
                                className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${editorMode === 'template' ? 'bg-themeblue2 text-white' : 'bg-themewhite text-tertiary hover:bg-tertiary/5'}`}
                            >
                                Template
                            </button>
                        </div>

                        {editorMode === 'simple' ? (
                            <textarea
                                value={expansion}
                                onChange={(e) => { setExpansion(e.target.value); setError(''); }}
                                placeholder="Expansion text (multi-line supported)"
                                className="w-full min-h-[4rem] text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5"
                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); if (e.key === 'Escape') cancel(); }}
                            />
                        ) : (
                            <TemplateBuilder nodes={templateNodes} onChange={(nodes) => { setTemplateNodes(nodes); setError(''); }} />
                        )}
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
