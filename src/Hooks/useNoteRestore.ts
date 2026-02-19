// hooks/useNoteRestore.ts
// Restores algorithm state from a saved note's encoded text,
// allowing users to view/edit previously saved triage notes.

import { useCallback } from 'react';
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/NoteCodec';
import type { WriteNoteData } from './useNavigation';
import type { SavedNote } from './useNotesStorage';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

export interface NoteRestoreResult {
    success: boolean;
    error?: string;
    writeNoteData?: WriteNoteData;
    category?: catDataTypes;
    symptom?: subCatDataTypes;
    hpiText?: string;
    peText?: string;
    timestamp?: Date | null;
}

export function useNoteRestore() {
    const restoreNote = useCallback((note: SavedNote): NoteRestoreResult => {
        // 1. Parse the encoded text
        const parsed = parseNoteEncoding(note.encodedText);
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
            hpiText: parsed.hpiText || '',
            peText: parsed.peText || '',
            timestamp: parsed.timestamp,
        };
    }, []);

    return { restoreNote };
}
