// hooks/useNoteImport.ts
// Reconstructs a full readable note from a barcode string.
// Uses shared codec (parsing/reconstruction) and formatter (text generation).

import { useCallback } from 'react';
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/NoteCodec';
import { assembleNote } from '../Utilities/NoteFormatter';

export const useNoteImport = () => {
    const importFromBarcode = useCallback((barcodeString: string): string => {
        // 1. Parse barcode
        const parsed = parseNoteEncoding(barcodeString);
        if (!parsed) return 'Error: Could not parse barcode string';

        // 2. Find algorithm options
        const algorithmOptions = findAlgorithmByCode(parsed.symptomCode);
        if (!algorithmOptions?.length) {
            return `Error: Algorithm ${parsed.symptomCode} not found`;
        }

        // 3. Reconstruct card states from encoded data
        const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed);

        // 4. Resolve symptom info for the note title
        const found = findSymptomByCode(parsed.symptomCode);
        const selectedSymptom = found
            ? { icon: found.symptom.icon || '', text: found.symptom.text || '' }
            : undefined;

        // 5. Assemble the note using shared formatter
        //    Uses barcode timestamp if present, otherwise falls back to current time
        const result = assembleNote(
            {
                includeAlgorithm: parsed.flags.includeAlgorithm,
                includeDecisionMaking: parsed.flags.includeDecisionMaking,
                customNote: parsed.flags.includeHPI ? parsed.hpiText : '',
            },
            algorithmOptions,
            cardStates,
            disposition?.type ?? '',
            disposition?.text ?? '',
            selectedSymptom,
            parsed.timestamp,
        );

        return result.fullNote;
    }, []);

    return { importFromBarcode };
};
