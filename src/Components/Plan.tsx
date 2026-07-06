import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Check, RotateCcw, GripVertical, X } from 'lucide-react';
import type { PlanOrderTags, PlanOrderSet, PlanBlockKey, TextExpander } from '../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../Data/User';
import { PreviewOverlay } from './PreviewOverlay';
import { PlanAllBlocksPreview, CategoryPicker } from './PlanBlockPreview';
import { CATEGORY_META } from './Settings/PlanTagManager';
import { ListItemRow } from '@/Components/primitives/ListItemRow';
import { SwipeToDeleteRow } from '@/Components/primitives/SwipeToDeleteRow';
import { ExpandableInput } from '@/Components/primitives/ExpandableInput';
import { EmptyState } from '@/Components/primitives/EmptyState';
import type { MergedPlanOrderSet } from '../Hooks/useMergedNoteContent';
import { ActionPill } from '@/Components/primitives/ActionPill';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { Chip, ChipBar } from '@/Components/primitives/Chip';
import type { PlanBlockState, PlanState } from '../Types/PlanTypes';

// ── Types ────────────────────────────────────────────────────

// Block state is shared with the desktop pane flow (ProviderPlanSections).
type BlockState = PlanBlockState;

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
    orderSets?: MergedPlanOrderSet[];
    initialText?: string;
    onChange: (text: string) => void;
    expanders?: TextExpander[];
    /** Bump to imperatively open the FAB popover. Anchor read from pickerOpenAnchor. */
    pickerOpenSignal?: number;
    /** Anchor rect used the next time pickerOpenSignal increments. */
    pickerOpenAnchor?: DOMRect | null;
}

// ── Parsing ──────────────────────────────────────────────────

function defaultBlockState(): BlockState {
    return { status: 'inactive', selectedTags: [], freeText: '' };
}

function emptyCustomTags(): Record<PlanBlockKey, string[]> {
    return { referral: [], meds: [], radiology: [], lab: [], followUp: [], instructions: [] };
}

/**
 * Parse seed text ("Label: a; b; c") into block states.
 *
 * Every semicolon-separated segment becomes an individually-removable
 * selectedTag — including auto-generated items the provider hasn't configured
 * as order tags. Unconfigured segments are returned as `customTags` so they're
 * registered in `allTags` (renders the block, keeps the item re-selectable from
 * the preview after it's unselected). Nothing lands in `freeText`, which has no
 * editor in this UI and would otherwise trap suggested items as an unremovable blob.
 */
function parseInitialText(
    text: string,
    orderTags: PlanOrderTags,
    instructionTags: string[],
): { states: Record<PlanBlockKey, BlockState>; customTags: Record<PlanBlockKey, string[]> } {
    const states: Record<PlanBlockKey, BlockState> = {
        referral: defaultBlockState(),
        meds: defaultBlockState(),
        radiology: defaultBlockState(),
        lab: defaultBlockState(),
        followUp: defaultBlockState(),
        instructions: defaultBlockState(),
    };
    const customTags = emptyCustomTags();
    if (!text.trim()) return { states, customTags };

    const configuredTags: Record<PlanBlockKey, string[]> = {
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
                const selected = [...new Set(segments)];
                // Segments not in the provider's configured tags become custom
                // tags so they render as removable/re-selectable chips.
                for (const seg of selected) {
                    if (!configuredTags[key].includes(seg) && !customTags[key].includes(seg)) {
                        customTags[key].push(seg);
                    }
                }
                states[key] = {
                    status: 'active',
                    selectedTags: selected,
                    freeText: '',
                };
                break;
            }
        }
    }
    return { states, customTags };
}

// ── Text generation ──────────────────────────────────────────

function generateText(states: Record<PlanBlockKey, BlockState>, orderedKeys?: PlanBlockKey[]): string {
    const keys = orderedKeys ?? ALL_BLOCK_KEYS;
    const lines: string[] = [];
    for (const key of keys) {
        const s = states[key];
        if (s.status !== 'active') continue;
        const parts: string[] = [...s.selectedTags];
        if (s.freeText.trim()) parts.push(s.freeText.trim());
        if (parts.length === 0) continue;
        lines.push(`${BLOCK_LABELS[key]}: ${parts.join('; ')}`);
    }
    return lines.join('\n');
}

/**
 * Pure `PlanState → plan text` renderer — the same output as the mounted Plan
 * component's onChange, without needing Plan mounted. Lets the desktop provider
 * pane drive Plan from the lifted planState and keep planNote in sync (mirrors
 * generatePEText). customTags/activeSetIds are UI-only and don't affect text.
 */
export function generatePlanText(planState: PlanState): string {
    const body = generateText(planState.states, planState.blockOrder.length ? planState.blockOrder : undefined);
    const extra = (planState.additional ?? '').trim();
    return [body, extra].filter(Boolean).join('\n');
}

/**
 * Seed a lifted PlanState from note text — the desktop pane's inverse of
 * generatePlanText (mirrors parseInitialText, which the mobile Plan runs on mount).
 * Used by ProviderDrawer to hydrate the center from a template apply / imported note.
 * blockOrder = the active categories in display order; order sets start un-applied.
 */
export function parsePlanState(
    text: string,
    orderTags: PlanOrderTags,
    instructionTags: string[],
): PlanState {
    const { states, customTags } = parseInitialText(text, orderTags, instructionTags);
    const blockOrder = ALL_BLOCK_KEYS.filter(k => states[k].status === 'active');
    return { states, customTags, activeSetIds: [], blockOrder };
}

// ── Summary row (tap opens popover) ──────────────────────────

function PlanBlockRow({ label, state, onTap, index, isDragging, dragOffset, onDragStart }: {
    label: string;
    state: BlockState;
    onTap: (index: number, rect: DOMRect) => void;
    index: number;
    isDragging?: boolean;
    dragOffset?: number;
    onDragStart?: (index: number, e: React.PointerEvent) => void;
}) {
    const rowRef = useRef<HTMLDivElement>(null);

    const handleTap = () => {
        if (rowRef.current) {
            onTap(index, rowRef.current.getBoundingClientRect());
        }
    };

    const hasSummary = state.status === 'active' && (state.selectedTags.length > 0 || state.freeText.trim());

    return (
        <div
            ref={rowRef}
            data-block-row
            style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
            className={isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}
        >
            <ListItemRow
                as="div"
                onClick={handleTap}
                className="py-2.5 active:scale-[0.98] transition-all cursor-pointer"
                left={
                    <div
                        className="shrink-0 text-tertiary touch-none cursor-grab active:cursor-grabbing"
                        onPointerDown={onDragStart ? (e) => { e.stopPropagation(); onDragStart(index, e); } : undefined}
                    >
                        <GripVertical size={16} />
                    </div>
                }
                center={
                    <>
                        <p className="text-sm font-medium text-primary truncate">{label}</p>
                        {hasSummary && (
                            <p className="text-[9pt] text-primary mt-0.5 whitespace-normal break-words">
                                {[...state.selectedTags, ...(state.freeText.trim() ? [state.freeText.trim()] : [])].join('; ')}
                            </p>
                        )}
                    </>
                }
            />
        </div>
    );
}

// ── Active items card (all selected tags, cross-category) ────

interface ActiveItemEntry {
    tag: string;
    catKey: string;
    catLabel: string;
}

function ActiveItemsCard({ items, onToggle, onReorder }: {
    items: ActiveItemEntry[];
    onToggle: (catKey: string, tag: string) => void;
    onReorder: (catKey: string, fromIdx: number, toIdx: number) => void;
}) {
    const dragRef = useRef<{
        index: number;
        currentIndex: number;
        startY: number;
        itemHeight: number;
    } | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);

    const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
        const row = (e.currentTarget as HTMLElement).closest('[data-active-row]') as HTMLElement | null;
        if (!row) return;
        dragRef.current = { index, currentIndex: index, startY: e.clientY, itemHeight: row.getBoundingClientRect().height };
        setDragIndex(index);
        setDragOffset(0);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const handleDragMove = useCallback((e: React.PointerEvent) => {
        const ds = dragRef.current;
        if (!ds) return;
        const dy = e.clientY - ds.startY;
        setDragOffset(dy);
        ds.currentIndex = Math.max(0, Math.min(items.length - 1, ds.index + Math.round(dy / ds.itemHeight)));
    }, [items.length]);

    const handleDragEnd = useCallback(() => {
        const ds = dragRef.current;
        if (ds && ds.index !== ds.currentIndex) {
            const dragged = items[ds.index];
            const target = items[ds.currentIndex];
            if (dragged.catKey === target.catKey) {
                const catItems = items.filter(x => x.catKey === dragged.catKey);
                const fromIdx = catItems.findIndex(x => x.tag === dragged.tag);
                const toIdx = catItems.findIndex(x => x.tag === target.tag);
                if (fromIdx !== -1 && toIdx !== -1) onReorder(dragged.catKey, fromIdx, toIdx);
            }
        }
        dragRef.current = null;
        setDragIndex(null);
        setDragOffset(0);
    }, [items, onReorder]);

    return (
        <div className="w-full rounded-2xl bg-themewhite shadow-xl border border-tertiary/10 overflow-hidden shrink-0">
            <div
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: '160px' }}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                {items.map(({ tag, catKey, catLabel }, i) => {
                    const isDragging = dragIndex === i;
                    return (
                        <div
                            key={`${catKey}-${tag}`}
                            data-active-row
                            style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
                            className={`flex items-center gap-2 px-3 py-2.5 bg-tertiary/4 ${i > 0 ? 'border-t border-tertiary/10' : ''} ${isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}`}
                        >
                            <div
                                className="shrink-0 text-tertiary touch-none cursor-grab active:cursor-grabbing"
                                onPointerDown={(e) => { e.stopPropagation(); handleDragStart(i, e); }}
                            >
                                <GripVertical size={16} />
                            </div>
                            <span className="flex-1 text-[11pt] text-primary min-w-0 truncate">{tag}</span>
                            <span className="text-[9pt] md:text-[9pt] text-tertiary shrink-0">{catLabel}</span>
                            <button
                                type="button"
                                onClick={() => onToggle(catKey, tag)}
                                className="shrink-0 p-1 text-tertiary active:text-themeredred transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────

export const Plan = ({ orderTags, instructionTags, orderSets = [], initialText, onChange, expanders = [],
    pickerOpenSignal, pickerOpenAnchor = null,
}: PlanProps) => {
    // Parse the seed once — states plus any custom (unconfigured) tags it carried,
    // e.g. auto-generated plan items from the algorithm's decision-making.
    const parsedSeed = useMemo(
        () => parseInitialText(initialText ?? '', orderTags, instructionTags),
        // Seed is consumed once at mount (matches PE/Plan seed semantics).
        [], // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Custom tags added inline via popover, seeded with unconfigured seed items —
    // merged with profile tags.
    const [customTags, setCustomTags] = useState<Record<PlanBlockKey, string[]>>(parsedSeed.customTags);

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

    const [states, setStates] = useState<Record<PlanBlockKey, BlockState>>(parsedSeed.states);

    // Track which order sets are "active" (have been applied)
    const [activeSetIds, setActiveSetIds] = useState<Set<string>>(new Set());

    // ── Block reorder state ──────────────────────────────────────
    const [blockOrder, setBlockOrder] = useState<PlanBlockKey[] | null>(null);

    const dragStateRef = useRef<{
        dragIndex: number;
        currentIndex: number;
        startY: number;
        itemHeight: number;
    } | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const addPillRef = useRef<HTMLDivElement>(null);

    // Single FAB popover state
    const [showFabPopover, setShowFabPopover] = useState(false);
    const [fabAnchorRect, setFabAnchorRect] = useState<DOMRect | null>(null);
    const [activeTab, setActiveTab] = useState<PlanBlockKey | null>(null);
    const [addCategory, setAddCategory] = useState<PlanBlockKey | null>(null);

    const addTarget = addCategory ?? activeTab;

    const openFabFromAnchor = useCallback((anchor: HTMLElement, focusKey?: string) => {
        setFabAnchorRect(anchor.getBoundingClientRect());
        const tab = (focusKey as PlanBlockKey) ?? null;
        setActiveTab(tab);
        setAddCategory(tab);
        setShowFabPopover(true);
    }, []);

    // Imperatively open the FAB popover each time pickerOpenSignal increments.
    const lastPickerSignalRef = useRef<number | undefined>(pickerOpenSignal);
    useEffect(() => {
        if (pickerOpenSignal === undefined) return;
        if (lastPickerSignalRef.current === pickerOpenSignal) return;
        lastPickerSignalRef.current = pickerOpenSignal;
        if (pickerOpenAnchor) setFabAnchorRect(pickerOpenAnchor);
        setActiveTab(null);
        setAddCategory(null);
        setShowFabPopover(true);
    }, [pickerOpenSignal, pickerOpenAnchor]);

    useEffect(() => {
        onChange(generateText(states, blockOrder ?? undefined));
    }, [states, blockOrder]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleAdd = useCallback((value: string) => {
        // Resolve target: explicit selection → first category with a matching tag → first with tags
        const key = (addTarget as PlanBlockKey)
            ?? ALL_BLOCK_KEYS.find(k => allTags[k].includes(value))
            ?? ALL_BLOCK_KEYS.find(k => allTags[k].length > 0);
        if (!key) return;
        if (allTags[key].includes(value)) {
            toggleTag(key, value);
        } else {
            addCustomTag(key, value);
        }
    }, [addTarget, allTags, toggleTag, addCustomTag]);

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

    // Only show blocks that have tags configured, respecting custom order
    const visibleBlocks = useMemo(() => {
        const active = ALL_BLOCK_KEYS.filter(key => states[key].status === 'active' && allTags[key].length > 0);
        if (!blockOrder) return active;
        const activeSet = new Set(active);
        return [
            ...blockOrder.filter(k => activeSet.has(k)),
            ...active.filter(k => !blockOrder.includes(k)),
        ];
    }, [allTags, states, blockOrder]);

    const allCategories = useMemo(() => {
        const planCats = ALL_BLOCK_KEYS
            .filter(key => allTags[key].length > 0)
            .map(key => ({
                key,
                label: BLOCK_LABELS[key],
                tags: allTags[key],
                state: states[key],
            }));
        return planCats;
    }, [allTags, states]);

    const activeItems = useMemo(() =>
        allCategories.flatMap(cat =>
            cat.state.selectedTags.map(tag => ({ tag, catKey: cat.key, catLabel: cat.label })),
        ),
    [allCategories]);

    const handleRowTap = useCallback((index: number, rect: DOMRect) => {
        const key = visibleBlocks[index];
        setFabAnchorRect(rect);
        setActiveTab(key ?? null);
        setAddCategory(key ?? null);
        setShowFabPopover(true);
    }, [visibleBlocks]);

    // Swipe-to-delete: deactivate the whole block (e.g. removes Medications /
    // Referral / Instructions), clearing its selected tags. Re-addable via +.
    const removeBlock = useCallback((key: PlanBlockKey) => {
        setStates(prev => ({ ...prev, [key]: defaultBlockState() }));
    }, []);

    const reorderTag = useCallback((key: PlanBlockKey, fromIndex: number, toIndex: number) => {
        setStates(prev => {
            const tags = [...prev[key].selectedTags];
            const [moved] = tags.splice(fromIndex, 1);
            tags.splice(toIndex, 0, moved);
            return { ...prev, [key]: { ...prev[key], selectedTags: tags } };
        });
    }, []);

    // ── Drag handlers ────────────────────────────────────────────
    const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
        const target = (e.currentTarget as HTMLElement).closest('[data-block-row]') as HTMLElement | null;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        dragStateRef.current = {
            dragIndex: index,
            currentIndex: index,
            startY: e.clientY,
            itemHeight: rect.height,
        };
        setDragIndex(index);
        setDragOffset(0);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const handleDragMove = useCallback((e: React.PointerEvent) => {
        const ds = dragStateRef.current;
        if (!ds) return;
        const dy = e.clientY - ds.startY;
        setDragOffset(dy);
        const indexShift = Math.round(dy / ds.itemHeight);
        ds.currentIndex = Math.max(0, Math.min(visibleBlocks.length - 1, ds.dragIndex + indexShift));
    }, [visibleBlocks.length]);

    const handleDragEnd = useCallback(() => {
        const ds = dragStateRef.current;
        if (!ds) {
            setDragIndex(null);
            setDragOffset(0);
            return;
        }
        if (ds.dragIndex !== ds.currentIndex) {
            const keys = [...visibleBlocks];
            const [moved] = keys.splice(ds.dragIndex, 1);
            keys.splice(ds.currentIndex, 0, moved);
            setBlockOrder(keys);
        }
        dragStateRef.current = null;
        setDragIndex(null);
        setDragOffset(0);
    }, [visibleBlocks]);

    return (
        <div className="space-y-4">
            {/* Block rows or empty state */}
            {visibleBlocks.length === 0 ? (
                <EmptyState
                    title="Add plan blocks"
                    action={{
                        icon: Plus,
                        label: 'Add plan blocks',
                        onClick: (a) => openFabFromAnchor(a),
                    }}
                />
            ) : (
                <div className="relative">
                    <ActionPill ref={addPillRef} shadow="sm" placement="overlay">
                        <ActionButton
                            icon={Plus}
                            label="Add block"
                            onClick={() => addPillRef.current && openFabFromAnchor(addPillRef.current)}
                        />
                    </ActionPill>
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                        <div
                            ref={listRef}
                            className="px-4 py-3"
                            onPointerMove={handleDragMove}
                            onPointerUp={handleDragEnd}
                            onPointerCancel={handleDragEnd}
                        >
                            {visibleBlocks.map((key, i) => (
                                <SwipeToDeleteRow
                                    key={key}
                                    onDelete={() => removeBlock(key)}
                                    clip={false}
                                >
                                    <PlanBlockRow
                                        label={BLOCK_LABELS[key]}
                                        state={states[key]}
                                        onTap={handleRowTap}
                                        index={i}
                                        isDragging={dragIndex === i}
                                        dragOffset={dragIndex === i ? dragOffset : 0}
                                        onDragStart={handleDragStart}
                                    />
                                </SwipeToDeleteRow>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Unified popover — all categories with nested tags */}
            <PreviewOverlay
                isOpen={showFabPopover}
                onClose={() => setShowFabPopover(false)}
                anchorRect={fabAnchorRect}
                maxWidth={520}
                previewMaxHeight="200px"
                title="Plan"
                headerCard={
                    <>
                        {orderSets.length > 0 && (
                            <div className="w-full rounded-2xl bg-themewhite shadow-xl border border-tertiary/10 overflow-hidden shrink-0">
                                <div className="py-2 px-3">
                                    <p className="text-[9pt] md:text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-2">Order Sets</p>
                                    <ChipBar>
                                        {orderSets.map(os => {
                                            const isActive = activeSetIds.has(os.id);
                                            return (
                                                <Chip
                                                    key={os.id}
                                                    active={isActive}
                                                    onClick={() => applyOrderSet(os)}
                                                >
                                                    {os.name}
                                                    {os.sourceCollides && (
                                                        <span className={`ml-1 text-[8pt] ${isActive ? 'text-white/80' : 'text-themeblue2/80'}`}>· {os.sourceClinicName ?? 'Personal'}</span>
                                                    )}
                                                </Chip>
                                            );
                                        })}
                                    </ChipBar>
                                </div>
                            </div>
                        )}
                        {activeItems.length > 0 && (
                            <ActiveItemsCard
                                items={activeItems}
                                onToggle={(catKey, tag) => toggleTag(catKey as PlanBlockKey, tag)}
                                onReorder={(catKey, from, to) => reorderTag(catKey as PlanBlockKey, from, to)}
                            />
                        )}
                    </>
                }
                searchPlaceholder="Search items..."
                searchPrefix={
                    <CategoryPicker
                        value={addTarget}
                        variant="icon"
                        categories={allCategories.map(c => ({
                            key: c.key,
                            label: c.label,
                            icon: CATEGORY_META[c.key as PlanBlockKey].icon,
                            color: CATEGORY_META[c.key as PlanBlockKey].color,
                            bg: CATEGORY_META[c.key as PlanBlockKey].bg,
                        }))}
                        onChange={(key) => { setAddCategory(key as PlanBlockKey | null); setActiveTab(key as PlanBlockKey | null); }}
                    />
                }
                preview={(filter, clearFilter) => (
                    <PlanAllBlocksPreview
                        categories={allCategories}
                        filter={filter}
                        onToggleTag={(catKey, tag) => {
                            toggleTag(catKey as PlanBlockKey, tag);
                            clearFilter();
                        }}
                        activeTab={activeTab}
                    />
                )}
                onAdd={handleAdd}
                addPlaceholder="Add custom item..."
                actions={[
                    {
                        key: 'reset',
                        label: 'Reset',
                        icon: RotateCcw,
                        onAction: () => {
                            setStates({
                                referral: defaultBlockState(),
                                meds: defaultBlockState(),
                                radiology: defaultBlockState(),
                                lab: defaultBlockState(),
                                followUp: defaultBlockState(),
                                instructions: defaultBlockState(),
                            });
                            setActiveSetIds(new Set());
                            setCustomTags({
                                referral: [], meds: [], radiology: [], lab: [], followUp: [], instructions: [],
                            });
                        },
                        closesOnAction: false,
                        variant: 'danger' as const,
                    },
                ]}
                rightFooter={
                    <ActionPill>
                        <ActionButton icon={Check} label="Done" onClick={() => setShowFabPopover(false)} />
                    </ActionPill>
                }
            />
        </div>
    );
};
