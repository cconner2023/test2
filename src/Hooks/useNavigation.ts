import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
 * Uses useShallow for a single subscription with shallow equality,
 * so consumers only re-render when a selected field actually changes.
 *
 * Local helper functions (shouldShowBackButton, shouldShowMenuButton,
 * getDynamicTitle, getMedicationButtonText) remain here because they
 * depend on external args or are trivial.
 */
export function useNavigation() {
    // ── Initialise media query listener (once per mount) ─────
    useEffect(() => useNavigationStore.getState().init(), [])

    // ── Single shallow subscription to all needed store slices ──
    const store = useNavigationStore(useShallow((s) => ({
        // Navigation State
        viewState: s.viewState,
        selectedCategory: s.selectedCategory,
        selectedSymptom: s.selectedSymptom,
        selectedMedication: s.selectedMedication,
        selectedGuideline: s.selectedGuideline,
        isMobile: s.isMobile,

        // UI State
        isMenuOpen: s.isMenuOpen,
        showNoteImport: s.showNoteImport,
        showSettings: s.showSettings,
        isSearchExpanded: s.isSearchExpanded,
        showSymptomInfo: s.showSymptomInfo,
        showMedications: s.showMedications,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
        showTrainingDrawer: s.showTrainingDrawer,
        trainingDrawerTaskId: s.trainingDrawerTaskId,
        showMessagesDrawer: s.showMessagesDrawer,
        showPropertyDrawer: s.showPropertyDrawer,
        showTrainingPanel: s.showTrainingPanel,

        // Derived selectors
        showQuestionCard: selectShowQuestionCard(s),
        mobileGridClass: selectMobileGridClass(s),
        columnAPanel: selectColumnAPanel(s),
        isMobileColumnB: selectIsMobileColumnB(s),

        // Actions (stable references from Zustand)
        handleNavigation: s.handleNavigation,
        handleMedicationSelect: s.handleMedicationSelect,
        handleShowMedications: s.handleShowMedications,
        handleBackClick: s.handleBackClick,
        toggleMenu: s.toggleMenu,
        closeMenu: s.closeMenu,
        setShowNoteImport: s.setShowNoteImport,
        setShowSettings: s.setShowSettings,
        setShowMedications: s.setShowMedications,
        toggleSearchExpanded: s.toggleSearchExpanded,
        setSearchExpanded: s.setSearchExpanded,
        expandSearchOnMobile: s.expandSearchOnMobile,
        toggleSymptomInfo: s.toggleSymptomInfo,
        setShowSymptomInfo: s.setShowSymptomInfo,
        setShowTrainingDrawer: s.setShowTrainingDrawer,
        setShowMessagesDrawer: s.setShowMessagesDrawer,
        setShowPropertyDrawer: s.setShowPropertyDrawer,
        setShowTrainingPanel: s.setShowTrainingPanel,
        showWriteNote: s.openWriteNote,
        closeWriteNote: s.closeWriteNote,
        resetToMain: s.resetToMain,
    })))

    // ── Local helper functions ────────────────────────────────

    const getDynamicTitle = (): string => {
        if (store.viewState === 'questions' && store.selectedSymptom) {
            return store.selectedSymptom.text
        }
        if (store.viewState === 'subcategory' && store.selectedCategory) {
            return store.selectedCategory.text
        }
        return ""
    }

    const shouldShowBackButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return Boolean(store.selectedCategory || store.selectedSymptom)
    }

    const shouldShowMenuButton = (hasSearchInput: boolean) => {
        if (hasSearchInput) return false
        return !Boolean(store.selectedCategory || store.selectedSymptom)
    }

    const getMedicationButtonText = () => "Medications" as const

    return {
        ...store,
        dynamicTitle: getDynamicTitle(),

        // Back button logic (needs external state)
        shouldShowBackButton,
        shouldShowMenuButton,
        getMedicationButtonText,
    }
}
