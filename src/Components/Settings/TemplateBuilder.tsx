import { useRef, useState } from 'react';
import { Plus, Trash2, Type, TextCursor, ChevronDown, GitBranch, Check, ChevronRight } from 'lucide-react';
import type { ContextMenuAction } from '../PreviewOverlay';
import type { TemplateNode, TextNode, StepNode, ChoiceNode, BranchNode } from '../../Data/TemplateTypes';
import { getChoiceLabels, findChoiceByLabel } from '../../Utilities/templateEngine';
import { PreviewOverlay } from '../PreviewOverlay';
import { OverlayStack, type StackNav } from '../OverlayStack';
import { ActionButton } from '../ActionButton';
import { ActionPill } from '../ActionPill';
import { TextInput, PickerInput } from '../FormInputs';

/**
 * TemplateBuilder — the recursive note-template authoring tree (text / step /
 * choice / branch nodes; branches nest sub-trees per option). The node LIST at the
 * top level renders INLINE (inside the host TextExpanderEditPopover card). Editing
 * is an OverlayStack drill-down (the morph primitive): ONE card whose body morphs
 * across screens instead of z-stacking a fresh anchored PreviewOverlay per level.
 *
 * REDESIGNED 2026-06-28 (was recursive nested PreviewOverlays). The recursion is
 * gone from the React tree — there is exactly one OverlayStack. Depth lives in the
 * stack as a path into the tree:
 *  - `editor` screen — edit a node at (path,index). A branch node's per-option rows
 *    push a `list` screen for that option's sub-tree.
 *  - `list` screen — the node list at a branch-option path. A row pushes an `editor`.
 * Back walks the path out; "Done" pops one level (or closes at the root editor).
 * All mutations go through path-based get/setList on the root `nodes`, bubbling a
 * single onChange — no per-level onChange threading.
 *
 * The add type-picker is a small INTERRUPT popover (anchored to the FAB), rendered
 * as a descendant of whichever surface launched it so OverlayStackContext floors it
 * above (root list → above the inline card; list screen → above the morph card).
 */

const CHOICE_SUGGESTIONS: Record<string, string[]> = {
    severity: ['mild', 'moderate', 'severe'],
    onset: ['sudden', 'gradual'],
    duration: ['hours', 'days', 'weeks'],
    quality: ['sharp', 'dull', 'aching', 'burning'],
};

interface TemplateBuilderProps {
    nodes: TemplateNode[];
    onChange: (nodes: TemplateNode[]) => void;
}

// ─── Path into the nested tree ─────────────────────────────────────────
// A list is reached by descending nodes[seg.index].branches[seg.option] per seg.
// Root list = []. A node is (ListPath, index).
type Seg = { index: number; option: string };
type ListPath = Seg[];

const getList = (root: TemplateNode[], path: ListPath): TemplateNode[] => {
    let nodes = root;
    for (const seg of path) {
        const n = nodes[seg.index];
        if (!n || n.type !== 'branch') return [];
        nodes = n.branches[seg.option] ?? [];
    }
    return nodes;
};

const setList = (root: TemplateNode[], path: ListPath, next: TemplateNode[]): TemplateNode[] => {
    if (path.length === 0) return next;
    const [seg, ...rest] = path;
    const n = root[seg.index];
    if (!n || n.type !== 'branch') return root;
    const child = setList(n.branches[seg.option] ?? [], rest, next);
    const updated: BranchNode = { ...n, branches: { ...n.branches, [seg.option]: child } };
    const out = [...root];
    out[seg.index] = updated;
    return out;
};

const makeNode = (type: TemplateNode['type']): TemplateNode => {
    switch (type) {
        case 'text':   return { type: 'text', content: '' } satisfies TextNode;
        case 'step':   return { type: 'step', label: '' } satisfies StepNode;
        case 'choice': return { type: 'choice', label: '', options: [] } satisfies ChoiceNode;
        case 'branch': return { type: 'branch', triggerField: '', branches: {} } satisfies BranchNode;
    }
};

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
                ? `${node.label}: ${node.options.filter(o => o.trim()).join(' | ')}${node.noInsert ? '  ·  no insert' : ''}`
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

// ─── A tappable node row (shared by the inline root list + the `list` screen) ──
const NodeRow = ({ node, onClick }: { node: TemplateNode; onClick: () => void }) => {
    const Icon = nodeIcon(node.type);
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
        >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${nodeTint(node.type)}`}>
                <Icon size={12} />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[10pt] font-medium text-primary truncate">{nodeTypeLabel(node.type)}</p>
                <p className="text-[9pt] text-tertiary truncate">{nodePreview(node)}</p>
            </div>
            <ChevronRight size={14} className="text-tertiary shrink-0" />
        </button>
    );
};

// ─── Per-node editor body (text / step / choice / branch) ──────────────
const NodeEditorBody = ({
    node, onChange, root, onDrill,
}: {
    node: TemplateNode;
    onChange: (n: TemplateNode) => void;
    root: TemplateNode[];
    onDrill: (option: string) => void;
}) => {
    switch (node.type) {
        case 'text':
            return (
                <RowTextarea
                    value={node.content}
                    onChange={(v) => onChange({ ...node, content: v })}
                    placeholder="Static text to insert..."
                />
            );
        case 'step':
            return (
                <TextInput
                    value={node.label}
                    onChange={(v) => onChange({ ...node, label: v })}
                    placeholder="Field label (e.g. chief complaint)"
                />
            );
        case 'choice':
            return <ChoiceEditorBody node={node} onChange={onChange} />;
        case 'branch':
            return <BranchEditorBody node={node} onChange={onChange} root={root} onDrill={onDrill} />;
    }
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
            <button
                type="button"
                onClick={() => onChange({ ...node, noInsert: !node.noInsert })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
            >
                <div className="flex-1 min-w-0">
                    <p className="text-[10pt] font-medium text-primary">Insert chosen word</p>
                    <p className="text-[9pt] text-tertiary">
                        {node.noInsert
                            ? 'Off — selection only routes a linked branch; no text added'
                            : 'On — the picked option is typed into the note'}
                    </p>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${!node.noInsert ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${!node.noInsert ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
            </button>
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
// Per-option rows DRILL into a `list` screen (onDrill) instead of opening a
// nested overlay — the OverlayStack owns the navigation.
const BranchEditorBody = ({
    node, onChange, root, onDrill,
}: {
    node: BranchNode;
    onChange: (n: BranchNode) => void;
    root: TemplateNode[];
    onDrill: (option: string) => void;
}) => {
    const isInline = !!(node.label || node.options?.length);
    const choiceLabels = getChoiceLabels(root);

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
                        const choiceNode = findChoiceByLabel(root, tf);
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

            {/* Per-option drill-in rows — push a `list` screen for that sub-tree */}
            {Object.keys(node.branches).length > 0 && (
                <div>
                    {Object.entries(node.branches).map(([optVal, optNodes]) => (
                        <button
                            key={optVal}
                            type="button"
                            onClick={() => onDrill(optVal)}
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
        </div>
    );
};

// ─── Main TemplateBuilder ──────────────────────────────────────────────
export const TemplateBuilder = ({ nodes, onChange }: TemplateBuilderProps) => {
    // The node being edited opens the stack; null = stack closed. Deeper navigation
    // is handled inside the stack via navRef (push/pop).
    const [entry, setEntry] = useState<{ path: ListPath; index: number } | null>(null);
    // The add type-picker target (which list to append to) + its anchor.
    const [addMenu, setAddMenu] = useState<{ path: ListPath; anchor: DOMRect | null } | null>(null);
    const navRef = useRef<StackNav | null>(null);
    const fabRef = useRef<HTMLDivElement>(null);
    // Only one `list` screen is mounted at a time (morph shows the top screen), so
    // a single ref serves the sublist FAB's add-picker anchor.
    const listFabRef = useRef<HTMLDivElement>(null);

    const updateNode = (path: ListPath, index: number, updated: TemplateNode) => {
        const list = getList(nodes, path);
        const next = [...list];
        next[index] = updated;
        onChange(setList(nodes, path, next));
    };

    const deleteNode = (path: ListPath, index: number) => {
        const list = getList(nodes, path);
        onChange(setList(nodes, path, list.filter((_, i) => i !== index)));
    };

    // Append a node to a list, then open/drill into its editor.
    const handleAdd = (type: TemplateNode['type']) => {
        if (!addMenu) return;
        const { path } = addMenu;
        const list = getList(nodes, path);
        onChange(setList(nodes, path, [...list, makeNode(type)]));
        const index = list.length;
        setAddMenu(null);
        if (path.length === 0) setEntry({ path, index });   // root → open the stack
        else navRef.current?.push('editor', { path, index }); // sublist → drill in
    };

    const addActions: ContextMenuAction[] = [
        { key: 'text',   icon: Type,        label: 'Add text',   onAction: () => handleAdd('text'),   closesOnAction: false },
        { key: 'step',   icon: TextCursor,  label: 'Add step',   onAction: () => handleAdd('step'),   closesOnAction: false },
        { key: 'choice', icon: ChevronDown, label: 'Add choice', onAction: () => handleAdd('choice'), closesOnAction: false },
        { key: 'branch', icon: GitBranch,   label: 'Add branch', onAction: () => handleAdd('branch'), closesOnAction: false },
    ];

    // "Done" / back: pop one level, or close the stack at the root editor.
    const upOrClose = (nav: StackNav) => { if (nav.depth > 1) nav.pop(); else setEntry(null); };

    // The add type-picker popover — rendered as a descendant of whichever surface
    // launched it (so it auto-stacks above), keyed by the active path.
    const addPicker = (forPath: ListPath) => (
        addMenu && pathEq(addMenu.path, forPath) ? (
            <PreviewOverlay
                isOpen
                onClose={() => setAddMenu(null)}
                anchorRect={addMenu.anchor}
                title="Add step"
                maxWidth={280}
                previewMaxHeight="auto"
                actions={addActions}
            >
                <div className="px-4 pb-3 text-[10pt] text-tertiary">
                    Choose a step type to add to the template.
                </div>
            </PreviewOverlay>
        ) : null
    );

    const screens = {
        editor: {
            title: (p: { path: ListPath; index: number }) => {
                const node = getList(nodes, p.path)[p.index];
                return node ? `Edit ${nodeTypeLabel(node.type)}` : 'Edit';
            },
            footer: (p: { path: ListPath; index: number }, nav: StackNav) => (
                <ActionPill>
                    <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => { deleteNode(p.path, p.index); upOrClose(nav); }} />
                </ActionPill>
            ),
            rightFooter: (_: { path: ListPath; index: number }, nav: StackNav) => (
                <ActionPill>
                    <ActionButton icon={Check} label="Done" variant="success" onClick={() => upOrClose(nav)} />
                </ActionPill>
            ),
            render: (p: { path: ListPath; index: number }, nav: StackNav) => {
                const node = getList(nodes, p.path)[p.index];
                if (!node) return null;
                return (
                    <NodeEditorBody
                        node={node}
                        onChange={(n) => updateNode(p.path, p.index, n)}
                        root={nodes}
                        onDrill={(option) => nav.push('list', { path: [...p.path, { index: p.index, option }] })}
                    />
                );
            },
        },
        list: {
            title: (p: { path: ListPath }) => {
                const last = p.path[p.path.length - 1];
                return last ? `Path: ${last.option}` : 'Path';
            },
            rightFooter: (_: { path: ListPath }, nav: StackNav) => (
                <ActionPill>
                    <ActionButton icon={Check} label="Done" variant="success" onClick={() => upOrClose(nav)} />
                </ActionPill>
            ),
            render: (p: { path: ListPath }, nav: StackNav) => {
                const list = getList(nodes, p.path);
                return (
                    <div>
                        {list.length === 0 ? (
                            <p className="text-[9pt] text-tertiary text-center py-6">Empty path — tap + to add a step.</p>
                        ) : (
                            list.map((node, i) => (
                                <NodeRow key={i} node={node} onClick={() => nav.push('editor', { path: p.path, index: i })} />
                            ))
                        )}
                        <div className="flex justify-end pt-3 px-2">
                            <ActionPill ref={listFabRef} shadow="sm">
                                <ActionButton
                                    icon={Plus}
                                    label="Add step"
                                    onClick={() => setAddMenu({ path: p.path, anchor: listFabRef.current?.getBoundingClientRect() ?? null })}
                                />
                            </ActionPill>
                        </div>
                        {/* Add picker for this sublist — descendant of the morph card. */}
                        {addPicker(p.path)}
                    </div>
                );
            },
        },
    };

    return (
        <div>
            {/* Inline root node list */}
            {nodes.length === 0 ? (
                <p className="text-[9pt] text-tertiary text-center py-6">
                    No template steps yet — tap + to add one.
                </p>
            ) : (
                <div>
                    {nodes.map((node, i) => (
                        <NodeRow key={i} node={node} onClick={() => setEntry({ path: [], index: i })} />
                    ))}
                </div>
            )}

            {/* FAB — opens the type-picker for the root list */}
            <div className="flex justify-end pt-3 px-2">
                <ActionPill ref={fabRef} shadow="sm">
                    <ActionButton
                        icon={Plus}
                        label="Add step"
                        onClick={() => setAddMenu({ path: [], anchor: fabRef.current?.getBoundingClientRect() ?? null })}
                    />
                </ActionPill>
            </div>

            {/* Add picker for the root list (stack closed) */}
            {entry == null && addPicker([])}

            {/* The editing stack — one morphing card; auto-stacks above the host card */}
            <OverlayStack
                isOpen={entry != null}
                onClose={() => setEntry(null)}
                navRef={navRef}
                initial={entry ? { key: 'editor', params: entry } : { key: 'editor', params: { path: [], index: 0 } }}
                screens={screens}
                maxWidth={520}
                previewMaxHeight="60dvh"
            />
        </div>
    );
};

const pathEq = (a: ListPath, b: ListPath): boolean =>
    a.length === b.length && a.every((seg, i) => seg.index === b[i].index && seg.option === b[i].option);
