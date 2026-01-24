// hooks/useAlgorithm.ts
import { useState, useCallback } from 'react';
import type { AlgorithmOptions, answerOptions, dispositionType } from '../Types/AlgorithmTypes';

export interface CardState {
    index: number;
    isVisible: boolean;
    answer: answerOptions | null;
    selectedOptions: number[];
    count: number;
}

export const useAlgorithm = (algorithmOptions: AlgorithmOptions[]) => {
    // Find initial card index
    const findInitialCardIndex = useCallback(() => {
        return algorithmOptions.findIndex(card => card.type === 'initial');
    }, [algorithmOptions]);

    // Find all RF card indices
    const findRFCardIndices = useCallback(() => {
        return algorithmOptions
            .map((card, index) => card.type === 'rf' ? index : -1)
            .filter(index => index !== -1);
    }, [algorithmOptions]);

    // Initialize card states
    const initializeCardStates = useCallback((): CardState[] => {
        const initialIndex = findInitialCardIndex();

        return algorithmOptions.map((_, index) => ({
            index,
            isVisible: index <= initialIndex,
            answer: null,
            selectedOptions: [],
            count: 0
        }));
    }, [algorithmOptions, findInitialCardIndex]);

    // State
    const [cardStates, setCardStates] = useState<CardState[]>(() => initializeCardStates());
    const [currentDisposition, setCurrentDisposition] = useState<dispositionType | null>(null);

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
            const initialIndex = findInitialCardIndex();
            const rfIndices = findRFCardIndices();

            // Count total RF selections
            const totalRFSelected = rfIndices.reduce((total, rfIndex) => {
                if (rfIndex === cardIndex) {
                    return total + newCount;
                }
                return total + (newCardStates[rfIndex]?.selectedOptions.length || 0);
            }, 0);

            const hasAnyRFSelected = totalRFSelected > 0;
            const initialCard = newCardStates[initialIndex];
            const initialQuestion = algorithmOptions[initialIndex];

            if (initialCard && initialQuestion?.answerOptions?.[0]) {
                if (hasAnyRFSelected) {
                    // Auto-select "Yes" on initial card
                    const yesAnswer = initialQuestion.answerOptions[0];
                    newCardStates[initialIndex] = {
                        ...initialCard,
                        answer: yesAnswer
                    };
                    setCurrentDisposition(yesAnswer.disposition?.[0] || null);
                } else if (initialCard.answer?.text === initialQuestion.answerOptions[0]?.text) {
                    // Clear initial if no RF selected
                    newCardStates[initialIndex] = {
                        ...initialCard,
                        answer: null
                    };
                    setCurrentDisposition(null);
                }
            }
        }
        // Handle initial card with its own question options
        else if (question.type === 'initial' && question.questionOptions && question.questionOptions.length > 0) {
            // For initial card, update answer based on its own selections + RF selections
            const rfIndices = findRFCardIndices();
            const totalRFSelected = rfIndices.reduce((total, rfIndex) => {
                return total + (newCardStates[rfIndex]?.selectedOptions.length || 0);
            }, 0);

            const totalSelections = newCount + totalRFSelected;
            const hasAnySelection = totalSelections > 0;

            if (question.answerOptions?.[0]) {
                if (hasAnySelection) {
                    // Auto-select "Yes" on initial card
                    const yesAnswer = question.answerOptions[0];
                    newCardStates[cardIndex] = {
                        ...newCardStates[cardIndex],
                        answer: yesAnswer
                    };
                    setCurrentDisposition(yesAnswer.disposition?.[0] || null);
                } else if (card.answer?.text === question.answerOptions[0]?.text) {
                    // Clear answer if no selections
                    newCardStates[cardIndex] = {
                        ...newCardStates[cardIndex],
                        answer: null
                    };
                    setCurrentDisposition(null);
                }
            }
        }
        // Handle choice/count cards
        else if ((question.type === 'choice' || question.type === 'count') && question.answerOptions) {
            let answerIndex = -1;

            if (question.type === 'choice') {
                answerIndex = newCount > 0 ? 0 : 1;
            } else if (question.type === 'count') {
                answerIndex = newCount >= 3 ? 0 : 1;
            }

            if (answerIndex !== -1) {
                const answer = question.answerOptions[answerIndex];
                newCardStates[cardIndex] = {
                    ...newCardStates[cardIndex],
                    answer: answer
                };

                // Reset all cards after this one if answer changes
                if (card.answer?.text !== answer.text) {
                    newCardStates = newCardStates.map((c, idx) => {
                        if (idx <= cardIndex) return c;
                        return {
                            ...c,
                            isVisible: false,
                            answer: null,
                            selectedOptions: [],
                            count: 0
                        };
                    });

                    // Show next cards if specified
                    if (answer.next !== null) {
                        const nextIndices = Array.isArray(answer.next) ? answer.next : [answer.next];
                        nextIndices.forEach(nextIndex => {
                            if (nextIndex >= 0 && nextIndex < newCardStates.length) {
                                newCardStates[nextIndex].isVisible = true;
                            }
                        });
                    }
                }

                setCurrentDisposition(answer.disposition?.[0] || null);
            }
        }

        return newCardStates;
    }, [algorithmOptions, findInitialCardIndex, findRFCardIndices]);

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
        const rfIndices = findRFCardIndices();

        // Update card with answer selection
        let newCardStates = [...currentStates];

        // Handle initial card specially (affects both its own options and RF cards)
        if (question.type === 'initial') {
            const yesAnswer = question.answerOptions[0];

            if (answer.text === yesAnswer.text) {
                // Select ALL options when initial is "Yes"

                // 1. Select all of initial card's own question options
                if (question.questionOptions && question.questionOptions.length > 0) {
                    const initialSelectedOptions = question.questionOptions.map((_, i) => i);
                    newCardStates[cardIndex] = {
                        ...card,
                        answer,
                        selectedOptions: initialSelectedOptions,
                        count: initialSelectedOptions.length
                    };
                } else {
                    newCardStates[cardIndex] = {
                        ...card,
                        answer,
                        selectedOptions: [],
                        count: 0
                    };
                }

                // 2. Select all RF options
                rfIndices.forEach(rfIndex => {
                    const rfQuestion = algorithmOptions[rfIndex];
                    if (rfQuestion) {
                        newCardStates[rfIndex] = {
                            ...newCardStates[rfIndex],
                            selectedOptions: rfQuestion.questionOptions?.map((_, i) => i) || [],
                            count: rfQuestion.questionOptions?.length || 0
                        };
                    }
                });
            } else {
                // Deselect ALL options when initial is "No"

                // 1. Deselect all of initial card's own question options
                newCardStates[cardIndex] = {
                    ...card,
                    answer,
                    selectedOptions: [],
                    count: 0
                };

                // 2. Deselect all RF options
                rfIndices.forEach(rfIndex => {
                    newCardStates[rfIndex] = {
                        ...newCardStates[rfIndex],
                        selectedOptions: [],
                        count: 0
                    };
                });
            }
        } else {
            // For non-initial cards, apply selectAll to their own question options only
            let newSelectedOptions = card.selectedOptions;

            if (question.questionOptions && question.questionOptions.length > 0) {
                if (answer.selectAll) {
                    newSelectedOptions = question.questionOptions.map((_, i) => i);
                } else {
                    newSelectedOptions = [];
                }
            }

            const newCount = newSelectedOptions.length;

            newCardStates[cardIndex] = {
                ...card,
                answer,
                selectedOptions: newSelectedOptions,
                count: newCount
            };
        }

        // Reset all cards after this one
        newCardStates = newCardStates.map((c, idx) => {
            if (idx <= cardIndex) return c;
            return {
                ...c,
                isVisible: false,
                answer: null,
                selectedOptions: [],
                count: 0
            };
        });

        // Show next cards if specified
        if (answer.next !== null) {
            const nextIndices = Array.isArray(answer.next) ? answer.next : [answer.next];
            nextIndices.forEach(nextIndex => {
                if (nextIndex >= 0 && nextIndex < newCardStates.length) {
                    newCardStates[nextIndex].isVisible = true;
                }
            });
        }

        setCurrentDisposition(answer.disposition?.[0] || null);

        return newCardStates;
    }, [algorithmOptions, findRFCardIndices]);

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

    return {
        cardStates,
        currentDisposition,
        handleQuestionOption,
        handleAnswer,
        getVisibleCards,
        resetAlgorithm
    };
};