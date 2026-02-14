import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/Algorithm/CatData'
import type { medListTypes } from '../Data/Medication/MedData'
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
    timestamp?: Date | null;
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
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
    // stateRef: provides current state inside callbacks without stale closures.
    // Used by: handleSymptomSelect (fallback category lookup).
    // Note: handleBackClick uses atomic setState(prev => ...) instead to avoid TOCTOU races.
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

    // Back Button - Navigation stack only (drawers have their own close controls)
    // Uses atomic setState(prev => ...) so the conditional and update read the same snapshot,
    // avoiding stale-ref races during rapid interactions (double-tap, swipe during transition).
    const handleBackClick = useCallback(() => {
        setState(prev => {
            // Priority 1: Clear guideline selection
            if (prev.selectedGuideline) {
                return { ...prev, selectedGuideline: null }
            }
            // Priority 2: Clear symptom → return to category view
            if (prev.selectedSymptom) {
                return {
                    ...prev,
                    selectedSymptom: null,
                    selectedGuideline: null,
                    viewState: 'subcategory' as ViewState
                }
            }
            // Priority 3: Clear category → return to main
            if (prev.selectedCategory) {
                return {
                    ...prev,
                    viewState: 'main' as ViewState,
                    selectedCategory: null,
                    selectedSymptom: null,
                    selectedMedication: null,
                    selectedGuideline: null
                }
            }
            return prev
        })
    }, [])

    // Core derived boolean — reused by grid class, panel index, and column B check
    const showQuestionCard = state.selectedSymptom !== null && state.viewState === 'questions'

    // Mobile grid class — which column is active (desktop handled by Tailwind md:)
    const mobileGridClass = useMemo(() => {
        if (state.isSearchExpanded || showQuestionCard) return 'grid-cols-[0fr_1fr]'
        return 'grid-cols-[1fr_0fr]'
    }, [state.isSearchExpanded, showQuestionCard])

    // Column A internal panel index (which navigation view is shown)
    // 0 = main categories, 1 = subcategories, 2 = symptom info (desktop only)
    const columnAPanel = useMemo(() => {
        if (!state.selectedCategory) return 0
        if (!showQuestionCard) return 1
        return 2 // symptom info (desktop) — mobile uses SymptomInfoDrawer
    }, [state.selectedCategory, showQuestionCard])

    // Whether Column B is the active column on mobile
    const isMobileColumnB = isMobile && (state.isSearchExpanded || showQuestionCard)

    const getDynamicTitle = (): string => {
        if (state.viewState === 'questions' && state.selectedSymptom) {
            return state.selectedSymptom.text
        }
        if (state.viewState === 'subcategory' && state.selectedCategory) {
            return state.selectedCategory.text
        }
        return ""
    }

    const shouldShowBackButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return Boolean(state.selectedCategory || state.selectedSymptom)
    }

    // Menu shows when back button doesn't (and no search input)
    const shouldShowMenuButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return !Boolean(state.selectedCategory || state.selectedSymptom)
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

    /** Expand search panel on mobile if not already expanded (no-op on desktop) */
    const expandSearchOnMobile = useCallback(() => {
        if (!isMobile) return
        setState(prev => prev.isSearchExpanded ? prev : { ...prev, isSearchExpanded: true })
    }, [isMobile])

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
            // Keep writeNoteData so BaseDrawer close animation has content
        }))
        // Clear data after close animation completes (300ms animation + 50ms buffer)
        setTimeout(() => {
            setState(prev => prev.showWriteNote ? prev : { ...prev, writeNoteData: null })
        }, 350)
    }, [])

    /** Reset navigation to main categories view — clears all selections and closes WriteNote */
    const resetToMain = useCallback(() => {
        setState(prev => ({
            ...prev,
            viewState: 'main' as ViewState,
            selectedCategory: null,
            selectedSymptom: null,
            selectedGuideline: null,
            selectedMedication: null,
            showWriteNote: false,
            writeNoteData: null,
        }))
    }, [])

    // Close mobile menu on resize to desktop — matchMedia only fires on breakpoint crossing
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches)
            if (!e.matches) {
                setState(prev => ({
                    ...prev,
                    isMenuOpen: false,
                    isSearchExpanded: false
                }))
            }
        }
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
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
        expandSearchOnMobile,
        toggleSymptomInfo,
        setShowSymptomInfo,
        showWriteNote,
        closeWriteNote,
        resetToMain,

        // Layout computation
        showQuestionCard,
        mobileGridClass,
        columnAPanel,
        isMobileColumnB,
        dynamicTitle: getDynamicTitle(),

        // Back button logic (needs external state)
        shouldShowBackButton,
        shouldShowMenuButton,
        getMedicationButtonText
    }
}