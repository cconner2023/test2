import { useCallback } from 'react';
import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';

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

    // Helper function to get decision making content for a specific disposition
    const getDecisionMakingContent = useCallback((dispositionType: string, dispositionText: string): string => {
        const sections: string[] = [];

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

        if (decisionMakingItems.length === 0) {
            return '';
        }

        // Format each decision making item
        decisionMakingItems.forEach((item, index) => {
            const itemLines: string[] = [];

            // Add divider between items (except first)
            if (index > 0) {
                itemLines.push('---');
            }

            // Add DDx if present
            if (item.ddx && item.ddx.length > 0) {
                const ddxLabel = item.ddx.length === 1 ? 'DDx:' : 'DDx:';
                const ddxList = item.ddx.join(', ');
                itemLines.push(`${ddxLabel} ${ddxList}`);
            }

            // Add main text
            if (item.text) {
                itemLines.push(item.text);
            }

            // Add ancillary findings
            if (item.ancillaryFind && item.ancillaryFind.length > 0) {
                const ancillaryTexts = item.ancillaryFind
                    .map(anc => anc.modifier)
                    .filter(Boolean);
                if (ancillaryTexts.length > 0) {
                    itemLines.push(`Ancillary: ${ancillaryTexts.join(', ')}`);
                }
            }

            // Add special limitations
            if (item.specLim && item.specLim.length > 0) {
                const limitations = item.specLim.map(lim => `  • ${lim}`);
                itemLines.push('Limitations:');
                itemLines.push(...limitations);
            }

            // Add associated MCP (nested) - without medications
            if (item.assocMcp) {
                const mcpLines: string[] = [];
                if (item.assocMcp.text) {
                    mcpLines.push(item.assocMcp.text);
                }
                if (item.assocMcp.specLim && item.assocMcp.specLim.length > 0) {
                    const mcpLimits = item.assocMcp.specLim.map(lim => `  • ${lim}`);
                    mcpLines.push('Limitations:');
                    mcpLines.push(...mcpLimits);
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
        generateNote,
        getAlgorithmContent,
        getDecisionMakingContent
    };
};