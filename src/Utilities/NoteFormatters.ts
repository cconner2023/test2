// Shared content formatters for note hooks
// Consolidates near-identical formatting logic from useNoteCapture and useNoteImport

import type { AlgorithmOptions, answerOptions, decisionMakingType } from '../Types/AlgorithmTypes';

/**
 * Format red flag card selections as text.
 * Used by both useNoteCapture (from live cardState) and useNoteImport (from decoded barcode).
 */
export function formatRedFlags(
    rfCard: AlgorithmOptions,
    selectedIndices: number[]
): string {
    if (!rfCard.questionOptions || rfCard.questionOptions.length === 0) return '';

    const flags: string[] = [];
    rfCard.questionOptions.forEach((option, optionIndex) => {
        const flagText = option.text?.trim();
        if (flagText) {
            const isSelected = selectedIndices.includes(optionIndex);
            flags.push(`  • ${flagText} - [${isSelected ? 'YES' : 'NO'}]`);
        }
    });

    return flags.length > 0 ? `Red Flags:\n${flags.join('\n')}` : '';
}

/**
 * Format a single algorithm card's content (question options + answer + disposition).
 * Used by both useNoteCapture and useNoteImport for non-RF cards.
 *
 * @param card - The algorithm card definition
 * @param selectedOptions - Indices of selected question options
 * @param answer - The selected answer (null if none)
 * @returns Formatted card text, or empty string if only the title exists
 */
export function formatCardContent(
    card: AlgorithmOptions,
    selectedOptions: number[],
    answer: answerOptions | null
): string {
    const cardLines: string[] = [card.text];

    // Question options with YES/NO
    if (card.questionOptions && card.questionOptions.length > 0) {
        card.questionOptions.forEach((option, optionIndex) => {
            const optionText = option.text?.trim();
            if (optionText) {
                const isSelected = selectedOptions.includes(optionIndex);
                cardLines.push(`  • ${optionText} - [${isSelected ? 'YES' : 'NO'}]`);
            }
        });
    }

    // Answer and disposition
    if (answer) {
        cardLines.push(`Answer: ${answer.text}`);
        if (answer.disposition && answer.disposition.length > 0) {
            const dispositionText = answer.disposition
                .map(d => `${d.type}: ${d.text}`)
                .join('; ');
            cardLines.push(`Disposition: ${dispositionText}`);
        }
    }

    return cardLines.length > 1 ? cardLines.join('\n') : '';
}

/**
 * Format an array of decision making items into text.
 * This is the shared formatter that was previously duplicated between
 * useNoteCapture.getDecisionMakingContent and useNoteImport.generateDecisionMakingContent.
 *
 * @param items - Decision making items to format
 * @returns Formatted text with DDx, text, ancillary findings, limitations, and associated MCP
 */
export function formatDecisionMakingItems(items: decisionMakingType[]): string {
    if (items.length === 0) return '';

    const sections: string[] = [];
    items.forEach((item, index) => {
        const itemLines: string[] = [];

        // Add divider between items (except first)
        if (index > 0) {
            itemLines.push('---');
        }

        // Add DDx if present
        if (item.ddx && item.ddx.length > 0) {
            itemLines.push(`DDx: ${item.ddx.join(', ')}`);
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
            itemLines.push('Limitations:');
            item.specLim.forEach(lim => itemLines.push(`  • ${lim}`));
        }

        // Add associated MCP (nested) - without medications
        if (item.assocMcp) {
            const mcpLines: string[] = [];
            if (item.assocMcp.text) {
                mcpLines.push(item.assocMcp.text);
            }
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
}
