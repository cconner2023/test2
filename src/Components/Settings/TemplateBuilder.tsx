import { useRef } from 'react';
import { Plus, Trash2, Type, TextCursor, ChevronDown, GitBranch, Check, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TemplateNode, TextNode, StepNode, ChoiceNode, BranchNode } from '../../Data/TemplateTypes';
import { getChoiceLabels, findChoiceByLabel } from '../../Utilities/templateEngine';
import type { StackNav, StackScreen } from '@/Components/primitives/OverlayStack';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { ActionPill } from '@/Components/primitives/ActionPill';
import { TextInput, TextArea, PickerInput } from '@/Components/primitives/FormInputs';
import { FooterPill } from '@/Components/primitives/FooterPill'
import { FooterMenuButton } from '@/Components/primitives/FooterMenuButton';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';

/**
 * TemplateBuilder — the note-template authoring tree (text / step / choice / branch
 * nodes; branches nest sub-trees per option), as a DRILL-DOWN morph rather than the
 * old recursive nested overlays.
 *
 * This module exports REUSABLE PIECES so a host can fold template editing into its
 * OWN OverlayStack (no overlay-on-overlay):
 *  - `makeTemplateScreens` — the `tpl-node` (per-node editor) + `tpl-list` (a branch
 *    sub-tree list) StackScreens, keyed by a PATH into the node tree. Spread into the
 *    host stack's screens.
 *  - `TemplateNodeList` — the inline node list (rows) for the host's root body.
 *  - `AddStepFooter` — the footer-LEFT Add action; tapping (+) opens a lifted menu of
 *    the four step types (no picker overlay), then the host appends + drills.
 *  - path helpers `getList` / `setList` / `makeNode` / `addTemplateNode` + `pathEq`.
 * `TextExpanderEditPopover` uses these to host the shortcut editor + template nodes
 * in ONE stack. Each AddStepFooter owns its own menu, so a host threads no add-target
 * state through — the footer's `path` closure already names the list being added to.
 */

// Authoring hint text. One phrasing per input ROLE, shared with the simple-mode
// editor (InsertFieldButton) so the same field reads the same in both. No worked
// clinical examples: the engine is doctrinal, and seeding "severity: mild |
// moderate | severe" reads as a recommended vocabulary the template author should
// match. Templates style the note's OUTPUT; they don't suggest its content.
export const HINT = {
    text: 'Static text to insert',
    label: 'Field label',
    options: 'Options (one per line)',
    linkedChoice: 'Link to a Choice field',
    emptyList: 'No steps yet — add one below',
} as const;

// ─── Path into the nested tree ─────────────────────────────────────────
// A list is reached by descending nodes[seg.index].branches[seg.option] per seg.
// Root list = []. A node is (ListPath, index).
export type Seg = { index: number; option: string };
export type ListPath = Seg[];

export const getList = (root: TemplateNode[], path: ListPath): TemplateNode[] => {
    let nodes = root;
    for (const seg of path) {
        const n = nodes[seg.index];
        if (!n || n.type !== 'branch') return [];
        nodes = n.branches[seg.option] ?? [];
    }
    return nodes;
};

export const setList = (root: TemplateNode[], path: ListPath, next: TemplateNode[]): TemplateNode[] => {
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

export const makeNode = (type: TemplateNode['type']): TemplateNode => {
    switch (type) {
        case 'text':   return { type: 'text', content: '' } satisfies TextNode;
        case 'step':   return { type: 'step', label: '' } satisfies StepNode;
        case 'choice': return { type: 'choice', label: '', options: [] } satisfies ChoiceNode;
        case 'branch': return { type: 'branch', triggerField: '', branches: {} } satisfies BranchNode;
    }
};

/** Append a fresh node to the list at `path`; returns the new node's index. */
export const addTemplateNode = (
    root: TemplateNode[],
    onChange: (nodes: TemplateNode[]) => void,
    path: ListPath,
    type: TemplateNode['type'],
): number => {
    const list = getList(root, path);
    onChange(setList(root, path, [...list, makeNode(type)]));
    return list.length;
};

export const pathEq = (a: ListPath, b: ListPath): boolean =>
    a.length === b.length && a.every((seg, i) => seg.index === b[i].index && seg.option === b[i].option);

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

// ─── The TextArea primitive, taller and optionally monospaced (raw template text) ──
const RowTextarea = ({
    value, onChange, placeholder, mono = false,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) => (
    <TextArea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputClassName={`w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[5rem] leading-5 ${mono ? 'font-mono' : ''}`}
    />
);

// ─── A tappable node row (shared by the inline root list + the `tpl-list` screen) ──
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
                    placeholder={HINT.text}
                />
            );
        case 'step':
            return (
                <TextInput
                    value={node.label}
                    onChange={(v) => onChange({ ...node, label: v })}
                    placeholder={HINT.label}
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
                placeholder={HINT.label}
            />
            <RowTextarea
                value={node.options.join('\n')}
                onChange={(v) => onChange({ ...node, options: v.split('\n') })}
                placeholder={HINT.options}
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
        </div>
    );
};

// ─── Branch node body ──────────────────────────────────────────────────
// Per-option rows DRILL into a `tpl-list` screen (onDrill) instead of opening a
// nested overlay — the host's OverlayStack owns the navigation.
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
                        placeholder={HINT.label}
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
                        placeholder={HINT.options}
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
                    placeholder={HINT.linkedChoice}
                />
            )}

            {/* Per-option drill-in rows — push a `tpl-list` screen for that sub-tree */}
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

// ─── Add-step footer (footer-LEFT). Tapping (+) opens a lifted menu of the four
//     step types — no nested overlay. Picking appends the node and drills into its
//     editor on the host's stack. `path` alone identifies the add target. ─────────
const STEP_TYPES: Array<{ type: TemplateNode['type']; label: string; icon: LucideIcon }> = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'step', label: 'Step', icon: TextCursor },
    { type: 'choice', label: 'Choice', icon: ChevronDown },
    { type: 'branch', label: 'Branch', icon: GitBranch },
];

export function AddStepFooter({ onPick }: { onPick: (type: TemplateNode['type']) => void }) {
    const items: ContextMenuItem[] = STEP_TYPES.map(t => ({
        key: t.type,
        label: t.label,
        icon: t.icon,
        onAction: () => onPick(t.type),
    }));
    return (
        <FooterPill>
            <FooterMenuButton icon={Plus} label="Add step" items={items} />
        </FooterPill>
    );
}

// ─── Inline node list (host root-screen body): rows + FAB ─────────────────────
export function TemplateNodeList({
    nodes, emptyHint = HINT.emptyList, onEdit, onAdd, showFab = true,
}: {
    nodes: TemplateNode[];
    emptyHint?: string;
    onEdit: (index: number) => void;
    /** Required by the in-body FAB; omit alongside `showFab={false}`. */
    onAdd?: (anchor: DOMRect | null) => void;
    /** In-body Add FAB. Suppress it when the host surfaces Add in a screen footer. */
    showFab?: boolean;
}) {
    const fabRef = useRef<HTMLDivElement>(null);
    return (
        <div>
            {nodes.length === 0 ? (
                <p className="text-[9pt] text-tertiary text-center py-6">{emptyHint}</p>
            ) : (
                <div>
                    {nodes.map((node, i) => (
                        <NodeRow key={i} node={node} onClick={() => onEdit(i)} />
                    ))}
                </div>
            )}
            {showFab && onAdd && (
                <div className="flex justify-end pt-3 px-2">
                    <ActionPill ref={fabRef} shadow="sm">
                        <ActionButton
                            icon={Plus}
                            label="Add step"
                            onClick={() => onAdd(fabRef.current?.getBoundingClientRect() ?? null)}
                        />
                    </ActionPill>
                </div>
            )}
        </div>
    );
}

// ─── The two drill screens (tpl-node editor + tpl-list sublist) ───────────────
// Spread into any host OverlayStack. `editorKey`/`listKey` namespace them so they
// can coexist with the host's own root screen (e.g. TextExpander's 'shortcut').
export function makeTemplateScreens({
    nodes, onChange, navRef,
    editorKey = 'tpl-node', listKey = 'tpl-list', onExitRoot,
}: {
    nodes: TemplateNode[];
    onChange: (nodes: TemplateNode[]) => void;
    navRef: React.MutableRefObject<StackNav | null>;
    editorKey?: string;
    listKey?: string;
    /** Called when "Done"/back is pressed at the stack root (standalone use). */
    onExitRoot?: () => void;
}): Record<string, StackScreen> {
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
    const upOrClose = (nav: StackNav) => { if (nav.depth > 1) nav.pop(); else onExitRoot?.(); };
    // Add-from-sublist: append + drill into the new node (the stack is already open).
    const handleAddAt = (path: ListPath, type: TemplateNode['type']) => {
        const index = addTemplateNode(nodes, onChange, path, type);
        navRef.current?.push(editorKey, { path, index });
    };

    return {
        [editorKey]: {
            title: (p: { path: ListPath; index: number }) => {
                const node = getList(nodes, p.path)[p.index];
                return node ? `Edit ${nodeTypeLabel(node.type)}` : 'Edit';
            },
            footer: (p: { path: ListPath; index: number }, nav: StackNav) => (
                <FooterPill>
                    <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => { deleteNode(p.path, p.index); upOrClose(nav); }} />
                </FooterPill>
            ),
            rightFooter: (_: { path: ListPath; index: number }, nav: StackNav) => (
                <FooterPill side="right">
                    <ActionButton icon={Check} label="Done" variant="confirm" onClick={() => upOrClose(nav)} />
                </FooterPill>
            ),
            render: (p: { path: ListPath; index: number }, nav: StackNav) => {
                const node = getList(nodes, p.path)[p.index];
                if (!node) return null;
                return (
                    <NodeEditorBody
                        node={node}
                        onChange={(n) => updateNode(p.path, p.index, n)}
                        root={nodes}
                        onDrill={(option) => nav.push(listKey, { path: [...p.path, { index: p.index, option }] })}
                    />
                );
            },
        },
        [listKey]: {
            title: (p: { path: ListPath }) => {
                const last = p.path[p.path.length - 1];
                return last ? `Path: ${last.option}` : 'Path';
            },
            // Add rides the footer-left (lifted type menu), Done the footer-right.
            footer: (p: { path: ListPath }) => (
                <AddStepFooter onPick={(type) => handleAddAt(p.path, type)} />
            ),
            rightFooter: (_: { path: ListPath }, nav: StackNav) => (
                <FooterPill side="right">
                    <ActionButton icon={Check} label="Done" variant="confirm" onClick={() => nav.pop()} />
                </FooterPill>
            ),
            render: (p: { path: ListPath }, nav: StackNav) => {
                const list = getList(nodes, p.path);
                return (
                    <div>
                        {list.length === 0 ? (
                            <p className="text-[9pt] text-tertiary text-center py-6">{HINT.emptyList}</p>
                        ) : (
                            list.map((node, i) => (
                                <NodeRow key={i} node={node} onClick={() => nav.push(editorKey, { path: p.path, index: i })} />
                            ))
                        )}
                    </div>
                );
            },
        },
    };
}

// NOTE: the standalone `TemplateBuilder` component (its own OverlayStack + inline
// root list) was removed 2026-06-30 — it was dead code and the last user of the
// nested TemplateAddPicker overlay. Hosts fold template editing into their OWN stack
// via makeTemplateScreens + TemplateNodeList (showFab={false}) + AddStepFooter.
