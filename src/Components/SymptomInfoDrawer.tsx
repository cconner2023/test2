import { X } from 'lucide-react';
import { BaseDrawer } from './BaseDrawer';
import { HeaderPill, PillButton } from './HeaderPill';
import { SymptomGuidelines } from './CategoryList';
import type { GuidelineItemData } from './CategoryList';
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes';

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
            header={{
                title: selectedSymptom.text || 'Symptom Info',
                rightContent: (
                    <HeaderPill>
                        <PillButton icon={X} onClick={onClose} label="Close" />
                    </HeaderPill>
                ),
                hideDefaultClose: true,
            }}
        >
            <div className="overflow-y-auto flex-1 px-4 pb-4">
                <SymptomGuidelines
                    symptom={selectedSymptom}
                    category={selectedCategory}
                    onNavigate={onNavigate}
                    guidelineToResult={guidelineToResult}
                />
            </div>
        </BaseDrawer>
    );
}
