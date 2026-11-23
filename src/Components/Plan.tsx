import type { PlanOrderTags, PlanBlockKey } from '../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../Data/User';
import type { PlanBlockState, PlanState } from '../Types/PlanTypes';
import { formatMedNoteEntry, parseMedNoteEntry } from '@/Utilities/medTag';

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
                // Med segments arrive in note form ("Label, #10, 0rf"); fold them
                // back to the stored pipe form so they match a configured tag.
                const normalized = key === 'meds' ? segments.map(parseMedNoteEntry) : segments;
                const selected = [...new Set(normalized)];
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

function generateText(
    states: Record<PlanBlockKey, BlockState>,
    orderedKeys?: PlanBlockKey[],
    medQty?: Record<string, number>,
): string {
    const keys = orderedKeys ?? ALL_BLOCK_KEYS;
    const lines: string[] = [];
    for (const key of keys) {
        const s = states[key];
        if (s.status !== 'active') continue;
        const parts: string[] = key === 'meds'
            ? s.selectedTags.map(t => formatMedNoteEntry(t, medQty?.[t]))
            : [...s.selectedTags];
        if (s.freeText.trim()) parts.push(s.freeText.trim());
        if (parts.length === 0) continue;
        lines.push(`${BLOCK_LABELS[key]}: ${parts.join('; ')}`);
    }
    return lines.join('\n');
}

/** Pure `PlanState -> plan text` renderer. */
export function generatePlanText(planState: PlanState): string {
    const body = generateText(
        planState.states,
        planState.blockOrder.length ? planState.blockOrder : undefined,
        planState.medQty,
    );
    const extra = (planState.additional ?? '').trim();
    return [body, extra].filter(Boolean).join('\n');
}

/** Seed a PlanState from note text; inverse of generatePlanText. */
export function parsePlanState(
    text: string,
    orderTags: PlanOrderTags,
    instructionTags: string[],
): PlanState {
    const { states, customTags } = parseInitialText(text, orderTags, instructionTags);
    const blockOrder = ALL_BLOCK_KEYS.filter(k => states[k].status === 'active');
    return { states, customTags, activeSetIds: [], blockOrder };
}
