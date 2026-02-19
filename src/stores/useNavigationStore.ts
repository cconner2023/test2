/**
 * Zustand store for navigation and UI drawer state replaces the useState + useCallback + stateRef pattern from useNavigation with Zustand's get()/set(), eliminating stale closure and enabling direct store access outside React.
 */

import { create } from 'zustand'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'

type ViewState = 'main' | 'subcategory' | 'questions'
type GuidelineType = 'gen' | 'medcom' | 'stp' | 'DDX'

export interface WriteNoteData {
    disposition: dispositionType;
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    selectedSymptom: { icon: string; text: string };
    initialPage?: number;
    initialHpiText?: string;
    initialPeText?: string;
    timestamp?: Date | null;
}

/** Shared partial for closing all drawers. */
const CLOSE_ALL_DRAWERS = {
    showNoteImport: false,
    showSettings: false,
    showMedications: false,
    showSymptomInfo: false,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null as string | null,
    isMenuOpen: false,
} as const

interface NavigationState {
    viewState: ViewState
    selectedCategory: catDataTypes | null
    selectedSymptom: subCatDataTypes | null
    selectedMedication: medListTypes | null
    selectedGuideline: { type: GuidelineType; id: number; symptomId: number } | null
    isMenuOpen: boolean
    showNoteImport: boolean
    showSettings: boolean
    isSearchExpanded: boolean
    showSymptomInfo: boolean
    showMedications: boolean
    isWriteNoteVisible: boolean
    writeNoteData: WriteNoteData | null
    showTrainingDrawer: boolean
    trainingDrawerTaskId: string | null
    isMobile: boolean
}

interface NavigationActions {
    /** Set up media query listener. Returns cleanup function. */
    init: () => () => void

    // Navigation
    handleNavigation: (result: SearchResultType) => void
    handleMedicationSelect: (medication: medListTypes | null) => void
    handleShowMedications: () => void
    handleBackClick: () => void

    // UI toggles / setters
    toggleMenu: () => void
    closeMenu: () => void
    setShowNoteImport: (show: boolean) => void
    setShowSettings: (show: boolean) => void
    toggleSearchExpanded: () => void
    setSearchExpanded: (expanded: boolean) => void
    expandSearchOnMobile: () => void
    toggleSymptomInfo: () => void
    setShowSymptomInfo: (show: boolean) => void
    setShowMedications: (show: boolean) => void
    setShowTrainingDrawer: (taskId: string | null) => void
    openWriteNote: (data: WriteNoteData) => void
    closeWriteNote: () => void
    resetToMain: () => void
}

export type NavigationStore = NavigationState & NavigationActions

export const useNavigationStore = create<NavigationStore>()((set, get) => ({
    // ── Initial State ────────────────────────────────────────
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
    isWriteNoteVisible: false,
    writeNoteData: null,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null,
    isMobile: typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 767px)').matches
        : false,

    // ── Init ─────────────────────────────────────────────────
    init: () => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => {
            set({ isMobile: e.matches })
            if (!e.matches) {
                set({ isMenuOpen: false, isSearchExpanded: false })
            }
        }
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    },

    // ── Navigation ───────────────────────────────────────────
    handleNavigation: (result) => {
        switch (result.type) {
            case 'category': {
                const category = result.data?.categoryRef || catData.find(c => c.id === result.id)
                if (category) {
                    set({
                        ...CLOSE_ALL_DRAWERS,
                        viewState: 'subcategory',
                        selectedCategory: category,
                        selectedSymptom: null,
                        selectedMedication: null,
                        selectedGuideline: null,
                        isSearchExpanded: false,
                    })
                }
                break
            }
            case 'CC': {
                const parentCategory = result.data?.categoryRef ||
                    catData.find(c => c.id === result.data?.categoryId) ||
                    catData.find(c => c.contents?.some(s => s.id === result.id))
                const symptom = result.data?.symptomRef ||
                    parentCategory?.contents?.find(s => s.id === result.id)
                if (parentCategory && symptom) {
                    set({
                        ...CLOSE_ALL_DRAWERS,
                        viewState: 'questions',
                        selectedCategory: parentCategory,
                        selectedSymptom: symptom,
                        selectedMedication: null,
                        selectedGuideline: null,
                        isSearchExpanded: false,
                    })
                }
                break
            }
            case 'training':
                // Handled by App.tsx — no nav state change
                break
            case 'DDX': {
                const guidelineCat = result.data?.categoryRef ||
                    catData.find(c => c.id === result.data?.categoryId)
                const guidelineSymptom = result.data?.symptomRef ||
                    guidelineCat?.contents?.find(s => s.id === result.data?.symptomId)
                if (guidelineCat && guidelineSymptom) {
                    set({
                        ...CLOSE_ALL_DRAWERS,
                        viewState: 'questions',
                        selectedCategory: guidelineCat,
                        selectedSymptom: guidelineSymptom,
                        selectedMedication: null,
                        selectedGuideline: {
                            type: 'DDX',
                            id: result.data?.guidelineId || result.id,
                            symptomId: guidelineSymptom.id,
                        },
                        isSearchExpanded: false,
                    })
                }
                break
            }
            case 'medication': {
                const medication = result.data?.medicationData
                if (medication) {
                    set({
                        ...CLOSE_ALL_DRAWERS,
                        showMedications: true,
                        selectedMedication: medication,
                        isSearchExpanded: false,
                    })
                }
                break
            }
        }
    },

    handleMedicationSelect: (medication) => {
        if (medication) {
            set({ showMedications: true, selectedMedication: medication })
        } else {
            set({ selectedMedication: null })
        }
    },

    handleShowMedications: () => {
        const s = get()
        const opening = !s.showMedications
        set({
            ...(opening ? CLOSE_ALL_DRAWERS : { isMenuOpen: false }),
            showMedications: opening,
            selectedMedication: null,
            isSearchExpanded: false,
        })
    },

    // Back Button — reads current state via get() to avoid stale closures.
    // Priority: guideline → symptom → category → no-op
    handleBackClick: () => {
        const s = get()
        if (s.selectedGuideline) {
            set({ selectedGuideline: null })
        } else if (s.selectedSymptom) {
            set({ selectedSymptom: null, selectedGuideline: null, viewState: 'subcategory' })
        } else if (s.selectedCategory) {
            set({
                viewState: 'main',
                selectedCategory: null,
                selectedSymptom: null,
                selectedMedication: null,
                selectedGuideline: null,
            })
        }
    },

    // ── UI Toggles / Setters ─────────────────────────────────
    toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
    closeMenu: () => set({ isMenuOpen: false }),

    setShowNoteImport: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        showNoteImport: show,
        // Preserve other state not in CLOSE_ALL_DRAWERS
        viewState: s.viewState,
        selectedCategory: s.selectedCategory,
        selectedSymptom: s.selectedSymptom,
        selectedMedication: s.selectedMedication,
        selectedGuideline: s.selectedGuideline,
        isSearchExpanded: s.isSearchExpanded,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
    })),

    setShowSettings: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        showSettings: show,
        viewState: s.viewState,
        selectedCategory: s.selectedCategory,
        selectedSymptom: s.selectedSymptom,
        selectedMedication: s.selectedMedication,
        selectedGuideline: s.selectedGuideline,
        isSearchExpanded: s.isSearchExpanded,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
    })),

    toggleSearchExpanded: () => set((s) => ({ isSearchExpanded: !s.isSearchExpanded })),
    setSearchExpanded: (expanded) => set({ isSearchExpanded: expanded }),

    expandSearchOnMobile: () => {
        const s = get()
        if (!s.isMobile || s.isSearchExpanded) return
        set({ isSearchExpanded: true })
    },

    toggleSymptomInfo: () => set((s) => ({ showSymptomInfo: !s.showSymptomInfo })),

    setShowSymptomInfo: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        showSymptomInfo: show,
        viewState: s.viewState,
        selectedCategory: s.selectedCategory,
        selectedSymptom: s.selectedSymptom,
        selectedMedication: s.selectedMedication,
        selectedGuideline: s.selectedGuideline,
        isSearchExpanded: s.isSearchExpanded,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
    })),

    setShowMedications: (show) => {
        set((s) => ({
            ...(show ? { ...CLOSE_ALL_DRAWERS, selectedMedication: null } : {}),
            ...(!show ? { selectedMedication: null } : {}),
            showMedications: show,
            viewState: s.viewState,
            selectedCategory: s.selectedCategory,
            selectedSymptom: s.selectedSymptom,
            selectedGuideline: s.selectedGuideline,
            isSearchExpanded: s.isSearchExpanded,
            isWriteNoteVisible: s.isWriteNoteVisible,
            writeNoteData: s.writeNoteData,
        }))
    },

    setShowTrainingDrawer: (taskId) => set((s) => ({
        ...(taskId ? CLOSE_ALL_DRAWERS : {}),
        showTrainingDrawer: !!taskId,
        trainingDrawerTaskId: taskId,
        viewState: s.viewState,
        selectedCategory: s.selectedCategory,
        selectedSymptom: s.selectedSymptom,
        selectedMedication: s.selectedMedication,
        selectedGuideline: s.selectedGuideline,
        isSearchExpanded: s.isSearchExpanded,
        isWriteNoteVisible: s.isWriteNoteVisible,
        writeNoteData: s.writeNoteData,
    })),

    openWriteNote: (data) => set({ isWriteNoteVisible: true, writeNoteData: data }),

    closeWriteNote: () => {
        set({ isWriteNoteVisible: false })
        // Clear data after close animation completes (300ms animation + 50ms buffer)
        setTimeout(() => {
            const s = useNavigationStore.getState()
            if (!s.isWriteNoteVisible) {
                useNavigationStore.setState({ writeNoteData: null })
            }
        }, 350)
    },

    resetToMain: () => set({
        viewState: 'main',
        selectedCategory: null,
        selectedSymptom: null,
        selectedGuideline: null,
        selectedMedication: null,
        isWriteNoteVisible: false,
        writeNoteData: null,
    }),
}))

// ── Selectors ────────────────────────────────────────────────

export const selectShowQuestionCard = (s: NavigationState) =>
    s.selectedSymptom !== null && s.viewState === 'questions'

export const selectMobileGridClass = (s: NavigationState) => {
    const showQ = s.selectedSymptom !== null && s.viewState === 'questions'
    if (s.isSearchExpanded || showQ) return 'grid-cols-[0fr_1fr]'
    return 'grid-cols-[1fr_0fr]'
}

export const selectColumnAPanel = (s: NavigationState) => {
    const showQ = s.selectedSymptom !== null && s.viewState === 'questions'
    if (!s.selectedCategory) return 0
    if (!showQ) return 1
    return 2
}

export const selectIsMobileColumnB = (s: NavigationState) =>
    s.isMobile && (s.isSearchExpanded || (s.selectedSymptom !== null && s.viewState === 'questions'))
