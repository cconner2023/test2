// Hooks/useSimplifiedNavigation.ts
import { useCallback } from 'react'
import { useSearch } from './useSearch'
import { useSearchNavigation } from './useSearchNavigation'

export function useAppNavigation() {
    const search = useSearch()
    const navigation = useSearchNavigation({
        onClearSearch: search.clearSearch
    })

    const hasSearchInput = search.searchInput.trim() !== ""
    const showMedicationDetail = navigation.selectedMedication !== null && !hasSearchInput
    const isMedicationView = (navigation.viewState === 'medications' ||
        navigation.selectedMedication !== null) && !hasSearchInput
    const showQuestionCard = navigation.selectedSymptom !== null &&
        !hasSearchInput &&
        !navigation.selectedMedication

    // Simplified: Just return booleans for grid visibility
    const getLayoutState = useCallback(() => {
        const state = {
            // Core states
            hasSearchInput,
            showQuestionCard,
            showMedicationDetail,
            isMedicationView,
            showSearchResults: hasSearchInput,
            showAlgorithm: showQuestionCard,
            showMedicationInMainGrid: showMedicationDetail && !isMedicationView,
            showMedicationList: isMedicationView,
            showMedicationDetails: showMedicationDetail && isMedicationView
        }

        console.log("📊 Layout State:", state)
        return state
    }, [hasSearchInput, showQuestionCard, showMedicationDetail, isMedicationView])

    return {
        // Search
        search,
        hasSearchInput,

        // Navigation state (direct from hook)
        ...navigation,

        // Derived states
        showMedicationDetail,
        isMedicationView,
        showQuestionCard,

        // Layout helper
        getLayoutState
    }
}