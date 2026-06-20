// Utilities/algorithmNoteRouting.ts
// Routes tagged algorithm list items (questionOptions.noteTag) into structured
// note sections based on the medic's YES/NO answer. The ASSESSMENT algorithm
// dump (formatAlgorithmContent) is left untouched — tagged items appear in BOTH
// the raw screen and their composed HPI/PE home (product decision 2026-06-19).
//
//   - hpi: YES → positive history statement, NO → pertinent negative.
//   - pe:  YES → abnormal finding (abnormalKey), NO → normal finding.
//   - plan: already structured via decisionMaking (ancillaryFind/medFind/specLim).

import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { PEItemState } from '../Types/PETypes';
import { MASTER_BLOCKS } from '../Data/PhysicalExamData';
import { findTriggeringDecisionMaking } from './NoteFormatter';

export interface AlgorithmNoteRouting {
    /** Composed HPI narrative ("Reports … . Denies … ."). Empty when no hpi tags hit. */
    hpiText: string;
    /** PE item-state patch keyed by block key — merge into PhysicalExam initialState. */
    peItems: Record<string, PEItemState>;
    /** Block keys touched by PE tags — union into the active template block set. */
    peBlockKeys: string[];
    /** Composed PLAN block text (Medications / Instructions) from the active
     *  disposition's decision-making. Empty when none. Parsed by Plan initialText. */
    planText: string;
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

/** De-dupe preserving first-seen order. */
function uniq(items: string[]): string[] {
    return [...new Set(items.filter(Boolean))];
}

/**
 * Compose a Plan-block text (Medications / Instructions) from the active
 * disposition's decision-making items. Walks into assocMcp (the minor-care
 * protocol). Format matches what Plan.parseInitialText expects ("Label: a; b").
 */
function composePlan(items: decisionMakingType[]): string {
    const meds: string[] = [];
    const instructions: string[] = [];

    const collect = (dm: decisionMakingType) => {
        if (dm.medFind) for (const m of dm.medFind) if (m?.text) meds.push(m.text);
        if (dm.planInstructions) instructions.push(...dm.planInstructions);
        if (dm.assocMcp) collect(dm.assocMcp);
    };
    items.forEach(collect);

    const lines: string[] = [];
    const medList = uniq(meds);
    const instrList = uniq(instructions);
    if (medList.length > 0) lines.push(`Medications: ${medList.join('; ')}`);
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
    dispositionType?: string,
    dispositionText?: string,
): AlgorithmNoteRouting {
    const hpiPositives: string[] = [];
    const hpiNegatives: string[] = [];

    // Accumulate PE selections per block before materializing item state.
    const peByBlock: Record<string, { normals: Set<string>; abnormals: Set<string> }> = {};
    const ensureBlock = (blockKey: string) => {
        if (!peByBlock[blockKey]) peByBlock[blockKey] = { normals: new Set(), abnormals: new Set() };
        return peByBlock[blockKey];
    };

    algorithmOptions.forEach((card, index) => {
        const state = cardStates[index];
        if (!state || !state.isVisible || !card.questionOptions) return;

        card.questionOptions.forEach((option, optionIndex) => {
            if (!option.noteTag) return;
            const text = option.text?.trim();
            const isYes = state.selectedOptions.includes(optionIndex);

            // A compound option carries an array — YES means yes to every part, so
            // each tag routes independently (e.g. one half → HPI, the other → PE).
            const tags = Array.isArray(option.noteTag) ? option.noteTag : [option.noteTag];

            for (const tag of tags) {
                if (tag.target === 'hpi') {
                    const phrase = (tag.label ?? text)?.trim().toLowerCase();
                    if (!phrase) continue;
                    const positive = tag.invert ? !isYes : isYes;
                    (positive ? hpiPositives : hpiNegatives).push(phrase);
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
        || Object.keys(peByBlock).length > 0;
    const cc = chiefComplaint?.trim();
    const hpiText = !hasTags ? '' : [
        cc ? `Presents with ${cc.toLowerCase()}.` : '',
        clause('Reports', hpiPositives),
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

    const planText = (dispositionType && dispositionText)
        ? composePlan(findTriggeringDecisionMaking(algorithmOptions, cardStates, dispositionType, dispositionText))
        : '';

    return { hpiText, peItems, peBlockKeys: Object.keys(peByBlock), planText };
}
