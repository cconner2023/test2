// hooks/useNoteImport.ts
import { useCallback } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import { Algorithm } from '../Data/Algorithms';
import { Disposition } from '../Data/Algorithms';

export const useNoteImport = () => {
    // Parse base36 red flags - '0' means no selections
    const parseRedFlags = useCallback((base36Str: string): number[] => {
        if (!base36Str || base36Str === '0') return [];

        try {
            const binaryValue = parseInt(base36Str, 36);
            const selectedOptions: number[] = [];

            // Convert binary to selected options (LSB first)
            for (let i = 0; i < 32; i++) {
                if ((binaryValue >> i) & 1) {
                    selectedOptions.push(i);
                }
            }

            return selectedOptions;
        } catch (error) {
            console.error('Error parsing red flags:', error);
            return [];
        }
    }, []);

    // Find algorithm by symptom code - Convert A1 to A-1
    const findAlgorithmByCode = useCallback((code: string): AlgorithmOptions[] | null => {
        if (!code) return null;

        // Convert A1 to A-1 format
        const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');

        console.log('Looking for algorithm with ID:', algorithmId);

        // Find in Algorithm array
        const algorithm = Algorithm.find(item => item.id === algorithmId);

        if (!algorithm) {
            console.error(`Algorithm ${algorithmId} not found in Algorithm array`);
            return null;
        }

        return algorithm.options || null;
    }, []);

    // Generate timestamp header
    const generateTimestamp = useCallback((): string => {
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

        return `ADTMC ${day}${month}${year} ${time} UTC`;
    }, []);

    // Find initial card index
    const findInitialCardIndex = useCallback((algorithmOptions: AlgorithmOptions[]): number => {
        return algorithmOptions.findIndex(card => card.type === 'initial');
    }, []);

    // Main import function
    const importFromBarcode = useCallback((barcodeString: string): string => {
        if (!barcodeString.trim()) return '';

        const parts = barcodeString.split('|');
        const sections: string[] = [];

        let symptomCode = '';
        let rfSelections: number[] = [];
        let lastCardIndex = -1;
        let lastCardSelections: number[] = [];

        // Parse each part
        for (const part of parts) {
            if (part.length === 0) continue;

            const firstChar = part[0];
            const value = part.substring(1);

            switch (firstChar) {
                case 'A': // Symptom code like A1
                    symptomCode = part; // Keep as A1
                    break;
                case 'R': // Red flags (R0 = no selections)
                    rfSelections = parseRedFlags(value);
                    break;
                case 'L': // Last card index
                    lastCardIndex = parseInt(value, 10);
                    break;
                case 'S': // Selected options for last card
                    if (value === '0') {
                        lastCardSelections = [];
                    } else {
                        lastCardSelections = value.split('').map(num => parseInt(num, 10));
                    }
                    break;
                default:
                    console.warn(`Unknown barcode part: ${part}`);
            }
        }

        console.log('Parsed:', { symptomCode, rfSelections, lastCardIndex, lastCardSelections });

        if (!symptomCode) {
            return 'Error: No symptom code found in barcode';
        }

        // Find the algorithm
        const algorithmOptions = findAlgorithmByCode(symptomCode);
        if (!algorithmOptions || algorithmOptions.length === 0) {
            return `Error: Algorithm ${symptomCode} not found`;
        }

        // Validate last card index
        if (lastCardIndex < 0 || lastCardIndex >= algorithmOptions.length) {
            return `Error: Invalid last card index ${lastCardIndex}`;
        }

        // Find initial card index
        const initialCardIndex = findInitialCardIndex(algorithmOptions);
        const hasRFSelections = rfSelections.length > 0;

        // Start building note
        sections.push(generateTimestamp());

        // Process Red Flags card if it exists (index 0)
        const rfCard = algorithmOptions[0];
        if (rfCard && rfCard.type === 'rf' && rfCard.questionOptions) {
            const flags: string[] = [];
            rfCard.questionOptions.forEach((option, optionIndex) => {
                const flagText = option.text?.trim();
                if (flagText) {
                    const isSelected = rfSelections.includes(optionIndex);
                    flags.push(`  • ${flagText} - [${isSelected ? 'YES' : 'NO'}]`);
                }
            });

            if (flags.length > 0) {
                sections.push(`Red Flags:\n${flags.join('\n')}`);
            }
        }

        // Process all cards up to lastCardIndex
        for (let cardIndex = 1; cardIndex <= lastCardIndex; cardIndex++) {
            const card = algorithmOptions[cardIndex];
            if (!card) continue;

            const cardLines: string[] = [card.text];

            // Determine if this is the last card
            const isLastCard = cardIndex === lastCardIndex;

            // Determine selections and answer
            let selectedOptions: number[] = [];
            let answer = null;

            if (isLastCard) {
                // This is the last card - use provided selections
                selectedOptions = lastCardSelections;

                if (card.answerOptions) {
                    if (card.type === 'initial') {
                        // For initial card, answer depends on RF selections
                        answer = hasRFSelections ? card.answerOptions[0] : card.answerOptions[1];
                    } else if (card.type === 'choice') {
                        // For choice card, Yes if selections exist
                        const answerIndex = selectedOptions.length > 0 ? 0 : 1;
                        if (answerIndex < card.answerOptions.length) {
                            answer = card.answerOptions[answerIndex];
                        }
                    } else if (card.type === 'count') {
                        // For count card, determine based on selection count
                        if (card.answerOptions.length > 1) {
                            const answerIndex = selectedOptions.length >= 3 ? 0 : 1;
                            answer = card.answerOptions[answerIndex];
                        }
                    }
                }
            } else {
                // Previous cards - no selections, answer is "No" (index 1)
                if (card.answerOptions && card.answerOptions.length > 1) {
                    answer = card.answerOptions[1]; // Index 1 = "No"
                }
            }

            // Add question options with YES/NO
            if (card.questionOptions && card.questionOptions.length > 0) {
                card.questionOptions.forEach((option, optionIndex) => {
                    const optionText = option.text?.trim();
                    if (optionText) {
                        const isSelected = selectedOptions.includes(optionIndex);
                        cardLines.push(`    - ${optionText} [${isSelected ? 'YES' : 'NO'}]`);
                    }
                });
            }

            // Add answer
            if (answer) {
                const answerText = answer.text?.trim();
                if (answerText) {
                    cardLines.push(`  Answer: ${answerText}`);
                }

                // Add count for count cards
                if (card.type === 'count' && selectedOptions.length > 0) {
                    cardLines.push(`  Count: ${selectedOptions.length}`);
                }

                // Add disposition if this card has one
                if (answer.disposition?.[0]) {
                    const disp = answer.disposition[0];
                    let dispositionText = `Disposition: ${disp.type}`;

                    if (disp.text && disp.text.trim()) {
                        dispositionText += ` ${disp.text}`;
                    }

                    if (disp.modifier && disp.modifier.trim()) {
                        dispositionText += ` (${disp.modifier})`;
                    }

                    sections.push(dispositionText);
                }
            }

            // Add card to sections
            if (cardLines.length > 1) {
                sections.push(cardLines.join('\n'));
            }
        }

        return sections.join('\n\n');
    }, [parseRedFlags, findAlgorithmByCode, generateTimestamp, findInitialCardIndex]);

    return {
        importFromBarcode
    };
};