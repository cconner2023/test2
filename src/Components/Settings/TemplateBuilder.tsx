import { useState } from 'react';
import { Plus, Trash2, Type, TextCursor, ChevronDown, GitBranch, GitMerge, ChevronRight } from 'lucide-react';
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

// ─── Helpers ───────────────────────────────────────────────────────────

const nodeTypeIcon = (type: TemplateNode['type']) => {
    switch (type) {
        case 'text':   return <Type size={12} className="text-tertiary/60" />;
        case 'step':   return <TextCursor size={12} className="text-themeblue2/70" />;
        case 'choice': return <ChevronDown size={12} className="text-themeblue2/70" />;
        case 'branch': return <GitBranch size={12} className="text-themepurple/70" />;
    }
};

const nodeDotColor = (type: TemplateNode['type']): string => {
    switch (type) {
        case 'text':   return 'bg-tertiary/40';
        case 'step':   return 'bg-themeblue2';
        case 'choice': return 'bg-themeblue2';
        case 'branch': return 'bg-themepurple';
    }
};

const nodePreview = (node: TemplateNode): string => {
    switch (node.type) {
        case 'text':
            return node.content
                ? node.content.length > 50 ? node.content.slice(0, 47) + '...' : node.content
                : 'Empty text';
        case 'step':
            return node.label || 'Untitled step';
        case 'choice':
            return node.label
                ? `${node.label}: ${node.options.filter(o => o.trim()).join(' | ')}`
                : 'Untitled choice';
        case 'branch':
            return node.label
                ? `"${node.label}" (inline)`
                : node.triggerField
                    ? `on "${node.triggerField}"`
                    : 'Unconfigured branch';
    }
};

const INPUT_CLASS =
    'w-full text-sm px-3 py-2 rounded-lg border border-tertiary/10 bg-themewhite outline-none focus:border-themeblue2/30 text-primary placeholder:text-tertiary/30';

// ─── Main TemplateBuilder (recursive, tap-to-expand) ──────────────────

export const TemplateBuilder = ({ nodes, onChange, depth = 0, rootNodes }: TemplateBuilderProps) => {
    const topNodes = rootNodes ?? nodes;
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const toggleExpand = (index: number) => {
        setExpandedIndex(prev => (prev === index ? null : index));
    };

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
        const nextNodes = [...nodes, newNode];
        onChange(nextNodes);
        setExpandedIndex(nextNodes.length - 1);
    };

    const updateNode = (index: number, updated: TemplateNode) => {
        const next = [...nodes];
        next[index] = updated;
        onChange(next);
    };

    const handleDelete = (index: number) => {
        setExpandedIndex(null);
        onChange(nodes.filter((_, i) => i !== index));
    };

    return (
        <div className="relative">
            {/* Vertical pipeline line */}
            {nodes.length > 0 && (
                <div className="absolute top-2 bottom-10 left-3 border-l-2 border-tertiary/10" />
            )}

            <div className="space-y-0.5">
                {nodes.length === 0 && depth === 0 && (
                    <p className="text-[10px] text-tertiary/50 text-center py-3">
                        No template nodes yet. Add blocks below.
                    </p>
                )}

                {nodes.map((node, i) => {
                    const isExpanded = expandedIndex === i;

                    {/* ── BRANCH node — special start/end card rendering ── */}
                    if (node.type === 'branch') {
                        const branchCount = Object.keys(node.branches).length;
                        return (
                            <div key={i} className="relative pl-7">
                                {/* Pipeline dot — start */}
                                <span className="absolute left-[7px] top-[10px] w-2.5 h-2.5 rounded-full bg-themepurple -translate-x-1/2 z-10" />

                                {/* ── Branch Start Card ── */}
                                <div className="px-3 py-2 rounded-lg border border-themepurple/20 bg-themepurple/5">
                                    <div className="flex items-center gap-2">
                                        <GitBranch size={12} className="text-themepurple/70 shrink-0" />
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(i)}
                                            className="flex-1 min-w-0 flex items-center gap-1.5 text-left active:scale-95 transition-transform"
                                        >
                                            <span className="text-xs text-themepurple/80 font-medium truncate">
                                                {nodePreview(node)}
                                            </span>
                                            <ChevronRight
                                                size={11}
                                                className={`shrink-0 text-themepurple/40 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(i)}
                                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-themeredred/10 transition-colors active:scale-95"
                                            aria-label="Delete branch"
                                        >
                                            <Trash2 size={12} className="text-themeredred/50" />
                                        </button>
                                    </div>

                                    {/* Branch config — expanded */}
                                    {isExpanded && (
                                        <div className="mt-2 space-y-2">
                                            {(() => {
                                                const isInline = !!(node.label || node.options?.length);
                                                return isInline ? (
                                                    <div className="space-y-1.5">
                                                        <input
                                                            type="text"
                                                            value={node.label ?? ''}
                                                            onChange={(e) =>
                                                                updateNode(i, { ...node, label: e.target.value })
                                                            }
                                                            placeholder="Prompt label (e.g. treatment path)"
                                                            className={INPUT_CLASS}
                                                        />
                                                        <textarea
                                                            value={(node.options ?? []).join('\n')}
                                                            onChange={(e) => {
                                                                const opts = e.target.value.split('\n');
                                                                const filtered = opts.filter(o => o.trim());
                                                                const newBranches: Record<string, TemplateNode[]> = {};
                                                                for (const opt of filtered) {
                                                                    newBranches[opt] = node.branches[opt] ?? [];
                                                                }
                                                                updateNode(i, {
                                                                    ...node,
                                                                    options: opts,
                                                                    branches: newBranches,
                                                                });
                                                            }}
                                                            placeholder="Options (one per line)"
                                                            className={`${INPUT_CLASS} min-h-[3rem] resize-none leading-5 font-mono`}
                                                        />
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={node.triggerField}
                                                        onChange={(e) => {
                                                            const tf = e.target.value;
                                                            const choiceNode = findChoiceByLabel(topNodes, tf);
                                                            const newBranches: Record<string, TemplateNode[]> = {};
                                                            if (choiceNode) {
                                                                for (const opt of choiceNode.options.filter(o =>
                                                                    o.trim(),
                                                                )) {
                                                                    newBranches[opt] = node.branches[opt] ?? [];
                                                                }
                                                            }
                                                            updateNode(i, {
                                                                ...node,
                                                                triggerField: tf,
                                                                branches: newBranches,
                                                            });
                                                        }}
                                                        className={INPUT_CLASS}
                                                    >
                                                        <option value="">Link to a Choice field...</option>
                                                        {getChoiceLabels(topNodes).map(l => (
                                                            <option key={l} value={l}>
                                                                {l}
                                                            </option>
                                                        ))}
                                                    </select>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* ── Branch option sub-builders ── */}
                                {branchCount > 0 && (
                                    <div className="mt-1 ml-3 space-y-1 border-l-2 border-themepurple/15 pl-3">
                                        {Object.entries(node.branches).map(([optVal, optNodes]) => (
                                            <div key={optVal}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-semibold text-themepurple">
                                                        {optVal}
                                                    </span>
                                                    <div className="flex-1" />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBranches = { ...node.branches };
                                                            delete newBranches[optVal];
                                                            updateNode(i, { ...node, branches: newBranches });
                                                        }}
                                                        className="shrink-0 p-0.5 rounded hover:bg-themeredred/10 transition-colors active:scale-95"
                                                        aria-label={`Delete ${optVal} branch`}
                                                    >
                                                        <Trash2 size={10} className="text-themeredred/40" />
                                                    </button>
                                                </div>
                                                <div className="pl-2">
                                                    <TemplateBuilder
                                                        nodes={optNodes}
                                                        onChange={(updated) =>
                                                            updateNode(i, {
                                                                ...node,
                                                                branches: {
                                                                    ...node.branches,
                                                                    [optVal]: updated,
                                                                },
                                                            })
                                                        }
                                                        depth={depth + 1}
                                                        rootNodes={topNodes}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Branch End Card ── */}
                                <div className="relative mt-1">
                                    <span className="absolute left-[-21px] top-[8px] w-2 h-2 rounded-full bg-themepurple/40 -translate-x-1/2 z-10" />
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-themepurple/10 bg-themepurple/3">
                                        <GitMerge size={10} className="text-themepurple/40" />
                                        <span className="text-[10px] text-themepurple/40">
                                            End branch{branchCount > 0 ? ` · ${branchCount} path${branchCount !== 1 ? 's' : ''}` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    {/* ── Standard nodes (text, step, choice) ── */}
                    return (
                        <div key={i} className="relative pl-7">
                            {/* Pipeline dot */}
                            <span
                                className={`absolute left-[7px] top-[10px] w-2.5 h-2.5 rounded-full ${nodeDotColor(node.type)} -translate-x-1/2 z-10`}
                            />

                            {/* Node card */}
                            <div
                                className={`px-3 py-2 rounded-lg transition-colors ${
                                    isExpanded ? 'bg-tertiary/5' : ''
                                }`}
                            >
                                {/* Collapsed row — tap to toggle */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(i)}
                                    className="w-full flex items-center gap-2 text-left active:scale-95 transition-transform"
                                >
                                    <span className="shrink-0">{nodeTypeIcon(node.type)}</span>
                                    <span className="text-xs text-tertiary/70 flex-1 min-w-0 truncate">
                                        {nodePreview(node)}
                                    </span>
                                </button>

                                {/* Expanded editing area */}
                                {isExpanded && (
                                    <div className="mt-2 space-y-2">
                                        {/* Trash button — top right */}
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(i)}
                                                className="p-1 rounded hover:bg-themeredred/10 transition-colors active:scale-95"
                                                aria-label="Delete node"
                                            >
                                                <Trash2 size={13} className="text-themeredred/50" />
                                            </button>
                                        </div>

                                        {/* ── TEXT node ── */}
                                        {node.type === 'text' && (
                                            <textarea
                                                value={node.content}
                                                onChange={(e) => updateNode(i, { ...node, content: e.target.value })}
                                                placeholder="Static text to insert..."
                                                className={`${INPUT_CLASS} min-h-[3rem] resize-none leading-5`}
                                            />
                                        )}

                                        {/* ── STEP node ── */}
                                        {node.type === 'step' && (
                                            <input
                                                type="text"
                                                value={node.label}
                                                onChange={(e) => updateNode(i, { ...node, label: e.target.value })}
                                                placeholder="Field label (e.g. chief complaint)"
                                                className={INPUT_CLASS}
                                            />
                                        )}

                                        {/* ── CHOICE node ── */}
                                        {node.type === 'choice' && (
                                            <div className="space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={node.label}
                                                    onChange={(e) => updateNode(i, { ...node, label: e.target.value })}
                                                    placeholder="Field label (e.g. severity)"
                                                    className={INPUT_CLASS}
                                                />
                                                <textarea
                                                    value={node.options.join('\n')}
                                                    onChange={(e) =>
                                                        updateNode(i, { ...node, options: e.target.value.split('\n') })
                                                    }
                                                    placeholder={"Options (one per line)\nmild\nmoderate\nsevere"}
                                                    className={`${INPUT_CLASS} min-h-[3rem] resize-none leading-5 font-mono`}
                                                />
                                                {node.options.length <= 1 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.entries(CHOICE_SUGGESTIONS).map(([key, vals]) => (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() =>
                                                                    updateNode(i, {
                                                                        ...node,
                                                                        label: node.label || key,
                                                                        options: vals,
                                                                    })
                                                                }
                                                                className="text-[10px] px-2 py-0.5 rounded-full bg-tertiary/8 text-tertiary/70 hover:bg-tertiary/15 transition-colors active:scale-95"
                                                            >
                                                                {key}: {vals.join(' | ')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add buttons */}
            <div className="flex flex-wrap gap-1.5 pt-2 pl-7">
                <button
                    type="button"
                    onClick={() => handleAdd('text')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-tertiary/8 text-tertiary/70 hover:bg-tertiary/15 transition-colors active:scale-95"
                >
                    <Plus size={11} />Text
                </button>
                <button
                    type="button"
                    onClick={() => handleAdd('step')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themeblue2/8 text-themeblue2/70 hover:bg-themeblue2/15 transition-colors active:scale-95"
                >
                    <Plus size={11} />Step
                </button>
                <button
                    type="button"
                    onClick={() => handleAdd('choice')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themeblue2/8 text-themeblue2/70 hover:bg-themeblue2/15 transition-colors active:scale-95"
                >
                    <Plus size={11} />Choice
                </button>
                <button
                    type="button"
                    onClick={() => handleAdd('branch')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-themepurple/8 text-themepurple/70 hover:bg-themepurple/15 transition-colors active:scale-95"
                >
                    <Plus size={11} />Branch
                </button>
            </div>
        </div>
    );
};
