import { X } from 'lucide-react';
import { BaseDrawer } from './BaseDrawer';
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes';

interface SymptomInfoDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    selectedSymptom: subCatDataTypes | null;
    selectedCategory: catDataTypes | null;
    onNavigate: (result: SearchResultType) => void;
}

// Section icon mapping for visual consistency (shared with CategoryList)
function getSectionIcon(key: string): string {
    switch (key) {
        case 'gen': return '📋';
        case 'DDX': return '🔍';
        case 'medcom': return '🎖️';
        case 'stp': return '📖';
        default: return '📝';
    }
}

// Reusable guideline item for the mobile drawer
function DrawerGuidelineItem({
    text,
    onClick,
}: {
    text: string | undefined;
    onClick: () => void;
}) {
    if (!text) return null;
    return (
        <div
            onClick={onClick}
            className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
        >
            <div className="text-sm text-secondary">{text}</div>
        </div>
    );
}

export function SymptomInfoDrawer({
    isVisible,
    onClose,
    selectedSymptom,
    selectedCategory,
    onNavigate
}: SymptomInfoDrawerProps) {

    if (!isVisible || !selectedSymptom || !selectedCategory) return null;

    const handleGuidelineClick = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: any,
        index: number,
        closeDrawer: () => void
    ) => {
        onNavigate({
            type: type === 'DDX' ? 'DDX' : 'training',
            id: item.id || index,
            icon: item.icon || (type === 'DDX' ? 'DDX' : '📝'),
            text: item.text,
            data: {
                categoryId: selectedCategory.id,
                symptomId: selectedSymptom.id,
                categoryRef: selectedCategory,
                symptomRef: selectedSymptom,
                guidelineType: type === 'DDX' ? undefined : type,
                guidelineId: item.id || index
            }
        });
        closeDrawer();
    };

    // Check content availability
    const hasGenContent = selectedSymptom.gen?.some(item => item.text);
    const hasDDX = selectedSymptom.DDX && selectedSymptom.DDX.length > 0;
    const hasMedcom = selectedSymptom.medcom && selectedSymptom.medcom.length > 0;
    const hasStp = selectedSymptom.stp && selectedSymptom.stp.length > 0;
    const hasTraining = hasMedcom || hasStp;

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            backdropOpacity={0.3}
            mobileOnly={true}
            mobileClassName="flex flex-col"
        >
            {(handleClose) => (
                <>
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                    </div>

                    {/* Header — consistent with WriteNotePage + CategoryList header */}
                    <div className="px-6 border-b border-tertiary/10 py-4" data-drag-zone style={{ touchAction: 'none' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="px-3 py-2 flex text-[12pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                    {selectedSymptom.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-semibold text-primary leading-tight">
                                        {selectedSymptom.text}
                                    </h2>
                                    <span className="text-xs text-secondary mt-0.5 block">
                                        {selectedCategory.text}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all shrink-0"
                                aria-label="Close"
                            >
                                <X size={24} className="text-tertiary" />
                            </button>
                        </div>
                        {selectedSymptom.description && (
                            <p className="text-sm text-secondary leading-relaxed mt-1">
                                {selectedSymptom.description}
                            </p>
                        )}
                    </div>

                    {/* Content — ordered: General Info → Differentials → Training */}
                    <div className="overflow-y-auto flex-1 px-6 py-4">

                        {/* General Information */}
                        {hasGenContent && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm">{getSectionIcon('gen')}</span>
                                    <h3 className="text-xs font-semibold text-themeblue1 uppercase tracking-wide">
                                        General Information
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {selectedSymptom.gen?.map((item, index) =>
                                        item.text ? (
                                            <DrawerGuidelineItem
                                                key={`gen-${index}`}
                                                text={item.text}
                                                onClick={() => handleGuidelineClick('gen', item, index, handleClose)}
                                            />
                                        ) : null
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Differentials (DDx) */}
                        {hasDDX && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm">{getSectionIcon('DDX')}</span>
                                    <h3 className="text-xs font-semibold text-themeblue1 uppercase tracking-wide">
                                        Differentials (DDx)
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {selectedSymptom.DDX!.map((ddx, index) => (
                                        <DrawerGuidelineItem
                                            key={`ddx-${index}`}
                                            text={ddx.text}
                                            onClick={() => handleGuidelineClick('DDX', ddx, index, handleClose)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Training References — MEDCOM and STP separated */}
                        {hasTraining && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm">📚</span>
                                    <h3 className="text-xs font-semibold text-themeblue1 uppercase tracking-wide">
                                        Training References
                                    </h3>
                                </div>

                                {/* MEDCOM Training */}
                                {hasMedcom && (
                                    <div className="mb-4 ml-1">
                                        <h4 className="text-xs font-medium text-secondary mb-2 pl-1 flex items-center gap-1.5">
                                            <span>{getSectionIcon('medcom')}</span>
                                            MEDCOM
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedSymptom.medcom?.map((item, index) => (
                                                <DrawerGuidelineItem
                                                    key={`medcom-${index}`}
                                                    text={item.text}
                                                    onClick={() => handleGuidelineClick('medcom', item, index, handleClose)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* STP Training */}
                                {hasStp && (
                                    <div className="mb-4 ml-1">
                                        <h4 className="text-xs font-medium text-secondary mb-2 pl-1 flex items-center gap-1.5">
                                            <span>{getSectionIcon('stp')}</span>
                                            STP
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedSymptom.stp?.map((item, index) => (
                                                <DrawerGuidelineItem
                                                    key={`stp-${index}`}
                                                    text={item.text}
                                                    onClick={() => handleGuidelineClick('stp', item, index, handleClose)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </BaseDrawer>
    );
}
