import { useState, useCallback } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { MedicationPage } from './MedicationPage';
import { BaseDrawer } from './BaseDrawer';
import { medList, type medListTypes } from '../Data/MedData';
import { tc3MedList } from '../Data/TC3MedData';
import { useSwipeBack } from '../Hooks/useSwipeBack';
import { useAuthStore } from '../stores/useAuthStore';

interface MedicationsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedMedication: medListTypes | null;
    onMedicationSelect: (medication: medListTypes | null) => void;
}

function MedicationListItem({ medication, onClick }: {
    medication: medListTypes;
    onClick: () => void;
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
    );
}

export function MedicationsDrawer({
    isVisible,
    onClose,
    selectedMedication,
    onMedicationSelect,
}: MedicationsDrawerProps) {
    const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false;
    const [selectedTC3Med, setSelectedTC3Med] = useState<medListTypes | null>(null);

    const activeMed = tc3Mode ? selectedTC3Med : selectedMedication;

    const handleBack = useCallback(() => {
        if (tc3Mode) {
            setSelectedTC3Med(null);
        } else {
            onMedicationSelect(null);
        }
    }, [tc3Mode, onMedicationSelect]);

    const swipeHandlers = useSwipeBack(activeMed ? handleBack : undefined, !!activeMed);

    const handleClose = useCallback(() => {
        setSelectedTC3Med(null);
        onClose();
    }, [onClose]);

    const headerTitle = tc3Mode
        ? (selectedTC3Med ? selectedTC3Med.text : 'TC3 Medications')
        : (selectedMedication ? selectedMedication.text : 'Medications');

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            mobileClassName="flex flex-col"
        >
            {(drawerClose) => (
                <>
                    {/* Drag Handle + Close */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="flex-1 flex items-center gap-2">
                            <div
                                className="shrink-0 overflow-hidden transition-all duration-200"
                                style={{
                                    width: activeMed ? 36 : 0,
                                    opacity: activeMed ? 1 : 0,
                                }}
                            >
                                <button
                                    onClick={handleBack}
                                    className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                                    aria-label="Go back"
                                >
                                    <ChevronLeft size={20} className="text-tertiary" />
                                </button>
                            </div>
                            <h2 className="hidden md:block text-lg font-normal text-primary truncate">
                                {headerTitle}
                            </h2>
                        </div>
                        <div className="w-14 h-1.5 rounded-full bg-tertiary/30 md:hidden" />
                        <div className="flex-1 flex justify-end">
                            <button
                                onClick={drawerClose}
                                className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                                aria-label="Close"
                            >
                                <X size={20} className="text-tertiary" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {tc3Mode ? (
                        <div className="overflow-y-auto flex-1 px-4 pb-4" {...(selectedTC3Med ? swipeHandlers : {})}>
                            {selectedTC3Med ? (
                                <MedicationPage medication={selectedTC3Med} />
                            ) : (
                                tc3MedList.map((medication, index) => (
                                    <MedicationListItem
                                        key={`tc3-med-${index}`}
                                        medication={medication}
                                        onClick={() => setSelectedTC3Med(medication)}
                                    />
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1 px-4 pb-4" {...(selectedMedication ? swipeHandlers : {})}>
                            {selectedMedication ? (
                                <MedicationPage medication={selectedMedication} />
                            ) : (
                                medList.map((medication, index) => (
                                    <MedicationListItem
                                        key={`med-${index}`}
                                        medication={medication}
                                        onClick={() => onMedicationSelect(medication)}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </>
            )}
        </BaseDrawer>
    );
}
