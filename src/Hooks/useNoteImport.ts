// hooks/useNoteImport.ts
// Reconstructs a full readable note from a barcode string.
// Uses shared codec (parsing/reconstruction) and formatter (text generation).

import { useCallback } from 'react';
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/NoteCodec';
import type { ParsedNote } from '../Utilities/NoteCodec';
import { assembleNote, formatSignature } from '../Utilities/NoteFormatter';

export interface ImportPreview {
    fullNote: string;
    parsed: ParsedNote;
    symptomText: string;
    symptomIcon: string;
    dispositionType: string;
    dispositionText: string;
    authorLabel: string;
    clinicId: string | null;
    userId: string | null;
    timestamp: Date | null;
    encodedText: string;
}

/** Provides importFromBarcode: decodes a barcode string, reconstructs algorithm state, and returns an ImportPreview. */
export const useNoteImport = () => {
    const importFromBarcode = useCallback((barcodeString: string): ImportPreview => {
        // 1. Parse barcode
        const parsed = parseNoteEncoding(barcodeString);
        if (!parsed) throw new Error('Could not parse barcode string');

        // 2. Find algorithm options
        const algorithmOptions = findAlgorithmByCode(parsed.symptomCode);
        if (!algorithmOptions?.length) {
            throw new Error(`Algorithm ${parsed.symptomCode} not found`);
        }

        // 3. Reconstruct card states from encoded data
        const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed);

        // 4. Resolve symptom info for the note title
        const found = findSymptomByCode(parsed.symptomCode);
        const selectedSymptom = found
            ? { icon: found.symptom.icon || '', text: found.symptom.text || '' }
            : undefined;

        // 5. Build author label from parsed user
        const authorLabel = parsed.user
            ? formatSignature(parsed.user) || 'Unknown'
            : 'Unknown';

        // 6. Assemble the note using shared formatter
        const result = assembleNote(
            {
                includeAlgorithm: parsed.flags.includeAlgorithm,
                includeDecisionMaking: parsed.flags.includeDecisionMaking,
                customNote: parsed.flags.includeHPI ? parsed.hpiText : '',
                physicalExamNote: parsed.flags.includePhysicalExam ? parsed.peText : '',
                signature: parsed.user ? formatSignature(parsed.user) : undefined,
            },
            algorithmOptions,
            cardStates,
            disposition?.type ?? '',
            disposition?.text ?? '',
            selectedSymptom,
            parsed.timestamp,
        );

        return {
            fullNote: result.fullNote,
            parsed,
            symptomText: selectedSymptom?.text || parsed.symptomCode,
            symptomIcon: selectedSymptom?.icon || parsed.symptomCode,
            dispositionType: disposition?.type ?? '',
            dispositionText: disposition?.text ?? '',
            authorLabel,
            clinicId: parsed.clinicId,
            userId: parsed.userId,
            timestamp: parsed.timestamp,
            encodedText: barcodeString,
        };
    }, []);

    return { importFromBarcode };
};
