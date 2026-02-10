import { useCallback } from 'react';
import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
import { formatRedFlags, formatCardContent, formatDecisionMakingItems } from '../Utilities/NoteFormatters';

interface NoteCaptureOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
}

interface NoteCaptureResult {
    sections: {
        algorithm?: string;
        decisionMaking?: string;
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

            // Red flags card — use shared formatter
            if (card.type === 'rf') {
                const rfText = formatRedFlags(card, state.selectedOptions);
                if (rfText) sections.push(rfText);
                return;
            }

            // Regular card — use shared formatter
            const cardText = formatCardContent(card, state.selectedOptions, state.answer);
            if (cardText) sections.push(cardText);
        });
        return sections.join('\n');
    }, [algorithmOptions, cardStates]);

    // Helper function to get decision making content for a specific disposition
    const getDecisionMakingContent = useCallback((dispositionType: string, dispositionText: string): string => {
        // Find decision making content (same logic as in DecisionMaking component)
        const findTriggeringDecisionMaking = (): decisionMakingType[] => {
            for (let i = cardStates.length - 1; i >= 0; i--) {
                const card = cardStates[i];
                const algorithmCard = algorithmOptions[i];

                if (!card || !algorithmCard || !card.isVisible) continue;

                const selectedAnswer = algorithmCard.answerOptions.find(
                    answer => answer.text === card.answer?.text
                );

                const selectAllAnswer = (card.selectedOptions && card.selectedOptions.length > 0)
                    ? algorithmCard.answerOptions.find(answer => answer.selectAll)
                    : null;

                const answerToCheck = selectedAnswer || selectAllAnswer;

                if (answerToCheck?.disposition?.some(d =>
                    d.type === dispositionType && d.text === dispositionText
                )) {
                    return answerToCheck.decisionMaking || [];
                }
            }

            return [];
        };

        const decisionMakingItems = findTriggeringDecisionMaking();
        return formatDecisionMakingItems(decisionMakingItems);
    }, [algorithmOptions, cardStates]);

    const generateNote = useCallback((
        options: NoteCaptureOptions,
        dispositionType: string,
        dispositionText: string,
        selectedSymptom?: { icon: string; text: string; }
    ): NoteCaptureResult => {
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

        // Add HPI if present
        if (customNote) {
            fullNoteParts.push('HPI:');
            fullNoteParts.push(customNote);
            fullNoteParts.push('');
        }

        // Add footer (after HPI, before other sections)
        fullNoteParts.push(`SCREENED IAW ADTMC MEDCOM PAM 40-7-21 ${day}${month}${year} ${time} UTC`);
        fullNoteParts.push('');

        // Add algorithm content if selected
        if (options.includeAlgorithm) {
            const algorithmContent = getAlgorithmContent();
            if (algorithmContent.trim()) {
                // Use algorithm title if available, otherwise use default
                const algorithmTitle = selectedSymptom?.icon && selectedSymptom?.text
                    ? `${selectedSymptom.icon}: ${selectedSymptom.text}`
                    : 'ALGORITHM';

                fullNoteParts.push(`${algorithmTitle}:`);
                fullNoteParts.push(algorithmContent);
                fullNoteParts.push('');
            }
        }

        // Add decision making content if selected
        if (options.includeDecisionMaking) {
            const decisionMakingContent = getDecisionMakingContent(dispositionType, dispositionText);
            if (decisionMakingContent.trim()) {
                fullNoteParts.push('DECISION MAKING:');
                fullNoteParts.push(decisionMakingContent);
                fullNoteParts.push('');
            }
        }

        const fullNote = fullNoteParts.join('\n').trim();

        return {
            sections: {
                algorithm: options.includeAlgorithm ? getAlgorithmContent() : undefined,
                decisionMaking: options.includeDecisionMaking ? getDecisionMakingContent(dispositionType, dispositionText) : undefined,
                customNote: customNote
            },
            fullNote
        };
    }, [getAlgorithmContent, getDecisionMakingContent]);

    return {
        generateNote
    };
};
