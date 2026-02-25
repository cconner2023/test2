import { useState } from 'react';
import { Pencil, Trash2, Plus, Check, Type, TextCursor, ChevronDown, GitBranch } from 'lucide-react';
import type { TemplateNode, TextNode, StepNode, ChoiceNode, BranchNode } from '../../Data/TemplateTypes';
import { getChoiceLabels, findChoiceByLabel } from '../../Utilities/templateEngine';

/** Common medical suggestion defaults for Choice nodes */
const CHOICE_SUGGESTIONS: Record<string, string[]> = {
    severity: ['mild', 'moderate', 'severe'],
    onset: ['sudden', 'gradual'],
    duration: ['hours', 'days', 'weeks'],
    quality: ['sharp', 'dull', 'aching', 'burning'],
};

interface TemplateBuilderProps {
    nodes: TemplateNode[];
    onChange: (nodes: TemplateNode[]) => void;
    depth?: number;
    /** Root-level nodes passed through recursion so getChoiceLabels sees the full template */
    rootNodes?: TemplateNode[];
}

// ─── Inline editor for text / step / choice ────────────────────────────

interface NodeEditorProps {
    node: TextNode | StepNode | ChoiceNode;
    onSave: (node: TemplateNode) => void;
    onCancel: () => void;
}

const NodeEditor = ({ node, onSave, onCancel }: NodeEditorProps) => {
    const [editNode, setEditNode] = useState<TextNode | StepNode | ChoiceNode>({ ...node });

    const handleSave = () => {
        if (editNode.type === 'choice') {
            onSave({ ...editNode, options: editNode.options.filter((o) => o.trim() !== '') });
        } else {
            onSave(editNode);
        }
    };

    return (
        <div className="space-y-2 px-3 py-2.5 rounded-lg border border-themeblue2/20 bg-themeblue2/5">
            {editNode.type === 'text' && (
                <textarea
                    value={editNode.content}
                    onChange={(e) => setEditNode({ ...editNode, content: e.target.value })}
                    placeholder="Static text to insert..."
                    className="w-full min-h-[3rem] text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5"
                    autoFocus
                />
            )}
            {editNode.type === 'step' && (
                <input
                    type="text"
                    value={editNode.label}
                    onChange={(e) => setEditNode({ ...editNode, label: e.target.value })}
                    placeholder="Field label (e.g. chief complaint)"
                    className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                    autoFocus
                />
            )}
            {editNode.type === 'choice' && (
                <>
                    <input
                        type="text"
                        value={editNode.label}
                        onChange={(e) => setEditNode({ ...editNode, label: e.target.value })}
                        placeholder="Field label (e.g. severity)"
                        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                        autoFocus
                    />
                    <div className="space-y-1">
                        <span className="text-[10px] text-tertiary/60 font-medium">Options (one per line)</span>
                        <textarea
                            value={editNode.options.join('\n')}
                            onChange={(e) => setEditNode({ ...editNode, options: e.target.value.split('\n') })}
                            placeholder={"mild\nmoderate\nsevere"}
                            className="w-full min-h-[3rem] text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5 font-mono"
                        />
                    </div>
                    {editNode.options.length <= 1 && (
                        <div className="flex flex-wrap gap-1">
                            {Object.entries(CHOICE_SUGGESTIONS).map(([key, vals]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setEditNode({ ...editNode, label: editNode.label || key, options: vals })}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-tertiary/8 text-tertiary/70 hover:bg-tertiary/15 transition-colors"
                                >
                                    {key}: {vals.join(' | ')}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors">
                    Cancel
                </button>
                <button onClick={handleSave} className="text-[11px] px-3 py-1 rounded-md bg-themeblue2 text-white hover:bg-themeblue2/90 transition-colors">
                    <Check size={12} className="inline mr-1" />Save
                </button>
            </div>
        </div>
    );
};

// ─── Branch editor (linked or inline mode) ─────────────────────────────

type BranchMode = 'linked' | 'inline';

interface BranchEditorProps {
    node: BranchNode;
    allNodes: TemplateNode[];
    onSave: (node: BranchNode) => void;
    onCancel: () => void;
}

const BranchEditor = ({ node, allNodes, onSave, onCancel }: BranchEditorProps) => {
    const initialMode: BranchMode = (node.label || node.options?.length) ? 'inline' : 'linked';
    const [mode, setMode] = useState<BranchMode>(initialMode);
    const [triggerField, setTriggerField] = useState(node.triggerField);
    const [label, setLabel] = useState(node.label ?? '');
    const [options, setOptions] = useState<string[]>(node.options ?? []);

    const handleSave = () => {
        if (mode === 'linked') {
            const choiceNode = findChoiceByLabel(allNodes, triggerField);
            const newBranches: Record<string, TemplateNode[]> = {};
            if (choiceNode) {
                for (const opt of choiceNode.options.filter((o) => o.trim())) {
                    newBranches[opt] = node.branches[opt] ?? [];
                }
            }
            onSave({ type: 'branch', triggerField, branches: newBranches });
        } else {
            const filtered = options.filter((o) => o.trim());
            const newBranches: Record<string, TemplateNode[]> = {};
            for (const opt of filtered) {
                newBranches[opt] = node.branches[opt] ?? [];
            }
            onSave({ type: 'branch', triggerField: '', branches: newBranches, label, options: filtered });
        }
    };

    const canSave = mode === 'linked' ? !!triggerField : (!!label.trim() && options.some((o) => o.trim()));

    return (
        <div className="space-y-2 px-3 py-2.5 rounded-lg border border-themepurple/20 bg-themepurple/5">
            {/* Mode toggle */}
            <div className="flex rounded-md overflow-hidden border border-tertiary/20">
                <button
                    onClick={() => setMode('linked')}
                    className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${mode === 'linked' ? 'bg-themepurple text-white' : 'bg-themewhite text-tertiary hover:bg-tertiary/5'}`}
                >
                    Link to choice
                </button>
                <button
                    onClick={() => setMode('inline')}
                    className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${mode === 'inline' ? 'bg-themepurple text-white' : 'bg-themewhite text-tertiary hover:bg-tertiary/5'}`}
                >
                    Inline choice
                </button>
            </div>

            {mode === 'linked' ? (
                <div>
                    <span className="text-[10px] text-tertiary/60 font-medium">Branch on prior Choice field:</span>
                    <select
                        value={triggerField}
                        onChange={(e) => setTriggerField(e.target.value)}
                        className="w-full mt-1 text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                        autoFocus
                    >
                        <option value="">Select a Choice field...</option>
                        {getChoiceLabels(allNodes).map((l) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>
            ) : (
                <>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Prompt label (e.g. treatment path)"
                        className="w-full text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary"
                        autoFocus
                    />
                    <div className="space-y-1">
                        <span className="text-[10px] text-tertiary/60 font-medium">Options (one per line) — value is not inserted into text</span>
                        <textarea
                            value={options.join('\n')}
                            onChange={(e) => setOptions(e.target.value.split('\n'))}
                            placeholder={"conservative\naggressive"}
                            className="w-full min-h-[3rem] text-base px-2 py-1.5 rounded-md border border-tertiary/20 bg-themewhite outline-none focus:border-themeblue2/40 text-tertiary resize-none leading-5 font-mono"
                        />
                    </div>
                </>
            )}

            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="text-[11px] px-3 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors">
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className="text-[11px] px-3 py-1 rounded-md bg-themepurple text-white hover:bg-themepurple/90 transition-colors disabled:opacity-40"
                >
                    <Check size={12} className="inline mr-1" />Save
                </button>
            </div>
        </div>
    );
};

// ─── Helpers ───────────────────────────────────────────────────────────

const nodeTypeIcon = (type: TemplateNode['type']) => {
    switch (type) {
        case 'text': return <Type size={12} className="text-tertiary/60" />;
        case 'step': return <TextCursor size={12} className="text-themeblue2/70" />;
        case 'choice': return <ChevronDown size={12} className="text-themeblue2/70" />;
        case 'branch': return <GitBranch size={12} className="text-themepurple/70" />;
    }
};

const nodePreview = (node: TemplateNode): string => {
    switch (node.type) {
        case 'text': return `"${node.content.length > 40 ? node.content.slice(0, 37) + '...' : node.content}"`;
        case 'step': return node.label;
        case 'choice': return `${node.label}: ${node.options.filter(o => o.trim()).join(' | ')}`;
        case 'branch': return node.label ? `"${node.label}" (inline)` : `on "${node.triggerField}"`;
    }
};

// ─── Main TemplateBuilder (recursive) ──────────────────────────────────

export const TemplateBuilder = ({ nodes, onChange, depth = 0, rootNodes }: TemplateBuilderProps) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const topNodes = rootNodes ?? nodes;

    const handleAdd = (type: TemplateNode['type']) => {
        let newNode: TemplateNode;
        switch (type) {
            case 'text':
                newNode = { type: 'text', content: '' } satisfies TextNode;
                break;
            case 'step':
                newNode = { type: 'step', label: '' } satisfies StepNode;
                break;
            case 'choice':
                newNode = { type: 'choice', label: '', options: [] } satisfies ChoiceNode;
                break;
            case 'branch':
                newNode = { type: 'branch', triggerField: '', branches: {} } satisfies BranchNode;
                break;
        }
        onChange([...nodes, newNode]);
        setEditingIndex(nodes.length);
    };

    const handleSaveNode = (index: number, updated: TemplateNode) => {
        const next = [...nodes];
        next[index] = updated;
        onChange(next);
        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        onChange(nodes.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    const updateBranch = (index: number, updated: BranchNode) => {
        const next = [...nodes];
        next[index] = updated;
        onChange(next);
    };

    return (
        <div className="space-y-1.5">
            {nodes.length === 0 && depth === 0 && (
                <p className="text-[10px] text-tertiary/50 text-center py-3">No template nodes yet. Add blocks below.</p>
            )}

            {nodes.map((node, i) => (
                <div key={i}>
                    {node.type === 'branch' ? (
                        /* ── Branch node ── */
                        <>
                            {/* Branch header row (or editor) */}
                            {editingIndex === i ? (
                                <BranchEditor
                                    node={node}
                                    allNodes={topNodes}
                                    onSave={(updated) => handleSaveNode(i, updated)}
                                    onCancel={() => setEditingIndex(null)}
                                />
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themepurple/5 border border-themepurple/15">
                                    <span className="shrink-0">{nodeTypeIcon('branch')}</span>
                                    <span className="text-[10px] font-medium text-themepurple/70 uppercase shrink-0 w-12">branch</span>
                                    <span className="text-xs text-tertiary truncate flex-1 min-w-0">
                                        {node.label
                                            ? <>&ldquo;{node.label}&rdquo; (inline)</>
                                            : <>on &ldquo;{node.triggerField}&rdquo;</>
                                        }
                                    </span>
                                    <button
                                        onClick={() => setEditingIndex(i)}
                                        className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                                        aria-label="Edit branch trigger"
                                    >
                                        <Pencil size={12} className="text-tertiary/50" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(i)}
                                        className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors"
                                        aria-label="Delete branch"
                                    >
                                        <Trash2 size={12} className="text-themeredred/50" />
                                    </button>
                                </div>
                            )}

                            {/* Option sections — always visible below the header */}
                            {Object.entries(node.branches).map(([optVal, optNodes]) => (
                                <div key={optVal} className="mt-1">
                                    {/* Option label bar */}
                                    <div className="flex items-center gap-2 ml-4 px-2.5 py-1 rounded-t-md bg-themepurple/8">
                                        <span className="text-[10px] font-semibold text-themepurple">{optVal}</span>
                                        <div className="flex-1" />
                                        <button
                                            onClick={() => {
                                                const newBranches = { ...node.branches };
                                                delete newBranches[optVal];
                                                updateBranch(i, { ...node, branches: newBranches });
                                            }}
                                            className="shrink-0 p-0.5 rounded hover:bg-themeredred/10 transition-colors"
                                            aria-label={`Delete ${optVal} branch`}
                                        >
                                            <Trash2 size={10} className="text-themeredred/40" />
                                        </button>
                                    </div>
                                    {/* Recursive builder for this option's nodes */}
                                    <div className="ml-4 pl-2.5 pb-1.5 border-l-2 border-themepurple/15">
                                        <TemplateBuilder
                                            nodes={optNodes}
                                            onChange={(updated) => updateBranch(i, {
                                                ...node,
                                                branches: { ...node.branches, [optVal]: updated },
                                            })}
                                            depth={depth + 1}
                                            rootNodes={topNodes}
                                        />
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        /* ── Text / Step / Choice node ── */
                        editingIndex === i ? (
                            <NodeEditor
                                node={node}
                                onSave={(updated) => handleSaveNode(i, updated)}
                                onCancel={() => setEditingIndex(null)}
                            />
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themewhite3 border border-tertiary/10">
                                <span className="shrink-0">{nodeTypeIcon(node.type)}</span>
                                <span className="text-[10px] font-medium text-tertiary/50 uppercase shrink-0 w-10">{node.type}</span>
                                <span className="text-xs text-tertiary truncate flex-1 min-w-0">{nodePreview(node)}</span>
                                <button
                                    onClick={() => setEditingIndex(i)}
                                    className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors"
                                    aria-label="Edit node"
                                >
                                    <Pencil size={12} className="text-tertiary/50" />
                                </button>
                                <button
                                    onClick={() => handleDelete(i)}
                                    className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors"
                                    aria-label="Delete node"
                                >
                                    <Trash2 size={12} className="text-themeredred/50" />
                                </button>
                            </div>
                        )
                    )}
                </div>
            ))}

            {/* Add buttons */}
            {editingIndex === null && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                        onClick={() => handleAdd('text')}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-tertiary/8 text-tertiary/70 hover:bg-tertiary/15 transition-colors"
                    >
                        <Plus size={11} />Text
                    </button>
                    <button
                        onClick={() => handleAdd('step')}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themeblue2/8 text-themeblue2/70 hover:bg-themeblue2/15 transition-colors"
                    >
                        <Plus size={11} />Step
                    </button>
                    <button
                        onClick={() => handleAdd('choice')}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themeblue2/8 text-themeblue2/70 hover:bg-themeblue2/15 transition-colors"
                    >
                        <Plus size={11} />Choice
                    </button>
                    <button
                        onClick={() => handleAdd('branch')}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themepurple/8 text-themepurple/70 hover:bg-themepurple/15 transition-colors"
                    >
                        <Plus size={11} />Branch
                    </button>
                </div>
            )}
        </div>
    );
};
