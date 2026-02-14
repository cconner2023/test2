import { X } from 'lucide-react';
import { BaseDrawer } from './BaseDrawer';
import { SymptomGuidelines } from '../BasePage/CategoryList';
import type { GuidelineItemData } from '../BasePage/CategoryList';
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../../Types/CatTypes';

interface SymptomInfoDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedSymptom: subCatDataTypes | null;
    selectedCategory: catDataTypes | null;
    onNavigate: (result: SearchResultType) => void;
}

export function SymptomInfoDrawer({
    isVisible,
    onClose,
    selectedSymptom,
    selectedCategory,
    onNavigate
}: SymptomInfoDrawerProps) {

    if (!isVisible || !selectedSymptom || !selectedCategory) return null;

    // Helper to convert guideline to SearchResultType (matches CategoryList)
    const guidelineToResult = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: GuidelineItemData,
        index: number,
        symptom: subCatDataTypes,
        category: catDataTypes
    ): SearchResultType => ({
        type: type === 'DDX' ? 'DDX' : 'training',
        id: item.id || index,
        icon: item.icon || (type === 'DDX' ? 'DDX' : '\u{1F4DD}'),
        text: item.text ?? '',
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom,
            guidelineType: type === 'DDX' ? undefined : type,
            guidelineId: item.id || index
        }
    });

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            mobileOnly={true}
            mobileClassName="flex flex-col"
        >
            {(handleClose) => (
                <>
                    {/* Drag Handle + Close */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="flex-1" />
                        <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                        <div className="flex-1 flex justify-end">
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                                aria-label="Close"
                            >
                                <X size={20} className="text-tertiary" />
                            </button>
                        </div>
                    </div>

                    {/* Content — reuses SymptomGuidelines card layout */}
                    <div className="overflow-y-auto flex-1 px-4 pb-4">
                        <SymptomGuidelines
                            symptom={selectedSymptom}
                            category={selectedCategory}
                            onNavigate={(result) => {
                                onNavigate(result);
                                handleClose();
                            }}
                            guidelineToResult={guidelineToResult}
                        />
                    </div>
                </>
            )}
        </BaseDrawer>
    );
}
