// CategoryList.tsx - REFACTORED with proper ref placement
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'
import { useState, useEffect } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'

interface CategoryListProps {
    selectedCategory: catDataTypes | null
    selectedSymptom: subCatDataTypes | null
    selectedMedication: medListTypes | null
    selectedGuideline: {
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        id: number;
        symptomId: number;
    } | null
    onCategorySelect: (category: catDataTypes | null) => void
    onSymptomSelect: (symptom: subCatDataTypes | null, category?: catDataTypes | null) => void
    onMedicationSelect: (medication: medListTypes) => void
    onGuidelineSelect: (guideline: {
        type: 'gen' | 'medcom' | 'stp' | 'DDX'
        id: number;
        symptomId: number
    } | null) => void
    // New swipe props
    isSwiping?: boolean
    swipeDirection?: 'left' | 'right' | null
    swipeProgress?: number
}

export function CategoryList({
    selectedCategory,
    selectedSymptom,
    selectedGuideline,
    onCategorySelect,
    onSymptomSelect,
    onGuidelineSelect,
    isSwiping = false,
    swipeDirection = null,
    swipeProgress = 0,
}: CategoryListProps) {
    const [selectedSymptomId, setSelectedSymptomId] = useState<number | null>(null)
    const [parentRef] = useAutoAnimate({ duration: 200, easing: 'ease-in-out' })

    // Sync internal state with external state
    useEffect(() => {
        if (selectedSymptom) {
            setSelectedSymptomId(selectedSymptom.id)
        } else {
            setSelectedSymptomId(null)
        }
    }, [selectedSymptom])

    // Handle guideline click
    const handleGuidelineClick = (type: 'gen' | 'medcom' | 'stp' | 'DDX', id: number, symptomId: number) => {
        if (selectedGuideline?.type === type && selectedGuideline.id === id && selectedGuideline.symptomId === symptomId) {
            onGuidelineSelect(null)
        } else {
            onGuidelineSelect({ type, id, symptomId })
        }
    }

    return (
        <div ref={parentRef} className="h-full w-full">
            {(selectedSymptom || selectedCategory) && typeof window !== 'undefined' && window.innerWidth < 768 && (
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 opacity-30">
                    <div className="flex items-center space-x-1 animate-pulse">
                        <div className="w-1 h-1 bg-themeblue3 rounded-full"></div>
                        <div className="w-1 h-1 bg-themeblue3 rounded-full"></div>
                        <div className="w-1 h-1 bg-themeblue3 rounded-full"></div>
                        <div className="text-[8px] text-themeblue3 ml-1">← swipe back</div>
                    </div>
                </div>
            )}
            {/* SAFETY CHECK */}
            {(!catData || !Array.isArray(catData)) ? (
                <div key="error" className="h-full flex items-center justify-center text-primary">
                    Error loading category data
                </div>
            ) : (
                <>
                    {/* VIEW 1: Main View - Show all categories (default) */}
                    {!selectedCategory && !selectedSymptom && (
                        <div key="main" className="flex flex-col h-full w-full">
                            <div className="flex-1 overflow-y-auto pb-4 bg-themewhite">
                                {catData.map((category) => (
                                    category && (
                                        <div
                                            key={category.id}
                                            className="flex py-3 px-2 w-full rounded-md wrap-normal border-b border-themewhite2/90 cursor-pointer"
                                            onClick={() => onCategorySelect(category)}
                                        >
                                            <div className="md:w-10 w-10 flex text-[10pt] font-normal items-center justify-center shrink-0 bg-themeblue3 text-white rounded-full">
                                                {category.icon}
                                            </div>
                                            <div className="h-full w-full p-[4px_10px_4px_10px] text-primary text-[11pt] flex items-center">
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
                                            className="flex py-3 px-2 w-full rounded-sm wrap-normal border-b border-themewhite2/70 cursor-pointer"
                                            onClick={() => {
                                                console.log("📝 Clicking symptom:", symptom.text, "from category:", selectedCategory.text)
                                                onSymptomSelect(symptom, selectedCategory)
                                            }}
                                        >
                                            <div className="md:w-10 w-10 flex text-[10pt] font-normal items-center justify-center shrink-0 bg-themeblue3 text-white rounded-full">
                                                {symptom.icon || "?"}
                                            </div>
                                            <div className="h-full w-full rounded-r-md bg-themewhite text-primary text-[11pt] p-[4px_10px_4px_10px] flex items-center">
                                                {symptom.text || "Untitled Symptom"}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: Questions View - Show only selected symptom with guidelines */}
                    {selectedSymptom && (
                        <div key="sym" className="flex flex-col h-full w-full md:opacity-100 opacity-0">
                            {/* Selected Symptom Card */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="flex flex-col backdrop-blur-2xl rounded-md bg-themewhite2 border border-themewhite2/10 h-full">
                                    {/* Symptom Header */}
                                    <div className="flex min-h-11 shrink-0">
                                        <div className="w-10 flex text-[10pt] font-normal items-center justify-center shrink-0 
                                                      bg-themeblue3 text-white rounded-tl-md">
                                            {selectedSymptom.icon || "?"}
                                        </div>
                                        <div className="flex text-[10pt] text-primary font-normal items-center w-full pl-2">
                                            {selectedSymptom.text || "Untitled Symptom"}
                                        </div>
                                    </div>

                                    {/* Guidelines Section */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {/* DDX Section */}
                                        {selectedSymptom.DDX && selectedSymptom.DDX.length > 0 && (
                                            <div className="mb-6">
                                                <div className="text-xs font-normal text-primary mb-3">Differential Diagnoses</div>
                                                <div className="space-y-2">
                                                    {selectedSymptom.DDX.map((ddxItem, index) => (
                                                        ddxItem && ddxItem.text && (
                                                            <div
                                                                key={`ddx-${index}`}
                                                                onClick={() => handleGuidelineClick('DDX', index, selectedSymptom.id)}
                                                                className={`text-xs px-2 py-2 rounded border transition-all duration-300 cursor-pointer
                                                                    ${selectedGuideline?.type === 'DDX' &&
                                                                        selectedGuideline?.id === index &&
                                                                        selectedGuideline?.symptomId === selectedSymptom.id
                                                                        ? 'border-themeblue3/40 bg-themeblue3/10 text-secondary shadow-sm'
                                                                        : 'border border-themewhite2/10 text-secondary bg-themewhite3 hover:themewhite2/80 hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="font-normal flex items-start">
                                                                    <span className={`mr-2 ${selectedGuideline?.type === 'DDX' &&
                                                                        selectedGuideline?.id === index &&
                                                                        selectedGuideline?.symptomId === selectedSymptom.id
                                                                        ? 'text-purple-600' : 'text-gray-400'}`}>
                                                                    </span>
                                                                    {ddxItem.text}
                                                                </div>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Medcom Guidelines */}
                                        {selectedSymptom.medcom && selectedSymptom.medcom.length > 0 && selectedSymptom.medcom.some(g => g && g.text) && (
                                            <div className="mb-6">
                                                <div className="text-xs font-normal text-primary mb-3">MEDCOM Regulation 40-50</div>
                                                <div className="space-y-1">
                                                    {selectedSymptom.medcom.map(guideline => (
                                                        guideline && guideline.text && (
                                                            <div
                                                                key={`medcom-${guideline.id || guideline.text}`}
                                                                onClick={() => handleGuidelineClick('medcom', guideline.id || 0, selectedSymptom.id)}
                                                                className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
                                                                    ${selectedGuideline?.type === 'medcom' &&
                                                                        selectedGuideline?.id === guideline.id &&
                                                                        selectedGuideline?.symptomId === selectedSymptom.id
                                                                        ? 'border-themeblue3/40 bg-themeblue3/10 text-primary shadow-sm'
                                                                        : 'border border-themewhite2/10 text-secondary bg-themewhite3 hover:themewhite2/80 hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="font-normal">{guideline.text}</div>
                                                                {guideline.icon && (
                                                                    <div className="text-[10px] text-tertiary mt-2">{guideline.icon}</div>
                                                                )}
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* STP Guidelines */}
                                        {selectedSymptom.stp && selectedSymptom.stp.length > 0 && selectedSymptom.stp.some(g => g && g.text) && (
                                            <div className="mb-6">
                                                <div className="text-xs font-normal text-primary mb-3">STP 8-68W13-SM-TG:</div>
                                                <div className="space-y-3">
                                                    {selectedSymptom.stp.map(guideline => (
                                                        guideline && guideline.text && (
                                                            <div
                                                                key={`stp-${guideline.id || guideline.text}`}
                                                                onClick={() => handleGuidelineClick('stp', guideline.id || 0, selectedSymptom.id)}
                                                                className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
                                                                    ${selectedGuideline?.type === 'stp' &&
                                                                        selectedGuideline?.id === guideline.id &&
                                                                        selectedGuideline?.symptomId === selectedSymptom.id
                                                                        ? 'border-themeblue3/40 bg-themeblue3/10 text-secondary shadow-sm'
                                                                        : 'border border-themewhite2/10 text-secondary bg-themewhite3 hover:themewhite2/80 hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="font-normal">{guideline.text}</div>
                                                                {guideline.icon && (
                                                                    <div className="text-[10px] text-tertiary mt-2">{guideline.icon}</div>
                                                                )}
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* GEN Guidelines */}
                                        {selectedSymptom.gen && selectedSymptom.gen.length > 0 && selectedSymptom.gen.some(g => g && g.text) && (
                                            <div className="">
                                                <div className="text-xs font-semibold text-gray-600 mb-3">Exercept:</div>
                                                <div className="space-y-3">
                                                    {selectedSymptom.gen.map((guideline, index) => (
                                                        guideline && guideline.text && (
                                                            <div
                                                                key={`gen-${index}`}
                                                                onClick={() => handleGuidelineClick('gen', index + 1, selectedSymptom.id)}
                                                                className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
                                                                    ${selectedGuideline?.type === 'gen' &&
                                                                        selectedGuideline?.id === index + 1 &&
                                                                        selectedGuideline?.symptomId === selectedSymptom.id
                                                                        ? 'border-themeblue3/40 bg-themeblue3/10 text-secondary shadow-sm'
                                                                        : 'border border-themewhite2/10 text-secondary/70 bg-themewhite/50 hover:themewhite2/80 hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="font-normal">{guideline.text}</div>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}