import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, X, Plus, Type, TextCursor, ChevronDown, GitBranch, Check, Trash2 } from 'lucide-react';
import type { TemplateNode, TextNode, StepNode, ChoiceNode, BranchNode } from '../../Data/TemplateTypes';
import { getChoiceLabels, findChoiceByLabel } from '../../Utilities/templateEngine';

const CHOICE_SUGGESTIONS: Record<string, string[]> = {
    severity: ['mild', 'moderate', 'severe'],
    onset: ['sudden', 'gradual'],
    duration: ['hours', 'days', 'weeks'],
    quality: ['sharp', 'dull', 'aching', 'burning'],
};

const NODE_CONFIG = {
    text: {
        icon: Type,
        bg: 'bg-tertiary/8',
        border: 'border-tertiary/15',
        iconBg: 'bg-tertiary/15',
        iconColor: 'text-tertiary',
        label: 'Text',
    },
    step: {
        icon: TextCursor,
        bg: 'bg-themeblue2/8',
        border: 'border-themeblue2/15',
        iconBg: 'bg-themeblue2/15',
        iconColor: 'text-themeblue2',
        label: 'Step',
    },
    choice: {
        icon: ChevronDown,
        bg: 'bg-themeblue2/8',
        border: 'border-themeblue2/15',
        iconBg: 'bg-themeblue2/15',
        iconColor: 'text-themeblue2',
        label: 'Choice',
    },
    branch: {
        icon: GitBranch,
        bg: 'bg-themepurple/8',
        border: 'border-themepurple/15',
        iconBg: 'bg-themepurple/15',
        iconColor: 'text-themepurple',
        label: 'Branch',
    },
} as const;

const nodePreview = (node: TemplateNode): string => {
    switch (node.type) {
        case 'text':
            return node.content
                ? node.content.length > 40 ? node.content.slice(0, 37) + '…' : node.content
                : 'Empty text';
        case 'step':
            return node.label || 'Untitled step';
        case 'choice':
            return node.label
                ? `${node.label}: ${node.options.filter(o => o.trim()).join(' | ')}`
                : 'Untitled choice';
        case 'branch': {
            const caseCount = Object.keys(node.branches).length;
            if (node.triggerField) return `on "${node.triggerField}" (${caseCount})`;
            return caseCount > 0 ? `${caseCount} case${caseCount !== 1 ? 's' : ''}` : 'New branch';
        }
    }
};

const INPUT_CLASS =
    'w-full text-sm px-3 py-2 rounded-lg border border-tertiary/10 bg-themewhite outline-none focus:border-themeblue2/30 text-primary placeholder:text-tertiary';

// ── Add Step (+) with type picker popover ──
// Branch option only shows when Choice nodes exist. Tapping Branch
// shows a choice-field picker; selecting one auto-creates the branch
// with the first option as the initial case.

interface AddStepButtonProps {
    onAdd: (type: TemplateNode['type']) => void;
    /** Called when user picks a choice field for a branch */
    onAddBranch?: (triggerField: string, firstCase: string) => void;
    /** All nodes at the top level for resolving choices */
    topNodes: TemplateNode[];
}

const AddStepButton = ({ onAdd, onAddBranch, topNodes }: AddStepButtonProps) => {
    const [open, setOpen] = useState(false);
    const [pickingBranchField, setPickingBranchField] = useState(false);

    const choiceLabels = getChoiceLabels(topNodes);
    const hasChoices = choiceLabels.length > 0;

    const handleBranchFieldPick = (label: string) => {
        const choiceNode = findChoiceByLabel(topNodes, label);
        const firstOption = choiceNode?.options.filter(o => o.trim())[0];
        if (firstOption && onAddBranch) {
            onAddBranch(label, firstOption);
        }
        setPickingBranchField(false);
        setOpen(false);
    };

    return (
        <div className="relative flex justify-center pt-2">
            {/* Type picker popover */}
            <div className={`absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 overflow-hidden transition-all duration-200 ease-out ${
                open ? 'max-h-60 opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95 pointer-events-none'
            }`}>
                {pickingBranchField ? (
                    /* Branch field picker */
                    <div className="rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg px-2 py-2 min-w-[140px]">
                        <p className="text-[9pt] md:text-[9pt] text-tertiary uppercase tracking-wider px-1 mb-1">Branch on…</p>
                        {choiceLabels.map(label => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => handleBranchFieldPick(label)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-primary hover:bg-themepurple/8 active:scale-95 transition-all text-left"
                            >
                                <ChevronDown size={11} className="text-themepurple/50 shrink-0" />
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPickingBranchField(false)}
                            className="w-full text-[9pt] text-tertiary mt-1 px-2 py-1 hover:text-tertiary transition-colors"
                        >
                            Back
                        </button>
                    </div>
                ) : (
                    /* Standard type picker */
                    <div className="flex gap-1 rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg px-1.5 py-1.5">
                        {(['text', 'step', 'choice'] as const).map(type => {
                            const config = NODE_CONFIG[type];
                            const Icon = config.icon;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => { onAdd(type); setOpen(false); }}
                                    className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg ${config.bg} active:scale-95 transition-all`}
                                >
                                    <Icon size={14} className={config.iconColor} />
                                    <span className={`text-[9pt] md:text-[9pt] font-medium ${config.iconColor}`}>{config.label}</span>
                                </button>
                            );
                        })}
                        {hasChoices && (
                            <button
                                type="button"
                                onClick={() => setPickingBranchField(true)}
                                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg ${NODE_CONFIG.branch.bg} active:scale-95 transition-all`}
                            >
                                <GitBranch size={14} className={NODE_CONFIG.branch.iconColor} />
                                <span className={`text-[9pt] md:text-[9pt] font-medium ${NODE_CONFIG.branch.iconColor}`}>Branch</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => { setOpen(!open); setPickingBranchField(false); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                    open
                        ? 'bg-tertiary/15 text-tertiary rotate-45'
                        : 'bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary'
                }`}
            >
                <Plus size={14} />
            </button>
        </div>
    );
};

// ── Main ShortcutStepBuilder ──

interface ShortcutStepBuilderProps {
    nodes: TemplateNode[];
    onChange: (nodes: TemplateNode[]) => void;
    rootNodes?: TemplateNode[];
}

export const ShortcutStepBuilder = ({ nodes, onChange, rootNodes }: ShortcutStepBuilderProps) => {
    const topNodes = rootNodes ?? nodes;
    const containerRef = useRef<HTMLDivElement>(null);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    // ── Drag state ──
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [insertIndex, setInsertIndex] = useState<number | null>(null);
    const itemRectsRef = useRef<DOMRect[]>([]);

    const measureItems = useCallback(() => {
        if (!containerRef.current) return;
        const pills = containerRef.current.querySelectorAll('[data-step-pill]');
        itemRectsRef.current = Array.from(pills).map(el => el.getBoundingClientRect());
    }, []);

    const handleDragStart = useCallback((e: React.PointerEvent, index: number) => {
        e.preventDefault();
        measureItems();
        setDragIndex(index);
        setInsertIndex(index);
    }, [measureItems]);

    useEffect(() => {
        if (dragIndex === null) return;

        const handleMove = (e: PointerEvent) => {
            e.preventDefault();
            const y = e.clientY;
            const rects = itemRectsRef.current;
            if (rects.length === 0) return;
            let target = rects.length;
            for (let i = 0; i < rects.length; i++) {
                if (y < rects[i].top + rects[i].height / 2) {
                    target = i;
                    break;
                }
            }
            setInsertIndex(target);
        };

        const handleUp = () => {
            setDragIndex(prev => {
                setInsertIndex(ins => {
                    if (prev !== null && ins !== null && prev !== ins) {
                        const next = [...nodes];
                        const [moved] = next.splice(prev, 1);
                        const adjusted = ins > prev ? ins - 1 : ins;
                        next.splice(adjusted, 0, moved);
                        onChange(next);
                    }
                    return null;
                });
                return null;
            });
        };

        document.addEventListener('pointermove', handleMove, { passive: false });
        document.addEventListener('pointerup', handleUp);
        return () => {
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
        };
    }, [dragIndex, nodes, onChange]);

    const handleDelete = useCallback((index: number) => {
        if (expandedIndex === index) setExpandedIndex(null);
        else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
        onChange(nodes.filter((_, i) => i !== index));
    }, [nodes, onChange, expandedIndex]);

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
        setExpandedIndex(next.length - 1);
    }, [nodes, onChange]);

    const handleAddBranch = useCallback((triggerField: string, firstCase: string) => {
        const newNode: BranchNode = {
            type: 'branch',
            triggerField,
            branches: { [firstCase]: [] },
        };
        const next = [...nodes, newNode];
        onChange(next);
    }, [nodes, onChange]);

    const updateNode = useCallback((index: number, updated: TemplateNode) => {
        const next = [...nodes];
        next[index] = updated;
        onChange(next);
    }, [nodes, onChange]);

    return (
        <div>
            <div ref={containerRef} className="space-y-2">
                {nodes.length === 0 && (
                    <p className="text-[9pt] text-tertiary text-center py-4">
                        No steps yet — add blocks below
                    </p>
                )}

                {nodes.map((node, i) => {
                    const isDragging = dragIndex === i;
                    const isExpanded = expandedIndex === i;
                    const showInsertBefore = dragIndex !== null && insertIndex === i && dragIndex !== i;

                    // ── Branch — no header pill, straight to cases ──
                    if (node.type === 'branch') {
                        return (
                            <div key={i} data-step-pill>
                                {showInsertBefore && (
                                    <div className="h-0.5 bg-themeblue3 rounded-full mx-2 mb-1.5 transition-all" />
                                )}
                                <div className={`transition-all duration-200 ${isDragging ? 'opacity-40 scale-[0.97]' : ''}`}>
                                    <BranchFlow
                                        node={node}
                                        topNodes={topNodes}
                                        onChange={(updated) => updateNode(i, updated)}
                                        onDelete={() => handleDelete(i)}
                                        onDragStart={(e) => handleDragStart(e, i)}
                                    />
                                </div>
                            </div>
                        );
                    }

                    // ── Regular node cards (top-level, not nested) ──
                    const config = NODE_CONFIG[node.type];
                    const Icon = config.icon;

                    return (
                        <div key={i} data-step-pill>
                            {showInsertBefore && (
                                <div className="h-0.5 bg-themeblue3 rounded-full mx-2 transition-all" />
                            )}

                            <div className={`rounded-xl ${config.bg} transition-all duration-200 ${
                                isDragging ? 'opacity-40 scale-[0.97]' : ''
                            }`}>
                                <div className="flex items-center gap-2 px-3 py-2.5">
                                    <div
                                        className="cursor-grab touch-none select-none shrink-0"
                                        onPointerDown={(e) => handleDragStart(e, i)}
                                    >
                                        <GripVertical size={14} className="text-tertiary" />
                                    </div>

                                    <div className={`w-6 h-6 rounded-lg ${config.iconBg} flex items-center justify-center shrink-0`}>
                                        <Icon size={12} className={config.iconColor} />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setExpandedIndex(isExpanded ? null : i)}
                                        className="flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
                                    >
                                        <p className="text-sm font-medium text-primary truncate">
                                            {nodePreview(node)}
                                        </p>
                                        <p className="text-[9pt] text-tertiary uppercase tracking-wider">
                                            {config.label}
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(i)}
                                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-themeredred/10 active:scale-95 transition-all"
                                    >
                                        <X size={14} className="text-tertiary" />
                                    </button>
                                </div>

                                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                                    isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                                }`}>
                                    <div className="px-3 pb-3 space-y-2">
                                        {node.type === 'text' && (
                                            <textarea
                                                value={node.content}
                                                onChange={(e) => updateNode(i, { ...node, content: e.target.value })}
                                                placeholder="Static text to insert..."
                                                className={`${INPUT_CLASS} min-h-[3rem] resize-none leading-5`}
                                                autoFocus
                                            />
                                        )}

                                        {node.type === 'step' && (
                                            <input
                                                type="text"
                                                value={node.label}
                                                onChange={(e) => updateNode(i, { ...node, label: e.target.value })}
                                                placeholder="Field label (e.g. chief complaint)"
                                                className={INPUT_CLASS}
                                                autoFocus
                                            />
                                        )}

                                        {node.type === 'choice' && (
                                            <div className="space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={node.label}
                                                    onChange={(e) => updateNode(i, { ...node, label: e.target.value })}
                                                    placeholder="Field label (e.g. severity)"
                                                    className={INPUT_CLASS}
                                                    autoFocus
                                                />
                                                <textarea
                                                    value={node.options.join('\n')}
                                                    onChange={(e) => updateNode(i, { ...node, options: e.target.value.split('\n') })}
                                                    placeholder={"Options (one per line)\nmild\nmoderate\nsevere"}
                                                    className={`${INPUT_CLASS} min-h-[3rem] resize-none leading-5 font-mono`}
                                                />
                                                {node.options.length <= 1 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.entries(CHOICE_SUGGESTIONS).map(([key, vals]) => (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => updateNode(i, { ...node, label: node.label || key, options: vals })}
                                                                className="text-[9pt] px-2 py-0.5 rounded-full bg-tertiary/8 text-tertiary hover:bg-tertiary/15 transition-colors active:scale-95"
                                                            >
                                                                {key}: {vals.join(' | ')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {dragIndex !== null && insertIndex !== null && insertIndex >= nodes.length && (
                    <div className="h-0.5 bg-themeblue3 rounded-full mx-2 transition-all" />
                )}
            </div>

            {/* ── Add step (+) ── */}
            <AddStepButton onAdd={handleAdd} onAddBranch={handleAddBranch} topNodes={topNodes} />
        </div>
    );
};

// ── Branch Flow ──────────────────────────────────────────────────────
//
// No header pill. Directly shows the active case as `if "value"` with
// steps below. Inactive cases as icon pills on the left. (+) on the
// right shows a dropdown of unused options from the linked Choice.

interface BranchFlowProps {
    node: BranchNode;
    topNodes: TemplateNode[];
    onChange: (node: BranchNode) => void;
    onDelete: () => void;
    onDragStart: (e: React.PointerEvent) => void;
}

const BranchFlow = ({ node, topNodes, onChange, onDelete, onDragStart }: BranchFlowProps) => {
    const allCases = Object.keys(node.branches);
    const [activeCase, setActiveCase] = useState<string>(allCases[0] ?? '');
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Keep active case valid
    useEffect(() => {
        if (allCases.length > 0 && !allCases.includes(activeCase)) {
            setActiveCase(allCases[0]);
        }
    }, [allCases, activeCase]);

    const activeCaseNodes = activeCase ? (node.branches[activeCase] ?? []) : [];
    const inactiveCases = allCases.filter(k => k !== activeCase);

    // Get unused options from the linked choice
    const linkedChoice = node.triggerField ? findChoiceByLabel(topNodes, node.triggerField) : null;
    const unusedOptions = linkedChoice
        ? linkedChoice.options.filter(o => o.trim() && !node.branches[o])
        : [];

    const addCase = (caseKey: string) => {
        onChange({
            ...node,
            branches: { ...node.branches, [caseKey]: [] },
        });
        setActiveCase(caseKey);
        setShowAddMenu(false);
    };

    const removeCase = (key: string) => {
        const nb = { ...node.branches };
        delete nb[key];
        onChange({ ...node, branches: nb });
        if (activeCase === key) {
            const remaining = Object.keys(nb);
            setActiveCase(remaining[0] ?? '');
        }
    };

    const hasCases = allCases.length > 0;

    return (
        <div className="space-y-1.5">
            {/* ── Horizontal split: inactive icons │ active case │ (+) ── */}
            <div className="flex items-start gap-0">
                {/* Inactive cases — small icon pills on the left */}
                {inactiveCases.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5 mr-2 pt-1">
                        {inactiveCases.map(caseKey => {
                            const caseNodes = node.branches[caseKey] ?? [];
                            return (
                                <button
                                    key={caseKey}
                                    type="button"
                                    onClick={() => setActiveCase(caseKey)}
                                    className="group flex flex-col items-center active:scale-95 transition-all"
                                    title={`Switch to "${caseKey}"`}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-themepurple/10 border border-themepurple/15 flex items-center justify-center">
                                        <GitBranch size={13} className="text-themepurple/40 group-hover:text-themepurple/70 transition-colors" />
                                    </div>
                                    <p className="text-[9pt] md:text-[9pt] text-themepurple/40 font-medium mt-0.5 max-w-[40px] truncate text-center group-hover:text-themepurple/70 transition-colors">
                                        {caseKey}
                                    </p>
                                    <p className="text-[9pt] md:text-[9pt] text-tertiary">
                                        {caseNodes.length} step{caseNodes.length !== 1 ? 's' : ''}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Connector from inactive to active */}
                {inactiveCases.length > 0 && (
                    <div className="self-start mt-5 w-3 h-px bg-themepurple/20 shrink-0" />
                )}

                {/* Active case — full width */}
                <div className="flex-1 min-w-0">
                    {hasCases ? (
                        <>
                            {/* Active case label row */}
                            <div className="flex items-center gap-2 px-1 py-2.5">
                                <div
                                    className="cursor-grab touch-none select-none shrink-0"
                                    onPointerDown={onDragStart}
                                >
                                    <GripVertical size={14} className="text-tertiary" />
                                </div>
                                <div className="w-6 h-6 rounded-lg bg-themepurple/15 flex items-center justify-center shrink-0">
                                    <GitBranch size={12} className="text-themepurple" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary truncate">
                                        {node.triggerField}: {activeCase}
                                    </p>
                                    <p className="text-[9pt] text-themepurple/50 uppercase tracking-wider">
                                        if "{activeCase}"
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeCase(activeCase)}
                                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-themeredred/10 active:scale-95 transition-all"
                                >
                                    <X size={14} className="text-tertiary" />
                                </button>
                            </div>

                            {/* Separator */}
                            <div className="h-px bg-themepurple/10 mx-1" />

                            {/* Active case steps */}
                            <ShortcutStepBuilder
                                nodes={activeCaseNodes}
                                onChange={(updated) => onChange({
                                    ...node,
                                    branches: { ...node.branches, [activeCase]: updated },
                                })}
                                rootNodes={topNodes}
                            />
                        </>
                    ) : (
                        <p className="text-[9pt] text-tertiary text-center py-3">
                            All cases removed
                        </p>
                    )}
                </div>

                {/* (+) Add case — dropdown of unused options */}
                <div className="shrink-0 ml-2 self-start pt-1 relative">
                    {unusedOptions.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                                    showAddMenu
                                        ? 'bg-themepurple/15 border border-themepurple/25'
                                        : 'bg-themepurple/10 border border-dashed border-themepurple/20'
                                }`}
                                title="Add case"
                            >
                                <Plus size={14} className={showAddMenu ? 'text-themepurple rotate-45' : 'text-themepurple/40'} />
                            </button>

                            {/* Dropdown of unused options */}
                            <div className={`absolute top-full mt-1 right-0 z-20 overflow-hidden transition-all duration-200 ease-out ${
                                showAddMenu ? 'max-h-60 opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95 pointer-events-none'
                            }`}>
                                <div className="rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg px-2 py-2 min-w-[100px]">
                                    <p className="text-[9pt] md:text-[9pt] text-tertiary uppercase tracking-wider px-1 mb-1">Add case</p>
                                    {unusedOptions.map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => addCase(opt)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-primary hover:bg-themepurple/8 active:scale-95 transition-all text-left"
                                        >
                                            <GitBranch size={10} className="text-themepurple/50 shrink-0" />
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Delete entire branch when no cases and no unused options */}
                    {!hasCases && unusedOptions.length === 0 && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="w-9 h-9 rounded-lg bg-themeredred/10 border border-themeredred/15 flex items-center justify-center active:scale-95 transition-all"
                            title="Remove branch"
                        >
                            <Trash2 size={13} className="text-themeredred/40" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── End Branch marker ── */}
            <div className="flex items-center gap-2 px-2 pt-1">
                <div className="flex-1 h-px bg-themepurple/15" />
                <p className="text-[9pt] text-themepurple/30 font-medium uppercase tracking-wider shrink-0">
                    end {node.triggerField || 'branch'}
                </p>
                <div className="flex-1 h-px bg-themepurple/15" />
            </div>
        </div>
    );
};
