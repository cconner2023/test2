// Hooks/useSimpleLayout.ts - UPDATED
import { useMemo } from 'react'
import { useSearch } from './useSearch'
import { useSearchNavigation } from './useSearchNavigation'

export function useLayout() {
    const search = useSearch()
    const navigation = useSearchNavigation({
        onClearSearch: search.clearSearch
    })

    const hasSearchInput = search.searchInput.trim() !== ""

    // FIXED: Medication view should ONLY be based on viewState
    const isMedicationView = navigation.viewState === 'medications' && !hasSearchInput

    // FIXED: Medication detail is shown when a medication is selected
    const showMedicationDetail = navigation.selectedMedication !== null && !hasSearchInput

    // FIXED: Question card is shown when a symptom is selected, but NOT in medication view
    const showQuestionCard = navigation.selectedSymptom !== null &&
        !hasSearchInput &&
        !isMedicationView &&
        !showMedicationDetail

    // Simple nested ifs for grid templates - UPDATED
    const getGridTemplates = () => {
        const { isMobile } = navigation

        if (isMobile) {
            // Mobile: Single column layout
            if (isMedicationView) {
                return {
                    mainTemplate: '0fr 0fr 0fr', // Hidden
                    medTemplate: showMedicationDetail ? '0fr 1fr' : '1fr 0fr',
                    showMain: false,
                    showMedication: true
                }
            } else if (hasSearchInput) {
                return {
                    mainTemplate: '0fr 1fr 0fr',
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            } else if (showQuestionCard || showMedicationDetail) {
                return {
                    mainTemplate: '0fr 0fr 1fr', // Single column for details
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            } else {
                return {
                    mainTemplate: '1fr 0fr 0fr', // Single column for categories
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            }
        } else {
            // Desktop: Multi-column layout
            if (isMedicationView) {
                return {
                    mainTemplate: '0fr 0fr 0fr', // Hidden
                    medTemplate: showMedicationDetail ? '0.9fr 1.1fr' : '1fr 1fr',
                    showMain: false,
                    showMedication: true
                }
            } else if (hasSearchInput) {
                return {
                    mainTemplate: '1fr 1fr 0fr', // Categories + Search, hide right
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            } else if (showQuestionCard) {
                return {
                    mainTemplate: '0.9fr 0fr 1.1fr', // Categories + Details, hide middle
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            } else if (showMedicationDetail) {
                return {
                    mainTemplate: '1fr 0fr 1fr', // Categories + Medication Details
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            } else {
                return {
                    mainTemplate: '1fr 1fr 0fr', // Categories only
                    medTemplate: '0fr 0fr',
                    showMain: true,
                    showMedication: false
                }
            }
        }
    }

    const gridTemplates = getGridTemplates()

    return useMemo(() => ({
        // Search
        search,
        hasSearchInput,
        searchInput: search.searchInput,
        searchResults: search.searchResults,
        isSearching: search.isSearching,
        clearSearch: search.clearSearch,
        handleSearchChange: search.handleSearchChange,

        // Navigation
        ...navigation,

        // Derived states
        showMedicationDetail,
        isMedicationView,
        showQuestionCard,

        // Layout
        mainGridTemplate: gridTemplates.mainTemplate,
        medicationGridTemplate: gridTemplates.medTemplate,
        showMainGrid: gridTemplates.showMain,
        showMedicationGrid: gridTemplates.showMedication,

        // Boolean getters (fixed with !! for boolean conversion)
        shouldShowBackButton: (showNoteImport: boolean) => {
            // Never show back when searching (search has its own X)
            if (hasSearchInput) return false

            if (showNoteImport) return true

            if (navigation.isMobile) {
                // Mobile: Show back when in detail view
                return Boolean(
                    navigation.selectedCategory ||
                    navigation.selectedSymptom ||
                    (isMedicationView && navigation.selectedMedication) ||
                    showMedicationDetail
                )
            } else {
                // Desktop: Show back when in detail view
                return Boolean(
                    navigation.selectedCategory ||
                    navigation.selectedSymptom ||
                    showMedicationDetail
                )
            }
        },

        shouldShowMenuButton: (showNoteImport: boolean) => {
            // Don't show menu when importing note or searching
            if (showNoteImport || hasSearchInput) return false

            // Always show menu on mobile (for switching between ADTMC/Medications)
            // On desktop, only show when not in medication view
            if (navigation.isMobile) {
                return true
            } else {
                return !isMedicationView
            }
        },

        getMedicationButtonText: () => isMedicationView ? "ADTMC" : "Medications"

    }), [search, navigation, hasSearchInput, showMedicationDetail, isMedicationView, showQuestionCard])
}