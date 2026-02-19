import { useEffect } from 'react'
import {
    useNavigationStore,
    selectShowQuestionCard,
    selectMobileGridClass,
    selectColumnAPanel,
    selectIsMobileColumnB,
} from '../stores/useNavigationStore'

// Re-export types that consumers import from this module
export type { WriteNoteData } from '../stores/useNavigationStore'

/**
 * Thin wrapper around the Zustand navigation store.
 * Preserves the identical return interface so no consumers need changes.
 *
 * Local helper functions (shouldShowBackButton, shouldShowMenuButton,
 * getDynamicTitle, getMedicationButtonText) remain here because they
 * depend on external args or are trivial.
 */
export function useNavigation() {
    // ── Initialise media query listener (once per mount) ─────
    useEffect(() => useNavigationStore.getState().init(), [])

    // ── Subscribe to store slices ────────────────────────────
    const viewState = useNavigationStore((s) => s.viewState)
    const selectedCategory = useNavigationStore((s) => s.selectedCategory)
    const selectedSymptom = useNavigationStore((s) => s.selectedSymptom)
    const selectedMedication = useNavigationStore((s) => s.selectedMedication)
    const selectedGuideline = useNavigationStore((s) => s.selectedGuideline)
    const isMobile = useNavigationStore((s) => s.isMobile)

    const isMenuOpen = useNavigationStore((s) => s.isMenuOpen)
    const showNoteImport = useNavigationStore((s) => s.showNoteImport)
    const showSettings = useNavigationStore((s) => s.showSettings)
    const isSearchExpanded = useNavigationStore((s) => s.isSearchExpanded)
    const showSymptomInfo = useNavigationStore((s) => s.showSymptomInfo)
    const showMedications = useNavigationStore((s) => s.showMedications)
    const isWriteNoteVisible = useNavigationStore((s) => s.isWriteNoteVisible)
    const writeNoteData = useNavigationStore((s) => s.writeNoteData)
    const showTrainingDrawer = useNavigationStore((s) => s.showTrainingDrawer)
    const trainingDrawerTaskId = useNavigationStore((s) => s.trainingDrawerTaskId)

    // Derived selectors
    const showQuestionCard = useNavigationStore(selectShowQuestionCard)
    const mobileGridClass = useNavigationStore(selectMobileGridClass)
    const columnAPanel = useNavigationStore(selectColumnAPanel)
    const isMobileColumnB = useNavigationStore(selectIsMobileColumnB)

    // Actions (stable references from Zustand — no useCallback needed)
    const handleNavigation = useNavigationStore((s) => s.handleNavigation)
    const handleMedicationSelect = useNavigationStore((s) => s.handleMedicationSelect)
    const handleShowMedications = useNavigationStore((s) => s.handleShowMedications)
    const handleBackClick = useNavigationStore((s) => s.handleBackClick)
    const toggleMenu = useNavigationStore((s) => s.toggleMenu)
    const closeMenu = useNavigationStore((s) => s.closeMenu)
    const setShowNoteImport = useNavigationStore((s) => s.setShowNoteImport)
    const setShowSettings = useNavigationStore((s) => s.setShowSettings)
    const setShowMedications = useNavigationStore((s) => s.setShowMedications)
    const toggleSearchExpanded = useNavigationStore((s) => s.toggleSearchExpanded)
    const setSearchExpanded = useNavigationStore((s) => s.setSearchExpanded)
    const expandSearchOnMobile = useNavigationStore((s) => s.expandSearchOnMobile)
    const toggleSymptomInfo = useNavigationStore((s) => s.toggleSymptomInfo)
    const setShowSymptomInfo = useNavigationStore((s) => s.setShowSymptomInfo)
    const setShowTrainingDrawer = useNavigationStore((s) => s.setShowTrainingDrawer)
    const showWriteNote = useNavigationStore((s) => s.openWriteNote)
    const closeWriteNote = useNavigationStore((s) => s.closeWriteNote)
    const resetToMain = useNavigationStore((s) => s.resetToMain)

    // ── Local helper functions ────────────────────────────────

    const getDynamicTitle = (): string => {
        if (viewState === 'questions' && selectedSymptom) {
            return selectedSymptom.text
        }
        if (viewState === 'subcategory' && selectedCategory) {
            return selectedCategory.text
        }
        return ""
    }

    const shouldShowBackButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return Boolean(selectedCategory || selectedSymptom)
    }

    const shouldShowMenuButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return !Boolean(selectedCategory || selectedSymptom)
    }

    const getMedicationButtonText = () => "Medications" as const

    return {
        // Navigation State
        viewState,
        selectedCategory,
        selectedSymptom,
        selectedMedication,
        selectedGuideline,
        isMobile,

        // UI State
        isMenuOpen,
        showNoteImport,
        showSettings,
        isSearchExpanded,
        showSymptomInfo,
        showMedications,
        isWriteNoteVisible,
        writeNoteData,
        showTrainingDrawer,
        trainingDrawerTaskId,

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
        setShowTrainingDrawer,
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
        getMedicationButtonText,
    }
}
