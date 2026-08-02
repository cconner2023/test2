// Utilities/algorithmNoteRouting.ts
// Routes tagged algorithm list items (questionOptions.noteTag) into structured
// note sections based on the medic's YES/NO answer. The ASSESSMENT algorithm
// dump (formatAlgorithmContent) is left untouched — tagged items appear in BOTH
// the raw screen and their composed HPI/PE home (product decision 2026-06-19).
//
//   - hpi: YES → positive history statement, NO → pertinent negative.
//   - pe:  YES → abnormal finding (abnormalKey), NO → normal finding.
//   - plan: structured via decisionMaking (ancillaryFind/medFind/planOrders) plus
//     the disposition itself (CAT I referral, disposition planInstructions).
//   - assessment: answer-level noteResult, for cards that record a test result.

import type { AlgorithmOptions, decisionMakingType, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { PEItemState } from '../Types/PETypes';
import { MASTER_BLOCKS } from '../Data/PhysicalExamData';
import { PLAN_ORDER_LABELS } from '../Data/User';
import { findTriggeringDecisionMaking } from './NoteFormatter';

/** CAT I is "provider now" — the referral is part of the disposition, not the tree. */
const CAT_I_REFERRAL_TAG = 'Medical Officer';

/** Plan blocks an order can land in, in the order the note prints them. */
type OrderBlock = 'referral' | 'meds' | 'radiology' | 'lab' | 'followUp';
const ORDER_BLOCKS: OrderBlock[] = ['referral', 'meds', 'radiology', 'lab', 'followUp'];

/** ancillaryFind is already a structured order — each type has a Plan home.
 *  'protocol' has none on purpose: it names a procedure (ear irrigation, Ottawa
 *  rules, EKG) that belongs in the decision-making dump. What the medic actually
 *  did is the disposition's planInstructions, in note wording. */
const ANCILLARY_TO_BLOCK: Record<string, OrderBlock> = {
    lab: 'lab',
    rad: 'radiology',
    refer: 'referral',
    med: 'meds',
};

export interface AlgorithmNoteRouting {
    /** Composed HPI narrative ("Reports … . Denies … ."). Empty when no hpi tags hit. */
    hpiText: string;
    /** PE item-state patch keyed by block key — merge into PhysicalExam initialState. */
    peItems: Record<string, PEItemState>;
    /** Block keys touched by PE tags — union into the active template block set. */
    peBlockKeys: string[];
    /** Composed PLAN block text (orders + Instructions) from the active disposition
     *  and its decision-making. Empty when none. Parsed by Plan initialText. */
    planText: string;
    /** Result statements from answered test-result cards, for the ASSESSMENT. */
    assessmentText: string;
}

/** Reverse index: PE finding key → its master block key (built once). */
const FINDING_TO_BLOCK: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const block of MASTER_BLOCKS) {
        for (const finding of block.findings) map[finding.key] = block.key;
    }
    return map;
})();

/** Join a list into a readable, comma-separated clause with a terminal period. */
function clause(lead: string, items: string[]): string {
    if (items.length === 0) return '';
    return `${lead} ${items.join(', ')}.`;
}

/** De-dupe preserving first-seen order. Case-insensitive: the same instruction
 *  reaches the plan from a protocol and a disposition with different casing. */
function uniq(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        const norm = item?.trim().toLowerCase();
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        out.push(item.trim());
    }
    return out;
}

/**
 * Compose a Plan-block text from the active disposition and its decision-making
 * items. Walks into assocMcp (the minor-care protocol). Format matches what
 * Plan.parseInitialText expects ("Label: a; b").
 */
function composePlan(items: decisionMakingType[], disposition: dispositionType): string {
    const orders: Record<OrderBlock, string[]> = {
        referral: [], meds: [], radiology: [], lab: [], followUp: [],
    };
    const instructions: string[] = [];

    if (disposition.type === 'CAT I') orders.referral.push(CAT_I_REFERRAL_TAG);
    if (disposition.planInstructions) instructions.push(...disposition.planInstructions);
    for (const block of ORDER_BLOCKS) {
        const values = block === 'meds' ? undefined : disposition.planOrders?.[block];
        if (values) orders[block].push(...values);
    }

    const collect = (dm: decisionMakingType) => {
        if (dm.medFind) for (const m of dm.medFind) if (m?.text) orders.meds.push(m.text);
        for (const find of dm.ancillaryFind ?? []) {
            const block = find.type ? ANCILLARY_TO_BLOCK[find.type] : undefined;
            if (block && find.modifier) orders[block].push(find.modifier);
        }
        if (dm.planOrders) {
            for (const block of ORDER_BLOCKS) {
                const values = block === 'meds' ? undefined : dm.planOrders[block];
                if (values) orders[block].push(...values);
            }
        }
        if (dm.planInstructions) instructions.push(...dm.planInstructions);
        if (dm.assocMcp) collect(dm.assocMcp);
    };
    items.forEach(collect);

    const lines: string[] = [];
    for (const block of ORDER_BLOCKS) {
        const list = uniq(orders[block]);
        if (list.length > 0) lines.push(`${PLAN_ORDER_LABELS[block]}: ${list.join('; ')}`);
    }
    const instrList = uniq(instructions);
    if (instrList.length > 0) lines.push(`Instructions: ${instrList.join('; ')}`);
    return lines.join('\n');
}

/**
 * Walk visible cards, read each tagged questionOption's YES/NO state
 * (selected = YES), and compose HPI prose + a PE item-state patch.
 */
export function composeAlgorithmNoteRouting(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    chiefComplaint?: string,
    disposition?: dispositionType,
): AlgorithmNoteRouting {
    const hpiPositives: string[] = [];
    const hpiNegatives: string[] = [];
    // Phrases that read with the complaint rather than as a separate report.
    const leadPhrases: string[] = [];
    let ccDuration = '';
    const results: string[] = [];

    // Accumulate PE selections per block before materializing item state.
    const peByBlock: Record<string, { normals: Set<string>; abnormals: Set<string> }> = {};
    const ensureBlock = (blockKey: string) => {
        if (!peByBlock[blockKey]) peByBlock[blockKey] = { normals: new Set(), abnormals: new Set() };
        return peByBlock[blockKey];
    };

    algorithmOptions.forEach((card, index) => {
        const state = cardStates[index];
        if (!state || !state.isVisible) return;

        if (state.answer?.noteResult) results.push(state.answer.noteResult);
        if (!card.questionOptions) return;

        card.questionOptions.forEach((option, optionIndex) => {
            if (!option.noteTag) return;
            const text = option.text?.trim();
            const isYes = state.selectedOptions.includes(optionIndex);

            // A compound option carries an array — YES means yes to every part, so
            // each tag routes independently (e.g. one half → HPI, the other → PE).
            const tags = Array.isArray(option.noteTag) ? option.noteTag : [option.noteTag];

            for (const tag of tags) {
                if (tag.target === 'hpi') {
                    const base = (tag.label ?? text)?.trim().toLowerCase();
                    const positive = tag.invert ? !isYes : isYes;

                    // A bare duration qualifies the complaint itself — "Presents with
                    // sore throat > 10 days". As a pertinent negative it says nothing.
                    if (tag.duration && !tag.label) {
                        if (positive) ccDuration = tag.duration;
                        continue;
                    }
                    if (!base) continue;
                    const phrase = tag.duration ? `${base} ${tag.duration}` : base;
                    if (positive && tag.lead) leadPhrases.push(phrase);
                    else (positive ? hpiPositives : hpiNegatives).push(phrase);
                    continue;
                }

                // PE: link YES → abnormal, NO → normal on the finding's block.
                const blockKey = FINDING_TO_BLOCK[tag.findingKey];
                if (!blockKey) continue;
                const bucket = ensureBlock(blockKey);
                if (isYes) {
                    bucket.abnormals.add(tag.abnormalKey ?? tag.findingKey);
                } else {
                    bucket.normals.add(tag.findingKey);
                }
            }
        });
    });

    // Only compose when the algorithm is actually tagged — keeps untagged trees
    // unchanged (incremental per-algorithm rollout).
    const hasTags = hpiPositives.length > 0 || hpiNegatives.length > 0
        || leadPhrases.length > 0 || !!ccDuration
        || Object.keys(peByBlock).length > 0;
    const cc = chiefComplaint?.trim();
    const lead = cc
        ? `Presents with ${[cc.toLowerCase(), ccDuration].filter(Boolean).join(' ')}`
            + (leadPhrases.length > 0 ? ` and ${leadPhrases.join(' and ')}` : '') + '.'
        : '';
    const hpiText = !hasTags ? '' : [
        lead,
        // Without a chief complaint there is no lead to hang them on.
        clause('Reports', cc ? hpiPositives : [...leadPhrases, ...hpiPositives]),
        clause('Denies', hpiNegatives),
    ].filter(Boolean).join(' ');

    const peItems: Record<string, PEItemState> = {};
    for (const [blockKey, sel] of Object.entries(peByBlock)) {
        const selectedAbnormals = [...sel.abnormals];
        const selectedNormals = [...sel.normals];
        peItems[blockKey] = {
            status: selectedAbnormals.length > 0 ? 'abnormal' : 'normal',
            selectedNormals,
            selectedAbnormals,
            findings: '',
        };
    }

    const planText = (disposition?.type && disposition.text)
        ? composePlan(
            findTriggeringDecisionMaking(algorithmOptions, cardStates, disposition.type, disposition.text),
            disposition,
        )
        : '';

    return {
        hpiText,
        peItems,
        peBlockKeys: Object.keys(peByBlock),
        planText,
        assessmentText: uniq(results).join(' '),
    };
}
