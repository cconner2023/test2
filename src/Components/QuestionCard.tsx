// components/QuestionCard.tsx
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { getScreenerMaxScore, getScreenerScore, isScreenerGateOpen } from '../Data/SpecTesting';
import { Check, ClipboardList } from 'lucide-react';

interface QuestionCardProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    visibleCards: CardState[];
    isTransitioning: boolean;
    onAnswer: (cardIndex: number, answerIndex: number) => void;
    onQuestionOption: (cardIndex: number, optionIndex: number) => void;
    onOpenScreener?: (cardIndex: number) => void;
}

// components/QuestionCard.tsx
export const QuestionCard = ({
    algorithmOptions,
    visibleCards,
    isTransitioning,
    onAnswer,
    onQuestionOption,
    onOpenScreener
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
                const isScreenerAction = isAction && !!question.screenerConfig;
                const hasNext = idx < visibleCards.length - 1;

                // Screener action card — special rendering
                if (isScreenerAction) {
                    const screener = question.screenerConfig!;
                    const isCompleted = !!card.completedScreenerId;
                    const isExtendedComplete = !!screener.conditionalExtension
                        && card.completedScreenerId === screener.conditionalExtension.screener.id;
                    const activeScreenerForScore = isExtendedComplete
                        ? screener.conditionalExtension!.screener : screener;
                    const gateClosed = isCompleted && card.screenerResponses
                        && !isScreenerGateOpen(activeScreenerForScore, card.screenerResponses);
                    const totalScore = card.screenerResponses
                        ? getScreenerScore(activeScreenerForScore, card.screenerResponses)
                        : 0;
                    const maxScore = getScreenerMaxScore(activeScreenerForScore);
                    const activeScreener = activeScreenerForScore;
                    const interp = isCompleted
                        ? activeScreener.interpretations.find(
                            i => totalScore >= i.minScore && totalScore <= i.maxScore
                        )?.label ?? ''
                        : '';

                    return (
                        <div key={card.index} className={`flex flex-col items-center ${idx > 0 ? 'animate-cardAppearIn' : ''}`}>
                            <div className={`flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border-3 border-dashed border-themeblue2/30`}>
                                <div className="px-4 py-3 text-center">
                                    <div className="text-[9pt] font-semibold mb-1 uppercase tracking-wider text-themeblue2">
                                        Screening Tool
                                    </div>
                                    <div className="text-[10pt] font-normal text-primary/80">
                                        {question.text}
                                    </div>
                                </div>

                                {isCompleted ? (
                                    <div className="px-4 pb-3">
                                        <div className="flex items-center justify-between bg-themeblue2/8 rounded-md px-3 py-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <Check size={14} className="text-themeblue2" />
                                                <span className="text-xs font-medium text-themeblue2">Completed</span>
                                            </div>
                                            <span className="text-xs text-themeblue2 font-semibold">
                                                {gateClosed ? 'Negative Screen' : `${totalScore}/${maxScore} — ${interp}`}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onOpenScreener?.(card.index)}
                                            className="w-full py-2 text-xs text-themeblue2 bg-themeblue2/8 rounded-md font-medium active:scale-[0.98] transition-all"
                                        >
                                            View / Edit Results
                                        </button>
                                    </div>
                                ) : (
                                    <div className="px-4 pb-3">
                                        <button
                                            onClick={() => onOpenScreener?.(card.index)}
                                            className="w-full py-2.5 text-xs text-white bg-themeblue2 rounded-md font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                                        >
                                            <ClipboardList size={14} />
                                            Start Screening
                                        </button>
                                    </div>
                                )}
                            </div>

                            {hasNext && (
                                <div className="flex flex-col items-center py-1">
                                    <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '0ms' }} />
                                    <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '100ms' }} />
                                    <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '200ms' }} />
                                    <div className={`connector-dot ${cardColors.badgeBg}`} style={{ animationDelay: '290ms' }} />
                                </div>
                            )}
                        </div>
                    );
                }

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
                                                        if (isRF || isChoice || isCount || isInitial) {
                                                            onQuestionOption(card.index, optIndex);
                                                        }
                                                    }}
                                                    className={`
                                                text-xs p-2 rounded-md transition-all duration-200
                                                ${isAction
                                                            ? 'bg-themewhite3 text-tertiary'
                                                            : isSelected
                                                                ? isRF
                                                                    ? 'bg-themeredred text-white'
                                                                    : `${cardColors.symptomClass} border-dashed`
                                                                : 'bg-themewhite3 text-tertiary'
                                                        }
                                                ${(isRF || isChoice || isCount || isInitial) ? 'cursor-pointer' : 'cursor-default'}
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