/**
 * Zustand store for navigation and UI drawer state replaces the useState + useCallback + stateRef pattern from useNavigation with Zustand's get()/set(), eliminating stale closure and enabling direct store access outside React.
 */

import { create } from 'zustand'
import type { catDataTypes, subCatDataTypes, SearchResultType, GuidelineType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'

type ViewState = 'main' | 'subcategory' | 'questions'

export interface WriteNoteData {
    disposition: dispositionType;
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    selectedSymptom: { icon: string; text: string };
    initialPage?: number;
}

/** Fields preserved across all drawer toggles (not in CLOSE_ALL_DRAWERS). */
const PRESERVED_FIELDS = (s: NavigationState) => ({
    viewState: s.viewState,
    selectedCategory: s.selectedCategory,
    selectedSymptom: s.selectedSymptom,
    selectedGuideline: s.selectedGuideline,
    columnAPanel: s.columnAPanel,
    isSearchExpanded: s.isSearchExpanded,
    isImportExpanded: s.isImportExpanded,
    isWriteNoteVisible: s.isWriteNoteVisible,
    writeNoteData: s.writeNoteData,
});

/** Shared partial for closing all drawers. */
const CLOSE_ALL_DRAWERS = {
    showSettings: false,
    showKnowledgeBase: false,
    kbInitialView: null as string | null,
    kbInitialMedication: null as medListTypes | null,
    kbInitialScreenerId: null as string | null,
    showSymptomInfo: false,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null as string | null,
    showMessagesDrawer: false,
    messagesInitialPeerId: null as string | null,
    messagesInitialGroupId: null as string | null,
    messagesInitialPeerName: null as string | null,
    showPropertyDrawer: false,
    showLoRaDrawer: false,
    showMapOverlayDrawer: false,
    mapOverlayDrawerOverlayId: null as string | null,
    showCalendarDrawer: false,
    showAdminDrawer: false,
    showSupervisorDrawer: false,
    showProviderDrawer: false,
    isMenuOpen: false,
} as const

interface NavigationState {
    viewState: ViewState
    selectedCategory: catDataTypes | null
    selectedSymptom: subCatDataTypes | null
    selectedGuideline: { type: GuidelineType; id: number; symptomId: number } | null
    /** Explicit carousel panel position — set directly by navigation actions,
     *  not derived reactively. 0 = categories, 1 = subcategories, 2 = symptom info (desktop). */
    columnAPanel: number
    isMenuOpen: boolean
    showSettings: boolean
    isSearchExpanded: boolean
    isImportExpanded: boolean
    showSymptomInfo: boolean
    showKnowledgeBase: boolean
    kbInitialView: string | null
    kbInitialMedication: medListTypes | null
    kbInitialScreenerId: string | null
    isWriteNoteVisible: boolean
    writeNoteData: WriteNoteData | null
    showTrainingDrawer: boolean
    trainingDrawerTaskId: string | null
    showMessagesDrawer: boolean
    messagesInitialPeerId: string | null
    messagesInitialGroupId: string | null
    messagesInitialPeerName: string | null
    showPropertyDrawer: boolean
    showLoRaDrawer: boolean
    showMapOverlayDrawer: boolean
    mapOverlayDrawerOverlayId: string | null
    showCalendarDrawer: boolean
    showAdminDrawer: boolean
    showSupervisorDrawer: boolean
    showProviderDrawer: boolean
    isMobile: boolean
}

interface NavigationActions {
    /** Set up media query listener. Returns cleanup function. */
    init: () => () => void

    // Navigation
    handleNavigation: (result: SearchResultType) => void
    handleBackClick: () => void

    // UI toggles / setters
    toggleMenu: () => void
    closeMenu: () => void
    setShowSettings: (show: boolean) => void
    toggleSearchExpanded: () => void
    setSearchExpanded: (expanded: boolean) => void
    toggleImportExpanded: () => void
    setImportExpanded: (expanded: boolean) => void
    expandSearchOnMobile: () => void
    toggleSymptomInfo: () => void
    setShowSymptomInfo: (show: boolean) => void
    setShowKnowledgeBase: (show: boolean, initialView?: string | null, initialMedication?: medListTypes | null, initialScreenerId?: string | null) => void
    setShowTrainingDrawer: (taskId: string | null) => void
    setShowMessagesDrawer: (show: boolean) => void
    openMessagesConversation: (peerId: string | null, groupId: string | null, peerName: string | null) => void
    clearMessagesConversation: () => void
    setShowPropertyDrawer: (show: boolean) => void
    setShowLoRaDrawer: (show: boolean) => void
    setShowMapOverlayDrawer: (show: boolean, overlayId?: string | null) => void
    setShowCalendarDrawer: (show: boolean) => void
    setShowAdminDrawer: (show: boolean) => void
    setShowSupervisorDrawer: (show: boolean) => void
    setShowProviderDrawer: (show: boolean) => void
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
    selectedGuideline: null,
    columnAPanel: 0,
    isMenuOpen: false,
    showSettings: false,
    isSearchExpanded: false,
    isImportExpanded: false,
    showSymptomInfo: false,
    showKnowledgeBase: false,
    kbInitialView: null,
    kbInitialMedication: null,
    kbInitialScreenerId: null,
    isWriteNoteVisible: false,
    writeNoteData: null,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null,
    showMessagesDrawer: false,
    showPropertyDrawer: false,
    showLoRaDrawer: false,
    showMapOverlayDrawer: false,
    mapOverlayDrawerOverlayId: null,
    showCalendarDrawer: false,
    showAdminDrawer: false,
    showSupervisorDrawer: false,
    showProviderDrawer: false,
    isMobile: typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 767px)').matches
        : false,

    // ── Init ─────────────────────────────────────────────────
    init: () => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => {
            set({ isMobile: e.matches })
            if (!e.matches) {
                set({ isMenuOpen: false, isSearchExpanded: false, isImportExpanded: false })
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
                        selectedGuideline: null,
                        columnAPanel: 1,
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
                        selectedGuideline: null,
                        columnAPanel: 2,
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
                        selectedGuideline: {
                            type: 'DDX',
                            id: result.data?.guidelineId || result.id,
                            symptomId: guidelineSymptom.id,
                        },
                        columnAPanel: 2,
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
                        showKnowledgeBase: true,
                        kbInitialView: 'medication-detail',
                        kbInitialMedication: medication,
                        isSearchExpanded: false,
                    })
                }
                break
            }
        }
    },

    // Back Button — reads current state via get() to avoid stale closures.
    // Priority: guideline → symptom → category → no-op
    handleBackClick: () => {
        const s = get()
        if (s.selectedGuideline) {
            set({ selectedGuideline: null })
        } else if (s.selectedSymptom) {
            set({ selectedSymptom: null, selectedGuideline: null, viewState: 'subcategory', columnAPanel: 1 })
        } else if (s.selectedCategory) {
            set({
                viewState: 'main',
                selectedCategory: null,
                selectedSymptom: null,
                selectedGuideline: null,
                columnAPanel: 0,
            })
        }
    },

    // ── UI Toggles / Setters ─────────────────────────────────
    toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
    closeMenu: () => set({ isMenuOpen: false }),

    setShowSettings: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showSettings: show,
    })),

    toggleSearchExpanded: () => set((s) => ({ isSearchExpanded: !s.isSearchExpanded, isImportExpanded: false })),
    setSearchExpanded: (expanded) => set({ isSearchExpanded: expanded }),
    toggleImportExpanded: () => set((s) => ({ isImportExpanded: !s.isImportExpanded, isSearchExpanded: false })),
    setImportExpanded: (expanded) => set({ isImportExpanded: expanded }),

    expandSearchOnMobile: () => {
        const s = get()
        if (!s.isMobile || s.isSearchExpanded) return
        set({ isSearchExpanded: true, isImportExpanded: false })
    },

    toggleSymptomInfo: () => set((s) => ({ showSymptomInfo: !s.showSymptomInfo })),

    setShowSymptomInfo: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showSymptomInfo: show,
    })),

    setShowKnowledgeBase: (show, initialView, initialMedication, initialScreenerId) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showKnowledgeBase: show,
        kbInitialView: show ? (initialView ?? null) : null,
        kbInitialMedication: show ? (initialMedication ?? null) : null,
        kbInitialScreenerId: show ? (initialScreenerId ?? null) : null,
    })),

    setShowTrainingDrawer: (taskId) => set((s) => ({
        ...(taskId ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showTrainingDrawer: !!taskId,
        trainingDrawerTaskId: taskId,
    })),

    setShowMessagesDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showMessagesDrawer: show,
    })),

    openMessagesConversation: (peerId, groupId, peerName) => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showMessagesDrawer: true,
        messagesInitialPeerId: peerId,
        messagesInitialGroupId: groupId,
        messagesInitialPeerName: peerName,
    })),

    clearMessagesConversation: () => set({
        messagesInitialPeerId: null,
        messagesInitialGroupId: null,
        messagesInitialPeerName: null,
    }),

    setShowPropertyDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showPropertyDrawer: show,
    })),

    setShowLoRaDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showLoRaDrawer: show,
    })),

    setShowMapOverlayDrawer: (show, overlayId) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showMapOverlayDrawer: show,
        mapOverlayDrawerOverlayId: show ? (overlayId ?? null) : null,
    })),

    setShowCalendarDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showCalendarDrawer: show,
    })),

    setShowAdminDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showAdminDrawer: show,
    })),

    setShowSupervisorDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showSupervisorDrawer: show,
    })),

    setShowProviderDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showProviderDrawer: show,
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
        columnAPanel: 0,
        isWriteNoteVisible: false,
        writeNoteData: null,
    }),
}))



// ── Selectors ────────────────────────────────────────────────

export const selectShowQuestionCard = (s: NavigationState) =>
    s.selectedSymptom !== null && s.viewState === 'questions'

export const selectMobileGridClass = (s: NavigationState) => {
    if (s.isSearchExpanded || selectShowQuestionCard(s)) return 'grid-cols-[0fr_1fr]'
    return 'grid-cols-[1fr_0fr]'
}

export const selectIsMobileColumnB = (s: NavigationState) =>
    s.isMobile && (s.isSearchExpanded || selectShowQuestionCard(s))
