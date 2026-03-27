import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlanOrderTags, PlanOrderCategory, PlanOrderSet, PlanBlockKey, TextExpander } from '../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../Data/User';
import { ContextMenuPreview } from './ContextMenuPreview';
import type { ContextMenuAction } from './ContextMenuPreview';
import { PlanBlockPreview } from './PlanBlockPreview';
import { ListItemRow } from './ListItemRow';

// ── Types ────────────────────────────────────────────────────

type BlockStatus = 'inactive' | 'active';

interface BlockState {
    status: BlockStatus;
    selectedTags: string[];
    freeText: string;
}

// Display order: meds → lab → radiology → referral → instructions → followUp
const ALL_BLOCK_KEYS: PlanBlockKey[] = [
    ...PLAN_ORDER_CATEGORIES.filter(k => k !== 'followUp'),
    'instructions',
    'followUp',
];

const BLOCK_LABELS: Record<PlanBlockKey, string> = {
    ...PLAN_ORDER_LABELS,
    instructions: 'Instructions',
};

interface PlanProps {
    orderTags: PlanOrderTags;
    instructionTags: string[];
    orderSets?: PlanOrderSet[];
    initialText?: string;
    onChange: (text: string) => void;
    expanders?: TextExpander[];
    expanderEnabled?: boolean;
}

// ── Parsing ──────────────────────────────────────────────────

function defaultBlockState(): BlockState {
    return { status: 'inactive', selectedTags: [], freeText: '' };
}

function parseInitialText(
    text: string,
    orderTags: PlanOrderTags,
    instructionTags: string[],
): Record<PlanBlockKey, BlockState> {
    const states: Record<PlanBlockKey, BlockState> = {
        referral: defaultBlockState(),
        meds: defaultBlockState(),
        radiology: defaultBlockState(),
        lab: defaultBlockState(),
        followUp: defaultBlockState(),
        instructions: defaultBlockState(),
    };
    if (!text.trim()) return states;

    const allTags: Record<PlanBlockKey, string[]> = {
        ...orderTags,
        instructions: instructionTags,
    };

    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        for (const key of ALL_BLOCK_KEYS) {
            const label = BLOCK_LABELS[key];
            if (trimmed.toUpperCase().startsWith(`${label.toUpperCase()}:`)) {
                const rest = trimmed.slice(label.length + 1).trim();
                const segments = rest.split(';').map(s => s.trim()).filter(Boolean);
                const selected: string[] = [];
                const freeParts: string[] = [];
                for (const seg of segments) {
                    if (allTags[key].includes(seg)) {
                        selected.push(seg);
                    } else {
                        freeParts.push(seg);
                    }
                }
                states[key] = {
                    status: 'active',
                    selectedTags: selected,
                    freeText: freeParts.join('; '),
                };
                break;
            }
        }
    }
    return states;
}

// ── Text generation ──────────────────────────────────────────

function generateText(states: Record<PlanBlockKey, BlockState>): string {
    const lines: string[] = [];
    for (const key of ALL_BLOCK_KEYS) {
        const s = states[key];
        if (s.status !== 'active') continue;
        const parts: string[] = [...s.selectedTags];
        if (s.freeText.trim()) parts.push(s.freeText.trim());
        if (parts.length === 0) continue;
        lines.push(`${BLOCK_LABELS[key]}: ${parts.join('; ')}`);
    }
    return lines.join('\n');
}

// ── Summary row (tap opens popover) ──────────────────────────

function PlanBlockRow({ label, state, onTap, index }: {
    label: string;
    state: BlockState;
    onTap: (index: number, rect: DOMRect) => void;
    index: number;
}) {
    const rowRef = useRef<HTMLDivElement>(null);

    const handleTap = () => {
        if (rowRef.current) {
            onTap(index, rowRef.current.getBoundingClientRect());
        }
    };

    const hasSummary = state.status === 'active' && (state.selectedTags.length > 0 || state.freeText.trim());

    return (
        <div ref={rowRef}>
            <ListItemRow
                onClick={handleTap}
                className="py-2.5 active:scale-[0.98] transition-all"
                left={
                    <span className={`w-3.5 h-3.5 rounded-full shrink-0 transition-colors duration-200 ${
                        state.status === 'active'
                            ? 'bg-themegreen'
                            : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                    }`} />
                }
                center={
                    <>
                        <p className="text-sm font-medium text-primary truncate">{label}</p>
                        {hasSummary && (
                            <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
                                {[...state.selectedTags, ...(state.freeText.trim() ? [state.freeText.trim()] : [])].join('; ')}
                            </p>
                        )}
                    </>
                }
            />
        </div>
    );
}

// ── Main component ───────────────────────────────────────────

export const Plan = ({ orderTags, instructionTags, orderSets = [], initialText, onChange, expanders = [], expanderEnabled = false }: PlanProps) => {
    // Custom tags added inline via popover — merged with profile tags
    const [customTags, setCustomTags] = useState<Record<PlanBlockKey, string[]>>({
        referral: [], meds: [], radiology: [], lab: [], followUp: [], instructions: [],
    });

    const allTags: Record<PlanBlockKey, string[]> = useMemo(() => {
        const base: Record<PlanBlockKey, string[]> = {
            ...orderTags,
            instructions: instructionTags,
        };
        for (const key of ALL_BLOCK_KEYS) {
            if (customTags[key].length > 0) {
                base[key] = [...base[key], ...customTags[key]];
            }
        }
        return base;
    }, [orderTags, instructionTags, customTags]);

    const [states, setStates] = useState<Record<PlanBlockKey, BlockState>>(() =>
        parseInitialText(initialText ?? '', orderTags, instructionTags),
    );

    // Track which order sets are "active" (have been applied)
    const [activeSetIds, setActiveSetIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        onChange(generateText(states));
    }, [states]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleTag = useCallback((key: PlanBlockKey, tag: string) => {
        setStates(prev => {
            const current = prev[key].selectedTags;
            const next = current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag];
            // Auto-activate when a tag is selected
            return { ...prev, [key]: { ...prev[key], selectedTags: next, status: 'active' } };
        });
    }, []);

    const setFreeText = useCallback((key: PlanBlockKey, text: string) => {
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], freeText: text },
        }));
    }, []);

    const addCustomTag = useCallback((key: PlanBlockKey, value: string) => {
        // Skip duplicates
        if (allTags[key].includes(value)) return;
        setCustomTags(prev => ({
            ...prev,
            [key]: [...prev[key], value],
        }));
        // Auto-select and activate
        setStates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                status: 'active',
                selectedTags: [...prev[key].selectedTags, value],
            },
        }));
    }, [allTags]);

    /** Apply an order set — activates blocks and unions the preset tags */
    const applyOrderSet = useCallback((os: PlanOrderSet) => {
        setActiveSetIds(prev => {
            const next = new Set(prev);
            if (next.has(os.id)) {
                // Deactivating: remove the preset tags this set contributed
                next.delete(os.id);
                setStates(prev => {
                    const updated = { ...prev };
                    for (const key of ALL_BLOCK_KEYS) {
                        const presetTags = os.presets[key];
                        if (!presetTags || presetTags.length === 0) continue;
                        const remaining = updated[key].selectedTags.filter(t => !presetTags.includes(t));
                        const stillActive = remaining.length > 0 || updated[key].freeText.trim();
                        updated[key] = {
                            ...updated[key],
                            selectedTags: remaining,
                            status: stillActive ? 'active' : 'inactive',
                        };
                    }
                    return updated;
                });
                return next;
            }
            // Activating: union preset tags into each block
            next.add(os.id);
            setStates(prev => {
                const updated = { ...prev };
                for (const key of ALL_BLOCK_KEYS) {
                    const presetTags = os.presets[key];
                    if (!presetTags || presetTags.length === 0) continue;
                    const merged = [...new Set([...updated[key].selectedTags, ...presetTags])];
                    updated[key] = {
                        ...updated[key],
                        status: 'active',
                        selectedTags: merged,
                    };
                }
                return updated;
            });
            return next;
        });
    }, []);

    // Only show blocks that have tags configured
    const visibleBlocks = useMemo(() => ALL_BLOCK_KEYS.filter(key => allTags[key].length > 0), [allTags]);

    // ── Popover state ────────────────────────────────────────
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null);

    const handleRowTap = useCallback((index: number, rect: DOMRect) => {
        setPopoverAnchorRect(rect);
        setEditingIndex(index);
    }, []);

    const editingKey = editingIndex !== null ? visibleBlocks[editingIndex] : null;
    const editingState = editingKey ? states[editingKey] : null;

    const popoverActions = useMemo((): ContextMenuAction[] => {
        if (editingIndex === null || editingKey === null) return [];
        const len = visibleBlocks.length;
        const isFirst = editingIndex === 0;
        const isLast = editingIndex === len - 1;
        return [
            {
                key: 'prev',
                label: '<',
                icon: ChevronLeft,
                onAction: () => { if (!isFirst) setEditingIndex(editingIndex - 1); },
                closesOnAction: false,
                variant: isFirst ? 'disabled' as any : 'default',
            },
            {
                key: 'reset',
                label: 'Reset',
                icon: RotateCcw,
                onAction: () => {
                    setStates(prev => ({
                        ...prev,
                        [editingKey]: defaultBlockState(),
                    }));
                },
                closesOnAction: false,
            },
            {
                key: 'next',
                label: '>',
                icon: ChevronRight,
                onAction: () => { if (!isLast) setEditingIndex(editingIndex + 1); },
                closesOnAction: false,
                variant: isLast ? 'disabled' as any : 'default',
            },
        ];
    }, [editingIndex, editingKey, editingState?.status, visibleBlocks.length]);

    if (visibleBlocks.length === 0 && orderSets.length === 0) {
        return (
            <div className="p-3">
                <p className="text-xs text-tertiary/50 italic text-center py-4">
                    No plan tags configured. Add tags in Settings &gt; Note Content.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Order Set chips */}
            {orderSets.length > 0 && (
                <section>
                    <div className="pb-2 flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Order Sets</p>
                    </div>
                    <div className="rounded-xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                                {orderSets.map(os => {
                                    const isActive = activeSetIds.has(os.id);
                                    return (
                                        <button
                                            key={os.id}
                                            onClick={() => applyOrderSet(os)}
                                            className={`px-2.5 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${
                                                isActive
                                                    ? 'bg-themegreen/15 text-themegreen'
                                                    : 'bg-tertiary/5 text-tertiary/40'
                                            }`}
                                        >
                                            {os.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Block rows */}
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    {visibleBlocks.map((key, i) => (
                        <PlanBlockRow
                            key={key}
                            label={BLOCK_LABELS[key]}
                            state={states[key]}
                            onTap={handleRowTap}
                            index={i}
                        />
                    ))}
                </div>
            </div>

            {/* ── Popover ── */}
            {editingKey && editingState && (
                <ContextMenuPreview
                    isVisible={editingIndex !== null}
                    onClose={() => setEditingIndex(null)}
                    anchorRect={popoverAnchorRect}
                    maxWidth="max-w-[340px] md:max-w-[520px]"
                    searchPlaceholder="Filter tags..."
                    preview={(filter, clearFilter) => (
                        <PlanBlockPreview
                            label={BLOCK_LABELS[editingKey]}
                            tags={allTags[editingKey]}
                            state={editingState}
                            filter={filter}
                            onToggleTag={(tag) => { toggleTag(editingKey, tag); clearFilter(); }}
                        />
                    )}
                    actions={popoverActions}
                    onAdd={(value) => addCustomTag(editingKey, value)}
                    addPlaceholder="Add custom tag..."
                />
            )}
        </div>
    );
};
