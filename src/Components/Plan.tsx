import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PlanOrderTags, PlanOrderCategory, PlanOrderSet, PlanBlockKey, TextExpander } from '../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../Data/User';
import { detectPII } from '../lib/piiDetector';
import { PIIWarningBanner } from './PIIWarningBanner';
import { ExpandableInput } from './ExpandableInput';

// ── Types ────────────────────────────────────────────────────

type BlockStatus = 'inactive' | 'active';

interface BlockState {
    status: BlockStatus;
    selectedTags: string[];
    freeText: string;
}

const ALL_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

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

// ── Block row component (mirrors ExamItemRow) ────────────────

function PlanBlockRow({ label, tags, state, onCycleStatus, onToggleTag, onSetFreeText, expanders = [], expanderEnabled = false }: {
    label: string;
    tags: string[];
    state: BlockState;
    onCycleStatus: () => void;
    onToggleTag: (tag: string) => void;
    onSetFreeText: (text: string) => void;
    expanders?: TextExpander[];
    expanderEnabled?: boolean;
}) {
    const freeTextWarnings = useMemo(() => detectPII(state.freeText), [state.freeText]);
    const isExpanded = state.status === 'active';

    return (
        <div>
            <button
                type="button"
                className="flex items-center gap-3 w-full text-left py-3 active:scale-[0.98] transition-all"
                onClick={onCycleStatus}
            >
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 transition-colors duration-200 ${
                    state.status === 'active'
                        ? 'bg-themegreen'
                        : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                }`} />
                <span className="text-[10pt] font-medium text-primary flex-1">{label}</span>
            </button>

            <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                style={{
                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="overflow-hidden min-h-0">
                    <div className="pb-3 pl-[26px]">
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                                {tags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={(e) => { e.stopPropagation(); onToggleTag(tag); }}
                                        className={`px-2 py-0.5 text-[9pt] rounded-full transition-colors active:scale-95 ${
                                            state.selectedTags.includes(tag)
                                                ? 'bg-themegreen/15 text-themegreen'
                                                : 'bg-tertiary/5 text-tertiary/40'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                        <ExpandableInput
                            value={state.freeText}
                            onChange={onSetFreeText}
                            expanders={expanders}
                            expanderEnabled={expanderEnabled}
                            placeholder="Additional details..."
                            className="w-full text-[9pt] px-4 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300 mt-1"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <PIIWarningBanner warnings={freeTextWarnings} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────

export const Plan = ({ orderTags, instructionTags, orderSets = [], initialText, onChange, expanders = [], expanderEnabled = false }: PlanProps) => {
    const allTags: Record<PlanBlockKey, string[]> = useMemo(() => ({
        ...orderTags,
        instructions: instructionTags,
    }), [orderTags, instructionTags]);

    const [states, setStates] = useState<Record<PlanBlockKey, BlockState>>(() =>
        parseInitialText(initialText ?? '', orderTags, instructionTags),
    );

    // Track which order sets are "active" (have been applied)
    const [activeSetIds, setActiveSetIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        onChange(generateText(states));
    }, [states]); // eslint-disable-line react-hooks/exhaustive-deps

    const cycleStatus = useCallback((key: PlanBlockKey) => {
        setStates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                status: prev[key].status === 'inactive' ? 'active' : 'inactive',
            },
        }));
    }, []);

    const toggleTag = useCallback((key: PlanBlockKey, tag: string) => {
        setStates(prev => {
            const current = prev[key].selectedTags;
            const next = current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag];
            return { ...prev, [key]: { ...prev[key], selectedTags: next } };
        });
    }, []);

    const setFreeText = useCallback((key: PlanBlockKey, text: string) => {
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], freeText: text },
        }));
    }, []);

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
    const visibleBlocks = ALL_BLOCK_KEYS.filter(key => allTags[key].length > 0);

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
                        <p className="text-[10pt] font-semibold text-tertiary/50 tracking-widest uppercase">Order Sets</p>
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
                    {visibleBlocks.map(key => (
                        <PlanBlockRow
                            key={key}
                            label={BLOCK_LABELS[key]}
                            tags={allTags[key]}
                            state={states[key]}
                            onCycleStatus={() => cycleStatus(key)}
                            onToggleTag={(tag) => toggleTag(key, tag)}
                            onSetFreeText={(text) => setFreeText(key, text)}
                            expanders={expanders}
                            expanderEnabled={expanderEnabled}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
