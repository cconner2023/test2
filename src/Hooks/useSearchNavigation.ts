// Hooks/useSearchNavigation.ts - FINAL COMPLETE VERSION
import { useState, useEffect, useCallback, useRef } from 'react'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import { type medListTypes } from '../Data/MedData'

export type OverView = 'ADTMC' | 'medications'
export type ViewState = 'main' | 'subcategory' | 'questions' | 'medications'
export type GuidelineType = 'gen' | 'medcom' | 'stp' | 'DDX'

interface UseSearchNavigationProps {
    onClearSearch?: () => void
}

export function useSearchNavigation({ onClearSearch }: UseSearchNavigationProps = {}) {
    const [viewState, setViewState] = useState<ViewState>('main')
    const [selectedCategory, setSelectedCategory] = useState<catDataTypes | null>(null)
    const [selectedSymptom, setSelectedSymptom] = useState<subCatDataTypes | null>(null)
    const [selectedMedication, setSelectedMedication] = useState<medListTypes | null>(null)
    const [selectedGuideline, setSelectedGuideline] = useState<{
        type: GuidelineType;
        id: number;
        symptomId: number;
    } | null>(null)

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    // Refs to avoid stale closures in callbacks
    const selectedCategoryRef = useRef<catDataTypes | null>(null)
    const selectedSymptomRef = useRef<subCatDataTypes | null>(null)
    const selectedMedicationRef = useRef<medListTypes | null>(null)

    // Sync refs with state
    useEffect(() => {
        selectedCategoryRef.current = selectedCategory
    }, [selectedCategory])

    useEffect(() => {
        selectedSymptomRef.current = selectedSymptom
    }, [selectedSymptom])

    useEffect(() => {
        selectedMedicationRef.current = selectedMedication
    }, [selectedMedication])

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const handleCategorySelect = useCallback((category: catDataTypes | null) => {
        console.log("🔄 handleCategorySelect:", category?.text || "null")
        if (category) {
            setSelectedCategory(category)
            setSelectedSymptom(null)
            setSelectedMedication(null)
            setSelectedGuideline(null)
            setViewState('subcategory')
        } else {
            setSelectedCategory(null)
            setViewState('main')
        }
    }, [])

    const handleSymptomSelect = useCallback((symptom: subCatDataTypes | null, category?: catDataTypes | null) => {
        console.log("🔄 handleSymptomSelect:", {
            symptom: symptom?.text || "null",
            providedCategory: category?.text || "none",
            currentCategoryRef: selectedCategoryRef.current?.text || "none"
        })

        if (symptom) {
            const parentCategory = category || selectedCategoryRef.current || catData.find(cat =>
                cat.contents?.some(content => content.id === symptom.id)
            )

            if (parentCategory) {
                console.log("  ↪ Using parent category:", parentCategory.text)
                setSelectedCategory(parentCategory)
                setSelectedSymptom(symptom)
                setSelectedMedication(null)
                setSelectedGuideline(null)
                setViewState('questions')
            } else {
                console.error("No parent category found for symptom:", symptom)
                setSelectedSymptom(symptom)
                setSelectedMedication(null)
                setSelectedGuideline(null)
                setViewState('questions')
            }
        } else {
            setSelectedSymptom(null)
            setSelectedMedication(null)
            setSelectedGuideline(null)
            setViewState('subcategory')
            // selectedCategory stays via the ref (and state)
        }
    }, [])
    const handleShowMedications = useCallback(() => {
        console.log("🔄 handleShowMedications")

        // Toggle view state
        setViewState(prev => {
            const newState = prev === 'medications' ? 'main' : 'medications'
            console.log(`  ↪ Toggling view: ${prev} → ${newState}`)
            return newState
        })

        // Always clear medication selection
        setSelectedMedication(null)

        // NEVER clear symptom/category/guideline here!
        // This preserves algorithm state

        // Clear search
        if (onClearSearch) {
            onClearSearch()
        }
    }, [onClearSearch])
    const handleMedicationSelect = useCallback((medication: medListTypes | null) => {
        console.log("🔄 handleMedicationSelect:", medication?.text || "null")
        if (medication === null) {
            setSelectedMedication(null)
            setViewState('medications')
        } else {
            setSelectedMedication(medication)
            setViewState('medications')
            if (onClearSearch) {
                onClearSearch()
            }
        }
    }, [onClearSearch])

    const handleGuidelineSelect = useCallback((guideline: { type: GuidelineType; id: number; symptomId: number } | null) => {
        if (guideline && selectedSymptomRef.current) {
            setSelectedGuideline(guideline)
        } else {
            setSelectedGuideline(null)
        }
    }, [])

    const handleSearchResultClick = useCallback((result: SearchResultType) => {
        if (result.type === 'category' && result.categoryId) {
            const category = catData.find(cat => cat.id === result.categoryId)
            if (category) {
                handleCategorySelect(category)
            }
        } else if (result.type === 'CC' && result.categoryId && result.contentId) {
            const category = catData.find(cat => cat.id === result.categoryId)
            const symptom = category?.contents.find(content => content.id === result.contentId)
            if (category && symptom) {
                setSelectedCategory(category)
                setSelectedSymptom(symptom)
                setSelectedMedication(null)
                setSelectedGuideline(null)
                setViewState('questions')
            }
        } else if (result.type === 'training' && result.categoryId && result.contentId && result.guidelineType) {
            const category = catData.find(cat => cat.id === result.categoryId)
            const symptom = category?.contents.find(content => content.id === result.contentId)
            if (category && symptom) {
                setSelectedCategory(category)
                setSelectedSymptom(symptom)
                setSelectedMedication(null)
                setSelectedGuideline({
                    type: result.guidelineType as GuidelineType,
                    id: result.guidelineId || 0,
                    symptomId: result.contentId || 0
                })
                setViewState('questions')
            }
        } else if (result.type === 'DDX' && result.categoryId && result.contentId && result.guidelineType) {
            const category = catData.find(cat => cat.id === result.categoryId)
            const symptom = category?.contents.find(content => content.id === result.contentId)
            if (category && symptom) {
                setSelectedCategory(category)
                setSelectedSymptom(symptom)
                setSelectedMedication(null)
                setSelectedGuideline({
                    type: result.guidelineType as GuidelineType,
                    id: result.guidelineId || 0,
                    symptomId: result.contentId || 0
                })
                setViewState('questions')
            }
        } else if (result.type === 'medication' && result.medData) {
            handleMedicationSelect(result.medData)
        }

        if (onClearSearch) {
            onClearSearch()
        }
    }, [handleCategorySelect, handleMedicationSelect, onClearSearch])

    const getDynamicTitle = (): { title: string; show: boolean } => {
        if (selectedMedicationRef.current) {
            return {
                title: selectedMedicationRef.current.text || "Medication Details",
                show: true
            };
        }
        if (viewState === 'questions' && selectedSymptomRef.current) {
            return {
                title: selectedSymptomRef.current.text || "Symptom Details",
                show: true
            };
        }
        if (viewState === 'subcategory' && selectedCategoryRef.current) {
            return {
                title: selectedCategoryRef.current.text || "Category",
                show: true
            };
        }
        if (viewState === 'medications') {
            return {
                title: "Medications",
                show: true
            };
        }
        return { title: "", show: false };
    }

    return {
        // State
        viewState,
        selectedCategory,
        selectedSymptom,
        selectedMedication,
        selectedGuideline,
        isMobile,

        // Handlers
        handleCategorySelect,
        handleSymptomSelect,
        handleMedicationSelect,
        handleShowMedications,
        handleGuidelineSelect,
        handleBackClick: null, // Removed - handled in useAppNavigation
        handleSearchResultClick,

        // Computed values
        dynamicTitle: getDynamicTitle()
    }
}