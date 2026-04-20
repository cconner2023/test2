import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
    useNavigationStore,
    selectShowQuestionCard,
    selectMobileGridClass,
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
 * getDynamicTitle) remain here because they depend on external args
 * or are trivial.
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
        selectedGuideline: s.selectedGuideline,
        isMobile: s.isMobile,

        // UI State
        isMenuOpen: s.isMenuOpen,
        showSettings: s.showSettings,
        isSearchExpanded: s.isSearchExpanded,
        showSymptomInfo: s.showSymptomInfo,
        showKnowledgeBase: s.showKnowledgeBase,
        kbInitialView: s.kbInitialView,
        kbInitialMedication: s.kbInitialMedication,
        kbInitialScreenerId: s.kbInitialScreenerId,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
        showTrainingDrawer: s.showTrainingDrawer,
        trainingDrawerTaskId: s.trainingDrawerTaskId,
        showMessagesDrawer: s.showMessagesDrawer,
        messagesInitialPeerId: s.messagesInitialPeerId,
        messagesInitialGroupId: s.messagesInitialGroupId,
        messagesInitialPeerName: s.messagesInitialPeerName,
        showPropertyDrawer: s.showPropertyDrawer,
        showAdminDrawer: s.showAdminDrawer,
        showSupervisorDrawer: s.showSupervisorDrawer,
        showProviderDrawer: s.showProviderDrawer,
        showLoRaDrawer: s.showLoRaDrawer,
        showMapOverlayDrawer: s.showMapOverlayDrawer,
        mapOverlayDrawerOverlayId: s.mapOverlayDrawerOverlayId,
        showCalendarDrawer: s.showCalendarDrawer,

        // Derived selectors
        showQuestionCard: selectShowQuestionCard(s),
        mobileGridClass: selectMobileGridClass(s),
        columnAPanel: s.columnAPanel,
        isMobileColumnB: selectIsMobileColumnB(s),

        // Actions (stable references from Zustand)
        handleNavigation: s.handleNavigation,
        handleBackClick: s.handleBackClick,
        toggleMenu: s.toggleMenu,
        closeMenu: s.closeMenu,
        setShowSettings: s.setShowSettings,
        setShowKnowledgeBase: s.setShowKnowledgeBase,
        toggleSearchExpanded: s.toggleSearchExpanded,
        setSearchExpanded: s.setSearchExpanded,
        isImportExpanded: s.isImportExpanded,
        toggleImportExpanded: s.toggleImportExpanded,
        setImportExpanded: s.setImportExpanded,
        expandSearchOnMobile: s.expandSearchOnMobile,
        toggleSymptomInfo: s.toggleSymptomInfo,
        setShowSymptomInfo: s.setShowSymptomInfo,
        setShowTrainingDrawer: s.setShowTrainingDrawer,
        setShowMessagesDrawer: s.setShowMessagesDrawer,
        openMessagesConversation: s.openMessagesConversation,
        clearMessagesConversation: s.clearMessagesConversation,
        setShowPropertyDrawer: s.setShowPropertyDrawer,
        setShowAdminDrawer: s.setShowAdminDrawer,
        setShowSupervisorDrawer: s.setShowSupervisorDrawer,
        setShowProviderDrawer: s.setShowProviderDrawer,
        setShowLoRaDrawer: s.setShowLoRaDrawer,
        setShowMapOverlayDrawer: s.setShowMapOverlayDrawer,
        setShowCalendarDrawer: s.setShowCalendarDrawer,
        openCalendarEvent: s.openCalendarEvent,
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

    return {
        ...store,
        dynamicTitle: getDynamicTitle(),

        // Back button logic (needs external state)
        shouldShowBackButton,
        shouldShowMenuButton,
    }
}
