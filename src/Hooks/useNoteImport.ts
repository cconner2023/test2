// hooks/useNoteImport.ts
import { useCallback } from 'react';
import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import { Algorithm } from '../Data/Algorithms';

interface DecodedBarcode {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    hpiText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean };
}

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

export const useNoteImport = () => {
    // Parse barcode string into structured data
    const parseBarcode = useCallback((barcodeString: string): DecodedBarcode | null => {
        if (!barcodeString.trim()) return null;

        const parts = barcodeString.split('|');
        const result: DecodedBarcode = {
            symptomCode: '',
            rfSelections: [],
            cardEntries: [],
            hpiText: '',
            flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false }
        };

        // Track if we find new-format card entries vs legacy L/S parts
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
                // Legacy format: last card index
                legacyLastCard = parseInt(value, 10);
            } else if (prefix === 'S') {
                // Legacy format: selections on last card
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

        // Legacy format fallback: convert L/S to a single card entry
        if (result.cardEntries.length === 0 && legacyLastCard > 0) {
            result.cardEntries = [{
                index: legacyLastCard,
                selections: legacySelections,
                answerIndex: -1
            }];
            result.flags = { includeAlgorithm: true, includeDecisionMaking: false, includeHPI: false };
        }

        if (!result.symptomCode) return null;
        return result;
    }, []);

    // Find algorithm options by symptom code
    const findAlgorithmByCode = useCallback((code: string): AlgorithmOptions[] | null => {
        const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
        const algorithm = Algorithm.find(item => item.id === algorithmId);
        return algorithm?.options || null;
    }, []);

    // Generate algorithm content matching useNoteCapture format
    const generateAlgorithmContent = useCallback((
        algorithmOptions: AlgorithmOptions[],
        decoded: DecodedBarcode
    ): string => {
        const sections: string[] = [];

        // Red flags
        const rfCard = algorithmOptions[0];
        if (rfCard?.type === 'rf' && rfCard.questionOptions) {
            const flags: string[] = [];
            rfCard.questionOptions.forEach((option, optionIndex) => {
                const flagText = option.text?.trim();
                if (flagText) {
                    const isSelected = decoded.rfSelections.includes(optionIndex);
                    flags.push(`  • ${flagText} - [${isSelected ? 'YES' : 'NO'}]`);
                }
            });
            if (flags.length > 0) {
                sections.push(`Red Flags:\n${flags.join('\n')}`);
            }
        }

        // Each card entry
        for (const entry of decoded.cardEntries) {
            const card = algorithmOptions[entry.index];
            if (!card || card.type === 'rf') continue;

            const cardLines: string[] = [card.text];

            // Question options with YES/NO
            if (card.questionOptions && card.questionOptions.length > 0) {
                card.questionOptions.forEach((option, optIndex) => {
                    const optionText = option.text?.trim();
                    if (optionText) {
                        const isSelected = entry.selections.includes(optIndex);
                        cardLines.push(`  • ${optionText} - [${isSelected ? 'YES' : 'NO'}]`);
                    }
                });
            }

            // Answer
            if (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length) {
                const answer = card.answerOptions[entry.answerIndex];
                cardLines.push(`Answer: ${answer.text}`);
                if (answer.disposition && answer.disposition.length > 0) {
                    const dispText = answer.disposition
                        .map(d => `${d.type}: ${d.text}`)
                        .join('; ');
                    cardLines.push(`Disposition: ${dispText}`);
                }
            }

            if (cardLines.length > 1) {
                sections.push(cardLines.join('\n'));
            }
        }

        return sections.join('\n');
    }, []);

    // Generate decision making content matching useNoteCapture format
    const generateDecisionMakingContent = useCallback((
        algorithmOptions: AlgorithmOptions[],
        decoded: DecodedBarcode
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

        // Find decision making items (same logic as useNoteCapture/DecisionMaking component)
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

        if (decisionMakingItems.length === 0) return '';

        // Format decision making items (matching useNoteCapture output)
        const sections: string[] = [];
        decisionMakingItems.forEach((item, index) => {
            const itemLines: string[] = [];
            if (index > 0) itemLines.push('---');

            if (item.ddx && item.ddx.length > 0) {
                itemLines.push(`DDx: ${item.ddx.join(', ')}`);
            }
            if (item.text) {
                itemLines.push(item.text);
            }
            if (item.ancillaryFind && item.ancillaryFind.length > 0) {
                const ancTexts = item.ancillaryFind.map(a => a.modifier).filter(Boolean);
                if (ancTexts.length > 0) {
                    itemLines.push(`Ancillary: ${ancTexts.join(', ')}`);
                }
            }
            if (item.specLim && item.specLim.length > 0) {
                itemLines.push('Limitations:');
                item.specLim.forEach(lim => itemLines.push(`  • ${lim}`));
            }
            if (item.assocMcp) {
                const mcpLines: string[] = [];
                if (item.assocMcp.text) mcpLines.push(item.assocMcp.text);
                if (item.assocMcp.specLim && item.assocMcp.specLim.length > 0) {
                    mcpLines.push('Limitations:');
                    item.assocMcp.specLim.forEach(lim => mcpLines.push(`  • ${lim}`));
                }
                if (mcpLines.length > 0) {
                    itemLines.push('Associated MCP:');
                    mcpLines.forEach(line => itemLines.push(`  ${line}`));
                }
            }
            if (itemLines.length > 0) {
                sections.push(itemLines.join('\n'));
            }
        });

        return sections.join('\n\n');
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
    }, [parseBarcode, findAlgorithmByCode, generateAlgorithmContent, generateDecisionMakingContent]);

    return {
        importFromBarcode
    };
};
