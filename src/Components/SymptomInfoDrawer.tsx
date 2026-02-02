import { X } from 'lucide-react';
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

    const handleGuidelineClick = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: any,
        index: number
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
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed bottom-0 left-0 right-0 bg-themewhite rounded-t-3xl z-50 max-h-[85vh] flex flex-col md:hidden animate-slideInUp">
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>

                {/* Header */}
                <div className="px-6 border-b border-tertiary/10 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">{selectedSymptom.icon}</div>
                            <h2 className="text-xl font-semibold text-primary">{selectedSymptom.text}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                            aria-label="Close"
                        >
                            <X size={24} className="text-tertiary" />
                        </button>
                    </div>
                    {selectedSymptom.description && (
                        <p className="text-sm text-secondary">{selectedSymptom.description}</p>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-6 py-4">
                    {/* Differentials */}
                    {selectedSymptom.DDX && selectedSymptom.DDX.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-base font-semibold text-primary mb-3">Differentials</h3>
                            <div className="space-y-2">
                                {selectedSymptom.DDX.map((ddx, index) => (
                                    <div
                                        key={`ddx-${index}`}
                                        onClick={() => handleGuidelineClick('DDX', ddx, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{ddx.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Guidelines */}
                    {(selectedSymptom.gen?.length > 0 || selectedSymptom.medcom?.length > 0 || selectedSymptom.stp?.length > 0) && (
                        <div>
                            <h3 className="text-base font-semibold text-primary mb-3">Guidelines</h3>
                            <div className="space-y-2">
                                {selectedSymptom.gen?.map((item, index) => (
                                    <div
                                        key={`gen-${index}`}
                                        onClick={() => handleGuidelineClick('gen', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                                {selectedSymptom.medcom?.map((item, index) => (
                                    <div
                                        key={`medcom-${index}`}
                                        onClick={() => handleGuidelineClick('medcom', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                                {selectedSymptom.stp?.map((item, index) => (
                                    <div
                                        key={`stp-${index}`}
                                        onClick={() => handleGuidelineClick('stp', item, index)}
                                        className="p-3 rounded-lg border border-themewhite2/50 cursor-pointer hover:bg-themewhite2 active:scale-[0.98] transition-all"
                                    >
                                        <div className="text-sm text-secondary">{item.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
