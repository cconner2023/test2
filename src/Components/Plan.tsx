import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Check } from 'lucide-react';
import type { PlanOrderTags, PlanOrderSet, PlanBlockKey, TextExpander } from '../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../Data/User';
import { ContextMenuPreview } from './ContextMenuPreview';
import { PlanAllBlocksPreview } from './PlanBlockPreview';
import { ListItemRow } from './ListItemRow';
import { ExpandableInput } from './ExpandableInput';

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

    // Free text below block rows
    const [freeTextValue, setFreeTextValue] = useState('');

    // Single FAB popover state
    const [showFabPopover, setShowFabPopover] = useState(false);
    const [fabAnchorRect, setFabAnchorRect] = useState<DOMRect | null>(null);
    const [focusCategory, setFocusCategory] = useState<string | null>(null);

    const openFab = useCallback((e: React.MouseEvent, focusKey?: string) => {
        setFabAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
        setFocusCategory(focusKey ?? null);
        setShowFabPopover(true);
    }, []);

    useEffect(() => {
        const blockText = generateText(states);
        const parts = [blockText, freeTextValue.trim()].filter(Boolean);
        onChange(parts.join('\n'));
    }, [states, freeTextValue]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleTag = useCallback((key: PlanBlockKey, tag: string) => {
        setStates(prev => {
            const current = prev[key].selectedTags;
            const next = current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag];
            return { ...prev, [key]: { ...prev[key], selectedTags: next, status: 'active' } };
        });
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
    const visibleBlocks = useMemo(() => ALL_BLOCK_KEYS.filter(key => states[key].status === 'active' && allTags[key].length > 0), [allTags, states]);

    const allCategories = useMemo(() =>
        ALL_BLOCK_KEYS
            .filter(key => allTags[key].length > 0)
            .map(key => ({
                key,
                label: BLOCK_LABELS[key],
                tags: allTags[key],
                state: states[key],
            })),
        [allTags, states],
    );

    const handleRowTap = useCallback((index: number, rect: DOMRect) => {
        const key = visibleBlocks[index];
        setFabAnchorRect(rect);
        setFocusCategory(key ?? null);
        setShowFabPopover(true);
    }, [visibleBlocks]);

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

            {/* Block rows or empty state */}
            {visibleBlocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-tertiary/15 bg-themewhite2/50 py-8 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={openFab}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                    >
                        <Plus size={16} />
                    </button>
                    <p className="text-[10px] text-tertiary/40">Add plan blocks</p>
                </div>
            ) : (
                <>
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
                    <div className="flex justify-center pt-1">
                        <button
                            type="button"
                            onClick={openFab}
                            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </>
            )}

            {/* Free text */}
            <ExpandableInput
                value={freeTextValue}
                onChange={setFreeTextValue}
                expanders={expanders}
                expanderEnabled={expanderEnabled}
                multiline
                className="w-full rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300 overflow-hidden"
                placeholder="Additional plan notes..."
            />

            {/* Unified popover — all categories with nested tags */}
            <ContextMenuPreview
                isVisible={showFabPopover}
                onClose={() => setShowFabPopover(false)}
                anchorRect={fabAnchorRect}
                maxWidth="max-w-[340px] md:max-w-[520px]"
                searchPlaceholder="Search plan items..."
                preview={(filter, clearFilter) => (
                    <PlanAllBlocksPreview
                        categories={allCategories}
                        filter={filter}
                        onToggleTag={(catKey, tag) => { toggleTag(catKey as PlanBlockKey, tag); clearFilter(); }}
                        focusKey={focusCategory}
                    />
                )}
                actions={[{
                    key: 'done',
                    label: 'Done',
                    icon: Check,
                    onAction: () => setShowFabPopover(false),
                }]}
                onAdd={(value) => {
                    if (focusCategory) {
                        addCustomTag(focusCategory as PlanBlockKey, value);
                    }
                }}
                addPlaceholder={focusCategory ? `Add custom ${BLOCK_LABELS[focusCategory as PlanBlockKey]?.toLowerCase()} tag...` : 'Select a category first...'}
            />
        </div>
    );
};
