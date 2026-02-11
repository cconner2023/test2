import { MedicationPage } from './MedicationPage';
import { BaseDrawer } from './BaseDrawer';
import { medList, type medListTypes } from '../Data/MedData';

interface MedicationsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedMedication: medListTypes | null;
    onMedicationSelect: (medication: medListTypes | null) => void;
}

function MedicationListItem({ medication, isSelected, onClick }: {
    medication: medListTypes;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <div
            className={`flex flex-col py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md ${isSelected ? 'bg-themewhite2' : ''}`}
            onClick={onClick}
        >
            <div className="text-[10pt] font-normal text-primary">
                {medication.icon}
            </div>
            <div className="text-tertiary text-[9pt]">
                {medication.text}
            </div>
        </div>
    );
}

// Shared content component for both mobile and desktop
const MedicationsContent = ({ selectedMedication, onMedicationSelect }: {
    selectedMedication: medListTypes | null;
    onMedicationSelect: (med: medListTypes | null) => void;
}) => (
    <div className="overflow-y-auto h-full">
        {selectedMedication ? (
            <MedicationPage medication={selectedMedication} />
        ) : (
            <div className="px-2 pb-4">
                {medList.map((medication, index) => (
                    <MedicationListItem
                        key={`med-${index}`}
                        medication={medication}
                        isSelected={false}
                        onClick={() => onMedicationSelect(medication)}
                    />
                ))}
            </div>
        )}
    </div>
);

export function MedicationsDrawer({
    isVisible,
    onClose,
    selectedMedication,
    onMedicationSelect,
}: MedicationsDrawerProps) {
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            desktopPosition="left"
            header={{
                title: selectedMedication ? selectedMedication.text : 'Medications',
                showBack: !!selectedMedication,
                onBack: () => onMedicationSelect(null),
            }}
        >
            <MedicationsContent
                selectedMedication={selectedMedication}
                onMedicationSelect={onMedicationSelect}
            />
        </BaseDrawer>
    );
}
