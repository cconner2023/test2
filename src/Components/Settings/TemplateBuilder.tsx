import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Type, TextCursor, ChevronDown, GitBranch, Check, ChevronRight } from 'lucide-react';
import type { ContextMenuAction } from '../PreviewOverlay';
import type { TemplateNode, TextNode, StepNode, ChoiceNode, BranchNode } from '../../Data/TemplateTypes';
import { getChoiceLabels, findChoiceByLabel } from '../../Utilities/templateEngine';
import { PreviewOverlay } from '../PreviewOverlay';
import { ActionButton } from '../ActionButton';
import { ActionPill } from '../ActionPill';
import { TextInput, PickerInput } from '../FormInputs';

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
    rootNodes?: TemplateNode[];
}

const nodeIcon = (type: TemplateNode['type']) => {
    switch (type) {
        case 'text':   return Type;
        case 'step':   return TextCursor;
        case 'choice': return ChevronDown;
        case 'branch': return GitBranch;
    }
};

const nodeTint = (type: TemplateNode['type']) => {
    switch (type) {
        case 'text':   return 'bg-tertiary/10 text-tertiary';
        case 'step':   return 'bg-themeblue2/15 text-themeblue2';
        case 'choice': return 'bg-themeblue2/15 text-themeblue2';
        case 'branch': return 'bg-themepurple/15 text-themepurple';
    }
};

const nodePreview = (node: TemplateNode): string => {
    switch (node.type) {
        case 'text':
            return node.content
                ? node.content.length > 60 ? node.content.slice(0, 57) + '...' : node.content
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

const nodeTypeLabel = (type: TemplateNode['type']) => {
    switch (type) {
        case 'text':   return 'text';
        case 'step':   return 'step';
        case 'choice': return 'choice';
        case 'branch': return 'branch';
    }
};

// ─── Borderless multi-line input matching FormInputs row style ─────────
const RowTextarea = ({
    value, onChange, placeholder, mono = false,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) => (
    <label className="block border-b border-primary/6 last:border-b-0">
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[5rem] leading-5 ${mono ? 'font-mono' : ''}`}
        />
    </label>
);

// ─── Per-node editor — opens as a stacked PreviewOverlay ───────────────
const NodeEditor = ({
    node, onChange, onDelete, onClose, anchorRect, rootNodes, depth,
}: {
    node: TemplateNode;
    onChange: (n: TemplateNode) => void;
    onDelete: () => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
    rootNodes: TemplateNode[];
    depth: number;
}) => {
    const title = `Edit ${nodeTypeLabel(node.type)}`;

    const footer = (
        <ActionPill>
            <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => { onDelete(); onClose(); }} />
            <ActionButton icon={Check} label="Done" variant="success" onClick={onClose} />
        </ActionPill>
    );

    return (
        <PreviewOverlay
            isOpen
            onClose={onClose}
            anchorRect={anchorRect}
            title={title}
            maxWidth={520}
            previewMaxHeight="60dvh"
            footer={footer}
        >
            {node.type === 'text' && (
                <div>
                    <RowTextarea
                        value={node.content}
                        onChange={(v) => onChange({ ...node, content: v })}
                        placeholder="Static text to insert..."
                    />
                </div>
            )}

            {node.type === 'step' && (
                <div>
                    <TextInput
                        value={node.label}
                        onChange={(v) => onChange({ ...node, label: v })}
                        placeholder="Field label (e.g. chief complaint)"
                    />
                </div>
            )}

            {node.type === 'choice' && (
                <ChoiceEditorBody node={node} onChange={onChange} />
            )}

            {node.type === 'branch' && (
                <BranchEditorBody
                    node={node}
                    onChange={onChange}
                    rootNodes={rootNodes}
                    depth={depth}
                />
            )}
        </PreviewOverlay>
    );
};

// ─── Choice node body ──────────────────────────────────────────────────
const ChoiceEditorBody = ({
    node, onChange,
}: {
    node: ChoiceNode;
    onChange: (n: ChoiceNode) => void;
}) => {
    return (
        <div>
            <TextInput
                value={node.label}
                onChange={(v) => onChange({ ...node, label: v })}
                placeholder="Field label (e.g. severity)"
            />
            <RowTextarea
                value={node.options.join('\n')}
                onChange={(v) => onChange({ ...node, options: v.split('\n') })}
                placeholder={'Options (one per line)\nmild\nmoderate\nsevere'}
                mono
            />
            {node.options.length <= 1 && (
                <div className="flex flex-wrap gap-1 px-4 py-3">
                    {Object.entries(CHOICE_SUGGESTIONS).map(([key, vals]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChange({ ...node, label: node.label || key, options: vals })}
                            className="text-[9pt] px-2 py-0.5 rounded-full bg-tertiary/8 text-tertiary hover:bg-tertiary/15 active:scale-95 transition-colors"
                        >
                            {key}: {vals.join(' | ')}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Branch node body ──────────────────────────────────────────────────
const BranchEditorBody = ({
    node, onChange, rootNodes, depth,
}: {
    node: BranchNode;
    onChange: (n: BranchNode) => void;
    rootNodes: TemplateNode[];
    depth: number;
}) => {
    const isInline = !!(node.label || node.options?.length);
    const choiceLabels = getChoiceLabels(rootNodes);
    const [drillOption, setDrillOption] = useState<{ key: string; anchor: DOMRect | null } | null>(null);

    const setMode = (next: 'inline' | 'linked') => {
        if (next === 'inline' && !isInline) {
            onChange({ ...node, label: '', options: [], triggerField: '', branches: {} });
        } else if (next === 'linked' && isInline) {
            onChange({ ...node, label: undefined, options: undefined, triggerField: '', branches: {} });
        }
    };

    return (
        <div>
            <div className="flex gap-1.5 px-4 py-3 border-b border-primary/6">
                <button
                    type="button"
                    onClick={() => setMode('inline')}
                    className={`text-[9pt] px-2.5 py-1 rounded-full transition-colors active:scale-95 ${
                        isInline ? 'bg-themepurple text-white' : 'bg-themepurple/8 text-themepurple'
                    }`}
                >
                    Inline prompt
                </button>
                <button
                    type="button"
                    onClick={() => setMode('linked')}
                    className={`text-[9pt] px-2.5 py-1 rounded-full transition-colors active:scale-95 ${
                        !isInline ? 'bg-themepurple text-white' : 'bg-themepurple/8 text-themepurple'
                    }`}
                >
                    Linked to choice
                </button>
            </div>

            {isInline ? (
                <>
                    <TextInput
                        value={node.label ?? ''}
                        onChange={(v) => onChange({ ...node, label: v })}
                        placeholder="Prompt label (e.g. treatment path)"
                    />
                    <RowTextarea
                        value={(node.options ?? []).join('\n')}
                        onChange={(v) => {
                            const opts = v.split('\n');
                            const filtered = opts.filter(o => o.trim());
                            const newBranches: Record<string, TemplateNode[]> = {};
                            for (const opt of filtered) newBranches[opt] = node.branches[opt] ?? [];
                            onChange({ ...node, options: opts, branches: newBranches });
                        }}
                        placeholder="Options (one per line)"
                        mono
                    />
                </>
            ) : (
                <PickerInput
                    value={node.triggerField}
                    onChange={(tf) => {
                        const choiceNode = findChoiceByLabel(rootNodes, tf);
                        const newBranches: Record<string, TemplateNode[]> = {};
                        if (choiceNode) {
                            for (const opt of choiceNode.options.filter(o => o.trim())) {
                                newBranches[opt] = node.branches[opt] ?? [];
                            }
                        }
                        onChange({ ...node, triggerField: tf, branches: newBranches });
                    }}
                    options={choiceLabels.length > 0 ? choiceLabels : ['']}
                    placeholder="Link to a Choice field..."
                />
            )}

            {/* Per-option drill-in rows */}
            {Object.keys(node.branches).length > 0 && (
                <div>
                    {Object.entries(node.branches).map(([optVal, optNodes]) => (
                        <button
                            key={optVal}
                            type="button"
                            onClick={(ev) => setDrillOption({ key: optVal, anchor: ev.currentTarget.getBoundingClientRect() })}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
                        >
                            <span className="w-7 h-7 rounded-full bg-themepurple/15 text-themepurple flex items-center justify-center shrink-0">
                                <GitBranch size={12} />
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10pt] font-medium text-primary truncate">{optVal}</p>
                                <p className="text-[9pt] text-tertiary truncate">
                                    {optNodes.length === 0 ? 'Empty path' : `${optNodes.length} step${optNodes.length === 1 ? '' : 's'}`}
                                </p>
                            </div>
                            <ChevronRight size={14} className="text-tertiary shrink-0" />
                        </button>
                    ))}
                </div>
            )}

            {drillOption && (
                <PreviewOverlay
                    isOpen
                    onClose={() => setDrillOption(null)}
                    anchorRect={drillOption.anchor}
                    title={`Path: ${drillOption.key}`}
                    maxWidth={520}
                    previewMaxHeight="60dvh"
                    footer={
                        <ActionPill>
                            <ActionButton icon={Check} label="Done" variant="success" onClick={() => setDrillOption(null)} />
                        </ActionPill>
                    }
                >
                    <div className="px-2 py-2">
                        <TemplateBuilder
                            nodes={node.branches[drillOption.key] ?? []}
                            onChange={(updated) => onChange({
                                ...node,
                                branches: { ...node.branches, [drillOption.key]: updated },
                            })}
                            depth={depth + 1}
                            rootNodes={rootNodes}
                        />
                    </div>
                </PreviewOverlay>
            )}
        </div>
    );
};

// ─── Main TemplateBuilder ──────────────────────────────────────────────
export const TemplateBuilder = ({ nodes, onChange, depth = 0, rootNodes }: TemplateBuilderProps) => {
    const topNodes = rootNodes ?? nodes;
    const [editing, setEditing] = useState<{ index: number; anchor: DOMRect | null } | null>(null);
    const [addMenu, setAddMenu] = useState<DOMRect | null>(null);
    const fabRef = useRef<HTMLDivElement>(null);

    const handleAdd = useCallback((type: TemplateNode['type']) => {
        let newNode: TemplateNode;
        switch (type) {
            case 'text':   newNode = { type: 'text', content: '' } satisfies TextNode; break;
            case 'step':   newNode = { type: 'step', label: '' } satisfies StepNode; break;
            case 'choice': newNode = { type: 'choice', label: '', options: [] } satisfies ChoiceNode; break;
            case 'branch': newNode = { type: 'branch', triggerField: '', branches: {} } satisfies BranchNode; break;
        }
        const next = [...nodes, newNode];
        onChange(next);
        const anchor = fabRef.current?.getBoundingClientRect() ?? null;
        setAddMenu(null);
        setEditing({ index: next.length - 1, anchor });
    }, [nodes, onChange]);

    const addActions: ContextMenuAction[] = [
        { key: 'text',   icon: Type,        label: 'Add text',   onAction: () => handleAdd('text'),   closesOnAction: false },
        { key: 'step',   icon: TextCursor,  label: 'Add step',   onAction: () => handleAdd('step'),   closesOnAction: false },
        { key: 'choice', icon: ChevronDown, label: 'Add choice', onAction: () => handleAdd('choice'), closesOnAction: false },
        { key: 'branch', icon: GitBranch,   label: 'Add branch', onAction: () => handleAdd('branch'), closesOnAction: false },
    ];

    const updateNode = useCallback((index: number, updated: TemplateNode) => {
        const next = [...nodes];
        next[index] = updated;
        onChange(next);
    }, [nodes, onChange]);

    const deleteNode = useCallback((index: number) => {
        onChange(nodes.filter((_, i) => i !== index));
    }, [nodes, onChange]);

    const editingNode = editing != null ? nodes[editing.index] : null;

    return (
        <div>
            {/* Node list — borderless rows */}
            {nodes.length === 0 && depth === 0 ? (
                <p className="text-[9pt] text-tertiary text-center py-6">
                    No template steps yet — tap + to add one.
                </p>
            ) : (
                <div>
                    {nodes.map((node, i) => {
                        const Icon = nodeIcon(node.type);
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={(ev) => setEditing({ index: i, anchor: ev.currentTarget.getBoundingClientRect() })}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
                            >
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${nodeTint(node.type)}`}>
                                    <Icon size={12} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10pt] font-medium text-primary truncate">
                                        {nodeTypeLabel(node.type)}
                                    </p>
                                    <p className="text-[9pt] text-tertiary truncate">{nodePreview(node)}</p>
                                </div>
                                <ChevronRight size={14} className="text-tertiary shrink-0" />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* FAB — single Plus, opens stacked context menu of node types */}
            <div className="flex justify-end pt-3 px-2">
                <ActionPill ref={fabRef} shadow="sm">
                    <ActionButton
                        icon={Plus}
                        label="Add step"
                        onClick={() => setAddMenu(fabRef.current?.getBoundingClientRect() ?? null)}
                    />
                </ActionPill>
            </div>

            {/* Type-picker context menu — anchored to FAB */}
            {addMenu && (
                <PreviewOverlay
                    isOpen
                    onClose={() => setAddMenu(null)}
                    anchorRect={addMenu}
                    title="Add step"
                    maxWidth={280}
                    previewMaxHeight="auto"
                    actions={addActions}
                >
                    <div className="px-4 pb-3 text-[10pt] text-tertiary">
                        Choose a step type to add to the template.
                    </div>
                </PreviewOverlay>
            )}

            {/* Stacked editor overlay */}
            {editing != null && editingNode && (
                <NodeEditor
                    node={editingNode}
                    onChange={(n) => updateNode(editing.index, n)}
                    onDelete={() => deleteNode(editing.index)}
                    onClose={() => setEditing(null)}
                    anchorRect={editing.anchor}
                    rootNodes={topNodes}
                    depth={depth}
                />
            )}
        </div>
    );
};
