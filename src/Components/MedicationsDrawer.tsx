import { X, ChevronLeft } from 'lucide-react';
import { MedicationPage } from './MedicationPage';
import { BaseDrawer } from './BaseDrawer';
import { medList, type medListTypes } from '../Data/MedData';

interface MedicationsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedMedication: medListTypes | null;
    onMedicationSelect: (medication: medListTypes | null) => void;
    isMobile?: boolean;
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
const MedicationsContent = ({ selectedMedication, onMedicationSelect, onClose }: {
    selectedMedication: medListTypes | null;
    onMedicationSelect: (med: medListTypes | null) => void;
    onClose: () => void;
}) => (
    <>
        {/* Drag Handle - Only visible on mobile */}
        <div className="flex justify-center pt-3 pb-2 md:hidden" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
        </div>

        {/* Header */}
        <div className="px-6 border-b border-tertiary/10 py-4 md:py-5" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {selectedMedication && (
                        <button
                            onClick={() => onMedicationSelect(null)}
                            className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                            aria-label="Back to list"
                        >
                            <ChevronLeft size={24} className="text-tertiary" />
                        </button>
                    )}
                    <h2 className="text-xl font-semibold text-primary md:text-2xl truncate">
                        {selectedMedication ? selectedMedication.text : 'Medications'}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all shrink-0"
                    aria-label="Close"
                >
                    <X size={24} className="text-tertiary" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100dvh-80px)] md:overflow-y-auto md:h-[60vh]">
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
    </>
);

export function MedicationsDrawer({
    isVisible,
    onClose,
    selectedMedication,
    onMedicationSelect,
    isMobile: externalIsMobile,
}: MedicationsDrawerProps) {
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            isMobile={externalIsMobile}
            partialHeight="40dvh"
            fullHeight="90dvh"
            backdropOpacity={0.3}
            desktopPosition="left"
            desktopContainerMaxWidth="max-w-315"
            desktopMaxWidth="max-w-lg"
            desktopPanelPadding=""
            mobilePartialPadding="0.5rem"
        >
            {(handleClose) => (
                <MedicationsContent
                    selectedMedication={selectedMedication}
                    onMedicationSelect={onMedicationSelect}
                    onClose={handleClose}
                />
            )}
        </BaseDrawer>
    );
}
