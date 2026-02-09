// hooks/useAlgorithm.ts
import { useState, useCallback, useMemo } from 'react';
import type { AlgorithmOptions, answerOptions, dispositionType } from '../Types/AlgorithmTypes';

export interface CardState {
    index: number;
    isVisible: boolean;
    answer: answerOptions | null;
    selectedOptions: number[];
    count: number;
}

/** Creates a blank (reset) card state, preserving only visibility and index */
const resetCard = (card: CardState): CardState => ({
    ...card,
    isVisible: false,
    answer: null,
    selectedOptions: [],
    count: 0,
});

/** Resets all cards after `afterIndex`, skipping RF cards. Returns a new array. */
const resetCardsAfter = (
    states: CardState[],
    afterIndex: number,
    algorithmOptions: AlgorithmOptions[],
): CardState[] =>
    states.map((c, idx) => {
        if (idx <= afterIndex || algorithmOptions[idx]?.type === 'rf') return c;
        return resetCard(c);
    });

/** Makes the "next" cards visible according to an answer's `next` field. Mutates in place. */
const revealNextCards = (states: CardState[], next: number | number[] | null): void => {
    if (next === null) return;
    const indices = Array.isArray(next) ? next : [next];
    for (const idx of indices) {
        if (idx >= 0 && idx < states.length) {
            states[idx] = { ...states[idx], isVisible: true };
        }
    }
};

export const useAlgorithm = (algorithmOptions: AlgorithmOptions[], initialCardStates?: CardState[], initialDisposition?: dispositionType | null) => {
    // Memoised card-type indices — recomputed only when the algorithm changes
    const initialCardIndex = useMemo(
        () => algorithmOptions.findIndex(card => card.type === 'initial'),
        [algorithmOptions],
    );

    const rfCardIndices = useMemo(
        () => algorithmOptions.reduce<number[]>((acc, card, i) => {
            if (card.type === 'rf') acc.push(i);
            return acc;
        }, []),
        [algorithmOptions],
    );

    // Initialize card states
    const initializeCardStates = useCallback((): CardState[] => {
        return algorithmOptions.map((_, index) => ({
            index,
            isVisible: index <= initialCardIndex,
            answer: null,
            selectedOptions: [],
            count: 0
        }));
    }, [algorithmOptions, initialCardIndex]);

    // State — use initial card states if provided (for restoring saved notes)
    const [cardStates, setCardStates] = useState<CardState[]>(() =>
        initialCardStates && initialCardStates.length > 0 ? initialCardStates : initializeCardStates()
    );
    const [currentDisposition, setCurrentDisposition] = useState<dispositionType | null>(
        initialDisposition !== undefined ? initialDisposition : null
    );

    /** Count total RF selections across all RF cards (optionally overriding one card's count) */
    const countTotalRFSelections = useCallback((
        states: CardState[],
        overrideIndex?: number,
        overrideCount?: number,
    ): number =>
        rfCardIndices.reduce((total, rfIdx) => {
            if (rfIdx === overrideIndex) return total + (overrideCount ?? 0);
            return total + (states[rfIdx]?.selectedOptions.length || 0);
        }, 0),
    [rfCardIndices]);

    /**
     * Apply a "yes/no selection" update to the initial card based on total selections.
     * Returns updated states and sets disposition. Shared by RF and initial-card handlers.
     */
    const applyInitialCardSelection = useCallback((
        states: CardState[],
        targetIndex: number,
        hasAnySelection: boolean,
        prevAnswer: answerOptions | null,
    ): CardState[] => {
        const question = algorithmOptions[targetIndex];
        if (!question?.answerOptions?.[0]) return states;

        let newStates = states;

        if (hasAnySelection) {
            const yesAnswer = question.answerOptions[0];
            const answerChanged = prevAnswer?.text !== yesAnswer.text;
            newStates[targetIndex] = { ...newStates[targetIndex], answer: yesAnswer };
            setCurrentDisposition(yesAnswer.disposition?.[0] || null);

            if (answerChanged) {
                newStates = resetCardsAfter(newStates, targetIndex, algorithmOptions);
                revealNextCards(newStates, yesAnswer.next);
            }
        } else if (prevAnswer?.text === question.answerOptions[0]?.text) {
            // Was "Yes", now nothing selected — clear and reset
            newStates[targetIndex] = { ...newStates[targetIndex], answer: null };
            setCurrentDisposition(null);
            newStates = resetCardsAfter(newStates, targetIndex, algorithmOptions);
        }

        return newStates;
    }, [algorithmOptions]);

    // Helper: Update answer and reset algorithm if needed
    const updateCardState = useCallback((
        currentStates: CardState[],
        cardIndex: number,
        newSelectedOptions: number[]
    ): CardState[] => {
        const question = algorithmOptions[cardIndex];
        const card = currentStates[cardIndex];
        if (!card || !question) return currentStates;

        const newCount = newSelectedOptions.length;
        let newCardStates = [...currentStates];

        // Update the card with new selections
        newCardStates[cardIndex] = {
            ...card,
            selectedOptions: newSelectedOptions,
            count: newCount
        };

        // Handle RF cards - they affect initial card
        if (question.type === 'rf') {
            const totalRFSelected = countTotalRFSelections(newCardStates, cardIndex, newCount);
            const hasAnyRFSelected = totalRFSelected > 0;
            const initialCard = newCardStates[initialCardIndex];
            const initialQuestion = algorithmOptions[initialCardIndex];

            if (initialCard && initialQuestion?.answerOptions?.[0]) {
                const prevAnswer = initialCard.answer;

                // Auto-select/deselect "Red flags" questionOption in initial card
                let newInitialSelected = [...newCardStates[initialCardIndex].selectedOptions];
                if (initialQuestion.questionOptions && initialQuestion.questionOptions.length > 0) {
                    const rfOptionIndex = initialQuestion.questionOptions.findIndex(
                        opt => opt.text.toLowerCase().includes('red flag')
                    );
                    if (rfOptionIndex !== -1) {
                        if (hasAnyRFSelected && !newInitialSelected.includes(rfOptionIndex)) {
                            newInitialSelected.push(rfOptionIndex);
                        } else if (!hasAnyRFSelected && newInitialSelected.includes(rfOptionIndex)) {
                            newInitialSelected = newInitialSelected.filter(i => i !== rfOptionIndex);
                        }
                    }
                }

                newCardStates[initialCardIndex] = {
                    ...newCardStates[initialCardIndex],
                    selectedOptions: newInitialSelected,
                    count: newInitialSelected.length
                };

                const hasAnySelection = hasAnyRFSelected || newInitialSelected.length > 0;
                newCardStates = applyInitialCardSelection(
                    newCardStates, initialCardIndex, hasAnySelection, prevAnswer,
                );
            }
        }
        // Handle initial card with its own question options
        else if (question.type === 'initial' && question.questionOptions && question.questionOptions.length > 0) {
            const totalRFSelected = countTotalRFSelections(newCardStates);
            const hasAnySelection = newCount + totalRFSelected > 0;

            newCardStates = applyInitialCardSelection(
                newCardStates, cardIndex, hasAnySelection, card.answer,
            );
        }
        // Handle choice/count cards
        else if ((question.type === 'choice' || question.type === 'count') && question.answerOptions) {
            const answerIndex = question.type === 'choice'
                ? (newCount > 0 ? 0 : 1)
                : (newCount >= 3 ? 0 : 1);

            const answer = question.answerOptions[answerIndex];
            newCardStates[cardIndex] = { ...newCardStates[cardIndex], answer };

            // Reset all cards after this one if answer changes
            if (card.answer?.text !== answer.text) {
                newCardStates = resetCardsAfter(newCardStates, cardIndex, algorithmOptions);
                revealNextCards(newCardStates, answer.next);
            }

            setCurrentDisposition(answer.disposition?.[0] || null);
        }

        return newCardStates;
    }, [algorithmOptions, initialCardIndex, countTotalRFSelections, applyInitialCardSelection]);

    // Handle question option selection
    const handleQuestionOption = useCallback((cardIndex: number, optionIndex: number) => {
        setCardStates(prev => {
            const question = algorithmOptions[cardIndex];
            const card = prev[cardIndex];
            if (!card || !question) return prev;

            // Simply toggle individual selection
            const newSelectedOptions = card.selectedOptions.includes(optionIndex)
                ? card.selectedOptions.filter(i => i !== optionIndex)
                : [...card.selectedOptions, optionIndex];

            // Update card state (which handles all other logic)
            return updateCardState(prev, cardIndex, newSelectedOptions);
        });
    }, [algorithmOptions, updateCardState]);

    /** Select all question options for a card, or none — returns [selectedOptions, count] */
    const selectAllOrNone = (question: AlgorithmOptions, selectAll: boolean): [number[], number] => {
        if (!question.questionOptions?.length) return [[], 0];
        if (selectAll) {
            const all = question.questionOptions.map((_, i) => i);
            return [all, all.length];
        }
        return [[], 0];
    };

    // Helper: Handle answer button click with selectAll logic
    const handleAnswerButtonClick = useCallback((
        currentStates: CardState[],
        cardIndex: number,
        answerIndex: number
    ): CardState[] => {
        const question = algorithmOptions[cardIndex];
        const card = currentStates[cardIndex];
        if (!card || !question || !question.answerOptions?.[answerIndex]) return currentStates;

        const answer = question.answerOptions[answerIndex];

        // Update card with answer selection
        let newCardStates = [...currentStates];

        // Handle initial card specially (affects both its own options and RF cards)
        if (question.type === 'initial') {
            const isYesAnswer = answer.text === question.answerOptions[0].text;
            const [selectedOpts, count] = selectAllOrNone(question, isYesAnswer);
            newCardStates[cardIndex] = { ...card, answer, selectedOptions: selectedOpts, count };

            // Select/deselect all RF options to match
            rfCardIndices.forEach(rfIndex => {
                const rfQuestion = algorithmOptions[rfIndex];
                if (rfQuestion) {
                    const [rfOpts, rfCount] = selectAllOrNone(rfQuestion, isYesAnswer);
                    newCardStates[rfIndex] = { ...newCardStates[rfIndex], selectedOptions: rfOpts, count: rfCount };
                }
            });
        } else {
            // For non-initial cards, apply selectAll to their own question options only
            const [newSelectedOptions, newCount] = (question.questionOptions?.length)
                ? selectAllOrNone(question, answer.selectAll)
                : [card.selectedOptions, card.selectedOptions.length];

            newCardStates[cardIndex] = { ...card, answer, selectedOptions: newSelectedOptions, count: newCount };
        }

        // Reset all cards after this one and reveal next cards
        newCardStates = resetCardsAfter(newCardStates, cardIndex, algorithmOptions);
        revealNextCards(newCardStates, answer.next);
        setCurrentDisposition(answer.disposition?.[0] || null);

        return newCardStates;
    }, [algorithmOptions, rfCardIndices]);

    // Handle answer button clicks
    const handleAnswer = useCallback((cardIndex: number, answerIndex: number) => {
        setCardStates(prev => handleAnswerButtonClick(prev, cardIndex, answerIndex));
    }, [handleAnswerButtonClick]);

    const getVisibleCards = useCallback(() => {
        return cardStates
            .filter(card => card.isVisible)
            .sort((a, b) => a.index - b.index);
    }, [cardStates]);

    const resetAlgorithm = useCallback(() => {
        setCardStates(initializeCardStates());
        setCurrentDisposition(null);
    }, [initializeCardStates]);

    // Check if we can go back one card within the algorithm
    // True if any non-RF card has an answer (including the initial card)
    const canGoBack = (() => {
        if (cardStates[initialCardIndex]?.answer !== null) return true;
        return cardStates.some((c, idx) =>
            idx > initialCardIndex &&
            algorithmOptions[idx]?.type !== 'rf' &&
            c.answer !== null
        );
    })();

    // Go back one card in the algorithm decision history
    const goBackOneCard = useCallback(() => {
        setCardStates(prev => {
            // Find the last answered non-RF card (furthest in the algorithm)
            let lastAnsweredIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
                if (rfCardIndices.includes(i)) continue;
                if (prev[i].answer !== null) {
                    lastAnsweredIndex = i;
                    break;
                }
            }

            if (lastAnsweredIndex === -1) return prev; // nothing to undo

            let newCardStates = [...prev];

            // Clear the target card's answer and selections
            newCardStates[lastAnsweredIndex] = {
                ...newCardStates[lastAnsweredIndex],
                answer: null,
                selectedOptions: [],
                count: 0
            };

            if (lastAnsweredIndex === initialCardIndex) {
                // Going back from the initial card = reset everything including RF selections
                rfCardIndices.forEach(rfIndex => {
                    newCardStates[rfIndex] = {
                        ...newCardStates[rfIndex],
                        selectedOptions: [],
                        count: 0
                    };
                });
                newCardStates = resetCardsAfter(newCardStates, initialCardIndex, algorithmOptions);
                setCurrentDisposition(null);
            } else {
                // Going back from a non-initial card
                newCardStates = resetCardsAfter(newCardStates, lastAnsweredIndex, algorithmOptions);

                // Recalculate disposition: find the last remaining answered card's disposition
                let newDisposition: dispositionType | null = null;
                for (let i = lastAnsweredIndex - 1; i >= 0; i--) {
                    if (rfCardIndices.includes(i)) continue;
                    const cardAnswer = newCardStates[i].answer;
                    if (cardAnswer?.disposition?.[0]) {
                        newDisposition = cardAnswer.disposition[0];
                        break;
                    }
                }
                setCurrentDisposition(newDisposition);
            }

            return newCardStates;
        });
    }, [initialCardIndex, rfCardIndices, algorithmOptions]);

    return {
        cardStates,
        currentDisposition,
        handleQuestionOption,
        handleAnswer,
        getVisibleCards,
        resetAlgorithm,
        canGoBack,
        goBackOneCard
    };
};