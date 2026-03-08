import { MedicationPage } from './MedicationPage'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'

function MedicationListItem({ medication, onClick }: {
    medication: medListTypes
    onClick: () => void
}) {
    return (
        <div
            className="flex flex-col py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md"
            onClick={onClick}
        >
            <div className="text-[10pt] font-normal text-primary">
                {medication.icon}
            </div>
            <div className="text-tertiary text-[9pt]">
                {medication.text}
            </div>
        </div>
    )
}

interface MedicationContentProps {
    selectedMedication: medListTypes | null
    onMedicationSelect: (medication: medListTypes) => void
    tc3Mode: boolean
}

/**
 * Pure content component for medication list/detail.
 * All state is managed by the parent (KnowledgeBaseDrawer).
 */
export function MedicationContent({
    selectedMedication,
    onMedicationSelect,
    tc3Mode,
}: MedicationContentProps) {
    const list = tc3Mode ? tc3MedList : medList

    if (selectedMedication) {
        return (
            <div className="h-full overflow-y-auto px-4 pb-4">
                <MedicationPage medication={selectedMedication} />
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto px-4 pb-4">
            {list.map((medication, index) => (
                <MedicationListItem
                    key={`med-${index}`}
                    medication={medication}
                    onClick={() => onMedicationSelect(medication)}
                />
            ))}
        </div>
    )
}
