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
                const prevAnswer = initialCard.answer;

                // Auto-select/deselect "Red flags" questionOption in initial card
                let newInitialSelected = [...newCardStates[initialIndex].selectedOptions];
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

                newCardStates[initialIndex] = {
                    ...newCardStates[initialIndex],
                    selectedOptions: newInitialSelected,
                    count: newInitialSelected.length
                };

                const hasAnySelection = hasAnyRFSelected || newInitialSelected.length > 0;

                if (hasAnySelection) {
                    const yesAnswer = initialQuestion.answerOptions[0];
                    const answerChanged = prevAnswer?.text !== yesAnswer.text;
                    newCardStates[initialIndex] = {
                        ...newCardStates[initialIndex],
                        answer: yesAnswer
                    };
                    setCurrentDisposition(yesAnswer.disposition?.[0] || null);

                    // Reset subsequent cards if answer changed
                    if (answerChanged) {
                        newCardStates = newCardStates.map((c, idx) => {
                            if (idx <= initialIndex || algorithmOptions[idx]?.type === 'rf') return c;
                            return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                        });
                        if (yesAnswer.next !== null) {
                            const nextIndices = Array.isArray(yesAnswer.next) ? yesAnswer.next : [yesAnswer.next];
                            nextIndices.forEach(nextIndex => {
                                if (nextIndex >= 0 && nextIndex < newCardStates.length) {
                                    newCardStates[nextIndex].isVisible = true;
                                }
                            });
                        }
                    }
                } else if (prevAnswer?.text === initialQuestion.answerOptions[0]?.text) {
                    // Was "Yes", now nothing selected — clear and reset
                    newCardStates[initialIndex] = {
                        ...newCardStates[initialIndex],
                        answer: null
                    };
                    setCurrentDisposition(null);

                    newCardStates = newCardStates.map((c, idx) => {
                        if (idx <= initialIndex || algorithmOptions[idx]?.type === 'rf') return c;
                        return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                    });
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
                const prevAnswer = card.answer;

                if (hasAnySelection) {
                    const yesAnswer = question.answerOptions[0];
                    const answerChanged = prevAnswer?.text !== yesAnswer.text;
                    newCardStates[cardIndex] = {
                        ...newCardStates[cardIndex],
                        answer: yesAnswer
                    };
                    setCurrentDisposition(yesAnswer.disposition?.[0] || null);

                    // Reset subsequent cards if answer changed
                    if (answerChanged) {
                        newCardStates = newCardStates.map((c, idx) => {
                            if (idx <= cardIndex || algorithmOptions[idx]?.type === 'rf') return c;
                            return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                        });
                        if (yesAnswer.next !== null) {
                            const nextIndices = Array.isArray(yesAnswer.next) ? yesAnswer.next : [yesAnswer.next];
                            nextIndices.forEach(nextIndex => {
                                if (nextIndex >= 0 && nextIndex < newCardStates.length) {
                                    newCardStates[nextIndex].isVisible = true;
                                }
                            });
                        }
                    }
                } else if (prevAnswer?.text === question.answerOptions[0]?.text) {
                    // Was "Yes", now nothing selected — clear and reset
                    newCardStates[cardIndex] = {
                        ...newCardStates[cardIndex],
                        answer: null
                    };
                    setCurrentDisposition(null);

                    newCardStates = newCardStates.map((c, idx) => {
                        if (idx <= cardIndex || algorithmOptions[idx]?.type === 'rf') return c;
                        return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                    });
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

    // Check if we can go back one card within the algorithm
    // True if any non-RF card has an answer (including the initial card)
    const canGoBack = (() => {
        const initialIndex = findInitialCardIndex();
        // Check if the initial card has an answer
        const initialHasAnswer = cardStates[initialIndex]?.answer !== null;
        if (initialHasAnswer) return true;
        // Check if any card after initial has an answer
        return cardStates.some((c, idx) =>
            idx > initialIndex &&
            algorithmOptions[idx]?.type !== 'rf' &&
            c.answer !== null
        );
    })();

    // Go back one card in the algorithm decision history
    const goBackOneCard = useCallback(() => {
        setCardStates(prev => {
            const initialIndex = findInitialCardIndex();
            const rfIndices = findRFCardIndices();

            // Find the last answered non-RF card (furthest in the algorithm)
            let lastAnsweredIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
                if (rfIndices.includes(i)) continue; // skip RF cards
                if (prev[i].answer !== null) {
                    lastAnsweredIndex = i;
                    break;
                }
            }

            if (lastAnsweredIndex === -1) return prev; // nothing to undo

            let newCardStates = [...prev];

            if (lastAnsweredIndex === initialIndex) {
                // Going back from the initial card = reset everything
                // Clear initial card answer and selections
                newCardStates[initialIndex] = {
                    ...newCardStates[initialIndex],
                    answer: null,
                    selectedOptions: [],
                    count: 0
                };

                // Clear all RF card selections too
                rfIndices.forEach(rfIndex => {
                    newCardStates[rfIndex] = {
                        ...newCardStates[rfIndex],
                        selectedOptions: [],
                        count: 0
                    };
                });

                // Hide all cards after initial (except RF cards which stay visible)
                newCardStates = newCardStates.map((c, idx) => {
                    if (idx <= initialIndex || rfIndices.includes(idx)) return c;
                    return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                });

                setCurrentDisposition(null);
            } else {
                // Going back from a non-initial card
                // Clear the last answered card's answer and selections
                newCardStates[lastAnsweredIndex] = {
                    ...newCardStates[lastAnsweredIndex],
                    answer: null,
                    selectedOptions: [],
                    count: 0
                };

                // Hide all cards after this one (except RF cards)
                newCardStates = newCardStates.map((c, idx) => {
                    if (idx <= lastAnsweredIndex || rfIndices.includes(idx)) return c;
                    return { ...c, isVisible: false, answer: null, selectedOptions: [], count: 0 };
                });

                // Recalculate disposition: find the last remaining answered card's disposition
                let newDisposition: dispositionType | null = null;
                for (let i = lastAnsweredIndex - 1; i >= 0; i--) {
                    if (rfIndices.includes(i)) continue;
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
    }, [findInitialCardIndex, findRFCardIndices]);

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