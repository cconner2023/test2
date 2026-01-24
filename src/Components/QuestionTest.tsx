// Components/QuestionCard.tsx
import type { subCatDataTypes } from '../Types/CatTypes'
import { Algorithm } from '../Data/Algorithms'

interface QuestionCardProps {
    selectedSymptom: subCatDataTypes | null | undefined
}

export function QuestionCard({ selectedSymptom }: QuestionCardProps) {
    if (!selectedSymptom) {
        return (
            <div className="h-full flex items-center justify-center p-8 text-gray-500">
                <div className="text-center">
                    <div className="text-lg mb-2">No symptom selected</div>
                    <div className="text-sm">Select a symptom to begin</div>
                </div>
            </div>
        )
    }

    // Find algorithm that matches the symptom icon
    const algorithm = Algorithm.find(algo => algo.id === selectedSymptom.icon)

    if (!algorithm) {
        return (
            <div className="h-full flex items-center justify-center p-8 text-gray-500">
                <div className="text-center">
                    <div className="text-lg mb-2">No algorithm available</div>
                    <div className="text-sm">
                        No algorithm found for: "{selectedSymptom.text}"
                    </div>
                </div>
            </div>
        )
    }

    // Get red flags from the selected symptom (already have it from selectedSymptom)
    const symptomRedFlags = selectedSymptom.redFlags || []

    return (
        <div className="h-full overflow-y-auto p-4">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                    {selectedSymptom.text}
                </h2>
                <div className="text-gray-600 mt-1">
                    Algorithm: {algorithm.id}
                </div>
            </div>

            {/* Map through algorithm cards */}
            <div className="space-y-4">
                {algorithm.options?.map((card, index) => {
                    // For red flag cards, use the symptom's red flags
                    const answerOptions = card.type === 'rf'
                        ? symptomRedFlags.map(flag => ({
                            text: flag.text || '',
                            disposition: [],
                            next: null,
                            selectAll: false
                        }))
                        : card.answerOptions || []

                    return (
                        <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
                            {/* Card Header */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        Step {index + 1}
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                                        {card.type}
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800">
                                    {card.text}
                                </h3>
                            </div>

                            {/* Question Options */}
                            {card.questionOptions && card.questionOptions.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        Check if any apply:
                                    </h4>
                                    <ul className="space-y-1">
                                        {card.questionOptions.map((qOpt, qIndex) => (
                                            <li key={qIndex} className="text-gray-600">
                                                • {qOpt.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Answer Options */}
                            {answerOptions.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        {card.type === 'rf' ? 'Red Flags:' : 'Select an answer:'}
                                    </h4>
                                    <div className="space-y-2">
                                        {answerOptions.map((answer, aIndex) => (
                                            <div key={aIndex} className="border rounded p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{answer.text}</span>
                                                    {answer.selectAll && (
                                                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                                                            Selects All
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Dispositions (only for non-rf cards) */}
                                                {card.type !== 'rf' && answer.disposition && answer.disposition.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t">
                                                        <div className="text-xs text-gray-500 mb-1">
                                                            Result:
                                                        </div>
                                                        {answer.disposition.map((disp, dIndex) => (
                                                            <div key={dIndex} className="text-sm">
                                                                <span className="font-medium">
                                                                    {disp.type || "UNKNOWN"}:
                                                                </span>{" "}
                                                                {disp.text || "No description"}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Next Step (only for non-rf cards) */}
                                                {card.type !== 'rf' && answer.next !== null && answer.next !== undefined && (
                                                    <div className="mt-2 text-xs text-gray-500">
                                                        {Array.isArray(answer.next) ? (
                                                            answer.next.length > 0 ? (
                                                                <span>Next: Steps {answer.next.map(n => n + 1).join(', ')}</span>
                                                            ) : (
                                                                <span>Next: No specific steps</span>
                                                            )
                                                        ) : (
                                                            <span>Next: Step {answer.next + 1}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Show message if no answer options */}
                            {answerOptions.length === 0 && (
                                <div className="text-sm text-gray-500 italic">
                                    {card.type === 'rf'
                                        ? 'No red flags defined for this symptom'
                                        : 'No answer options defined for this step'
                                    }
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}