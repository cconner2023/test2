// components/QuestionCard.tsx
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';

interface QuestionCardProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    visibleCards: CardState[];
    isTransitioning: boolean;
    onAnswer: (cardIndex: number, answerIndex: number) => void;
    onQuestionOption: (cardIndex: number, optionIndex: number) => void;
}

// components/QuestionCard.tsx
export const QuestionCard = ({
    algorithmOptions,
    visibleCards,
    isTransitioning,
    onAnswer,
    onQuestionOption
}: QuestionCardProps) => {
    return (
        <div className="space-y-0">
            {visibleCards.map((card, idx) => {
                const question = algorithmOptions[card.index];
                if (!question) return null;

                const cardColors = getColorClasses(
                    card.answer?.disposition?.[0]?.type
                );

                const isRF = question.type === 'rf';
                const isChoice = question.type === 'choice';
                const isCount = question.type === 'count';
                const isInitial = question.type === 'initial';
                const isAction = question.type === 'action';
                const hasNext = idx < visibleCards.length - 1;

                return (
                    <div key={card.index} className={`flex flex-col items-center ${idx > 0 ? 'animate-cardAppearIn' : ''}`}>
                        <div
                            className={`
              flex flex-col rounded-md w-full overflow-hidden shadow-sm
              bg-themewhite2 border
              ${isRF
                                    ? 'border-2 border-dashed border-themeredred/30'
                                    : isAction
                                        ? 'border-3 border-dashed border-themeblue2/30'
                                        : 'border-themewhite/10'
                                }
            `}
                        >
                            {/* Question Header */}
                            <div className={`px-4 py-3 ${isRF ? 'text-center text-themeredred' : isAction ? 'text-center text-themeblue2' : 'text-primary/80'}`}>
                                {/* Title for RF and Action cards */}
                                {(isRF || isAction) && (
                                    <div className="text-[9pt] font-semibold mb-1 uppercase tracking-wider">
                                        {isRF ? '' : 'Action Required'}
                                    </div>
                                )}
                                <div className="text-[10pt] font-normal">
                                    {question.text}
                                </div>
                            </div>

                            {/* Question Options */}
                            {question.questionOptions && question.questionOptions.length > 0 && (
                                <div className="px-3 pt-2 pb-10">
                                    <div className="space-y-2">
                                        {question.questionOptions.map((opt, optIndex) => {
                                            const isSelected = card.selectedOptions.includes(optIndex);
                                            return (
                                                <div
                                                    key={optIndex}
                                                    onClick={() => {
                                                        if (isRF || isChoice || isCount || isInitial || isAction) {
                                                            onQuestionOption(card.index, optIndex);
                                                        }
                                                    }}
                                                    className={`
                                                text-xs p-2 rounded-md cursor-pointer transition-all duration-200
                                                ${isSelected
                                                            ? isRF
                                                                ? 'bg-themeredred text-white' // RF selected style
                                                                : `${cardColors.symptomClass} border-dashed`
                                                            : 'bg-themewhite3 text-tertiary'
                                                        }
                                                ${(isRF || isChoice || isCount || isInitial || isAction) ? 'cursor-pointer' : 'cursor-default'}
                                            `}
                                                >
                                                    <div className="font-normal flex items-center">
                                                        {isSelected && (
                                                            <span className={`mr-2 ${isRF ? 'text-white' : cardColors.symptomCheck}`}>
                                                                ✓
                                                            </span>
                                                        )}
                                                        {opt.text}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Answer Options */}
                            {question.answerOptions && question.answerOptions.length > 0 && !isRF && (
                                <div className="relative flex w-full h-10 bg-themewhite2">
                                    <div className={`
                  absolute top-0 left-0 h-full w-1/2 
                  transition-all duration-300
                  ${card.answer === question.answerOptions[0]
                                            ? 'translate-x-0'
                                            : card.answer === question.answerOptions[1]
                                                ? 'translate-x-full'
                                                : '-translate-x-full'
                                        } 
                  ${card.answer ? cardColors.sliderClass : 'bg-themewhite'}
                `} />

                                    {question.answerOptions.map((option, optionIndex) => (
                                        <button
                                            key={option.text}
                                            onClick={() => onAnswer(card.index, optionIndex)}
                                            className="relative h-full w-1/2 text-[10pt] flex items-center justify-center"
                                            disabled={isTransitioning}
                                        >
                                            <span className={`
                      transition-colors duration-300 
                      ${card.answer === option ? `font-semibold ${cardColors.answerButton}` : 'text-gray-600'}
                    `}>
                                                {option.text.toUpperCase()}
                                                {isInitial && card.selectedOptions.length > 0 &&
                                                    optionIndex === 0 && card.answer === option &&
                                                    <span className="ml-1">✓</span>}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Spacer for RF cards (no connector) */}
                        {hasNext && isRF && (
                            <div className="h-6" />
                        )}

                        {/* Dot-dot-arrow connector — sequential stagger */}
                        {hasNext && !isRF && (
                            <div className="flex flex-col items-center py-1">
                                <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '0ms' }} />
                                <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '100ms' }} />
                                <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '200ms' }} />
                                <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '290ms' }} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};