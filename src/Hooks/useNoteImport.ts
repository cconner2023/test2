// hooks/useNoteImport.ts
// Reconstructs a full readable note from a barcode string.
// Uses shared codec (parsing/reconstruction) and formatter (text generation).
// Supports both ADTMC notes and TC3 cards via prefix detection.

import { useCallback } from 'react';
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/NoteCodec';
import { isTC3Encoding, parseTC3Encoding } from '../Utilities/tc3Codec';
import { formatTC3Note } from '../Utilities/TC3Formatter';
import type { ParsedNote } from '../Utilities/NoteCodec';
import type { TC3Card } from '../Types/TC3Types';
import { assembleNote, formatSignature } from '../Utilities/NoteFormatter';

export interface ImportPreview {
    fullNote: string;
    parsed: ParsedNote | null;
    symptomText: string;
    symptomIcon: string;
    dispositionType: string;
    dispositionText: string;
    authorLabel: string;
    userId: string | null;
    encodedText: string;
    isTC3?: boolean;
    tc3Card?: TC3Card;
}

/** Provides importFromBarcode: decodes a barcode string, reconstructs algorithm state, and returns an ImportPreview. */
export const useNoteImport = () => {
    const importFromBarcode = useCallback((barcodeString: string): ImportPreview => {
        // ── TC3 path ──────────────────────────────────────────
        if (isTC3Encoding(barcodeString)) {
            const result = parseTC3Encoding(barcodeString);
            if (!result) throw new Error('Could not parse TC3 barcode string');

            const noteText = formatTC3Note(result.card);
            const name = [result.card.casualty.lastName, result.card.casualty.firstName].filter(Boolean).join(', ');

            return {
                fullNote: noteText,
                parsed: null,
                symptomText: 'TC3 Casualty Card',
                symptomIcon: 'TC3',
                dispositionType: result.card.evacuation.priority || '',
                dispositionText: 'Battle Injury',
                authorLabel: name || 'Unknown',
                userId: result.userId,
                encodedText: barcodeString,
                isTC3: true,
                tc3Card: result.card,
            };
        }

        // ── ADTMC path ───────────────────────────────────────
        // 1. Parse barcode
        const parsed = parseNoteEncoding(barcodeString);
        if (!parsed) throw new Error('Could not parse barcode string');

        // 2. Find algorithm options
        if (!parsed.symptomCode) throw new Error('Note has no symptom code');
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
                planNote: parsed.flags.includePlan ? parsed.planText : '',
                signature: parsed.user ? formatSignature(parsed.user) : undefined,
            },
            algorithmOptions ?? [],
            cardStates,
            disposition?.type ?? '',
            disposition?.text ?? '',
            selectedSymptom,
        );

        return {
            fullNote: result.fullNote,
            parsed,
            symptomText: selectedSymptom?.text || parsed.symptomCode,
            symptomIcon: selectedSymptom?.icon || parsed.symptomCode,
            dispositionType: disposition?.type ?? '',
            dispositionText: disposition?.text ?? '',
            authorLabel,
            userId: parsed.userId,
            encodedText: barcodeString,
        };
    }, []);

    return { importFromBarcode };
};
