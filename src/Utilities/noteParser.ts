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
    includeDecisionMaking: boolean;
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

/** Encode PE state with structured v6 when available, compressed text fallback. */
function encodePE(peState: PEState | undefined, peText: string | undefined): string | null {
    if (peState) {
        try {
            return encodePEState(peState);
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

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const prefix = part[0];
        const value = part.substring(1);

        switch (prefix) {
            // ── Medic segments (uppercase) ──
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

    // Red flag selections (card 0 if RF type)
    const rfCard = algorithmOptions[0];
    if (rfCard?.type === 'rf' && cardStates[0]?.selectedOptions) {
        let bitmask = 0;
        const totalOptions = rfCard.questionOptions?.length || 0;
        for (let i = 0; i < totalOptions; i++) {
            if (cardStates[0].selectedOptions.includes(i)) bitmask |= (1 << i);
        }
        parts.push(`R${bitmask.toString(36)}`);
    } else {
        parts.push('R0');
    }

    // Each visible non-RF card: {index}.{selBitmaskBase36}.{answerIndex}
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type === 'rf') continue;

        let selBitmask = 0;
        for (const optIdx of state.selectedOptions) selBitmask |= (1 << optIdx);

        let answerIdx = -1;
        if (state.answer) {
            answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
        }
        parts.push(`${i}.${selBitmask.toString(36)}.${answerIdx}`);
    }

    // Screener entries
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || !card.screenerConfig || !state.screenerResponses) continue;

        const screenerId = state.completedScreenerId || card.screenerConfig.id;
        const allSingleDigit = state.screenerResponses.every(d => d >= 0 && d <= 9);
        const encoded = allSingleDigit
            ? state.screenerResponses.map(d => d.toString()).join('')
            : state.screenerResponses.map(d => d.toString(36)).join('-');
        let seg = `Q${screenerId}.${encoded}`;
        if (state.followUpResponse !== undefined && state.followUpResponse !== null) {
            seg += `.${state.followUpResponse}`;
        }
        parts.push(seg);
    }

    // Action status entries
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type !== 'action' || card.screenerConfig || !state.actionStatus) continue;
        parts.push(`A${i}.${state.actionStatus === 'deferred' ? 'D' : 'P'}`);
    }

    // HPI
    const customNote = noteOptions.customNote?.trim();
    if (customNote) parts.push(`H${compressText(customNote)}`);

    // Physical Exam
    const peEncoded = encodePE(noteOptions.peState, noteOptions.physicalExamNote);
    const hasPE = !!peEncoded;
    if (peEncoded) parts.push(`P${peEncoded}`);

    // Plan
    const planNoteText = noteOptions.planNote?.trim();
    if (planNoteText) parts.push(`N${compressText(planNoteText)}`);

    // Flags
    let flags = 0;
    if (noteOptions.includeAlgorithm) flags |= 1;
    if (noteOptions.includeDecisionMaking) flags |= 2;
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
