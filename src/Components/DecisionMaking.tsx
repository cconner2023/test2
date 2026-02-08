// components/DecisionMaking.tsx
import { useState } from 'react'
import { useAppAnimate } from '../Utilities/AnimationConfig'
import { getColorClasses } from '../Utilities/ColorUtilities'
import type { AlgorithmOptions, decisionMakingType, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'
import { DecisionMakingItem } from './DecisionMakingItem'
import { DecisionPathReview } from './DecisionPathReview'
import { MedicationPage } from './MedicationPage'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingProps {
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    disposition: dispositionType;
    dispositionType: dispositionType['type'];
    selectedSymptom?: {
        icon: string;
        text: string;
    };
}

export function DecisionMaking({
    algorithmOptions = [],
    cardStates = [],
    disposition,
    dispositionType,
    selectedSymptom,
}: DecisionMakingProps) {
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)
    const [listRef] = useAppAnimate<HTMLDivElement>()
    const colors = getColorClasses(dispositionType)

    const findTriggeringDecisionMaking = (): decisionMakingType[] => {
        const results: decisionMakingType[] = [];

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
                d.type === disposition.type && d.text === disposition.text
            )) {
                const decisionMaking = answerToCheck.decisionMaking || [];
                results.push(...decisionMaking);
            }
        }

        return results;
    };

    const decisionMakingContent = findTriggeringDecisionMaking()

    const handleMedicationClick = (medication: medListTypes) => {
        setSelectedMedication(medication)
    }

    const handleCloseMedication = () => {
        setSelectedMedication(null)
    }

    return (
        <div className="h-full w-full">
            <div ref={listRef} className="h-full">
                {selectedMedication ? (
                    <div className="h-full flex flex-col">
                        <div className="flex-none p-3 border-b border-themegray1/20">
                            <button
                                onClick={handleCloseMedication}
                                className="flex items-center gap-1 text-sm text-themeblue2 hover:text-themeblue1"
                            >
                                ← Back
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <MedicationPage medication={selectedMedication} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto p-3 space-y-4">
                        {/* Decision Path Review - read-only summary of selections and answers */}
                        <DecisionPathReview
                            algorithmOptions={algorithmOptions}
                            cardStates={cardStates}
                            disposition={disposition}
                            colors={colors}
                            selectedSymptom={selectedSymptom}
                        />

                        {/* Clinical Decision Making Content */}
                        {decisionMakingContent.length > 0 && (
                            <div className="border-t border-themegray1/20 pt-4">
                                <div className="text-xs font-semibold text-tertiary uppercase tracking-wide mb-3">Clinical Decision Support</div>
                                {decisionMakingContent.map((item, index) => (
                                    <DecisionMakingItem
                                        key={index}
                                        item={item}
                                        colors={colors}
                                        onMedicationClick={handleMedicationClick}
                                        onDdxClick={undefined}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}