// hooks/useNoteImport.ts
import { useCallback } from 'react';
import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import { parseBarcode, findAlgorithmByCode, type ParsedBarcode } from '../Utilities/EncodingUtils';
import { formatRedFlags, formatCardContent, formatDecisionMakingItems } from '../Utilities/NoteFormatters';

export const useNoteImport = () => {
    // Generate algorithm content matching useNoteCapture format
    const generateAlgorithmContent = useCallback((
        algorithmOptions: AlgorithmOptions[],
        decoded: ParsedBarcode
    ): string => {
        const sections: string[] = [];

        // Red flags — use shared formatter
        const rfCard = algorithmOptions[0];
        if (rfCard?.type === 'rf') {
            const rfText = formatRedFlags(rfCard, decoded.rfSelections);
            if (rfText) sections.push(rfText);
        }

        // Each card entry — use shared formatter
        for (const entry of decoded.cardEntries) {
            const card = algorithmOptions[entry.index];
            if (!card || card.type === 'rf') continue;

            // Resolve answer from answerIndex
            const answer = (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length)
                ? card.answerOptions[entry.answerIndex]
                : null;

            const cardText = formatCardContent(card, entry.selections, answer);
            if (cardText) sections.push(cardText);
        }

        return sections.join('\n');
    }, []);

    // Generate decision making content matching useNoteCapture format
    const generateDecisionMakingContent = useCallback((
        algorithmOptions: AlgorithmOptions[],
        decoded: ParsedBarcode
    ): string => {
        // Find the current disposition from card entries
        let currentDisposition: { type: string; text: string } | null = null;
        for (let i = decoded.cardEntries.length - 1; i >= 0; i--) {
            const entry = decoded.cardEntries[i];
            const card = algorithmOptions[entry.index];
            if (!card || entry.answerIndex < 0) continue;
            const answer = card.answerOptions[entry.answerIndex];
            if (answer?.disposition?.length > 0) {
                currentDisposition = answer.disposition[0];
                break;
            }
        }

        // Also check initial card for RF-triggered disposition
        if (!currentDisposition) {
            for (const entry of decoded.cardEntries) {
                const card = algorithmOptions[entry.index];
                if (!card || card.type !== 'initial') continue;
                if (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length) {
                    const answer = card.answerOptions[entry.answerIndex];
                    if (answer?.disposition?.length > 0) {
                        currentDisposition = answer.disposition[0];
                        break;
                    }
                }
            }
        }

        if (!currentDisposition) return '';

        // Find decision making items
        let decisionMakingItems: decisionMakingType[] = [];

        for (let i = decoded.cardEntries.length - 1; i >= 0; i--) {
            const entry = decoded.cardEntries[i];
            const card = algorithmOptions[entry.index];
            if (!card) continue;

            // Check direct answer
            if (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length) {
                const answer = card.answerOptions[entry.answerIndex];
                if (answer?.disposition?.some(d =>
                    d.type === currentDisposition!.type && d.text === currentDisposition!.text
                )) {
                    if (answer.decisionMaking?.length) {
                        decisionMakingItems = answer.decisionMaking;
                        break;
                    }
                }
            }

            // Check selectAll answer (for cards with selections)
            if (entry.selections.length > 0) {
                const selectAllAnswer = card.answerOptions.find(a => a.selectAll);
                if (selectAllAnswer?.disposition?.some(d =>
                    d.type === currentDisposition!.type && d.text === currentDisposition!.text
                )) {
                    if (selectAllAnswer.decisionMaking?.length) {
                        decisionMakingItems = selectAllAnswer.decisionMaking;
                        break;
                    }
                }
            }
        }

        // Use shared formatter for the items
        return formatDecisionMakingItems(decisionMakingItems);
    }, []);

    // Main import function - reconstructs full note matching useNoteCapture output
    const importFromBarcode = useCallback((barcodeString: string): string => {
        const decoded = parseBarcode(barcodeString);
        if (!decoded) return 'Error: Could not parse barcode string';

        const algorithmOptions = findAlgorithmByCode(decoded.symptomCode);
        if (!algorithmOptions?.length) {
            return `Error: Algorithm ${decoded.symptomCode} not found`;
        }

        // Build the note using the same format as useNoteCapture.generateNote
        const fullNoteParts: string[] = [];
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const year = now.getFullYear().toString().slice(2);
        const time = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // HPI (if flagged and present)
        if (decoded.flags.includeHPI && decoded.hpiText) {
            fullNoteParts.push('HPI:');
            fullNoteParts.push(decoded.hpiText);
            fullNoteParts.push('');
        }

        // Timestamp (matches useNoteCapture format)
        fullNoteParts.push(`SCREENED IAW ADTMC MEDCOM PAM 40-7-21 ${day}${month}${year} ${time} UTC`);
        fullNoteParts.push('');

        // Algorithm content
        if (decoded.flags.includeAlgorithm) {
            const algoContent = generateAlgorithmContent(algorithmOptions, decoded);
            if (algoContent.trim()) {
                const algorithmId = decoded.symptomCode.replace(/([A-Z])(\d+)/, '$1-$2');
                fullNoteParts.push(`${algorithmId}:`);
                fullNoteParts.push(algoContent);
                fullNoteParts.push('');
            }
        }

        // Decision making content
        if (decoded.flags.includeDecisionMaking) {
            const dmContent = generateDecisionMakingContent(algorithmOptions, decoded);
            if (dmContent.trim()) {
                fullNoteParts.push('DECISION MAKING:');
                fullNoteParts.push(dmContent);
                fullNoteParts.push('');
            }
        }

        return fullNoteParts.join('\n').trim();
    }, [generateAlgorithmContent, generateDecisionMakingContent]);

    return {
        importFromBarcode
    };
};
