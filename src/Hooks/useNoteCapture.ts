import { useCallback } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
interface NoteCaptureOptions {
    includeAlgorithm: boolean;
    customNote: string;
}
interface NoteCaptureResult {
    sections: {
        algorithm?: string;
        customNote: string;
    };
    fullNote: string;
}
export const useNoteCapture = (
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[]
) => {
    const getAlgorithmContent = useCallback((): string => {
        const sections: string[] = [];
        algorithmOptions.forEach((card, index) => {
            const state = cardStates[index];
            if (!state || !state.isVisible) {
                return;
            }
            const cardLines: string[] = [];
            cardLines.push(`${card.text}`);
            if (card.type === 'rf') {
                if (card.questionOptions && card.questionOptions.length > 0) {
                    const flags: string[] = [];
                    card.questionOptions.forEach((option, optionIndex) => {
                        const flagText = option.text.trim();
                        if (flagText) {
                            const isSelected = state.selectedOptions.includes(optionIndex);
                            flags.push(`  • ${flagText} - [${isSelected ? 'YES' : 'NO'}]`);
                        }
                    });

                    if (flags.length > 0) {
                        sections.push(`Red Flags:\n${flags.join('\n')}`);
                    }
                    return;
                }
            }
            if (card.questionOptions && card.questionOptions.length > 0) {
                card.questionOptions.forEach((option, optionIndex) => {
                    const optionText = option.text.trim();
                    if (optionText) {
                        const isSelected = state.selectedOptions.includes(optionIndex);
                        cardLines.push(`  • ${optionText} - [${isSelected ? 'YES' : 'NO'}]`);
                    }
                });
            }
            if (state.answer) {
                cardLines.push(`Answer: ${state.answer.text}`);
                if (state.answer.disposition && state.answer.disposition.length > 0) {
                    const dispositionText = state.answer.disposition
                        .map(d => `${d.type}: ${d.text}`)
                        .join('; ');
                    cardLines.push(`Disposition: ${dispositionText}`);
                }
            }

            if (cardLines.length > 1) {
                sections.push(cardLines.join('\n'));
            }
        });
        return sections.join('\n');
    }, [algorithmOptions, cardStates]);
    const generateNote = useCallback((options: NoteCaptureOptions): NoteCaptureResult => {
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
        const customNote = options.customNote.trim();
        if (customNote) {
            fullNoteParts.push('HPI')
            fullNoteParts.push(customNote);
            fullNoteParts.push('')
        }
        fullNoteParts.push(`SCREENED IAW ADTMC MEDCOM PAM 40-7-21 ${day}${month}${year} ${time} UTC`);
        if (options.includeAlgorithm) {
            const algorithmContent = getAlgorithmContent();
            if (algorithmContent.trim()) {
                fullNoteParts.push(algorithmContent);
            }
        }
        const fullNote = fullNoteParts.join('\n');
        return {
            sections: {
                algorithm: options.includeAlgorithm ? getAlgorithmContent() : undefined,
                customNote: customNote
            },
            fullNote
        };
    }, [getAlgorithmContent]);
    return {
        generateNote,
        getAlgorithmContent
    };
};