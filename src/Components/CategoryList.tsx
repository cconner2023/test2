// Components/CategoryList.tsx - Updated
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import { useState, useEffect } from 'react'
import { useAppAnimate } from '../Utilities/AnimationConfig'

// Guideline Item Component - Reusable for DDX, medcom, stp, gen
interface GuidelineItemProps {
    guideline: any
    type: 'DDX' | 'medcom' | 'stp' | 'gen'
    index: number
    keyPrefix: string
    onClick: () => void
}

function GuidelineItem({ guideline, keyPrefix, index, onClick }: GuidelineItemProps) {
    if (!guideline?.text) return null

    return (
        <div
            key={`${keyPrefix}-${guideline.id || index}`}
            onClick={onClick}
            className="mb-3 p-3 rounded border border-themewhite2/10 cursor-pointer hover:bg-themewhite2"
        >
            <div className="text-xs font-normal text-secondary">
                {guideline.text}
            </div>
        </div>
    )
}

interface CategoryListProps {
    selectedCategory: catDataTypes | null
    selectedSymptom: subCatDataTypes | null
    selectedGuideline: {
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        id: number;
        symptomId: number;
    } | null
    onNavigate: (result: SearchResultType) => void
}

export function CategoryList({
    selectedCategory,
    selectedSymptom,
    selectedGuideline,
    onNavigate,
}: CategoryListProps) {
    const [selectedSymptomId, setSelectedSymptomId] = useState<number | null>(null)
    const [parentRef] = useAppAnimate('fast')

    useEffect(() => {
        if (selectedSymptom) {
            setSelectedSymptomId(selectedSymptom.id)
        } else {
            setSelectedSymptomId(null)
        }
    }, [selectedSymptom])

    // Helper to convert category to SearchResultType
    const categoryToResult = (category: catDataTypes): SearchResultType => ({
        type: 'category',
        id: category.id,
        icon: category.icon,
        text: category.text,
        data: { categoryRef: category }
    })

    // Helper to convert symptom to SearchResultType
    const symptomToResult = (symptom: subCatDataTypes, category: catDataTypes): SearchResultType => ({
        type: 'CC',
        id: symptom.id,
        icon: symptom.icon,
        text: symptom.text,
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom
        }
    })

    // Helper to convert guideline to SearchResultType
    const guidelineToResult = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: any,
        index: number,
        symptom: subCatDataTypes,
        category: catDataTypes
    ): SearchResultType => ({
        type: type === 'DDX' ? 'DDX' : 'training',
        id: item.id || index,
        icon: item.icon || (type === 'DDX' ? 'DDX' : '📝'),
        text: item.text,
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom,
            guidelineType: type === 'DDX' ? undefined : type,
            guidelineId: item.id || index
        }
    })

    return (
        <div ref={parentRef} className="h-full w-full">
            {(!catData || !Array.isArray(catData)) ? (
                <div key="error" className="h-full flex items-center justify-center text-primary">
                    Error loading category data
                </div>
            ) : (
                <>
                    {!selectedCategory && !selectedSymptom && (
                        <div key="main" className="flex flex-col h-full w-full">
                            <div className="flex-1 overflow-y-auto pb-4 bg-themewhite">
                                {catData.map((category) => (
                                    category && (
                                        <div
                                            key={category.id}
                                            className="flex py-3 px-2 w-full rounded-md border-b border-themewhite2/90 cursor-pointer hover:bg-themewhite2 min-w-0"
                                            onClick={() => onNavigate(categoryToResult(category))}
                                        >
                                            <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                                {category.icon}
                                            </div>
                                            <div className="h-full flex-1 min-w-0 p-[4px_10px_4px_10px] text-primary text-[10pt] flex items-center truncate">
                                                {category.text}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: Subcategory View - Show only selected category's symptoms */}
                    {selectedCategory && !selectedSymptom && (
                        <div key="cat" className="flex flex-col h-full w-full">
                            <div className="h-full flex-1 overflow-y-auto pb-4 bg-themewhite">
                                {selectedCategory.contents?.map((symptom) => (
                                    symptom && (
                                        <div
                                            key={symptom.id}
                                            className="flex py-3 px-2 w-full rounded-sm border-b border-themewhite2/70 cursor-pointer  min-w-0"
                                            onClick={() => onNavigate(symptomToResult(symptom, selectedCategory))}
                                        >
                                            <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                                {symptom.icon || "?"}
                                            </div>
                                            <div className="h-full flex-1 min-w-0 bg-themewhite text-primary text-[10pt] p-[4px_10px_4px_10px] flex items-center truncate">
                                                {symptom.text || "Untitled Symptom"}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: Questions View - Show only selected symptom with guidelines */}
                    {selectedSymptom && selectedCategory && (
                        <div key="sym" className="flex flex-col h-full w-full">
                            {/* Guidelines Section */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {/* Symptom Header */}
                                <div className="mb-4 pb-4 border-b border-themewhite2">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="px-4 py-3 flex text-[12pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                            {selectedSymptom.icon}
                                        </div>
                                        <h2 className="text-[11pt] font-semibold text-primary flex-1 min-w-0">
                                            {selectedSymptom.text}
                                        </h2>
                                    </div>
                                    {selectedSymptom.description && (
                                        <p className="text-[9.5pt] text-secondary leading-relaxed mt-2 pl-1">
                                            {selectedSymptom.description}
                                        </p>
                                    )}
                                </div>

                                {/* DDX Section */}
                                {selectedSymptom.DDX && selectedSymptom.DDX.length > 0 && (
                                    <div className="mb-3">
                                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide mb-2 pl-1">
                                            Differentials
                                        </h3>
                                        {selectedSymptom.DDX.map((ddxItem, index) => (
                                            <GuidelineItem
                                                key={`ddx-${index}`}
                                                guideline={ddxItem}
                                                type="DDX"
                                                index={index}
                                                keyPrefix="ddx"
                                                onClick={() => onNavigate(guidelineToResult('DDX', ddxItem, index, selectedSymptom, selectedCategory))}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* MEDCOM Training Section */}
                                {selectedSymptom.medcom && selectedSymptom.medcom.length > 0 && (
                                    <div className="mb-3">
                                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide mb-2 pl-1">
                                            MEDCOM Training
                                        </h3>
                                        {selectedSymptom.medcom.map((guideline, index) => (
                                            <GuidelineItem
                                                key={`medcom-${guideline.id || index}`}
                                                guideline={guideline}
                                                type="medcom"
                                                index={index}
                                                keyPrefix="medcom"
                                                onClick={() => onNavigate(guidelineToResult('medcom', guideline, index, selectedSymptom, selectedCategory))}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* STP Training Section */}
                                {selectedSymptom.stp && selectedSymptom.stp.length > 0 && (
                                    <div className="mb-3">
                                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide mb-2 pl-1">
                                            STP Training
                                        </h3>
                                        {selectedSymptom.stp.map((guideline, index) => (
                                            <GuidelineItem
                                                key={`stp-${guideline.id || index}`}
                                                guideline={guideline}
                                                type="stp"
                                                index={index}
                                                keyPrefix="stp"
                                                onClick={() => onNavigate(guidelineToResult('stp', guideline, index, selectedSymptom, selectedCategory))}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* General Guidelines Section */}
                                {selectedSymptom.gen && selectedSymptom.gen.length > 0 && (
                                    <div className="mb-3">
                                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide mb-2 pl-1">
                                            General Guidelines
                                        </h3>
                                        {selectedSymptom.gen.map((guideline, index) => (
                                            <GuidelineItem
                                                key={`gen-${index}`}
                                                guideline={guideline}
                                                type="gen"
                                                index={index}
                                                keyPrefix="gen"
                                                onClick={() => onNavigate(guidelineToResult('gen', guideline, index, selectedSymptom, selectedCategory))}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}