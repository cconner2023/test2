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

        // 1b. Provider-only note (PRV prefix) — no algorithm to reconstruct
        if (parsed.symptomCode === 'PRV') {
            const parts: string[] = [];
            if (parsed.providerHpi) { parts.push('HPI'); parts.push(parsed.providerHpi); }
            if (parsed.providerPe) { parts.push(''); parts.push('Physical Exam'); parts.push(parsed.providerPe); }
            if (parsed.providerAssessment) { parts.push(''); parts.push('Assessment'); parts.push(parsed.providerAssessment); }
            if (parsed.providerPlan) { parts.push(''); parts.push('Plan'); parts.push(parsed.providerPlan); }
            const providerAuthor = parsed.providerUser
                ? formatSignature(parsed.providerUser) || 'Unknown Provider'
                : 'Unknown Provider';
            if (providerAuthor) { parts.push(''); parts.push(providerAuthor); }

            return {
                fullNote: parts.join('\n'),
                parsed,
                symptomText: 'Provider Note',
                symptomIcon: 'PRV',
                dispositionType: '',
                dispositionText: '',
                authorLabel: providerAuthor,
                userId: parsed.providerUserId ?? null,
                encodedText: barcodeString,
            };
        }

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

        // 7. If provider fields exist, rebuild with alternating signatures
        const hasProviderFields = !!(parsed.providerHpi || parsed.providerPe || parsed.providerAssessment || parsed.providerPlan);
        const providerSig = parsed.providerUser ? formatSignature(parsed.providerUser) : '';
        const medicSig = parsed.user ? formatSignature(parsed.user) : '';
        const sameAuthor = !!(medicSig && providerSig && medicSig === providerSig);
        const hasMixed = hasProviderFields && !sameAuthor;

        let fullNote = result.fullNote;
        if (hasProviderFields && sameAuthor) {
            // Same person — merge content, single signature at bottom
            const parts: string[] = [];
            const addMerged = (header: string, medicText?: string, providerText?: string) => {
                const combined = [medicText, providerText].filter(Boolean).join('\n');
                if (!combined) return;
                if (parts.length > 0) parts.push('');
                parts.push(header);
                parts.push(combined);
            };
            addMerged('HPI:', result.sections.customNote || undefined, parsed.providerHpi);
            addMerged('PHYSICAL EXAM:', result.sections.physicalExam, parsed.providerPe);
            if (result.sections.algorithm) { parts.push(''); const t = selectedSymptom?.icon && selectedSymptom?.text ? `${selectedSymptom.icon}: ${selectedSymptom.text}:` : 'ALGORITHM:'; parts.push(t); parts.push(result.sections.algorithm); }
            if (result.sections.decisionMaking) { parts.push(''); parts.push('DECISION MAKING:'); parts.push(result.sections.decisionMaking); }
            addMerged('ASSESSMENT:', undefined, parsed.providerAssessment);
            addMerged('PLAN:', result.sections.plan, parsed.providerPlan);
            if (medicSig) { parts.push(''); parts.push(medicSig); }
            fullNote = parts.join('\n').trim();
        } else if (hasMixed) {
            // Layout: [header, medicText, providerText, isMedicOnly]
            const layout: [string, string | undefined, string | undefined, boolean][] = [
                ['HPI:', result.sections.customNote || undefined, parsed.providerHpi, false],
                ['PHYSICAL EXAM:', result.sections.physicalExam, parsed.providerPe, false],
            ];
            // Algorithm + Decision Making are medic-only sections
            if (result.sections.algorithm) {
                const title = selectedSymptom?.icon && selectedSymptom?.text
                    ? `${selectedSymptom.icon}: ${selectedSymptom.text}:` : 'ALGORITHM:';
                layout.push([title, result.sections.algorithm, undefined, true]);
            }
            if (result.sections.decisionMaking) {
                layout.push(['DECISION MAKING:', result.sections.decisionMaking, undefined, true]);
            }
            layout.push(['ASSESSMENT:', undefined, parsed.providerAssessment, false]);
            layout.push(['PLAN:', result.sections.plan, parsed.providerPlan, false]);

            // Find last index where each voice has content
            let lastMedic = -1, lastProvider = -1;
            for (let i = layout.length - 1; i >= 0; i--) {
                if (lastMedic < 0 && layout[i][1]) lastMedic = i;
                if (lastProvider < 0 && layout[i][2]) lastProvider = i;
            }

            const parts: string[] = [];
            layout.forEach(([header, medicText, providerText, isMedicOnly], i) => {
                if (!medicText && !providerText) return;
                if (parts.length > 0) parts.push('');
                parts.push(header);
                if (medicText) {
                    parts.push(medicText);
                    if (i === lastMedic && medicSig) parts.push(medicSig);
                }
                if (providerText && !isMedicOnly) {
                    if (medicText) parts.push('Provider');
                    parts.push(providerText);
                    if (i === lastProvider && providerSig) parts.push(providerSig);
                }
            });

            fullNote = parts.join('\n').trim();
        }

        return {
            fullNote,
            parsed,
            symptomText: selectedSymptom?.text || parsed.symptomCode,
            symptomIcon: selectedSymptom?.icon || parsed.symptomCode,
            dispositionType: disposition?.type ?? '',
            dispositionText: disposition?.text ?? '',
            authorLabel: hasMixed ? `${authorLabel} / ${providerSig || 'Provider'}` : authorLabel,
            userId: parsed.userId,
            encodedText: barcodeString,
        };
    }, []);

    return { importFromBarcode };
};
