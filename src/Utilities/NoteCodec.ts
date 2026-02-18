// Utilities/NoteCodec.ts
// Shared encoding, decoding, and reconstruction logic for note barcodes.
// Centralises the pipe-delimited barcode format so every consumer
// (useNoteRestore, useNoteImport, useNoteCapture, Barcode.tsx) uses one source.

import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import { ranks, credentials, components } from '../Data/User';
import type { UserTypes } from '../Data/User';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

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
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean };
    timestamp: Date | null;
    user: UserTypes | null;
}

export interface NoteEncodeOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
    user?: UserTypes;
}

// ---------------------------------------------------------------------------
// Bitmask helpers
// ---------------------------------------------------------------------------

export function bitmaskToIndices(bitmask: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) {
        if ((bitmask >> i) & 1) {
            indices.push(i);
        }
    }
    return indices;
}

export function indicesToBitmask(indices: number[]): number {
    let bitmask = 0;
    for (const i of indices) {
        bitmask |= (1 << i);
    }
    return bitmask;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findAlgorithmByCode(code: string): AlgorithmOptions[] | null {
    const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    const algorithm = Algorithm.find(item => item.id === algorithmId);
    return algorithm?.options || null;
}

export function findSymptomByCode(code: string): { category: catDataTypes; symptom: subCatDataTypes } | null {
    const iconId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    for (const category of catData) {
        if (category.contents) {
            const symptom = category.contents.find(s => s.icon === iconId);
            if (symptom) {
                return { category, symptom };
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Decoding (barcode string → ParsedNote)
// ---------------------------------------------------------------------------

export function parseNoteEncoding(encodedText: string): ParsedNote | null {
    if (!encodedText.trim()) return null;

    const parts = encodedText.split('|');
    const result: ParsedNote = {
        symptomCode: '',
        rfSelections: [],
        cardEntries: [],
        screenerEntries: [],
        actionEntries: [],
        hpiText: '',
        flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false },
        timestamp: null,
        user: null,
    };

    let legacyLastCard = -1;
    let legacySelections: number[] = [];

    const nonEmptyParts = parts.filter(p => p.length > 0);
    if (nonEmptyParts.length > 0) {
        result.symptomCode = nonEmptyParts[0];
    }

    for (let partIdx = 1; partIdx < nonEmptyParts.length; partIdx++) {
        const part = nonEmptyParts[partIdx];
        const prefix = part[0];
        const value = part.substring(1);

        if (prefix === 'R') {
            const bitmask = parseInt(value || '0', 36);
            result.rfSelections = bitmaskToIndices(bitmask);
        } else if (prefix === 'H') {
            try {
                result.hpiText = decodeURIComponent(atob(value));
            } catch {
                try {
                    result.hpiText = atob(value);
                } catch {
                    result.hpiText = decodeURIComponent(value);
                }
            }
        } else if (prefix === 'F') {
            const flagsNum = parseInt(value, 10);
            result.flags = {
                includeAlgorithm: !!(flagsNum & 1),
                includeDecisionMaking: !!(flagsNum & 2),
                includeHPI: !!(flagsNum & 4),
            };
        } else if (prefix === 'T') {
            const epoch = parseInt(value, 36);
            if (!isNaN(epoch)) {
                result.timestamp = new Date(epoch * 1000);
            }
        } else if (prefix === 'U') {
            // User segment: rankIdx.credIdx.compIdx.base64(first|last|middle)
            const segs = value.split('.');
            if (segs.length >= 4) {
                const ri = parseInt(segs[0], 10);
                const ci = parseInt(segs[1], 10);
                const coi = parseInt(segs[2], 10);
                let names: string[] = [];
                try {
                    names = decodeURIComponent(atob(segs.slice(3).join('.'))).split('|');
                } catch { /* ignore decode errors */ }
                result.user = {
                    firstName: names[0] || undefined,
                    lastName: names[1] || undefined,
                    middleInitial: names[2] || undefined,
                    rank: ri >= 0 ? ranks[ri] : undefined,
                    credential: ci >= 0 ? credentials[ci] : undefined,
                    component: coi >= 0 ? components[coi] : undefined,
                    uic: names[3] || undefined,
                };
            }
        } else if (prefix === 'A') {
            // Action status segment: A{cardIndex}.{P|D}
            const aSegs = value.split('.');
            if (aSegs.length >= 2) {
                const idx = parseInt(aSegs[0], 10);
                const status = aSegs[1] === 'D' ? 'deferred' : 'performed';
                result.actionEntries.push({ index: idx, status });
            }
        } else if (prefix === 'Q') {
            // Screener segment: Q{id}.{responseDigits}[.{followUpIdx}]
            const qSegs = value.split('.');
            if (qSegs.length >= 2) {
                const id = qSegs[0];
                const responseStr = qSegs[1];
                const responses = responseStr.includes('-')
                    ? responseStr.split('-').map(s => parseInt(s, 36))
                    : responseStr.split('').map(d => parseInt(d, 10));
                const followUp = qSegs.length >= 3 ? parseInt(qSegs[2], 10) : undefined;
                result.screenerEntries.push({ id, responses, followUp: isNaN(followUp as number) ? undefined : followUp });
            }
        } else if (prefix === 'L') {
            legacyLastCard = parseInt(value, 10);
        } else if (prefix === 'S') {
            legacySelections = value === '0' ? [] : value.split('').map(n => parseInt(n, 10));
        } else if (/^\d/.test(part)) {
            const segments = part.split('.');
            if (segments.length >= 3) {
                result.cardEntries.push({
                    index: parseInt(segments[0], 10),
                    selections: bitmaskToIndices(parseInt(segments[1], 36)),
                    answerIndex: parseInt(segments[2], 10),
                });
            }
        }
    }

    // Legacy format fallback
    if (result.cardEntries.length === 0 && legacyLastCard > 0) {
        result.cardEntries = [{
            index: legacyLastCard,
            selections: legacySelections,
            answerIndex: -1,
        }];
        result.flags = { includeAlgorithm: true, includeDecisionMaking: false, includeHPI: false };
    }

    if (!result.symptomCode) return null;
    return result;
}

// ---------------------------------------------------------------------------
// Encoding (live state → barcode string)
// ---------------------------------------------------------------------------

export function encodeNoteState(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    noteOptions: NoteEncodeOptions,
    symptomCode: string,
): string {
    const parts: string[] = [];

    // 1. Symptom code
    parts.push(symptomCode);

    // 2. Red flag selections (card 0 if RF type)
    const rfCard = algorithmOptions[0];
    if (rfCard?.type === 'rf' && cardStates[0]?.selectedOptions) {
        const totalOptions = rfCard.questionOptions?.length || 0;
        let bitmask = 0;
        for (let i = 0; i < totalOptions; i++) {
            if (cardStates[0].selectedOptions.includes(i)) {
                bitmask |= (1 << i);
            }
        }
        parts.push(`R${bitmask.toString(36)}`);
    } else {
        parts.push('R0');
    }

    // 3. Each visible non-RF card: {index}.{selBitmaskBase36}.{answerIndex}
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type === 'rf') continue;

        let selBitmask = 0;
        for (const optIdx of state.selectedOptions) {
            selBitmask |= (1 << optIdx);
        }

        let answerIdx = -1;
        if (state.answer) {
            answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
        }

        parts.push(`${i}.${selBitmask.toString(36)}.${answerIdx}`);
    }

    // 3b. Screener entries for action cards with screenerConfig + screenerResponses
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

    // 3c. Action status entries for non-screener action cards
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type !== 'action' || card.screenerConfig || !state.actionStatus) continue;
        parts.push(`A${i}.${state.actionStatus === 'deferred' ? 'D' : 'P'}`);
    }

    // 4. HPI text (base64 encoded)
    const customNote = noteOptions.customNote?.trim();
    if (customNote) {
        try {
            parts.push(`H${btoa(encodeURIComponent(customNote))}`);
        } catch {
            parts.push(`H${encodeURIComponent(customNote)}`);
        }
    }

    // 5. Flags: bit0=includeAlgorithm, bit1=includeDM, bit2=includeHPI
    let flags = 0;
    if (noteOptions.includeAlgorithm) flags |= 1;
    if (noteOptions.includeDecisionMaking) flags |= 2;
    if (customNote) flags |= 4;
    parts.push(`F${flags}`);

    // 6. User profile (indexed enums + base64 name)
    const user = noteOptions.user;
    if (user?.lastName) {
        const ri = user.rank ? ranks.indexOf(user.rank) : -1;
        const ci = user.credential ? credentials.indexOf(user.credential) : -1;
        const coi = user.component ? components.indexOf(user.component) : -1;
        const nameStr = `${user.firstName ?? ''}|${user.lastName ?? ''}|${user.middleInitial ?? ''}|${user.uic ?? ''}`;
        try {
            parts.push(`U${ri}.${ci}.${coi}.${btoa(encodeURIComponent(nameStr))}`);
        } catch {
            parts.push(`U${ri}.${ci}.${coi}.${encodeURIComponent(nameStr)}`);
        }
    }

    // 7. Timestamp (epoch seconds in base36)
    parts.push(`T${Math.floor(Date.now() / 1000).toString(36)}`);

    return parts.join('|');
}

// ---------------------------------------------------------------------------
// Content comparison (ignores volatile segments like timestamp)
// ---------------------------------------------------------------------------

/** Compare two encoded note strings ignoring the timestamp segment (T...) */
export function encodedContentEquals(a: string, b: string): boolean {
    const strip = (s: string) => s.split('|').filter(p => !p.startsWith('T')).join('|');
    return strip(a) === strip(b);
}

// ---------------------------------------------------------------------------
// Reconstruction (ParsedNote + algorithm → CardState[] + disposition)
// ---------------------------------------------------------------------------

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
        // Find the action card whose screenerConfig matches this entry
        const cardIdx = algorithmOptions.findIndex(card => {
            if (!card.screenerConfig) return false;
            // Direct match
            if (card.screenerConfig.id === entry.id) return true;
            // Extended match (e.g. PHQ-2 card completed as PHQ-9)
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
            if (entry.status === 'deferred') {
                lastDisposition = { type: "OTHER", text: "defer to AEM" };
            }
        }
    }

    return { cardStates, disposition: lastDisposition };
}
