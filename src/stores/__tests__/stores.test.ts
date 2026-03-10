// @vitest-environment jsdom
/**
 * Unit tests for Zustand stores: usePropertyStore and useNavigationStore.
 *
 * These stores manage UI state for property management and app navigation.
 * Tests use getState()/setState() directly — no React rendering needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PropertyItem } from '../../Types/PropertyTypes'
import type { SearchResultType } from '../../Types/CatTypes'

// ── Mocks ─────────────────────────────────────────────────────────────────

// Polyfill matchMedia before any store module evaluates (jsdom lacks it).
// vi.hoisted runs before vi.mock and before imports.
vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }),
  })
})

// vi.mock factory is hoisted — cannot reference outer variables.
// Define mock data inline, then re-export matching references below.
vi.mock('../../Data/CatData', () => ({
  catData: [{
    id: 1,
    icon: '🏥',
    text: 'Trauma',
    isParent: false,
    contents: [{
      id: 10,
      icon: '🩹',
      text: 'Wound Care',
      gen: [],
      medcom: [],
      stp: [],
    }],
  }],
}))

/** Matching mock objects for use in test assertions. */
const mockSymptom = {
  id: 10,
  icon: '🩹',
  text: 'Wound Care',
  gen: [],
  medcom: [],
  stp: [],
}

const mockCategory = {
  id: 1,
  icon: '🏥',
  text: 'Trauma',
  isParent: false,
  contents: [mockSymptom],
}

// Import stores after mocks are in place
import { usePropertyStore } from '../usePropertyStore'
import { useNavigationStore } from '../useNavigationStore'
import {
  selectShowQuestionCard,
  selectIsMobileColumnB,
  selectColumnAPanel,
  selectMobileGridClass,
} from '../useNavigationStore'

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════

/** Minimal PropertyItem stub for testing. */
const mockItem = (overrides?: Partial<PropertyItem>): PropertyItem =>
  ({ id: 'item-1', name: 'Test Item', ...overrides }) as PropertyItem

const mockItemA = mockItem({ id: 'item-a', name: 'Item A' })
const mockItemB = mockItem({ id: 'item-b', name: 'Item B' })

// ═════════════════════════════════════════════════════════════════════════
// 1. usePropertyStore
// ═════════════════════════════════════════════════════════════════════════

describe('usePropertyStore', () => {
  const { getState, setState } = usePropertyStore

  /** Capture initial state once for reset. */
  const INITIAL_STATE = getState()

  beforeEach(() => {
    // Reset to initial state between tests
    setState({
      selectedItem: null,
      editingItem: null,
      selectedZoneId: null,
      canvasStack: [],
      rootLocationId: null,
      defaultLocationId: null,
      holderFilter: null,
    })
  })

  // ── Initial state ───────────────────────────────────────────────────

  it('has correct initial state', () => {
    const s = getState()
    expect(s.selectedItem).toBeNull()
    expect(s.editingItem).toBeNull()
    expect(s.selectedZoneId).toBeNull()
    expect(s.canvasStack).toEqual([])
    expect(s.rootLocationId).toBeNull()
    expect(s.defaultLocationId).toBeNull()
    expect(s.holderFilter).toBeNull()
  })

  // ── selectItem ──────────────────────────────────────────────────────

  it('selectItem sets selectedItem', () => {
    getState().selectItem(mockItemA)
    expect(getState().selectedItem).toBe(mockItemA)
  })

  it('selectItem clears selectedItem with null', () => {
    getState().selectItem(mockItemA)
    getState().selectItem(null)
    expect(getState().selectedItem).toBeNull()
  })

  // ── setEditingItem ──────────────────────────────────────────────────

  it('setEditingItem sets editingItem', () => {
    getState().setEditingItem(mockItemB)
    expect(getState().editingItem).toBe(mockItemB)
  })

  it('setEditingItem clears editingItem with null', () => {
    getState().setEditingItem(mockItemB)
    getState().setEditingItem(null)
    expect(getState().editingItem).toBeNull()
  })

  // ── selectZone ──────────────────────────────────────────────────────

  it('selectZone sets selectedZoneId', () => {
    getState().selectZone('zone-1')
    expect(getState().selectedZoneId).toBe('zone-1')
  })

  it('selectZone clears selectedZoneId with null', () => {
    getState().selectZone('zone-1')
    getState().selectZone(null)
    expect(getState().selectedZoneId).toBeNull()
  })

  // ── navigateInto ────────────────────────────────────────────────────

  it('navigateInto pushes zoneId onto canvasStack and sets selectedZoneId', () => {
    getState().navigateInto('zone-a')

    const s = getState()
    expect(s.canvasStack).toEqual(['zone-a'])
    expect(s.selectedZoneId).toBe('zone-a')
  })

  it('navigateInto multiple times builds up the stack', () => {
    getState().navigateInto('zone-a')
    getState().navigateInto('zone-b')
    getState().navigateInto('zone-c')

    const s = getState()
    expect(s.canvasStack).toEqual(['zone-a', 'zone-b', 'zone-c'])
    expect(s.selectedZoneId).toBe('zone-c')
  })

  // ── navigateBack ────────────────────────────────────────────────────

  it('navigateBack pops last entry and sets selectedZoneId to new top', () => {
    getState().navigateInto('zone-a')
    getState().navigateInto('zone-b')
    getState().navigateBack()

    const s = getState()
    expect(s.canvasStack).toEqual(['zone-a'])
    expect(s.selectedZoneId).toBe('zone-a')
  })

  it('navigateBack from single-entry stack results in empty stack and null selectedZoneId', () => {
    getState().navigateInto('zone-a')
    getState().navigateBack()

    const s = getState()
    expect(s.canvasStack).toEqual([])
    expect(s.selectedZoneId).toBeNull()
  })

  it('navigateBack from empty stack stays empty with null selectedZoneId', () => {
    getState().navigateBack()

    const s = getState()
    expect(s.canvasStack).toEqual([])
    expect(s.selectedZoneId).toBeNull()
  })

  // ── navigateToPath ──────────────────────────────────────────────────

  it('navigateToPath replaces entire stack and sets selectedZoneId to last entry', () => {
    getState().navigateInto('old-zone')
    getState().navigateToPath(['zone-x', 'zone-y', 'zone-z'])

    const s = getState()
    expect(s.canvasStack).toEqual(['zone-x', 'zone-y', 'zone-z'])
    expect(s.selectedZoneId).toBe('zone-z')
  })

  it('navigateToPath with empty array clears stack and sets selectedZoneId to null', () => {
    getState().navigateInto('zone-a')
    getState().navigateToPath([])

    const s = getState()
    expect(s.canvasStack).toEqual([])
    expect(s.selectedZoneId).toBeNull()
  })

  // ── Simple setters ──────────────────────────────────────────────────

  it('setRootLocationId sets rootLocationId', () => {
    getState().setRootLocationId('root-1')
    expect(getState().rootLocationId).toBe('root-1')
  })

  it('setRootLocationId clears with null', () => {
    getState().setRootLocationId('root-1')
    getState().setRootLocationId(null)
    expect(getState().rootLocationId).toBeNull()
  })

  it('setDefaultLocationId sets defaultLocationId', () => {
    getState().setDefaultLocationId('loc-1')
    expect(getState().defaultLocationId).toBe('loc-1')
  })

  it('setDefaultLocationId clears with null', () => {
    getState().setDefaultLocationId('loc-1')
    getState().setDefaultLocationId(null)
    expect(getState().defaultLocationId).toBeNull()
  })

  it('setHolderFilter sets holderFilter', () => {
    getState().setHolderFilter('holder-1')
    expect(getState().holderFilter).toBe('holder-1')
  })

  it('setHolderFilter clears with null', () => {
    getState().setHolderFilter('holder-1')
    getState().setHolderFilter(null)
    expect(getState().holderFilter).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. useNavigationStore
// ═════════════════════════════════════════════════════════════════════════

describe('useNavigationStore', () => {
  const { getState, setState } = useNavigationStore

  beforeEach(() => {
    vi.useFakeTimers()
    setState({
      viewState: 'main',
      selectedCategory: null,
      selectedSymptom: null,
      selectedGuideline: null,
      isMenuOpen: false,
      showNoteImport: false,
      showSettings: false,
      isSearchExpanded: false,
      showSymptomInfo: false,
      showKnowledgeBase: false,
      kbInitialView: null,
      kbInitialMedication: null,
      isWriteNoteVisible: false,
      writeNoteData: null,
      showTrainingDrawer: false,
      trainingDrawerTaskId: null,
      showMessagesDrawer: false,
      showPropertyDrawer: false,
      showAdminDrawer: false,
      showSupervisorDrawer: false,
      isMobile: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Initial state ───────────────────────────────────────────────────

  it('has correct initial state', () => {
    const s = getState()
    expect(s.viewState).toBe('main')
    expect(s.selectedCategory).toBeNull()
    expect(s.selectedSymptom).toBeNull()
    expect(s.selectedGuideline).toBeNull()
    expect(s.isMenuOpen).toBe(false)
    expect(s.showSettings).toBe(false)
    expect(s.showMessagesDrawer).toBe(false)
    expect(s.showPropertyDrawer).toBe(false)
    expect(s.showAdminDrawer).toBe(false)
    expect(s.showSupervisorDrawer).toBe(false)
    expect(s.showTrainingDrawer).toBe(false)
    expect(s.isWriteNoteVisible).toBe(false)
    expect(s.writeNoteData).toBeNull()
  })

  // ── handleNavigation ────────────────────────────────────────────────

  describe('handleNavigation', () => {
    it('navigates to category — sets viewState to subcategory', () => {
      const result: SearchResultType = {
        type: 'category',
        id: 1,
        icon: '🏥',
        text: 'Trauma',
        data: { categoryRef: mockCategory as any },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.viewState).toBe('subcategory')
      expect(s.selectedCategory).toBe(mockCategory)
      expect(s.selectedSymptom).toBeNull()
      expect(s.isSearchExpanded).toBe(false)
    })

    it('navigates to CC — sets viewState to questions with category and symptom', () => {
      const result: SearchResultType = {
        type: 'CC',
        id: 10,
        icon: '🩹',
        text: 'Wound Care',
        data: {
          categoryRef: mockCategory as any,
          symptomRef: mockSymptom as any,
        },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.viewState).toBe('questions')
      expect(s.selectedCategory).toBe(mockCategory)
      expect(s.selectedSymptom).toBe(mockSymptom)
      expect(s.selectedGuideline).toBeNull()
      expect(s.isSearchExpanded).toBe(false)
    })

    it('navigates to CC using catData lookup when no refs provided', () => {
      const result: SearchResultType = {
        type: 'CC',
        id: 10,
        icon: '🩹',
        text: 'Wound Care',
        data: { categoryId: 1 },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.viewState).toBe('questions')
      expect(s.selectedCategory).toEqual(mockCategory)
      expect(s.selectedSymptom).toEqual(mockSymptom)
    })

    it('navigates to DDX — sets viewState to questions with guideline', () => {
      const result: SearchResultType = {
        type: 'DDX',
        id: 99,
        icon: '🔬',
        text: 'Differential',
        data: {
          categoryRef: mockCategory as any,
          symptomRef: mockSymptom as any,
          guidelineId: 42,
        },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.viewState).toBe('questions')
      expect(s.selectedCategory).toBe(mockCategory)
      expect(s.selectedSymptom).toBe(mockSymptom)
      expect(s.selectedGuideline).toEqual({
        type: 'DDX',
        id: 42,
        symptomId: 10,
      })
    })

    it('navigates to medication — opens knowledge base with medication data', () => {
      const mockMed = { name: 'Aspirin' } as any
      const result: SearchResultType = {
        type: 'medication',
        id: 1,
        icon: '💊',
        text: 'Aspirin',
        data: { medicationData: mockMed },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.showKnowledgeBase).toBe(true)
      expect(s.kbInitialView).toBe('medication-detail')
      expect(s.kbInitialMedication).toBe(mockMed)
    })

    it('training type does not change navigation state', () => {
      const before = { ...getState() }
      const result: SearchResultType = {
        type: 'training',
        id: 1,
        icon: '📚',
        text: 'Training Task',
      }

      getState().handleNavigation(result)

      const after = getState()
      expect(after.viewState).toBe(before.viewState)
      expect(after.selectedCategory).toBe(before.selectedCategory)
    })

    it('CC navigation closes all open drawers', () => {
      // Open several drawers first
      setState({
        showSettings: true,
        showMessagesDrawer: true,
        showPropertyDrawer: true,
        isMenuOpen: true,
      })

      const result: SearchResultType = {
        type: 'CC',
        id: 10,
        icon: '🩹',
        text: 'Wound Care',
        data: {
          categoryRef: mockCategory as any,
          symptomRef: mockSymptom as any,
        },
      }

      getState().handleNavigation(result)

      const s = getState()
      expect(s.showSettings).toBe(false)
      expect(s.showMessagesDrawer).toBe(false)
      expect(s.showPropertyDrawer).toBe(false)
      expect(s.isMenuOpen).toBe(false)
    })
  })

  // ── handleBackClick ─────────────────────────────────────────────────

  describe('handleBackClick', () => {
    it('from guideline — clears guideline, keeps symptom and category', () => {
      setState({
        viewState: 'questions',
        selectedCategory: mockCategory as any,
        selectedSymptom: mockSymptom as any,
        selectedGuideline: { type: 'DDX', id: 1, symptomId: 10 },
      })

      getState().handleBackClick()

      const s = getState()
      expect(s.selectedGuideline).toBeNull()
      expect(s.selectedSymptom).toBe(mockSymptom)
      expect(s.selectedCategory).toBe(mockCategory)
      expect(s.viewState).toBe('questions')
    })

    it('from questions (symptom selected) — clears symptom, goes to subcategory', () => {
      setState({
        viewState: 'questions',
        selectedCategory: mockCategory as any,
        selectedSymptom: mockSymptom as any,
        selectedGuideline: null,
      })

      getState().handleBackClick()

      const s = getState()
      expect(s.selectedSymptom).toBeNull()
      expect(s.selectedGuideline).toBeNull()
      expect(s.viewState).toBe('subcategory')
      expect(s.selectedCategory).toBe(mockCategory)
    })

    it('from subcategory (category selected) — clears category, goes to main', () => {
      setState({
        viewState: 'subcategory',
        selectedCategory: mockCategory as any,
        selectedSymptom: null,
        selectedGuideline: null,
      })

      getState().handleBackClick()

      const s = getState()
      expect(s.viewState).toBe('main')
      expect(s.selectedCategory).toBeNull()
      expect(s.selectedSymptom).toBeNull()
      expect(s.selectedGuideline).toBeNull()
    })

    it('from main with nothing selected — no-op', () => {
      const before = { ...getState() }

      getState().handleBackClick()

      const after = getState()
      expect(after.viewState).toBe(before.viewState)
      expect(after.selectedCategory).toBe(before.selectedCategory)
    })
  })

  // ── CLOSE_ALL_DRAWERS pattern ───────────────────────────────────────

  describe('CLOSE_ALL_DRAWERS pattern', () => {
    it('opening settings closes all other drawers', () => {
      setState({
        showMessagesDrawer: true,
        showPropertyDrawer: true,
        showAdminDrawer: true,
        showKnowledgeBase: true,
        isMenuOpen: true,
      })

      getState().setShowSettings(true)

      const s = getState()
      expect(s.showSettings).toBe(true)
      expect(s.showMessagesDrawer).toBe(false)
      expect(s.showPropertyDrawer).toBe(false)
      expect(s.showAdminDrawer).toBe(false)
      expect(s.showKnowledgeBase).toBe(false)
      expect(s.isMenuOpen).toBe(false)
    })

    it('opening messages closes all other drawers', () => {
      setState({
        showSettings: true,
        showPropertyDrawer: true,
        showTrainingDrawer: true,
      })

      getState().setShowMessagesDrawer(true)

      const s = getState()
      expect(s.showMessagesDrawer).toBe(true)
      expect(s.showSettings).toBe(false)
      expect(s.showPropertyDrawer).toBe(false)
      expect(s.showTrainingDrawer).toBe(false)
    })

    it('preserved fields survive drawer toggles', () => {
      setState({
        viewState: 'questions',
        selectedCategory: mockCategory as any,
        selectedSymptom: mockSymptom as any,
        isWriteNoteVisible: true,
        writeNoteData: { disposition: 'evac' } as any,
      })

      getState().setShowSettings(true)

      const s = getState()
      // Preserved fields should survive
      expect(s.viewState).toBe('questions')
      expect(s.selectedCategory).toBe(mockCategory)
      expect(s.selectedSymptom).toBe(mockSymptom)
      expect(s.isWriteNoteVisible).toBe(true)
      expect(s.writeNoteData).toEqual({ disposition: 'evac' })
    })

    it('closing a drawer does not apply CLOSE_ALL_DRAWERS', () => {
      setState({
        showSettings: true,
        showMessagesDrawer: true,
      })

      // Closing settings (show=false) should NOT close messages
      getState().setShowSettings(false)

      const s = getState()
      expect(s.showSettings).toBe(false)
      expect(s.showMessagesDrawer).toBe(true)
    })
  })

  // ── toggleMenu ──────────────────────────────────────────────────────

  describe('toggleMenu', () => {
    it('toggles isMenuOpen from false to true', () => {
      getState().toggleMenu()
      expect(getState().isMenuOpen).toBe(true)
    })

    it('toggles isMenuOpen from true to false', () => {
      setState({ isMenuOpen: true })
      getState().toggleMenu()
      expect(getState().isMenuOpen).toBe(false)
    })
  })

  // ── closeMenu ───────────────────────────────────────────────────────

  it('closeMenu sets isMenuOpen to false', () => {
    setState({ isMenuOpen: true })
    getState().closeMenu()
    expect(getState().isMenuOpen).toBe(false)
  })

  // ── Search expansion ────────────────────────────────────────────────

  describe('search expansion', () => {
    it('setSearchExpanded sets isSearchExpanded directly', () => {
      getState().setSearchExpanded(true)
      expect(getState().isSearchExpanded).toBe(true)

      getState().setSearchExpanded(false)
      expect(getState().isSearchExpanded).toBe(false)
    })

    it('toggleSearchExpanded flips isSearchExpanded', () => {
      getState().toggleSearchExpanded()
      expect(getState().isSearchExpanded).toBe(true)

      getState().toggleSearchExpanded()
      expect(getState().isSearchExpanded).toBe(false)
    })

    it('expandSearchOnMobile expands only when isMobile is true', () => {
      setState({ isMobile: false })
      getState().expandSearchOnMobile()
      expect(getState().isSearchExpanded).toBe(false)

      setState({ isMobile: true })
      getState().expandSearchOnMobile()
      expect(getState().isSearchExpanded).toBe(true)
    })

    it('expandSearchOnMobile does nothing if already expanded', () => {
      setState({ isMobile: true, isSearchExpanded: true })

      // Should not throw or change state
      getState().expandSearchOnMobile()
      expect(getState().isSearchExpanded).toBe(true)
    })
  })

  // ── Drawer-specific setters ─────────────────────────────────────────

  describe('drawer setters', () => {
    it('setShowTrainingDrawer opens with taskId', () => {
      getState().setShowTrainingDrawer('task-123')

      const s = getState()
      expect(s.showTrainingDrawer).toBe(true)
      expect(s.trainingDrawerTaskId).toBe('task-123')
    })

    it('setShowTrainingDrawer closes with null', () => {
      setState({ showTrainingDrawer: true, trainingDrawerTaskId: 'task-123' })
      getState().setShowTrainingDrawer(null)

      const s = getState()
      expect(s.showTrainingDrawer).toBe(false)
      expect(s.trainingDrawerTaskId).toBeNull()
    })

    it('setShowPropertyDrawer opens property drawer', () => {
      getState().setShowPropertyDrawer(true)
      expect(getState().showPropertyDrawer).toBe(true)
    })

    it('setShowAdminDrawer opens admin drawer', () => {
      getState().setShowAdminDrawer(true)
      expect(getState().showAdminDrawer).toBe(true)
    })

    it('setShowSupervisorDrawer opens supervisor drawer', () => {
      getState().setShowSupervisorDrawer(true)
      expect(getState().showSupervisorDrawer).toBe(true)
    })

    it('setShowKnowledgeBase opens with initialView and medication', () => {
      const mockMed = { name: 'Morphine' } as any
      getState().setShowKnowledgeBase(true, 'medication-detail', mockMed)

      const s = getState()
      expect(s.showKnowledgeBase).toBe(true)
      expect(s.kbInitialView).toBe('medication-detail')
      expect(s.kbInitialMedication).toBe(mockMed)
    })

    it('setShowKnowledgeBase closing clears initialView and medication', () => {
      setState({
        showKnowledgeBase: true,
        kbInitialView: 'medication-detail',
        kbInitialMedication: { name: 'Morphine' } as any,
      })

      getState().setShowKnowledgeBase(false)

      const s = getState()
      expect(s.showKnowledgeBase).toBe(false)
      expect(s.kbInitialView).toBeNull()
      expect(s.kbInitialMedication).toBeNull()
    })

    it('setShowNoteImport opens and closes', () => {
      getState().setShowNoteImport(true)
      expect(getState().showNoteImport).toBe(true)

      getState().setShowNoteImport(false)
      expect(getState().showNoteImport).toBe(false)
    })

    it('toggleSymptomInfo flips showSymptomInfo', () => {
      getState().toggleSymptomInfo()
      expect(getState().showSymptomInfo).toBe(true)

      getState().toggleSymptomInfo()
      expect(getState().showSymptomInfo).toBe(false)
    })

    it('setShowSymptomInfo opens with CLOSE_ALL_DRAWERS', () => {
      setState({ showSettings: true, showMessagesDrawer: true })

      getState().setShowSymptomInfo(true)

      const s = getState()
      expect(s.showSymptomInfo).toBe(true)
      expect(s.showSettings).toBe(false)
      expect(s.showMessagesDrawer).toBe(false)
    })
  })

  // ── WriteNote ───────────────────────────────────────────────────────

  describe('writeNote', () => {
    const mockWriteNoteData = {
      disposition: 'evac' as any,
      algorithmOptions: [],
      cardStates: [],
      selectedSymptom: { icon: '🩹', text: 'Wound' },
    }

    it('openWriteNote sets isWriteNoteVisible and writeNoteData', () => {
      getState().openWriteNote(mockWriteNoteData)

      const s = getState()
      expect(s.isWriteNoteVisible).toBe(true)
      expect(s.writeNoteData).toEqual(mockWriteNoteData)
    })

    it('closeWriteNote sets isWriteNoteVisible to false immediately', () => {
      getState().openWriteNote(mockWriteNoteData)
      getState().closeWriteNote()

      expect(getState().isWriteNoteVisible).toBe(false)
      // writeNoteData still present (cleared after 350ms timeout)
      expect(getState().writeNoteData).toEqual(mockWriteNoteData)
    })

    it('closeWriteNote clears writeNoteData after animation delay', () => {
      getState().openWriteNote(mockWriteNoteData)
      getState().closeWriteNote()

      // Advance past the 350ms animation buffer
      vi.advanceTimersByTime(350)

      expect(getState().writeNoteData).toBeNull()
    })

    it('closeWriteNote does not clear writeNoteData if reopened during delay', () => {
      getState().openWriteNote(mockWriteNoteData)
      getState().closeWriteNote()

      // Re-open before the 350ms timeout fires
      const newData = { ...mockWriteNoteData, disposition: 'rtu' as any }
      getState().openWriteNote(newData)

      // Advance past the timeout
      vi.advanceTimersByTime(350)

      // Should NOT have been cleared because isWriteNoteVisible is now true
      expect(getState().isWriteNoteVisible).toBe(true)
      expect(getState().writeNoteData).toEqual(newData)
    })
  })

  // ── resetToMain ─────────────────────────────────────────────────────

  it('resetToMain restores navigation to main view', () => {
    setState({
      viewState: 'questions',
      selectedCategory: mockCategory as any,
      selectedSymptom: mockSymptom as any,
      selectedGuideline: { type: 'DDX', id: 1, symptomId: 10 },
      isWriteNoteVisible: true,
      writeNoteData: { disposition: 'evac' } as any,
    })

    getState().resetToMain()

    const s = getState()
    expect(s.viewState).toBe('main')
    expect(s.selectedCategory).toBeNull()
    expect(s.selectedSymptom).toBeNull()
    expect(s.selectedGuideline).toBeNull()
    expect(s.isWriteNoteVisible).toBe(false)
    expect(s.writeNoteData).toBeNull()
  })

  // ── Selectors ───────────────────────────────────────────────────────

  describe('selectors', () => {
    it('selectShowQuestionCard returns true when symptom selected and viewState is questions', () => {
      const state = {
        ...getState(),
        selectedSymptom: mockSymptom as any,
        viewState: 'questions' as const,
      }
      expect(selectShowQuestionCard(state)).toBe(true)
    })

    it('selectShowQuestionCard returns false when no symptom', () => {
      const state = { ...getState(), selectedSymptom: null, viewState: 'questions' as const }
      expect(selectShowQuestionCard(state)).toBe(false)
    })

    it('selectShowQuestionCard returns false when viewState is not questions', () => {
      const state = {
        ...getState(),
        selectedSymptom: mockSymptom as any,
        viewState: 'subcategory' as const,
      }
      expect(selectShowQuestionCard(state)).toBe(false)
    })

    it('selectIsMobileColumnB returns true when isMobile and search expanded', () => {
      const state = { ...getState(), isMobile: true, isSearchExpanded: true }
      expect(selectIsMobileColumnB(state)).toBe(true)
    })

    it('selectIsMobileColumnB returns true when isMobile and question card showing', () => {
      const state = {
        ...getState(),
        isMobile: true,
        selectedSymptom: mockSymptom as any,
        viewState: 'questions' as const,
      }
      expect(selectIsMobileColumnB(state)).toBe(true)
    })

    it('selectIsMobileColumnB returns false when not mobile', () => {
      const state = {
        ...getState(),
        isMobile: false,
        isSearchExpanded: true,
        selectedSymptom: mockSymptom as any,
        viewState: 'questions' as const,
      }
      expect(selectIsMobileColumnB(state)).toBe(false)
    })

    it('selectColumnAPanel returns 0 when no category selected', () => {
      expect(selectColumnAPanel(getState())).toBe(0)
    })

    it('selectColumnAPanel returns 1 when category selected but no question card', () => {
      const state = {
        ...getState(),
        selectedCategory: mockCategory as any,
        viewState: 'subcategory' as const,
      }
      expect(selectColumnAPanel(state)).toBe(1)
    })

    it('selectColumnAPanel returns 2 when question card is showing', () => {
      const state = {
        ...getState(),
        selectedCategory: mockCategory as any,
        selectedSymptom: mockSymptom as any,
        viewState: 'questions' as const,
      }
      expect(selectColumnAPanel(state)).toBe(2)
    })

    it('selectMobileGridClass returns column-B-visible class when search expanded', () => {
      const state = { ...getState(), isSearchExpanded: true }
      expect(selectMobileGridClass(state)).toBe('grid-cols-[0fr_1fr]')
    })

    it('selectMobileGridClass returns column-A-visible class by default', () => {
      expect(selectMobileGridClass(getState())).toBe('grid-cols-[1fr_0fr]')
    })
  })
})
