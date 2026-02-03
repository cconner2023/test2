import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'

type ViewState = 'main' | 'subcategory' | 'questions'
type GuidelineType = 'gen' | 'medcom' | 'stp' | 'DDX'

interface NavigationState {
    viewState: ViewState;
    selectedCategory: catDataTypes | null;
    selectedSymptom: subCatDataTypes | null;
    selectedMedication: medListTypes | null;
    selectedGuideline: {
        type: GuidelineType;
        id: number;
        symptomId: number;
    } | null;
    // UI State (consolidated from App.tsx)
    isMenuOpen: boolean;
    showNoteImport: boolean;
    showSettings: boolean;
    isSearchExpanded: boolean;
    showSymptomInfo: boolean;
    showMedications: boolean;
}

export function useNavigation() {
    const [state, setState] = useState<NavigationState>({
        viewState: 'main',
        selectedCategory: null,
        selectedSymptom: null,
        selectedMedication: null,
        selectedGuideline: null,
        isMenuOpen: false,
        showNoteImport: false,
        showSettings: false,
        isSearchExpanded: false,
        showSymptomInfo: false,
        showMedications: false
    })
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])


    const handleNavigation = useCallback((result: SearchResultType) => {
        console.log("🔄 Navigation to:", result.type, result.text)

        switch (result.type) {
            case 'category':
                const category = result.data?.categoryRef || catData.find(c => c.id === result.id)
                if (category) {
                    setState(prev => ({
                        ...prev,
                        viewState: 'subcategory',
                        selectedCategory: category,
                        selectedSymptom: null,
                        selectedMedication: null,
                        selectedGuideline: null,
                        isSearchExpanded: false
                    }))
                }
                break

            case 'CC':
                const parentCategory = result.data?.categoryRef ||
                    catData.find(c => c.id === result.data?.categoryId) ||
                    catData.find(c => c.contents?.some(s => s.id === result.id))

                const symptom = result.data?.symptomRef ||
                    parentCategory?.contents?.find(s => s.id === result.id)

                if (parentCategory && symptom) {
                    setState(prev => ({
                        ...prev,
                        viewState: 'questions',
                        selectedCategory: parentCategory,
                        selectedSymptom: symptom,
                        selectedMedication: null,
                        selectedGuideline: null,
                        isSearchExpanded: false
                    }))
                }
                break

            case 'training':
            case 'DDX':
                const guidelineCat = result.data?.categoryRef ||
                    catData.find(c => c.id === result.data?.categoryId)
                const guidelineSymptom = result.data?.symptomRef ||
                    guidelineCat?.contents?.find(s => s.id === result.data?.symptomId)

                if (guidelineCat && guidelineSymptom) {
                    setState(prev => ({
                        ...prev,
                        viewState: 'questions',
                        selectedCategory: guidelineCat,
                        selectedSymptom: guidelineSymptom,
                        selectedMedication: null,
                        selectedGuideline: {
                            type: result.type === 'DDX' ? 'DDX' : (result.data?.guidelineType || 'gen'),
                            id: result.data?.guidelineId || result.id,
                            symptomId: guidelineSymptom.id
                        },
                        isSearchExpanded: false
                    }))
                }
                break

            case 'medication':
                const medication = result.data?.medicationData
                if (medication) {
                    setState(prev => ({
                        ...prev,
                        showMedications: true,
                        selectedMedication: medication,
                        isSearchExpanded: false
                    }))
                }
                break
        }
    }, [])

    const handleCategorySelect = useCallback((category: catDataTypes | null) => {
        if (category) {
            handleNavigation({
                type: 'category',
                id: category.id,
                icon: category.icon,
                text: category.text,
                data: { categoryRef: category }
            })
        } else {
            setState(prev => ({
                ...prev,
                viewState: 'main',
                selectedCategory: null,
                selectedSymptom: null,
                selectedMedication: null,
                selectedGuideline: null
            }))
        }
    }, [handleNavigation])

    const handleSymptomSelect = useCallback((symptom: subCatDataTypes | null, category?: catDataTypes | null) => {
        if (symptom) {
            const parentCategory = category || stateRef.current.selectedCategory ||
                catData.find(c => c.contents?.some(s => s.id === symptom.id))

            if (parentCategory) {
                handleNavigation({
                    type: 'CC',
                    id: symptom.id,
                    icon: symptom.icon,
                    text: symptom.text,
                    data: {
                        categoryId: parentCategory.id,
                        symptomId: symptom.id,
                        categoryRef: parentCategory,
                        symptomRef: symptom
                    }
                })
            }
        } else {
            setState(prev => ({
                ...prev,
                viewState: 'subcategory',
                selectedSymptom: null,
                selectedGuideline: null
            }))
        }
    }, [handleNavigation])

    const handleMedicationSelect = useCallback((medication: medListTypes | null) => {
        if (medication) {
            setState(prev => ({
                ...prev,
                showMedications: true,
                selectedMedication: medication,
            }))
        } else {
            setState(prev => ({
                ...prev,
                selectedMedication: null
            }))
        }
    }, [])

    const handleShowMedications = useCallback(() => {
        setState(prev => ({
            ...prev,
            showMedications: !prev.showMedications,
            selectedMedication: null,
            isMenuOpen: false,
            isSearchExpanded: false
        }))
    }, [])

    const handleGuidelineSelect = useCallback((guideline: { type: GuidelineType; id: number; symptomId: number } | null) => {
        setState(prev => ({
            ...prev,
            selectedGuideline: guideline
        }))
    }, [])

    // Back Button - Priority-based navigation stack
    const handleBackClick = useCallback(() => {
        const current = stateRef.current

        // Priority 1: Medications overlay - deselect medication or close
        if (current.showMedications) {
            if (current.selectedMedication) {
                setState(prev => ({ ...prev, selectedMedication: null }))
            } else {
                setState(prev => ({ ...prev, showMedications: false }))
            }
            return
        }
        // Priority 2: Clear guideline selection
        if (current.selectedGuideline) {
            setState(prev => ({ ...prev, selectedGuideline: null }))
        }
        // Priority 3: Clear symptom → return to category view
        else if (current.selectedSymptom) {
            setState(prev => ({
                ...prev,
                selectedSymptom: null,
                selectedGuideline: null,
                viewState: 'subcategory'
            }))
        }
        // Priority 4: Clear category → return to main
        else if (current.selectedCategory) {
            setState(prev => ({
                ...prev,
                viewState: 'main',
                selectedCategory: null,
                selectedSymptom: null,
                selectedMedication: null,
                selectedGuideline: null
            }))
        }
    }, [])

    // Grid Template Computation - Simplified
    const getGridTemplates = useMemo(() => {
        const GRID = {
            HIDE: '0fr',
            SHOW: '1fr',
            SHOW_SMALL: '0.9fr',
            SHOW_LARGE: '1.1fr',
        }

        const hasSymptomDetail = state.selectedSymptom !== null && state.viewState === 'questions'

        // Mobile: Single column at a time
        if (isMobile) {
            if (state.isSearchExpanded) {
                return { mainTemplate: `${GRID.HIDE} ${GRID.SHOW} ${GRID.HIDE}` }
            } else if (hasSymptomDetail) {
                return { mainTemplate: `${GRID.HIDE} ${GRID.HIDE} ${GRID.SHOW}` }
            } else {
                return { mainTemplate: `${GRID.SHOW} ${GRID.HIDE} ${GRID.HIDE}` }
            }
        }

        // Desktop: Multi-column layout
        if (hasSymptomDetail) {
            return { mainTemplate: `${GRID.SHOW_SMALL} ${GRID.HIDE} ${GRID.SHOW_LARGE}` }
        } else {
            return { mainTemplate: `${GRID.SHOW} ${GRID.SHOW} ${GRID.HIDE}` }
        }
    }, [state, isMobile])

    const getDynamicTitle = () => {
        if (state.showMedications) {
            if (state.selectedMedication) {
                return { title: state.selectedMedication.text, show: true }
            }
            return { title: "Medications", show: true }
        }
        if (state.viewState === 'questions' && state.selectedSymptom) {
            return { title: state.selectedSymptom.text, show: true }
        }
        if (state.viewState === 'subcategory' && state.selectedCategory) {
            return { title: state.selectedCategory.text, show: true }
        }
        return { title: "", show: false }
    }

    const shouldShowBackButton = (hasSearchInput: boolean, showNoteImport: boolean) => {
        if (hasSearchInput) return false
        if (showNoteImport) return false
        if (isMobile) {
            return Boolean(
                state.showMedications ||
                state.selectedCategory ||
                state.selectedSymptom
            )
        } else {
            return Boolean(
                state.selectedCategory ||
                state.selectedSymptom
            )
        }
    }

    const shouldShowMenuButton = (hasSearchInput: boolean, showNoteImport: boolean) => {
        if (showNoteImport || hasSearchInput) return false

        if (isMobile) {
            const shouldShowBack = Boolean(
                state.showMedications ||
                state.selectedCategory ||
                state.selectedSymptom
            )
            return !shouldShowBack
        } else {
            return true
        }
    }

    const getMedicationButtonText = () => "Medications"

    // UI State Handlers
    const toggleMenu = useCallback(() => {
        setState(prev => ({ ...prev, isMenuOpen: !prev.isMenuOpen }))
    }, [])

    const closeMenu = useCallback(() => {
        setState(prev => ({ ...prev, isMenuOpen: false }))
    }, [])

    const setShowNoteImport = useCallback((show: boolean) => {
        setState(prev => ({ ...prev, showNoteImport: show }))
    }, [])

    const setShowSettings = useCallback((show: boolean) => {
        setState(prev => ({ ...prev, showSettings: show, isMenuOpen: false }))
    }, [])

    const toggleSearchExpanded = useCallback(() => {
        setState(prev => ({ ...prev, isSearchExpanded: !prev.isSearchExpanded }))
    }, [])

    const setSearchExpanded = useCallback((expanded: boolean) => {
        setState(prev => ({ ...prev, isSearchExpanded: expanded }))
    }, [])

    const toggleSymptomInfo = useCallback(() => {
        setState(prev => ({ ...prev, showSymptomInfo: !prev.showSymptomInfo }))
    }, [])

    const setShowSymptomInfo = useCallback((show: boolean) => {
        setState(prev => ({ ...prev, showSymptomInfo: show }))
    }, [])

    const setShowMedications = useCallback((show: boolean) => {
        setState(prev => ({
            ...prev,
            showMedications: show,
            ...(show ? {} : { selectedMedication: null })
        }))
    }, [])

    // Close mobile menu on resize to desktop
    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth < 768
            setIsMobile(newIsMobile)
            if (!newIsMobile) {
                setState(prev => ({
                    ...prev,
                    isMenuOpen: false,
                    isSearchExpanded: false
                }))
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return {
        // Navigation State
        viewState: state.viewState,
        selectedCategory: state.selectedCategory,
        selectedSymptom: state.selectedSymptom,
        selectedMedication: state.selectedMedication,
        selectedGuideline: state.selectedGuideline,
        isMobile,

        // UI State
        isMenuOpen: state.isMenuOpen,
        showNoteImport: state.showNoteImport,
        showSettings: state.showSettings,
        isSearchExpanded: state.isSearchExpanded,
        showSymptomInfo: state.showSymptomInfo,
        showMedications: state.showMedications,

        // Navigation handlers
        handleNavigation,
        handleCategorySelect,
        handleSymptomSelect,
        handleMedicationSelect,
        handleShowMedications,
        handleGuidelineSelect,
        handleBackClick,

        // UI State handlers
        toggleMenu,
        closeMenu,
        setShowNoteImport,
        setShowSettings,
        setShowMedications,
        toggleSearchExpanded,
        setSearchExpanded,
        toggleSymptomInfo,
        setShowSymptomInfo,

        // Layout computation
        showQuestionCard: state.selectedSymptom !== null && state.viewState === 'questions',
        mainGridTemplate: getGridTemplates.mainTemplate,
        dynamicTitle: getDynamicTitle(),

        // Back button logic (needs external state)
        shouldShowBackButton,
        shouldShowMenuButton,
        getMedicationButtonText
    }
}