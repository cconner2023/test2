// components/DecisionMaking.tsx
import { useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { getColorClasses } from '../Utilities/ColorUtilities'
import type { AlgorithmOptions, decisionMakingType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'
import { DecisionMakingItem } from './DecisionMakingItem'
import { MedicationPage } from './MedicationPage'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingProps {
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    disposition: any;
    dispositionType: string;
}

export function DecisionMaking({
    algorithmOptions = [],
    cardStates = [],
    disposition,
    dispositionType,
}: DecisionMakingProps) {
    const [selectedMedication, setSelectedMedication] = useState<{
        medication: medListTypes;
        itemIndex: number;
    } | null>(null)

    // Auto-animate for smooth transitions
    const [listRef] = useAutoAnimate<HTMLDivElement>({
        duration: 300,
        easing: 'ease-in-out',
    })

    const colors = getColorClasses(dispositionType as any)

    const findTriggeringDecisionMaking = (): decisionMakingType[] => {
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
                return answerToCheck.decisionMaking || [];
            }
        }

        return [];
    };

    const decisionMakingContent = findTriggeringDecisionMaking()

    // Handler for medication clicks from DecisionMakingItem
    const handleMedicationClick = (medication: medListTypes, itemIndex: number) => {
        setSelectedMedication({ medication, itemIndex })
    }

    const handleCloseMedication = () => {
        setSelectedMedication(null)
    }

    return (
        <div className="h-full w-full">
            {/* Separate container for animation to avoid layout jumps */}
            <div ref={listRef} className="h-full">
                {/* Medication Details View */}
                {selectedMedication ? (
                    <div key="medication-view" className="h-full">
                        <div className="h-full flex flex-col">
                            {/* Fixed header that won't scroll away */}
                            <div className="flex-none flex items-center justify-between p-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCloseMedication}
                                        className="flex items-center gap-1 text-sm text-themeblue2 hover:text-themeblue1"
                                    >
                                        ← Back
                                    </button>
                                </div>
                            </div>
                            {/* Scrollable medication content */}
                            <div className="flex-1 overflow-y-auto">
                                <MedicationPage medication={selectedMedication.medication} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div key="decision-items-view" className="h-full w-full overflow-y-auto">
                        {decisionMakingContent.map((item, index) => (
                            <DecisionMakingItem
                                key={index}
                                item={item}
                                colors={colors}
                                onMedicationClick={(med) => handleMedicationClick(med, index)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}