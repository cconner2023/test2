// Utilities/noteParser.ts
// Types, lookup helpers, encoding, decoding, and reconstruction logic for note barcodes.

import { compressText, decompressText, bitmaskToIndices, indicesToBitmask } from './textCodec';
import { decodePECompact, encodePEState } from './peCodec';
import { logError } from './ErrorHandler';

import type { PEState } from '../Types/PETypes';
import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import { ranks, credentials, components } from '../Data/User';
import type { UserTypes } from '../Data/User';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

/** True when value looks like a versioned PE compact string (e.g. "6:A,R,…"). */
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
    actionEntries: { index: number; status: 'performed' | 'deferred' }[];
    hpiText: string;
    peText: string;
    planText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean; includePhysicalExam: boolean; includePlan: boolean };
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
    try {
        return `${ri}.${ci}.${coi}.${compressText(nameStr)}`;
    } catch (e) {
        logError('noteParser.encodeUser', e);
        return `${ri}.${ci}.${coi}.${encodeURIComponent(nameStr)}`;
    }
}

/** Decode a user profile from "{rankIdx}.{credIdx}.{compIdx}.{compressedName}" */
function decodeUser(value: string): UserTypes | null {
    const segs = value.split('.');
    if (segs.length < 4) return null;
    const ri = parseInt(segs[0], 10);
    const ci = parseInt(segs[1], 10);
    const coi = parseInt(segs[2], 10);
    let names: string[] = [];
    try {
        names = decompressText(segs.slice(3).join('.')).split('|');
    } catch (e) { logError('noteParser.decodeUser', e); }
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

/** Encode PE state with structured v8 when available, compressed text fallback. */
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

/** Decode a PE value — structured v6 or compressed text. */
function decodePE(value: string, symptomCode: string): { text: string; raw?: string } {
    if (isCompactPE(value)) {
        return { text: decodePECompact(value, symptomCode), raw: value };
    }
    return { text: decompressText(value) };
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
        flags: {
            includeAlgorithm: !isProvider,
            includeDecisionMaking: !isProvider,
            includeHPI: false,
            includePhysicalExam: false,
            includePlan: false,
        },
        user: null,
        userId: null,
    };

    // Detect compact algorithm format (v2) vs legacy
    const hasCompactAlgo = !isProvider && isCompactAlgorithm(parts[1]);
    let contentStart = 1;

    if (hasCompactAlgo) {
        const algorithmOptions = findAlgorithmByCode(symptomCode);
        if (algorithmOptions) {
            const algo = decodeAlgorithmCompact(parts[1] || '', algorithmOptions);
            result.rfSelections = algo.rfSelections;
            result.cardEntries = algo.cardEntries;
            result.screenerEntries = algo.screenerEntries;
            result.actionEntries = algo.actionEntries;
        }
        contentStart = 2;
    }

    for (let i = contentStart; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const prefix = part[0];
        const value = part.substring(1);

        switch (prefix) {
            // ── Legacy medic algorithm segments (only hit for old barcodes) ──
            case 'R': {
                result.rfSelections = bitmaskToIndices(parseInt(value || '0', 36));
                break;
            }
            case 'H': {
                result.hpiText = decompressText(value);
                break;
            }
            case 'P': {
                const pe = decodePE(value, symptomCode);
                result.peText = pe.text;
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
                    includeDecisionMaking: !!(f & 2),
                    includeHPI: !!(f & 4),
                    includePhysicalExam: !!(f & 8),
                    includePlan: !!(f & 16),
                };
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
            case 'A': {
                const aSegs = value.split('.');
                if (aSegs.length >= 2) {
                    result.actionEntries.push({
                        index: parseInt(aSegs[0], 10),
                        status: aSegs[1] === 'D' ? 'deferred' : 'performed',
                    });
                }
                break;
            }
            case 'Q': {
                const qSegs = value.split('.');
                if (qSegs.length >= 2) {
                    const responseStr = qSegs[1];
                    const responses = responseStr.includes('-')
                        ? responseStr.split('-').map(s => parseInt(s, 36))
                        : responseStr.split('').map(d => parseInt(d, 10));
                    const followUp = qSegs.length >= 3 ? parseInt(qSegs[2], 10) : undefined;
                    result.screenerEntries.push({
                        id: qSegs[0],
                        responses,
                        followUp: isNaN(followUp as number) ? undefined : followUp,
                    });
                }
                break;
            }
            case 'D': {
                // DDx list: selected~selected^custom~custom
                const [selectedStr, customStr] = value.split('^');
                if (selectedStr) {
                    // Store in flags as a proxy — actual DDx values parsed here
                    result.flags.includeDecisionMaking = true;
                }
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
            default: {
                // Card entry: "{index}.{selBitmask36}.{answerIndex}"
                if (/^\d/.test(part)) {
                    const segments = part.split('.');
                    if (segments.length >= 3) {
                        result.cardEntries.push({
                            index: parseInt(segments[0], 10),
                            selections: bitmaskToIndices(parseInt(segments[1], 36)),
                            answerIndex: parseInt(segments[2], 10),
                        });
                    }
                }
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
            const statusPart = state.actionStatus
                ? (state.actionStatus === 'deferred' ? 'D' : 'P')
                : '';
            if (selPart || statusPart) {
                groups.push(idx + selPart + statusPart);
            }
            continue;
        }

        // Initial with no questionOptions: skip (answer derived from RF presence)
        if (card.type === 'initial' && card.questionOptions.length === 0) {
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

/** Check if a pipe segment is a compact algorithm string (vs legacy R{bitmask}). */
function isCompactAlgorithm(segment: string | undefined): boolean {
    if (segment === undefined) return false;
    if (segment === '') return true; // empty = no algorithm state
    return !segment.startsWith('R');
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
    actionEntries: { index: number; status: 'performed' | 'deferred' }[];
} {
    const rfSelections: number[] = [];
    const cardEntries: { index: number; selections: number[]; answerIndex: number }[] = [];
    const screenerEntries: ScreenerEntry[] = [];
    const actionEntries: { index: number; status: 'performed' | 'deferred' }[] = [];

    if (!compact) return { rfSelections, cardEntries, screenerEntries, actionEntries };

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

    // Non-screener: optional hex selections + optional P/D suffix
    let selStr = rest;
    let statusChar = '';
    if (rest.endsWith('P') || rest.endsWith('D')) {
        statusChar = rest[rest.length - 1];
        selStr = rest.substring(0, rest.length - 1);
    }
    if (statusChar) {
        actionEntries.push({ index: ci, status: statusChar === 'D' ? 'deferred' : 'performed' });
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

    // DDx list
    const allDdx = [...(noteOptions.selectedDdx ?? []), ...(noteOptions.customDdx ?? [])];
    if (allDdx.length > 0) {
        const selectedPart = (noteOptions.selectedDdx ?? []).join('~');
        const customPart = (noteOptions.customDdx ?? []).join('~');
        parts.push(`D${selectedPart}${customPart ? '^' + customPart : ''}`);
    }

    // Flags
    let flags = 0;
    if (noteOptions.includeAlgorithm) flags |= 1;
    if ((noteOptions.selectedDdx?.length ?? 0) + (noteOptions.customDdx?.length ?? 0) > 0) flags |= 2;
    if (customNote) flags |= 4;
    if (hasPE) flags |= 8;
    if (planNoteText) flags |= 16;
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

    return { cardStates, disposition: lastDisposition };
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

/** Append provider segments to an existing medic barcode string. */
export function encodeProviderBundle(medicBarcode: string, options: ProviderNoteEncodeOptions): string {
    const providerParts: string[] = [];
    appendProviderSegments(providerParts, options);
    if (providerParts.length === 0) return medicBarcode;
    return medicBarcode + '|' + providerParts.join('|');
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
