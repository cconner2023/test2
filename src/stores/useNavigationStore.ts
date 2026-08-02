/**
 * Zustand store for navigation and UI drawer state replaces the useState + useCallback + stateRef pattern from useNavigation with Zustand's get()/set(), eliminating stale closure and enabling direct store access outside React.
 */

import { create } from 'zustand'
import type { catDataTypes, subCatDataTypes, SearchResultType, GuidelineType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import type { medListTypes } from '../Data/MedData'
import type { MedevacRequest } from '../Types/MedevacTypes'
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes'
import type { EventCategory } from '../Types/CalendarTypes'
import type { CardState } from '../Hooks/useAlgorithm'

type ViewState = 'main' | 'subcategory' | 'questions'

/** Prefill for a deep-linked new calendar event (e.g. from a detected date in a message). */
export interface CalendarPrefill {
    /** Seed the event title. */
    title?: string
    /** Local datetime string "YYYY-MM-DDTHH:mm" to seed start_time. */
    startISO?: string
    /** Seed the event category (e.g. 'training' when scheduling an algorithm). */
    category?: EventCategory
    /** Tag the event with an ADTMC algorithm id (e.g. "A-1") for encounter rollups. */
    encounterAlgorithmId?: string
    /** Pre-assign the event to these user ids (e.g. the soldier a supervisor is scheduling for). */
    assignedTo?: string[]
    /** STP task id for a supervisor task-assignment — the calendar SAVE creates the
     *  linked training assignment row(s) (one per assignee) so both platforms route
     *  the same "assign task" flow through the real calendar compose. */
    trainingItemId?: string
    /** Seed the event description / assignment notes. */
    notes?: string
}

/** Where to send the user back to after a deep-linked calendar event is saved
 *  or cancelled — e.g. the chat message whose detected date opened the form. */
export interface CalendarReturn {
    /** Peer id (1:1) or group id. */
    conversationId: string
    /** True when conversationId is a group id. */
    isGroup: boolean
    /** Display name for the conversation header on reopen. */
    peerName?: string | null
    /** Message to scroll back to once the conversation reopens. */
    messageId: string
}

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
    kbInitialMedevacReq: null as MedevacRequest | null,
    showSymptomInfo: false,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null as string | null,
    showMessagesDrawer: false,
    messagesInitialPeerId: null as string | null,
    messagesInitialGroupId: null as string | null,
    messagesInitialPeerName: null as string | null,
    messagesInitialMessageId: null as string | null,
    showPropertyDrawer: false,
    propertyDrawerItemId: null as string | null,
    propertyDrawerZoneId: null as string | null,
    propertyDrawerCustody: false,
    propertyDrawerShortages: false,
    showLoRaDrawer: false,
    showTC3Drawer: false,
    showMapOverlayDrawer: false,
    mapOverlayDrawerOverlayId: null as string | null,
    mapOverlayDrawerFeatureId: null as string | null,
    showCalendarDrawer: false,
    calendarDrawerEventId: null as string | null,
    calendarDrawerEventEditMode: false,
    calendarDrawerInitialDate: null as string | null,
    pendingCalendarAction: null as 'new' | null,
    calendarPrefill: null as CalendarPrefill | null,
    calendarReturnTo: null as CalendarReturn | null,
    showAdminDrawer: false,
    showSupervisorDrawer: false,
    showProviderDrawer: false,
    showUserGuideDrawer: false,
    userGuideDrawerSectionId: null as string | null,
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
    kbInitialMedevacReq: MedevacRequest | null
    isWriteNoteVisible: boolean
    writeNoteData: WriteNoteData | null
    showTrainingDrawer: boolean
    trainingDrawerTaskId: string | null
    showMessagesDrawer: boolean
    messagesInitialPeerId: string | null
    messagesInitialGroupId: string | null
    messagesInitialPeerName: string | null
    messagesInitialMessageId: string | null
    showPropertyDrawer: boolean
    propertyDrawerItemId: string | null
    propertyDrawerZoneId: string | null
    propertyDrawerCustody: boolean
    propertyDrawerShortages: boolean
    showLoRaDrawer: boolean
    showTC3Drawer: boolean
    showMapOverlayDrawer: boolean
    mapOverlayDrawerOverlayId: string | null
    mapOverlayDrawerFeatureId: string | null
    showCalendarDrawer: boolean
    calendarDrawerEventId: string | null
    calendarDrawerEventEditMode: boolean
    calendarDrawerInitialDate: string | null
    pendingCalendarAction: 'new' | null
    calendarPrefill: CalendarPrefill | null
    calendarReturnTo: CalendarReturn | null
    showAdminDrawer: boolean
    showSupervisorDrawer: boolean
    showProviderDrawer: boolean
    showUserGuideDrawer: boolean
    /** Deep-link target: a section/subsection id the guide should scroll to on open. */
    userGuideDrawerSectionId: string | null
    isMobile: boolean
}

interface NavigationActions {
    /** Set up media query listener. Returns cleanup function. */
    init: () => () => void

    // Navigation
    handleNavigation: (result: SearchResultType) => void
    handleBackClick: () => void
    /** Jump straight to an algorithm by its id (the subCat `icon`), e.g. from a
     *  "Screen X if present" disposition redirect. No-op if id isn't in catData. */
    navigateToAlgorithm: (algorithmId: string) => void

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
    setShowKnowledgeBase: (show: boolean, initialView?: string | null, initialMedication?: medListTypes | null, initialScreenerId?: string | null, initialMedevacReq?: MedevacRequest | null) => void
    setShowTrainingDrawer: (taskId: string | null) => void
    setShowMessagesDrawer: (show: boolean) => void
    openMessagesConversation: (peerId: string | null, groupId: string | null, peerName: string | null) => void
    clearMessagesConversation: () => void
    clearMessagesInitialMessageId: () => void
    setShowPropertyDrawer: (show: boolean, itemId?: string | null) => void
    clearPropertyDrawerItemId: () => void
    /** Open the property drawer and deep-link the canvas to a zone (search). */
    openPropertyZone: (zoneId: string) => void
    /** Open the property drawer straight to the Custody / DA 2062 tab (search). */
    openPropertyCustody: () => void
    /** Open the property drawer straight to the Shortages report (mission overview). */
    openPropertyShortages: () => void
    clearPropertyDeepLink: () => void
    setShowLoRaDrawer: (show: boolean) => void
    setShowTC3Drawer: (show: boolean) => void
    setShowMapOverlayDrawer: (show: boolean, overlayId?: string | null, featureId?: string | null) => void
    setShowCalendarDrawer: (show: boolean, initialDate?: string | null) => void
    openCalendarEvent: (eventId: string) => void
    openCalendarEventForEdit: (eventId: string) => void
    clearCalendarDrawerEventId: () => void
    clearCalendarDrawerInitialDate: () => void
    requestNewCalendarEvent: (prefill?: CalendarPrefill, returnTo?: CalendarReturn) => void
    clearPendingCalendarAction: () => void
    clearCalendarPrefill: () => void
    /** After a deep-linked event is saved/cancelled, reopen the originating
     *  conversation scrolled to its message. No-op when no return target. */
    returnFromCalendar: () => void
    setShowAdminDrawer: (show: boolean) => void
    setShowSupervisorDrawer: (show: boolean) => void
    setShowProviderDrawer: (show: boolean) => void
    /** Open the User Guide drawer, optionally deep-linked to a section/subsection id. */
    setShowUserGuideDrawer: (show: boolean, sectionId?: string | null) => void
    /** Set the deep-link target only — for a host that already has the guide open. */
    setUserGuideSection: (sectionId: string) => void
    clearUserGuideSection: () => void
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
    kbInitialMedevacReq: null,
    isWriteNoteVisible: false,
    writeNoteData: null,
    showTrainingDrawer: false,
    trainingDrawerTaskId: null,
    showMessagesDrawer: false,
    messagesInitialPeerId: null,
    messagesInitialGroupId: null,
    messagesInitialPeerName: null,
    messagesInitialMessageId: null,
    showPropertyDrawer: false,
    propertyDrawerItemId: null,
    propertyDrawerZoneId: null,
    propertyDrawerCustody: false,
    propertyDrawerShortages: false,
    showLoRaDrawer: false,
    showTC3Drawer: false,
    showMapOverlayDrawer: false,
    mapOverlayDrawerOverlayId: null,
    mapOverlayDrawerFeatureId: null,
    showCalendarDrawer: false,
    calendarDrawerEventId: null,
    calendarDrawerEventEditMode: false,
    calendarDrawerInitialDate: null,
    pendingCalendarAction: null,
    calendarPrefill: null,
    calendarReturnTo: null,
    showAdminDrawer: false,
    showSupervisorDrawer: false,
    showProviderDrawer: false,
    showUserGuideDrawer: false,
    userGuideDrawerSectionId: null,
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

    navigateToAlgorithm: (algorithmId) => {
        const category = catData.find(c => c.contents?.some(s => s.icon === algorithmId))
        const symptom = category?.contents?.find(s => s.icon === algorithmId)
        if (!category || !symptom) return
        get().handleNavigation({
            type: 'CC',
            id: symptom.id,
            icon: symptom.icon,
            text: symptom.text,
            data: {
                categoryId: category.id,
                symptomId: symptom.id,
                categoryRef: category,
                symptomRef: symptom,
            },
        })
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

    setShowKnowledgeBase: (show, initialView, initialMedication, initialScreenerId, initialMedevacReq) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showKnowledgeBase: show,
        kbInitialView: show ? (initialView ?? null) : null,
        kbInitialMedication: show ? (initialMedication ?? null) : null,
        kbInitialScreenerId: show ? (initialScreenerId ?? null) : null,
        kbInitialMedevacReq: show ? (initialMedevacReq ?? null) : null,
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
        messagesInitialMessageId: null,
    }),

    clearMessagesInitialMessageId: () => set({ messagesInitialMessageId: null }),

    setShowPropertyDrawer: (show, itemId) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showPropertyDrawer: show,
        propertyDrawerItemId: show ? (itemId ?? null) : null,
        propertyDrawerZoneId: null,
        propertyDrawerCustody: false,
        propertyDrawerShortages: false,
    })),

    clearPropertyDrawerItemId: () => set({ propertyDrawerItemId: null }),

    openPropertyZone: (zoneId) => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showPropertyDrawer: true,
        propertyDrawerItemId: null,
        propertyDrawerZoneId: zoneId,
        propertyDrawerCustody: false,
        propertyDrawerShortages: false,
    })),

    openPropertyCustody: () => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showPropertyDrawer: true,
        propertyDrawerItemId: null,
        propertyDrawerZoneId: null,
        propertyDrawerCustody: true,
        propertyDrawerShortages: false,
    })),

    openPropertyShortages: () => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showPropertyDrawer: true,
        propertyDrawerItemId: null,
        propertyDrawerZoneId: null,
        propertyDrawerCustody: false,
        propertyDrawerShortages: true,
    })),

    clearPropertyDeepLink: () => set({ propertyDrawerZoneId: null, propertyDrawerCustody: false, propertyDrawerShortages: false }),

    setShowLoRaDrawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showLoRaDrawer: show,
    })),

    setShowTC3Drawer: (show) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showTC3Drawer: show,
    })),

    setShowMapOverlayDrawer: (show, overlayId, featureId) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showMapOverlayDrawer: show,
        mapOverlayDrawerOverlayId: show ? (overlayId ?? null) : null,
        mapOverlayDrawerFeatureId: show ? (featureId ?? null) : null,
    })),

    setShowCalendarDrawer: (show, initialDate) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showCalendarDrawer: show,
        calendarDrawerInitialDate: show ? (initialDate ?? null) : null,
    })),

    openCalendarEvent: (eventId) => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showCalendarDrawer: true,
        calendarDrawerEventId: eventId,
        calendarDrawerEventEditMode: false,
    })),

    openCalendarEventForEdit: (eventId) => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showCalendarDrawer: true,
        calendarDrawerEventId: eventId,
        calendarDrawerEventEditMode: true,
    })),

    clearCalendarDrawerEventId: () => set({ calendarDrawerEventId: null, calendarDrawerEventEditMode: false }),

    clearCalendarDrawerInitialDate: () => set({ calendarDrawerInitialDate: null }),

    requestNewCalendarEvent: (prefill, returnTo) => set((s) => ({
        ...CLOSE_ALL_DRAWERS,
        ...PRESERVED_FIELDS(s),
        showCalendarDrawer: true,
        pendingCalendarAction: 'new',
        calendarPrefill: prefill ?? null,
        calendarReturnTo: returnTo ?? null,
    })),

    clearPendingCalendarAction: () => set({ pendingCalendarAction: null }),

    clearCalendarPrefill: () => set({ calendarPrefill: null }),

    returnFromCalendar: () => {
        const r = get().calendarReturnTo
        if (!r) return
        set((s) => ({
            ...CLOSE_ALL_DRAWERS,
            ...PRESERVED_FIELDS(s),
            showMessagesDrawer: true,
            messagesInitialPeerId: r.isGroup ? null : r.conversationId,
            messagesInitialGroupId: r.isGroup ? r.conversationId : null,
            messagesInitialPeerName: r.peerName ?? null,
            messagesInitialMessageId: r.messageId,
        }))
    },

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

    setShowUserGuideDrawer: (show, sectionId) => set((s) => ({
        ...(show ? CLOSE_ALL_DRAWERS : {}),
        ...PRESERVED_FIELDS(s),
        showUserGuideDrawer: show,
        userGuideDrawerSectionId: show ? (sectionId ?? null) : null,
    })),

    // Deep-link WITHOUT opening the standalone drawer. Settings hosts the guide
    // nested in its own panes on desktop, so a "Read more" tapped from there must
    // not run CLOSE_ALL_DRAWERS — that would close the Settings drawer the guide
    // is being read inside of.
    setUserGuideSection: (sectionId) => set({ userGuideDrawerSectionId: sectionId }),

    clearUserGuideSection: () => set({ userGuideDrawerSectionId: null }),

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
