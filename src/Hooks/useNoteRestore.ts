// hooks/useNoteRestore.ts
// Restores algorithm state from a saved note's encoded text,
// allowing users to view/edit previously saved triage notes.

import { useCallback } from 'react';
import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
import type { SavedNote } from './useNotesStorage';
import type { WriteNoteData } from './useNavigation';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

// Convert a bitmask integer to array of set bit indices
function bitmaskToIndices(bitmask: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) {
        if ((bitmask >> i) & 1) {
            indices.push(i);
        }
    }
    return indices;
}

interface ParsedBarcode {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    hpiText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean };
}

function parseEncodedText(encodedText: string): ParsedBarcode | null {
    if (!encodedText.trim()) return null;

    const parts = encodedText.split('|');
    const result: ParsedBarcode = {
        symptomCode: '',
        rfSelections: [],
        cardEntries: [],
        hpiText: '',
        flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false }
    };

    let legacyLastCard = -1;
    let legacySelections: number[] = [];

    // First non-empty part is always the symptom code (e.g. "A1", "F3")
    // This must be extracted first to avoid prefix collisions with F (flags), etc.
    const nonEmptyParts = parts.filter(p => p.length > 0);
    if (nonEmptyParts.length > 0) {
        result.symptomCode = nonEmptyParts[0];
    }

    // Parse remaining parts by prefix (skip the first which is the symptom code)
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
                includeHPI: !!(flagsNum & 4)
            };
        } else if (prefix === 'L') {
            legacyLastCard = parseInt(value, 10);
        } else if (prefix === 'S') {
            legacySelections = value === '0' ? [] : value.split('').map(n => parseInt(n, 10));
        } else if (/^\d/.test(part)) {
            // New format card entry: index.selections.answer
            const segments = part.split('.');
            if (segments.length >= 3) {
                result.cardEntries.push({
                    index: parseInt(segments[0], 10),
                    selections: bitmaskToIndices(parseInt(segments[1], 36)),
                    answerIndex: parseInt(segments[2], 10)
                });
            }
        }
    }

    // Legacy format fallback
    if (result.cardEntries.length === 0 && legacyLastCard > 0) {
        result.cardEntries = [{
            index: legacyLastCard,
            selections: legacySelections,
            answerIndex: -1
        }];
    }

    if (!result.symptomCode) return null;
    return result;
}

function findSymptomByCode(code: string): { category: catDataTypes; symptom: subCatDataTypes } | null {
    // Convert "A1" to "A-1" format
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

function findAlgorithmByCode(code: string): AlgorithmOptions[] | null {
    const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    const algorithm = Algorithm.find(item => item.id === algorithmId);
    return algorithm?.options || null;
}

/**
 * Reconstruct CardState[] from parsed barcode data and algorithm options.
 * This recreates the exact state of the algorithm at the time the note was saved.
 */
function reconstructCardStates(
    algorithmOptions: AlgorithmOptions[],
    parsed: ParsedBarcode
): { cardStates: CardState[]; disposition: dispositionType | null } {
    // Initialize all cards (same as useAlgorithm.initializeCardStates)
    const initialIndex = algorithmOptions.findIndex(card => card.type === 'initial');

    const cardStates: CardState[] = algorithmOptions.map((_, index) => ({
        index,
        isVisible: index <= initialIndex,
        answer: null,
        selectedOptions: [],
        count: 0
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

            // Track disposition
            if (answer.disposition && answer.disposition.length > 0) {
                lastDisposition = answer.disposition[0];
            }

            // Make next cards visible (if answer specifies)
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

export interface NoteRestoreResult {
    success: boolean;
    error?: string;
    writeNoteData?: WriteNoteData;
    category?: catDataTypes;
    symptom?: subCatDataTypes;
    hpiText?: string;
}

export function useNoteRestore() {
    const restoreNote = useCallback((note: SavedNote): NoteRestoreResult => {
        // 1. Parse the encoded text
        const parsed = parseEncodedText(note.encodedText);
        if (!parsed) {
            return { success: false, error: 'Could not parse encoded text' };
        }

        // 2. Find the algorithm options
        const algorithmOptions = findAlgorithmByCode(parsed.symptomCode);
        if (!algorithmOptions?.length) {
            return { success: false, error: `Algorithm ${parsed.symptomCode} not found` };
        }

        // 3. Find the category and symptom
        const found = findSymptomByCode(parsed.symptomCode);
        if (!found) {
            return { success: false, error: `Symptom ${parsed.symptomCode} not found in categories` };
        }

        // 4. Reconstruct card states
        const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed);

        if (!disposition) {
            return { success: false, error: 'Could not determine disposition from saved note' };
        }

        // 5. Build WriteNoteData
        const writeNoteData: WriteNoteData = {
            disposition,
            algorithmOptions,
            cardStates,
            selectedSymptom: {
                icon: found.symptom.icon || '',
                text: found.symptom.text || ''
            }
        };

        return {
            success: true,
            writeNoteData,
            category: found.category,
            symptom: found.symptom,
            hpiText: parsed.hpiText || ''
        };
    }, []);

    return { restoreNote };
}
