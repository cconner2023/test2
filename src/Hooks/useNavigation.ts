import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from './useAlgorithm'

type ViewState = 'main' | 'subcategory' | 'questions'
type GuidelineType = 'gen' | 'medcom' | 'stp' | 'DDX'

export interface WriteNoteData {
    disposition: dispositionType;
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    selectedSymptom: { icon: string; text: string };
    initialPage?: number;
    initialHpiText?: string;
}

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
    showWriteNote: boolean;
    writeNoteData: WriteNoteData | null;
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
        showMedications: false,
        showWriteNote: false,
        writeNoteData: null
    })
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])


    const handleNavigation = useCallback((result: SearchResultType) => {
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
        setState(prev => {
            const opening = !prev.showMedications
            return {
                ...prev,
                ...(opening ? CLOSE_ALL_DRAWERS : { isMenuOpen: false }),
                showMedications: opening,
                selectedMedication: null,
                isSearchExpanded: false,
            }
        })
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

    // Grid Template Computation - 2-panel master-detail desktop layout
    // Column 1 (Left): Navigation (categories → subcategories → symptom info, all stacked vertically)
    // Column 2 (Right): Content (empty when browsing, algorithm when symptom selected, search results)
    const getGridTemplates = useMemo(() => {
        const GRID = {
            HIDE: '0fr',
            SHOW: '1fr',
            SHOW_SMALL: '0.9fr',
            SHOW_LARGE: '1.1fr',
        }

        // Mobile: Single column at a time
        if (isMobile) {
            if (state.isSearchExpanded) {
                return { mainTemplate: `${GRID.HIDE} ${GRID.SHOW}` }
            } else {
                return { mainTemplate: `${GRID.SHOW} ${GRID.HIDE}` }
            }
        }

        // Desktop: ALWAYS show two columns - CategoryList (left) and Content (right)
        // Left column fixed width, right column flexible
        return { mainTemplate: '0.45fr 0.55fr' }
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

    // Shared condition: user has navigated away from main view
    const hasActiveNavigation = Boolean(
        state.showMedications ||
        state.selectedCategory ||
        state.selectedSymptom
    )

    // Check if any drawer that covers the menu is open (on mobile these cover the entire screen)
    const isDrawerCoveringMenu = state.showNoteImport || state.showSettings || state.showMedications || state.showSymptomInfo

    const shouldShowBackButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        // Hide back button when any covering drawer is open on mobile (drawer has its own controls)
        if (isMobile && isDrawerCoveringMenu) return false
        return Boolean(state.selectedCategory || state.selectedSymptom)
    }

    const shouldShowMenuButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        // Hide menu button when any covering drawer is open on mobile
        if (isMobile && isDrawerCoveringMenu) return false
        return isMobile ? !Boolean(state.selectedCategory || state.selectedSymptom) : true
    }

    /** Static label — kept as a function for future localisation */
    const getMedicationButtonText = () => "Medications" as const

    /** Shared state for closing all drawers — used when opening any single drawer */
    const CLOSE_ALL_DRAWERS: Partial<NavigationState> = {
        showNoteImport: false,
        showSettings: false,
        showMedications: false,
        showSymptomInfo: false,
        isMenuOpen: false,
    }

    // UI State Handlers
    const toggleMenu = useCallback(() => {
        setState(prev => ({ ...prev, isMenuOpen: !prev.isMenuOpen }))
    }, [])

    const closeMenu = useCallback(() => {
        setState(prev => ({ ...prev, isMenuOpen: false }))
    }, [])

    const setShowNoteImport = useCallback((show: boolean) => {
        setState(prev => ({
            ...prev,
            ...(show ? CLOSE_ALL_DRAWERS : {}),
            showNoteImport: show,
        }))
    }, [])

    const setShowSettings = useCallback((show: boolean) => {
        setState(prev => ({
            ...prev,
            ...(show ? CLOSE_ALL_DRAWERS : {}),
            showSettings: show,
        }))
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
        setState(prev => ({
            ...prev,
            ...(show ? CLOSE_ALL_DRAWERS : {}),
            showSymptomInfo: show,
        }))
    }, [])

    const setShowMedications = useCallback((show: boolean) => {
        setState(prev => ({
            ...prev,
            ...(show ? { ...CLOSE_ALL_DRAWERS, selectedMedication: null } : {}),
            ...(!show ? { selectedMedication: null } : {}),
            showMedications: show,
        }))
    }, [])

    const showWriteNote = useCallback((data: WriteNoteData) => {
        setState(prev => ({
            ...prev,
            showWriteNote: true,
            writeNoteData: data
        }))
    }, [])

    const closeWriteNote = useCallback(() => {
        setState(prev => ({
            ...prev,
            showWriteNote: false,
            writeNoteData: null
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
        isWriteNoteVisible: state.showWriteNote,
        writeNoteData: state.writeNoteData,

        // Navigation handlers
        handleNavigation,
        handleMedicationSelect,
        handleShowMedications,
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
        showWriteNote,
        closeWriteNote,

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