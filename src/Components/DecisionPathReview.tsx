// components/DecisionPathReview.tsx
// Read-only review of the decision path taken through the algorithm
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { getColorClasses } from '../Utilities/ColorUtilities';

interface DecisionPathReviewProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    disposition: {
        type: string;
        text: string;
        addendum?: string;
    };
    colors: ReturnType<typeof getColorClasses>;
    selectedSymptom?: {
        icon: string;
        text: string;
    };
}

export function DecisionPathReview({
    algorithmOptions,
    cardStates,
    disposition,
    colors,
    selectedSymptom,
}: DecisionPathReviewProps) {
    // Build the decision path from card states
    const pathSteps: {
        type: 'rf' | 'initial' | 'choice' | 'count' | 'action';
        question: string;
        selectedOptions: string[];
        answer: string | null;
    }[] = [];

    // Gather RF selections first
    const rfSelections: string[] = [];
    for (let i = 0; i < cardStates.length; i++) {
        const card = cardStates[i];
        const algorithmCard = algorithmOptions[i];
        if (!card || !algorithmCard) continue;

        if (algorithmCard.type === 'rf' && card.selectedOptions.length > 0) {
            card.selectedOptions.forEach(optIdx => {
                const optionText = algorithmCard.questionOptions[optIdx]?.text;
                if (optionText) rfSelections.push(optionText);
            });
        }
    }

    // Gather non-RF steps in order
    for (let i = 0; i < cardStates.length; i++) {
        const card = cardStates[i];
        const algorithmCard = algorithmOptions[i];
        if (!card || !algorithmCard) continue;
        if (!card.isVisible) continue;
        if (algorithmCard.type === 'rf') continue; // RF handled separately above
        if (algorithmCard.type === 'action') continue; // Action cards are info-only, no user decision

        const selectedOptionTexts = card.selectedOptions
            .map(optIdx => algorithmCard.questionOptions[optIdx]?.text)
            .filter(Boolean) as string[];

        pathSteps.push({
            type: algorithmCard.type,
            question: algorithmCard.text,
            selectedOptions: selectedOptionTexts,
            answer: card.answer?.text || null,
        });
    }

    return (
        <div className="space-y-3">
            {/* Symptom header */}
            {selectedSymptom && selectedSymptom.text && (
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-tertiary">Symptom:</span>
                    <span className="text-sm font-medium text-primary">{selectedSymptom.text}</span>
                </div>
            )}

            {/* Red Flag Selections */}
            {rfSelections.length > 0 && (
                <div className="rounded-md border border-themeredred/30 bg-themeredred/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-themeredred shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-xs font-semibold text-themeredred uppercase tracking-wide">Red Flags Present</span>
                    </div>
                    <div className="space-y-1 pl-6">
                        {rfSelections.map((rf, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-primary">
                                <span className="text-themeredred shrink-0 mt-0.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                                <span>{rf}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Red Flags indicator */}
            {rfSelections.length === 0 && algorithmOptions.some(o => o.type === 'rf') && (
                <div className="rounded-md border border-themegray1/20 bg-themewhite3 p-3">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-themegreen shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-tertiary">No Red Flags Selected</span>
                    </div>
                </div>
            )}

            {/* Decision Steps */}
            {pathSteps.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-tertiary uppercase tracking-wide">Decision Path</div>
                    <div className="space-y-2">
                        {pathSteps.map((step, idx) => (
                            <div
                                key={idx}
                                className="rounded-md border border-themegray1/20 bg-themewhite3 p-3"
                            >
                                {/* Step question */}
                                <div className="text-xs text-tertiary mb-1.5 font-medium">
                                    {step.question}
                                </div>

                                {/* Selected options (if any) */}
                                {step.selectedOptions.length > 0 && (
                                    <div className="space-y-0.5 mb-1.5 pl-2">
                                        {step.selectedOptions.map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-start gap-2 text-xs text-primary">
                                                <span className={`${colors.symptomCheck} shrink-0 mt-0.5`}>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </span>
                                                <span>{opt}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Answer */}
                                {step.answer && (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colors.symptomClass}`}>
                                            {step.answer}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Disposition result */}
            <div className={`rounded-md p-3 ${colors.barBg}`}>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${colors.badgeBg} ${colors.badgeText}`}>
                        {disposition.type}
                    </span>
                    <span className="text-sm font-medium text-primary">
                        {disposition.text}
                    </span>
                </div>
                {disposition.addendum && (
                    <div className="text-xs text-tertiary mt-1 pl-1">
                        {disposition.addendum}
                    </div>
                )}
            </div>
        </div>
    );
}
