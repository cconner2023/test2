// Utilities/NoteCodec.ts
// Shared encoding, decoding, and reconstruction logic for note barcodes.
// Centralises the pipe-delimited barcode format so every consumer
// (useNoteRestore, useNoteImport, useNoteCapture, Barcode.tsx) uses one source.

import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedNote {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    hpiText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean };
    timestamp: Date | null;
}

export interface NoteEncodeOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
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
        hpiText: '',
        flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false },
        timestamp: null,
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

    // 6. Timestamp (epoch seconds in base36)
    parts.push(`T${Math.floor(Date.now() / 1000).toString(36)}`);

    return parts.join('|');
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

    return { cardStates, disposition: lastDisposition };
}
