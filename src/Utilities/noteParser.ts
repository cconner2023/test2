// Utilities/noteParser.ts
// Types, lookup helpers, encoding, decoding, and reconstruction logic for note barcodes.

import { compressText, decompressText } from './textCodec';
import { decodePECompact, encodePEState } from './peCodec';
import { applyRedFlagFloor } from './dispositionSeverity';
import { logError } from './ErrorHandler';

import type { PEState } from '../Types/PETypes';
import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import { ranks, credentials, components } from '../Data/User';
import type { UserTypes } from '../Data/User';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

/** True when value is a versioned structured PE string (e.g. "9:A,R,…") rather than compressed free text. */
const isCompactPE = (v: string) => /^\d+:/.test(v);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenerEntry {
    id: string;
    responses: number[];
    followUp?: number;
}

export interface ParsedNote {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    screenerEntries: ScreenerEntry[];
    actionEntries: { index: number; status: 'performed' | 'deferred-pending' | 'deferred-continue' | 'deferred-stop' }[];
    hpiText: string;
    peText: string;
    /** Medic PE compact (v9) when structured — restores PEState for re-editing. */
    peRaw?: string;
    planText: string;
    assessmentText: string;
    /** Differential diagnoses — library picks and free-text entries. */
    ddx: { selected: string[]; custom: string[] };
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean; includePhysicalExam: boolean; includePlan: boolean; includeAssessment: boolean; amended: boolean };
    user: UserTypes | null;
    userId: string | null;
    // Provider overlay fields (lowercase prefix segments)
    providerHpi?: string;
    providerPe?: string;
    providerPeRaw?: string;
    providerAssessment?: string;
    providerPlan?: string;
    providerUser?: UserTypes | null;
    providerUserId?: string | null;
}

export interface NoteEncodeOptions {
    includeAlgorithm: boolean;
    /** Defaults to true. False sets the omit-decision-making flag bit (64). */
    includeDecisionMaking?: boolean;
    assessmentNote?: string;
    selectedDdx?: string[];
    customDdx?: string[];
    customNote: string;
    physicalExamNote?: string;
    peState?: PEState;
    planNote?: string;
    user?: UserTypes;
    userId?: string;
}

export interface ProviderNoteEncodeOptions {
    hpiNote: string;
    peNote: string;
    peState?: PEState;
    assessmentNote: string;
    planNote: string;
    user?: UserTypes;
    userId?: string;
}

// ---------------------------------------------------------------------------
// Shared user encode / decode
// ---------------------------------------------------------------------------

/** Encode a user profile into "{rankIdx}.{credIdx}.{compIdx}.{compressedName}" */
function encodeUser(user: UserTypes | undefined): string | null {
    if (!user?.lastName) return null;
    const ri = user.rank ? ranks.indexOf(user.rank) : -1;
    const ci = user.credential ? credentials.indexOf(user.credential) : -1;
    const coi = user.component ? components.indexOf(user.component) : -1;
    const nameStr = `${user.firstName ?? ''}|${user.lastName ?? ''}|${user.middleInitial ?? ''}|${user.uic ?? ''}`;
    return `${ri}.${ci}.${coi}.${compressText(nameStr)}`;
}

/** Decode a user profile from "{rankIdx}.{credIdx}.{compIdx}.{compressedName}" */
function decodeUser(value: string): UserTypes | null {
    const segs = value.split('.');
    if (segs.length < 4) return null;
    const ri = parseInt(segs[0], 10);
    const ci = parseInt(segs[1], 10);
    const coi = parseInt(segs[2], 10);
    const names = decompressText(segs.slice(3).join('.')).split('|');
    return {
        firstName: names[0] || undefined,
        lastName: names[1] || undefined,
        middleInitial: names[2] || undefined,
        rank: ri >= 0 ? ranks[ri] : undefined,
        credential: ci >= 0 ? credentials[ci] : undefined,
        component: coi >= 0 ? components[coi] : undefined,
        uic: names[3] || undefined,
    };
}

/** Encode a UUID with hyphens stripped. */
function encodeUserId(userId: string): string {
    return userId.replace(/-/g, '');
}

/** Decode a 32-char hex string back to UUID format. */
function decodeUserId(value: string): string | null {
    if (value.length !== 32) return null;
    return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Shared PE encode helper
// ---------------------------------------------------------------------------

/** Encode PE state as structured v9 when available, compressed text fallback. */
function encodePE(peState: PEState | undefined, peText: string | undefined, symptomCode?: string): string | null {
    if (peState) {
        try {
            return encodePEState(peState, symptomCode);
        } catch (e) {
            logError('noteParser.encodePE', e);
        }
    }
    const trimmed = peText?.trim();
    return trimmed ? compressText(trimmed) : null;
}

/** Decode a PE value — structured v9 or compressed text. */
function decodePE(value: string, symptomCode: string): { text: string; raw?: string } {
    if (isCompactPE(value)) {
        return { text: decodePECompact(value, symptomCode), raw: value };
    }
    return { text: decompressText(value) };
}

// ---------------------------------------------------------------------------
// Shared DDx encode / decode
// ---------------------------------------------------------------------------

/**
 * Encode DDx as compressed JSON `[selected, custom]`. Custom entries are free
 * text, so they must never sit raw in the pipe-delimited string.
 */
function encodeDdx(selected: string[] | undefined, custom: string[] | undefined): string | null {
    const s = (selected ?? []).map(d => d.trim()).filter(Boolean);
    const c = (custom ?? []).map(d => d.trim()).filter(Boolean);
    if (s.length === 0 && c.length === 0) return null;
    return compressText(JSON.stringify([s, c]));
}

/** Decode a DDx segment value. Malformed input yields empty lists. */
function decodeDdx(value: string): ParsedNote['ddx'] {
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
    try {
        const [selected, custom] = JSON.parse(decompressText(value));
        return { selected: strings(selected), custom: strings(custom) };
    } catch (e) {
        logError('noteParser.decodeDdx', e);
        return { selected: [], custom: [] };
    }
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Look up algorithm options by symptom code (e.g. "A1" or "A-1"). Returns null if not found. */
export function findAlgorithmByCode(code: string): AlgorithmOptions[] | null {
    const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    const algorithm = Algorithm.find(item => item.id === algorithmId);
    return algorithm?.options || null;
}

/** Look up the category and symptom definition by symptom code. Returns null if not found. */
export function findSymptomByCode(code: string): { category: catDataTypes; symptom: subCatDataTypes } | null {
    const iconId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    for (const category of catData) {
        if (category.contents) {
            const symptom = category.contents.find(s => s.icon === iconId);
            if (symptom) return { category, symptom };
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Decoding (barcode string -> ParsedNote)
// ---------------------------------------------------------------------------

/**
 * Parse a pipe-delimited barcode string into a structured ParsedNote.
 * Handles medic notes, provider-solo (PRV) notes, and combined medic+provider bundles.
 *
 * Medic layout: {symptomCode}|{compactAlgorithm}|{prefixed segments…}
 * Provider layout: PRV|{prefixed segments…}
 */
export function parseNoteEncoding(encodedText: string): ParsedNote | null {
    if (!encodedText.trim()) return null;

    const parts = encodedText.split('|');
    const symptomCode = parts[0] ?? '';
    if (!symptomCode) return null;

    const isProvider = symptomCode === 'PRV';

    const result: ParsedNote = {
        symptomCode,
        rfSelections: [],
        cardEntries: [],
        screenerEntries: [],
        actionEntries: [],
        hpiText: '',
        peText: '',
        planText: '',
        assessmentText: '',
        ddx: { selected: [], custom: [] },
        flags: {
            includeAlgorithm: !isProvider,
            includeDecisionMaking: !isProvider,
            includeHPI: false,
            includePhysicalExam: false,
            includePlan: false,
            includeAssessment: false,
            amended: false,
        },
        user: null,
        userId: null,
    };

    if (!isProvider) {
        const algorithmOptions = findAlgorithmByCode(symptomCode);
        if (algorithmOptions) {
            const algo = decodeAlgorithmCompact(parts[1] ?? '', algorithmOptions);
            result.rfSelections = algo.rfSelections;
            result.cardEntries = algo.cardEntries;
            result.screenerEntries = algo.screenerEntries;
            result.actionEntries = algo.actionEntries;
        }
    }

    for (let i = contentStartIndex(symptomCode); i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const prefix = part[0];
        const value = part.substring(1);

        switch (prefix) {
            // ── Medic segments ──
            case 'H': {
                result.hpiText = decompressText(value);
                break;
            }
            case 'P': {
                const pe = decodePE(value, symptomCode);
                result.peText = pe.text;
                if (pe.raw) result.peRaw = pe.raw;
                break;
            }
            case 'N': {
                result.planText = decompressText(value);
                break;
            }
            case 'F': {
                const f = parseInt(value, 10);
                result.flags = {
                    includeAlgorithm: !!(f & 1),
                    // Bit 64 = medic toggled DECISION MAKING off. Inverted so legacy
                    // barcodes (no bit) keep rendering it. Bit 2 only marks DDx presence.
                    includeDecisionMaking: !(f & 64),
                    includeHPI: !!(f & 4),
                    includePhysicalExam: !!(f & 8),
                    includePlan: !!(f & 16),
                    includeAssessment: !!(f & 32),
                    // Bit 128 = a provider amended the medic's free-text sections.
                    amended: !!(f & 128),
                };
                break;
            }
            case 'X': {
                result.assessmentText = decompressText(value);
                break;
            }
            case 'U': {
                result.user = decodeUser(value);
                break;
            }
            case 'I': {
                result.userId = decodeUserId(value);
                break;
            }
            case 'D': {
                result.ddx = decodeDdx(value);
                break;
            }
            // ── Provider segments (lowercase) ──
            case 'h': {
                result.providerHpi = decompressText(value);
                break;
            }
            case 'p': {
                const pe = decodePE(value, symptomCode);
                result.providerPe = pe.text;
                if (pe.raw) result.providerPeRaw = pe.raw;
                break;
            }
            case 'x': {
                result.providerAssessment = decompressText(value);
                break;
            }
            case 'n': {
                result.providerPlan = decompressText(value);
                break;
            }
            case 'u': {
                result.providerUser = decodeUser(value);
                break;
            }
            case 'i': {
                result.providerUserId = decodeUserId(value);
                break;
            }
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Compact algorithm encoding (v2)
// ---------------------------------------------------------------------------

/**
 * Encode algorithm card states into a compact dash-separated string.
 * First hex digit of each group is the card index (0-f).
 * Cards with no meaningful state are skipped — the decoder replays
 * the algorithm flow to reconstruct visibility and answers.
 *
 * Group types:
 *   RF / choice / count / initial with opts:  {idx}{hexOpt1}{hexOpt2}...
 *   Action (non-screener):                    {idx}[{hexOpts}]{P|D}
 *   Screener action:                          {idx}:{hexResponses}[:{followUp}]
 *   No-opts terminal/disposition answer:       {idx}{answerIdx}
 *   Flow-through (non-terminal, no-opts):      SKIPPED
 *   Initial with no opts:                      SKIPPED (derived from RF)
 */
function encodeAlgorithmCompact(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
): string {
    const groups: string[] = [];

    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card) continue;

        const idx = i.toString(16);

        // RF: encode selected option indices as hex
        if (card.type === 'rf') {
            if (state.selectedOptions.length > 0) {
                groups.push(idx + state.selectedOptions.map(o => o.toString(16)).join(''));
            }
            continue;
        }

        // Screener action: {idx}:{responses}[:{followUp}]
        if (card.type === 'action' && card.screenerConfig && state.screenerResponses) {
            const resp = state.screenerResponses.map(d => d.toString(16)).join('');
            let seg = `${idx}:${resp}`;
            if (state.followUpResponse !== undefined && state.followUpResponse !== null) {
                seg += `:${state.followUpResponse}`;
            }
            groups.push(seg);
            continue;
        }

        // Non-screener action: [selections]{P|D}
        if (card.type === 'action' && !card.screenerConfig) {
            const selPart = (card.questionOptions.length > 0 && state.selectedOptions.length > 0)
                ? state.selectedOptions.map(o => o.toString(16)).join('')
                : '';
            // 'deferred-pending' is a transient mid-decision state and is not serialized.
            const statusPart = state.actionStatus === 'deferred-stop' ? 'S'
                : state.actionStatus === 'deferred-continue' ? 'D'
                : state.actionStatus === 'performed' ? 'P'
                : '';
            if (selPart || statusPart) {
                groups.push(idx + selPart + statusPart);
            }
            continue;
        }

        // Initial with no questionOptions: answer is derived from RF presence — only encode
        // it when it differs (e.g. algorithms with no RF card answered "Yes").
        if (card.type === 'initial' && card.questionOptions.length === 0) {
            if (state.answer) {
                const answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
                const hasRf = algorithmOptions.some((c, j) => c.type === 'rf' && (cardStates[j]?.selectedOptions.length ?? 0) > 0);
                const derivedIdx = hasRf ? 0 : (card.answerOptions.length > 1 ? 1 : -1);
                if (answerIdx >= 0 && answerIdx !== derivedIdx) groups.push(idx + answerIdx.toString());
            }
            continue;
        }

        // Cards with questionOptions: encode selections, answer is derived
        if (card.questionOptions.length > 0) {
            if (state.selectedOptions.length > 0) {
                groups.push(idx + state.selectedOptions.map(o => o.toString(16)).join(''));
            }
            continue;
        }

        // Cards without questionOptions: encode answer index for terminal/disposition only
        if (state.answer && card.answerOptions.length > 0) {
            const answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
            if (answerIdx >= 0) {
                const answer = card.answerOptions[answerIdx];
                if (answer.next === null || (answer.disposition && answer.disposition.length > 0)) {
                    groups.push(idx + answerIdx.toString());
                }
            }
        }
    }

    return groups.join('-');
}

// ---------------------------------------------------------------------------
// Compact algorithm decoding (v2)
// ---------------------------------------------------------------------------

/** Index of the first prefixed segment — after the compact algorithm segment on medic notes. */
function contentStartIndex(symptomCode: string): number {
    return symptomCode === 'PRV' ? 1 : 2;
}

/**
 * Decode a compact algorithm string back into ParsedNote components.
 * Replays the algorithm flow using selections to reconstruct answers and visibility.
 */
function decodeAlgorithmCompact(
    compact: string,
    algorithmOptions: AlgorithmOptions[],
): {
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    screenerEntries: ScreenerEntry[];
    actionEntries: { index: number; status: 'performed' | 'deferred-pending' | 'deferred-continue' | 'deferred-stop' }[];
} {
    const rfSelections: number[] = [];
    const cardEntries: { index: number; selections: number[]; answerIndex: number }[] = [];
    const screenerEntries: ScreenerEntry[] = [];
    const actionEntries: { index: number; status: 'performed' | 'deferred' }[] = [];

    // An empty compact is still a valid flow (e.g. no red flags + "No" to every card
    // encodes zero groups) — replay it rather than returning early.
    // Parse groups into a lookup: cardIndex → rest-of-group
    const groupMap = new Map<number, string>();
    for (const group of compact.split('-')) {
        if (!group) continue;
        const cardIdx = parseInt(group[0], 16);
        if (!isNaN(cardIdx)) groupMap.set(cardIdx, group.substring(1));
    }

    const initialIndex = algorithmOptions.findIndex(c => c.type === 'initial');
    if (initialIndex < 0) return { rfSelections, cardEntries, screenerEntries, actionEntries };

    // Phase 1: RF and pre-initial cards (always visible)
    for (let i = 0; i < initialIndex; i++) {
        const card = algorithmOptions[i];
        if (!card) continue;
        if (card.type === 'rf') {
            if (groupMap.has(i)) {
                rfSelections.push(...groupMap.get(i)!.split('').map(ch => parseInt(ch, 16)));
            }
        } else if (card.type === 'action') {
            decodeCompactAction(i, card, groupMap, cardEntries, screenerEntries, actionEntries);
        }
    }

    // Phase 2: Replay flow from initial card
    const visited = new Set<number>();
    const queue: number[] = [initialIndex];

    while (queue.length > 0) {
        const ci = queue.shift()!;
        if (visited.has(ci) || ci < 0 || ci >= algorithmOptions.length) continue;
        visited.add(ci);

        const card = algorithmOptions[ci];
        if (!card || card.type === 'rf') continue;

        // Action cards
        if (card.type === 'action') {
            decodeCompactAction(ci, card, groupMap, cardEntries, screenerEntries, actionEntries);
            continue;
        }

        let selections: number[] = [];
        let answerIdx = -1;

        if (card.questionOptions.length > 0) {
            // Parse selections from group
            if (groupMap.has(ci)) {
                selections = groupMap.get(ci)!.split('').map(ch => parseInt(ch, 16));
            }
            // Derive answer
            if (card.type === 'initial') {
                answerIdx = (selections.length > 0 || rfSelections.length > 0)
                    ? 0 : (card.answerOptions.length > 1 ? 1 : -1);
            } else if (card.type === 'choice') {
                answerIdx = selections.length > 0 ? 0 : (card.answerOptions.length > 1 ? 1 : -1);
            } else if (card.type === 'count') {
                answerIdx = selections.length >= 3 ? 0 : (card.answerOptions.length > 1 ? 1 : -1);
            }
        } else if (card.answerOptions.length > 0) {
            // No questionOptions — check group or infer
            if (groupMap.has(ci)) {
                answerIdx = parseInt(groupMap.get(ci)!, 10);
            } else if (card.type === 'initial') {
                answerIdx = rfSelections.length > 0 ? 0 : (card.answerOptions.length > 1 ? 1 : -1);
            } else {
                answerIdx = inferFlowThroughAnswer(card, groupMap, algorithmOptions);
            }
        }

        if (answerIdx >= 0 && answerIdx < card.answerOptions.length) {
            cardEntries.push({ index: ci, selections, answerIndex: answerIdx });
            const answer = card.answerOptions[answerIdx];
            if (answer.next !== null) {
                const nextArr = Array.isArray(answer.next) ? answer.next : [answer.next];
                for (const n of nextArr) { if (!visited.has(n)) queue.push(n); }
            }
        }
    }

    return { rfSelections, cardEntries, screenerEntries, actionEntries };
}

/** Decode an action card group (screener or non-screener). */
function decodeCompactAction(
    ci: number,
    card: AlgorithmOptions,
    groupMap: Map<number, string>,
    cardEntries: { index: number; selections: number[]; answerIndex: number }[],
    screenerEntries: ScreenerEntry[],
    actionEntries: { index: number; status: 'performed' | 'deferred' }[],
): void {
    if (!groupMap.has(ci)) return;
    const rest = groupMap.get(ci)!;

    // Screener: rest starts with ':'
    if (card.screenerConfig && rest.startsWith(':')) {
        const parts = rest.substring(1).split(':');
        const responses = parts[0].split('').map(ch => parseInt(ch, 16));
        const followUp = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
        let screenerId = card.screenerConfig.id;
        const ext = card.screenerConfig.conditionalExtension;
        if (ext && responses.length > card.screenerConfig.questions.length) {
            screenerId = ext.screener.id;
        }
        screenerEntries.push({
            id: screenerId,
            responses,
            followUp: isNaN(followUp as number) ? undefined : followUp,
        });
        return;
    }

    // Non-screener: optional hex selections + optional P/D/S suffix
    // (P = performed, D = deferred-continue, S = deferred-stop)
    let selStr = rest;
    let statusChar = '';
    if (rest.endsWith('P') || rest.endsWith('D') || rest.endsWith('S')) {
        statusChar = rest[rest.length - 1];
        selStr = rest.substring(0, rest.length - 1);
    }
    if (statusChar) {
        const status = statusChar === 'S' ? 'deferred-stop'
            : statusChar === 'D' ? 'deferred-continue'
            : 'performed';
        actionEntries.push({ index: ci, status });
    }
    if (selStr.length > 0 && card.questionOptions.length > 0) {
        cardEntries.push({
            index: ci,
            selections: selStr.split('').map(ch => parseInt(ch, 16)),
            answerIndex: -1,
        });
    }
}

/**
 * Infer the answer for a flow-through card (no questionOptions, no group).
 * Picks the non-terminal answer, or checks downstream for encoded state.
 */
function inferFlowThroughAnswer(
    card: AlgorithmOptions,
    groupMap: Map<number, string>,
    algorithmOptions: AlgorithmOptions[],
): number {
    // Try to find the single non-terminal answer
    const nonTerminal: number[] = [];
    for (let a = 0; a < card.answerOptions.length; a++) {
        if (card.answerOptions[a].next !== null) nonTerminal.push(a);
    }
    if (nonTerminal.length === 1) return nonTerminal[0];

    // Multiple non-terminal: check which downstream path has encoded state
    for (const a of nonTerminal) {
        const answer = card.answerOptions[a];
        const nextArr = Array.isArray(answer.next) ? answer.next! as number[] : [answer.next as number];
        if (nextArr.some(idx => hasEncodedDescendant(idx, groupMap, algorithmOptions, new Set()))) {
            return a;
        }
    }

    // Fallback: pick answer 1 (typically "no" / flow-through)
    return card.answerOptions.length > 1 ? 1 : 0;
}

/** Recursively check if a card index or any of its descendants have encoded state. */
function hasEncodedDescendant(
    ci: number,
    groupMap: Map<number, string>,
    algorithmOptions: AlgorithmOptions[],
    visited: Set<number>,
): boolean {
    if (visited.has(ci)) return false;
    visited.add(ci);
    if (groupMap.has(ci)) return true;
    const card = algorithmOptions[ci];
    if (!card) return false;
    for (const answer of card.answerOptions) {
        if (answer.next !== null) {
            const nextArr = Array.isArray(answer.next) ? answer.next : [answer.next];
            for (const n of nextArr) {
                if (hasEncodedDescendant(n, groupMap, algorithmOptions, visited)) return true;
            }
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Encoding (live state -> barcode string)
// ---------------------------------------------------------------------------

/**
 * Encode the current algorithm state, HPI, PE, and user profile into a pipe-delimited barcode string.
 */
export function encodeNoteState(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    noteOptions: NoteEncodeOptions,
    symptomCode: string,
): string {
    const parts: string[] = [symptomCode];

    // Compact algorithm encoding (v2): single dash-separated segment
    parts.push(encodeAlgorithmCompact(algorithmOptions, cardStates));

    // HPI
    const customNote = noteOptions.customNote?.trim();
    if (customNote) parts.push(`H${compressText(customNote)}`);

    // Physical Exam
    const peEncoded = encodePE(noteOptions.peState, noteOptions.physicalExamNote, symptomCode);
    const hasPE = !!peEncoded;
    if (peEncoded) parts.push(`P${peEncoded}`);

    // Plan
    const planNoteText = noteOptions.planNote?.trim();
    if (planNoteText) parts.push(`N${compressText(planNoteText)}`);

    // Assessment (free-text clinical narrative)
    const assessmentNoteText = noteOptions.assessmentNote?.trim();
    if (assessmentNoteText) parts.push(`X${compressText(assessmentNoteText)}`);

    // DDx list
    const ddxEncoded = encodeDdx(noteOptions.selectedDdx, noteOptions.customDdx);
    if (ddxEncoded) parts.push(`D${ddxEncoded}`);

    // Flags
    let flags = 0;
    if (noteOptions.includeAlgorithm) flags |= 1;
    if (ddxEncoded) flags |= 2;
    if (customNote) flags |= 4;
    if (hasPE) flags |= 8;
    if (planNoteText) flags |= 16;
    if (assessmentNoteText) flags |= 32;
    if (noteOptions.includeDecisionMaking === false) flags |= 64;
    parts.push(`F${flags}`);

    // User profile
    const userEncoded = encodeUser(noteOptions.user);
    if (userEncoded) parts.push(`U${userEncoded}`);

    // User ID
    if (noteOptions.userId) parts.push(`I${encodeUserId(noteOptions.userId)}`);

    return parts.join('|');
}

// ---------------------------------------------------------------------------
// Content comparison
// ---------------------------------------------------------------------------

/** Compare two encoded note strings ignoring volatile segments (I/i = userId) */
export function encodedContentEquals(a: string, b: string): boolean {
    const strip = (s: string) => s.split('|').filter(p => !p.startsWith('I') && !p.startsWith('i')).join('|');
    return strip(a) === strip(b);
}

// ---------------------------------------------------------------------------
// Reconstruction (ParsedNote + algorithm -> CardState[] + disposition)
// ---------------------------------------------------------------------------

/**
 * Reconstruct card states and disposition from a parsed note and its algorithm definition.
 */
export function reconstructCardStates(
    algorithmOptions: AlgorithmOptions[],
    parsed: ParsedNote,
): { cardStates: CardState[]; disposition: dispositionType | null } {
    const initialIndex = algorithmOptions.findIndex(card => card.type === 'initial');

    const cardStates: CardState[] = algorithmOptions.map((_, index) => ({
        index,
        isVisible: index <= initialIndex,
        answer: null,
        selectedOptions: [],
        count: 0,
    }));

    // Apply RF selections
    const rfCard = algorithmOptions[0];
    if (rfCard?.type === 'rf') {
        cardStates[0].selectedOptions = parsed.rfSelections;
        cardStates[0].count = parsed.rfSelections.length;
    }

    // Apply each card entry
    let lastDisposition: dispositionType | null = null;

    for (const entry of parsed.cardEntries) {
        if (entry.index < 0 || entry.index >= cardStates.length) continue;
        const card = algorithmOptions[entry.index];
        if (!card) continue;

        cardStates[entry.index].isVisible = true;
        cardStates[entry.index].selectedOptions = entry.selections;
        cardStates[entry.index].count = entry.selections.length;

        if (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length) {
            const answer = card.answerOptions[entry.answerIndex];
            cardStates[entry.index].answer = answer;

            if (answer.disposition && answer.disposition.length > 0) {
                lastDisposition = answer.disposition[0];
            }

            if (answer.next !== null) {
                const nextIndices = Array.isArray(answer.next) ? answer.next : [answer.next];
                nextIndices.forEach(nextIndex => {
                    if (nextIndex >= 0 && nextIndex < cardStates.length) {
                        cardStates[nextIndex].isVisible = true;
                    }
                });
            }
        }
    }

    // Apply screener entries
    for (const entry of parsed.screenerEntries) {
        const cardIdx = algorithmOptions.findIndex(card => {
            if (!card.screenerConfig) return false;
            if (card.screenerConfig.id === entry.id) return true;
            if (card.screenerConfig.conditionalExtension?.screener.id === entry.id) return true;
            return false;
        });
        if (cardIdx >= 0) {
            cardStates[cardIdx].screenerResponses = entry.responses;
            cardStates[cardIdx].completedScreenerId = entry.id;
            if (entry.followUp !== undefined) {
                cardStates[cardIdx].followUpResponse = entry.followUp;
            }
        }
    }

    // Apply action status entries
    for (const entry of parsed.actionEntries) {
        if (entry.index >= 0 && entry.index < cardStates.length) {
            cardStates[entry.index].actionStatus = entry.status;
        }
    }

    // Red flags floor the disposition at the bound initial card's "yes" severity (e.g. CAT I),
    // matching the live engine (useAlgorithm) so an imported/previewed note shows the same
    // sticky disposition a later, lower-severity answer would otherwise have downgraded.
    const disposition = applyRedFlagFloor(
        algorithmOptions, initialIndex, parsed.rfSelections.length > 0, lastDisposition,
    );

    return { cardStates, disposition };
}

// ---------------------------------------------------------------------------
// Provider note encoding
// ---------------------------------------------------------------------------

/** Encode provider note fields into a PRV-prefixed pipe-delimited string. */
export function encodeProviderNote(options: ProviderNoteEncodeOptions): string {
    const parts: string[] = ['PRV'];
    appendProviderSegments(parts, options);
    return parts.join('|');
}

/**
 * Append provider segments to a medic barcode. Any provider layer already on the
 * barcode (a re-imported bundle) is replaced, not stacked — the importer seeds the
 * editors from it, so the new provider options are the complete provider layer.
 */
export function encodeProviderBundle(medicBarcode: string, options: ProviderNoteEncodeOptions): string {
    const medicOnly = stripProviderSegments(medicBarcode);
    const providerParts: string[] = [];
    appendProviderSegments(providerParts, options);
    if (providerParts.length === 0) return medicOnly;
    return medicOnly + '|' + providerParts.join('|');
}

/** Medic sections a provider can amend in a bundle. PE takes structured state
 *  (stays editable as exam blocks + vitals) or, for a legacy text exam, text. */
export interface MedicAmendment {
    hpi?: string;
    pe?: string;
    peState?: PEState;
    assessment?: string;
    plan?: string;
}

const AMEND_TEXT_SEGMENTS: { key: 'hpi' | 'pe' | 'assessment' | 'plan'; prefix: string; bit: number }[] = [
    { key: 'hpi', prefix: 'H', bit: 4 },
    { key: 'pe', prefix: 'P', bit: 8 },
    { key: 'plan', prefix: 'N', bit: 16 },
    { key: 'assessment', prefix: 'X', bit: 32 },
];

/**
 * Rewrite a medic barcode's section segments (H/P/N/X) in place, keeping the
 * algorithm, DDx, and author intact. Include-flags track the new content and
 * bit 128 marks the note as provider-amended. Returns the barcode unchanged when
 * the edit encodes identically (editor re-emits never flag a note amended).
 * Provider segments pass through untouched.
 */
export function amendMedicBarcode(medicBarcode: string, edits: MedicAmendment): string {
    const parts = medicBarcode.split('|');
    const symptomCode = parts[0];
    const contentStart = contentStartIndex(symptomCode);
    const head = parts.slice(0, contentStart);
    let body = parts.slice(contentStart);

    let flags = 0;
    const fIdx = body.findIndex(p => p[0] === 'F');
    if (fIdx >= 0) flags = parseInt(body[fIdx].substring(1), 10) || 0;

    let changed = false;
    const replace = (prefix: string, bit: number, value: string | null) => {
        const current = body.find(p => p[0] === prefix)?.substring(1) ?? null;
        if (current === value) return;
        changed = true;
        body = body.filter(p => p[0] !== prefix);
        if (value) {
            body.push(`${prefix}${value}`);
            flags |= bit;
        } else {
            flags &= ~bit;
        }
    };

    for (const { key, prefix, bit } of AMEND_TEXT_SEGMENTS) {
        const next = edits[key];
        if (next === undefined) continue;
        const trimmed = next.trim();
        replace(prefix, bit, trimmed ? compressText(trimmed) : null);
    }
    if (edits.peState) replace('P', 8, encodePE(edits.peState, undefined, symptomCode));

    if (!changed) return medicBarcode;
    flags |= 128;
    body = body.filter(p => p[0] !== 'F');
    body.push(`F${flags}`);
    return [...head, ...body].join('|');
}

const PROVIDER_PREFIXES = new Set(['h', 'p', 'x', 'n', 'u', 'i']);

/** Drop provider (lowercase-prefixed) segments, leaving the medic note. */
function stripProviderSegments(barcode: string): string {
    const parts = barcode.split('|');
    // The compact algorithm segment is lowercase hex — never treat it as a provider segment.
    const contentStart = contentStartIndex(parts[0]);
    return parts.filter((p, i) => i < contentStart || !PROVIDER_PREFIXES.has(p[0])).join('|');
}

/** Shared: encode all provider segments into the parts array. */
function appendProviderSegments(parts: string[], options: ProviderNoteEncodeOptions): void {
    if (options.hpiNote.trim()) parts.push(`h${compressText(options.hpiNote.trim())}`);

    const peEncoded = encodePE(options.peState, options.peNote);
    if (peEncoded) parts.push(`p${peEncoded}`);

    if (options.assessmentNote.trim()) parts.push(`x${compressText(options.assessmentNote.trim())}`);
    if (options.planNote.trim()) parts.push(`n${compressText(options.planNote.trim())}`);

    const userEncoded = encodeUser(options.user);
    if (userEncoded) parts.push(`u${userEncoded}`);

    if (options.userId) parts.push(`i${encodeUserId(options.userId)}`);
}
