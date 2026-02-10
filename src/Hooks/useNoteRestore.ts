// hooks/useNoteRestore.ts
// Restores algorithm state from a saved note's encoded text,
// allowing users to view/edit previously saved triage notes.

import { useCallback } from 'react';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
import type { SavedNote } from './useNotesStorage';
import type { WriteNoteData } from './useNavigation';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';
import { catData } from '../Data/CatData';
import { parseBarcode, findAlgorithmByCode, type ParsedBarcode } from '../Utilities/EncodingUtils';

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
        const parsed = parseBarcode(note.encodedText);
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
