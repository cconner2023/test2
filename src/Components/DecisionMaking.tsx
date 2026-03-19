// components/DecisionMaking.tsx
import { useState } from 'react'
import type { AlgorithmOptions, decisionMakingType, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'
import { DecisionMakingItem } from './DecisionMakingItem'
import { MedicationPage } from './MedicationPage'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingProps {
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    disposition: dispositionType;
    dispositionType: dispositionType['type'];
}

export function DecisionMaking({
    algorithmOptions = [],
    cardStates = [],
    disposition,
    dispositionType,
}: DecisionMakingProps) {
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)

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
            <div className="h-full">
                {selectedMedication ? (
                    <div className="h-full flex flex-col">
                        <div className="flex-none px-4 py-3 border-b border-tertiary/10">
                            <button
                                onClick={handleCloseMedication}
                                className="flex items-center gap-1 text-[10pt] text-themeblue2 hover:text-themeblue1 active:scale-95 transition-transform"
                            >
                                ← Back
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <MedicationPage medication={selectedMedication} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto space-y-4">
                        {decisionMakingContent.map((item, index) => (
                            <DecisionMakingItem
                                key={index}
                                item={item}
                                onMedicationClick={handleMedicationClick}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}