// Utilities/NoteFormatter.ts
// Pure formatting functions for generating readable note text from algorithm state.
// Shared by useNoteCapture (live state) and useNoteImport (reconstructed state).

import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { UserTypes } from '../Data/User';

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

export function formatTimestamp(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear().toString().slice(2);
    const time = date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    return `SCREENED IAW ADTMC MEDCOM PAM 40-7-21 ${day}${month}${year} ${time} UTC`;
}

// ---------------------------------------------------------------------------
// Algorithm content
// ---------------------------------------------------------------------------

export function formatAlgorithmContent(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
): string {
    const sections: string[] = [];

    algorithmOptions.forEach((card, index) => {
        const state = cardStates[index];
        if (!state || !state.isVisible) return;

        const cardLines: string[] = [card.text];

        if (card.type === 'rf') {
            if (card.questionOptions && card.questionOptions.length > 0) {
                const flags: string[] = [];
                card.questionOptions.forEach((option, optionIndex) => {
                    const flagText = option.text?.trim();
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
                const optionText = option.text?.trim();
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
}

// ---------------------------------------------------------------------------
// Decision making content
// ---------------------------------------------------------------------------

function findTriggeringDecisionMaking(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    dispositionType: string,
    dispositionText: string,
): decisionMakingType[] {
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
}

function formatDecisionMakingItems(items: decisionMakingType[]): string {
    const sections: string[] = [];

    items.forEach((item, index) => {
        const itemLines: string[] = [];

        if (index > 0) itemLines.push('---');

        if (item.ddx && item.ddx.length > 0) {
            itemLines.push(`DDx: ${item.ddx.join(', ')}`);
        }
        if (item.text) {
            itemLines.push(item.text);
        }
        if (item.ancillaryFind && item.ancillaryFind.length > 0) {
            const ancillaryTexts = item.ancillaryFind
                .map(anc => anc.modifier)
                .filter(Boolean);
            if (ancillaryTexts.length > 0) {
                itemLines.push(`Ancillary: ${ancillaryTexts.join(', ')}`);
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
}

export function formatDecisionMakingContent(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    dispositionType: string,
    dispositionText: string,
): string {
    const items = findTriggeringDecisionMaking(algorithmOptions, cardStates, dispositionType, dispositionText);
    if (items.length === 0) return '';
    return formatDecisionMakingItems(items);
}

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

export function formatSignature(profile: UserTypes): string {
    if (!profile.lastName) return '';
    const parts = [
        profile.lastName,
        profile.firstName ?? '',
        profile.middleInitial ?? '',
    ].filter(Boolean).join(' ');
    const suffix = [
        profile.credential,
        profile.rank,
        profile.component,
    ].filter(Boolean).join(', ');
    return suffix ? `Signed: ${parts} ${suffix}` : `Signed: ${parts}`;
}

// ---------------------------------------------------------------------------
// Full note assembly
// ---------------------------------------------------------------------------

export interface NoteAssemblyOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
    signature?: string;
}

export interface AssembledNote {
    sections: {
        algorithm?: string;
        decisionMaking?: string;
        customNote: string;
    };
    fullNote: string;
}

export function assembleNote(
    options: NoteAssemblyOptions,
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    dispositionType: string,
    dispositionText: string,
    selectedSymptom?: { icon: string; text: string },
    timestamp?: Date | null,
): AssembledNote {
    const fullNoteParts: string[] = [];
    const noteDate = timestamp ?? new Date();
    const customNote = options.customNote.trim();

    // HPI
    if (customNote) {
        fullNoteParts.push('HPI:');
        fullNoteParts.push(customNote);
        fullNoteParts.push('');
    }

    // Timestamp
    fullNoteParts.push(formatTimestamp(noteDate));
    fullNoteParts.push('');

    // Algorithm content
    let algorithmContent: string | undefined;
    if (options.includeAlgorithm) {
        algorithmContent = formatAlgorithmContent(algorithmOptions, cardStates);
        if (algorithmContent.trim()) {
            const algorithmTitle = selectedSymptom?.icon && selectedSymptom?.text
                ? `${selectedSymptom.icon}: ${selectedSymptom.text}`
                : 'ALGORITHM';
            fullNoteParts.push(`${algorithmTitle}:`);
            fullNoteParts.push(algorithmContent);
            fullNoteParts.push('');
        }
    }

    // Decision making content
    let decisionMakingContent: string | undefined;
    if (options.includeDecisionMaking) {
        decisionMakingContent = formatDecisionMakingContent(
            algorithmOptions, cardStates, dispositionType, dispositionText,
        );
        if (decisionMakingContent.trim()) {
            fullNoteParts.push('DECISION MAKING:');
            fullNoteParts.push(decisionMakingContent);
            fullNoteParts.push('');
        }
    }

    // Signature
    if (options.signature) {
        fullNoteParts.push(options.signature);
    }

    return {
        sections: {
            algorithm: algorithmContent,
            decisionMaking: decisionMakingContent,
            customNote,
        },
        fullNote: fullNoteParts.join('\n').trim(),
    };
}
