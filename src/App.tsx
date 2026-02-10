import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import type { ImportSuccessData } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { WriteNotePage } from './Components/WriteNotePage'
import type { NoteSaveData } from './Components/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import type { WriteNoteData } from './Hooks/useNavigation'
import { useNotesStorage } from './Hooks/useNotesStorage'
import type { SavedNote } from './Hooks/useNotesStorage'
import { useNoteRestore } from './Hooks/useNoteRestore'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import { useAppAnimate } from './Utilities/AnimationConfig'
import UpdateNotification from './Components/UpdateNotification'
import InstallPrompt from './Components/InstallPrompt'
import StorageErrorToast from './Components/StorageErrorToast'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/MedicationsDrawer'
import { ColumnA } from './Components/ColumnA'

// PWA App Shortcut: capture ?view= URL parameter once at module load time
// This runs before React StrictMode can interfere with double-mounting
const _initialViewParam = (() => {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view) {
    // Clean up URL parameter immediately so it doesn't persist
    window.history.replaceState({}, '', window.location.pathname)
  }
  return view
})()

function AppContent() {
  const searchInputRef = useRef<HTMLInputElement>(null!)
  const { theme, toggleTheme } = useTheme()

  const [contentRef] = useAppAnimate<HTMLDivElement>()

  const navigation = useNavigation()
  const search = useSearch()
  const notesStorage = useNotesStorage()
  const { restoreNote } = useNoteRestore()

  // Track whether the import shortcut was used to open import in scanning mode
  const [importInitialView, setImportInitialView] = useState<'input' | 'scanning' | undefined>(
    _initialViewParam === 'import' ? 'scanning' : undefined
  )

  // Import success modal state
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false)
  // Import duplicate modal state (shown when importing an already-saved note)
  const [showImportDuplicateModal, setShowImportDuplicateModal] = useState(false)
  // Track the note ID to pre-select in My Notes (used for duplicate import detection)
  const [myNotesInitialSelectedId, setMyNotesInitialSelectedId] = useState<string | null>(null)
  // Track which panel Settings should open to ('main' or 'my-notes')
  const [settingsInitialPanel, setSettingsInitialPanel] = useState<'main' | 'my-notes'>('main')

  // Storage error toast state — shown when localStorage operations fail
  const [storageError, setStorageError] = useState<string | null>(null)
  const clearStorageError = useCallback(() => setStorageError(null), [])

  // Track the active note being viewed in WriteNotePage (null = fresh note, string = saved note ID)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [activeNoteEncodedText, setActiveNoteEncodedText] = useState<string | null>(null)
  const [activeNoteSource, setActiveNoteSource] = useState<string | null>(null)

  // Restored algorithm state for pre-filling AlgorithmPage when viewing/editing saved notes
  const [restoredAlgorithmState, setRestoredAlgorithmState] = useState<{
    cardStates: import('./Hooks/useAlgorithm').CardState[];
    disposition: import('./Types/AlgorithmTypes').dispositionType | null;
  } | null>(null)

  // Stable key suffix for AlgorithmPage — set once when restoring, cleared when navigating away
  // This prevents AlgorithmPage from remounting when WriteNote closes (which nulls restoredAlgorithmState)
  const algorithmKeyRef = useRef<string>('fresh')

  // PWA App Shortcut: open the appropriate view based on the captured URL parameter
  useEffect(() => {
    if (_initialViewParam === 'mynotes') {
      setSettingsInitialPanel('my-notes')
      navigation.setShowSettings(true)
    } else if (_initialViewParam === 'import') {
      navigation.setShowNoteImport(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount

  // Track whether the import drawer has been opened at least once (to avoid clearing on initial mount)
  const importWasOpenedRef = useRef(false)

  // Clear the import initial view state when the import drawer is closed
  // so subsequent opens from the Import Note button use the default 'input' view
  useEffect(() => {
    if (navigation.showNoteImport) {
      importWasOpenedRef.current = true
    } else if (importWasOpenedRef.current && importInitialView) {
      setImportInitialView(undefined)
    }
  }, [navigation.showNoteImport, importInitialView])

  // Track whether the ColumnA carousel is actively being swiped.
  // This is shared with the cross-column swipe handler so only one
  // gesture system processes a swipe at a time.
  const [isCarouselSwiping, setIsCarouselSwiping] = useState(false)
  const handleCarouselSwipingChange = useCallback((swiping: boolean) => {
    setIsCarouselSwiping(swiping)
  }, [])

  // Unified swipe-back: works on both Column A panels (carousel) and Column B → Column A
  // viewDepth reflects the total navigation depth: Column A panel index + 1 when in Column B
  const swipeViewDepth = navigation.isMobileColumnB
    ? navigation.columnAPanel + 1  // Column B: depth includes all Column A panels + Column B
    : navigation.columnAPanel       // Column A: depth is the panel index (0 = home, 1 = subcategory)
  const swipe = useSwipeNavigation({
    enabled: navigation.isMobile && !search.searchInput && !navigation.isWriteNoteVisible && swipeViewDepth > 0,
    viewDepth: swipeViewDepth,
    onSwipeBack: useCallback(() => {
      navigation.handleBackClick()
    }, [navigation]),
    isCarouselSwiping,
  })

  // When WriteNote closes, only clear the encoded text reference (not the note ID/source/algorithm state)
  // This preserves the algorithm state and note status badge on the algorithm page
  useEffect(() => {
    if (!navigation.isWriteNoteVisible) {
      setActiveNoteEncodedText(null)
    }
  }, [navigation.isWriteNoteVisible])

  // Clear ALL active note tracking when navigating away from the algorithm view
  // (e.g., going back to subcategories or categories)
  useEffect(() => {
    if (!navigation.showQuestionCard) {
      setActiveNoteId(null)
      setActiveNoteEncodedText(null)
      setActiveNoteSource(null)
      setRestoredAlgorithmState(null)
      algorithmKeyRef.current = 'fresh'
    }
  }, [navigation.showQuestionCard])

  // Sync search expansion when transitioning to mobile with active search text
  useEffect(() => {
    if (navigation.isMobile && search.searchInput.trim() && !navigation.isSearchExpanded) {
      navigation.setSearchExpanded(true)
    }
  }, [navigation.isMobile, search.searchInput, navigation.isSearchExpanded, navigation.setSearchExpanded])

  const handleNavigationClick = useCallback((result: SearchResultType) => {
    // Navigation state change drives the grid column transition and Column A carousel
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation, search])

  const clearSearchAndCollapse = useCallback(() => {
    search.clearSearch()
    if (navigation.isMobile && navigation.isSearchExpanded) {
      navigation.setSearchExpanded(false)
    }
  }, [search, navigation])

  const handleBackClick = () => {
    if (search.searchInput) {
      clearSearchAndCollapse()
      return
    }

    // State change drives grid column transition and Column A carousel
    navigation.handleBackClick()
  }

  const handleImportClick = () => {
    navigation.setShowNoteImport(true)
  }

  const handleSearchChange = (value: string) => {
    if (value.trim() !== "") {
      navigation.setShowNoteImport(false)
      if (navigation.isMobile && !navigation.isSearchExpanded) {
        navigation.setSearchExpanded(true)
      }
    }
    search.handleSearchChange(value)
  }

  const handleSearchFocus = () => {
    if (navigation.isMobile && !navigation.isSearchExpanded) {
      navigation.setSearchExpanded(true)
    }
  }

  const handleClearSearch = () => {
    clearSearchAndCollapse()
  }

  // Settings click handler
  const handleSettingsClick = () => {
    navigation.setShowSettings(true)
  }

  // Expand note from algorithm page — injects HPI text from existing saved note when available
  const handleExpandNote = useCallback((data: WriteNoteData) => {
    if (activeNoteId && activeNoteEncodedText) {
      // We have an existing saved note — restore HPI text from the encoded data
      const tempNote = { id: activeNoteId, encodedText: activeNoteEncodedText, createdAt: '', symptomIcon: '', symptomText: '', dispositionType: '', dispositionText: '', previewText: '' }
      const result = restoreNote(tempNote)
      if (result.success && result.hpiText) {
        navigation.showWriteNote({ ...data, initialHpiText: result.hpiText })
        return
      }
    }
    navigation.showWriteNote(data)
  }, [activeNoteId, activeNoteEncodedText, restoreNote, navigation])

  // Note save handler (new note)
  const handleNoteSave = useCallback((data: NoteSaveData): boolean => {
    const result = notesStorage.saveNote({
      encodedText: data.encodedText,
      previewText: data.previewText,
      symptomIcon: data.symptomIcon,
      symptomText: data.symptomText,
      dispositionType: data.dispositionType,
      dispositionText: data.dispositionText,
    })
    // After saving, track the new note so the button changes to "Delete Note"
    // and the note status badge appears on the algorithm page
    if (result.success && result.noteId) {
      setActiveNoteId(result.noteId)
      setActiveNoteEncodedText(data.encodedText)
      setActiveNoteSource('device')
      return true
    }
    // Show error toast when save fails (e.g., quota exceeded)
    setStorageError(result.error || 'Failed to save note. Storage may be full.')
    return false
  }, [notesStorage])

  // Note delete handler (from WriteNotePage)
  const handleNoteDelete = useCallback((noteId: string) => {
    notesStorage.deleteNote(noteId)
    setActiveNoteId(null)
    setActiveNoteEncodedText(null)
  }, [notesStorage])

  // Note update handler (save changes to existing note)
  // When an external note is edited and re-saved, it becomes a normal saved note (source cleared)
  const handleNoteUpdate = useCallback((noteId: string, data: NoteSaveData): boolean => {
    const result = notesStorage.updateNote(noteId, {
      encodedText: data.encodedText,
      previewText: data.previewText,
      symptomIcon: data.symptomIcon,
      symptomText: data.symptomText,
      dispositionType: data.dispositionType,
      dispositionText: data.dispositionText,
      source: undefined, // Clear external source tag — edited notes become normal saved notes
    }, true) // refreshTimestamp = true
    if (result.success) {
      // Update the tracked encoded text and source to reflect the change
      setActiveNoteEncodedText(data.encodedText)
      setActiveNoteSource('device') // External notes become normal on re-save
      return true
    }
    // Show error toast when update fails
    setStorageError(result.error || 'Failed to update note. Storage may be full.')
    return false
  }, [notesStorage])

  // View note handler — restore algorithm state from saved note and open WriteNote
  const handleViewNote = useCallback((note: SavedNote) => {
    const result = restoreNote(note)
    if (!result.success || !result.writeNoteData || !result.symptom || !result.category) {
      console.warn('Failed to restore note:', result.error)
      return
    }

    // Track which saved note we're viewing
    setActiveNoteId(note.id)
    setActiveNoteEncodedText(note.encodedText)
    setActiveNoteSource(note.source || 'device')
    algorithmKeyRef.current = `restored-${note.id}`

    // Store restored algorithm state so AlgorithmPage can be pre-filled
    setRestoredAlgorithmState({
      cardStates: result.writeNoteData.cardStates,
      disposition: result.writeNoteData.disposition
    })

    // 1. Navigate to the algorithm view for this symptom
    navigation.handleNavigation({
      type: 'CC',
      id: result.symptom.id,
      icon: result.symptom.icon,
      text: result.symptom.text,
      data: {
        categoryId: result.category.id,
        symptomId: result.symptom.id,
        categoryRef: result.category,
        symptomRef: result.symptom
      }
    })

    // 2. Close Settings drawer (My Notes lives inside Settings)
    navigation.setShowSettings(false)

    // 3. Open WriteNote wizard with restored algorithm state (slight delay for navigation to complete)
    setTimeout(() => {
      navigation.showWriteNote(result.writeNoteData!)
    }, 400)
  }, [restoreNote, navigation])

  // Edit note handler — restore algorithm state and open WriteNote wizard at Page 1 (content selection) with HPI pre-filled
  const handleEditNoteInWizard = useCallback((note: SavedNote) => {
    const result = restoreNote(note)
    if (!result.success || !result.writeNoteData || !result.symptom || !result.category) {
      console.warn('Failed to restore note for editing:', result.error)
      return
    }

    // Track which saved note we're editing
    setActiveNoteId(note.id)
    setActiveNoteEncodedText(note.encodedText)
    setActiveNoteSource(note.source || 'device')
    algorithmKeyRef.current = `restored-${note.id}`

    // Store restored algorithm state so AlgorithmPage can be pre-filled
    setRestoredAlgorithmState({
      cardStates: result.writeNoteData.cardStates,
      disposition: result.writeNoteData.disposition
    })

    // 1. Navigate to the algorithm view for this symptom
    navigation.handleNavigation({
      type: 'CC',
      id: result.symptom.id,
      icon: result.symptom.icon,
      text: result.symptom.text,
      data: {
        categoryId: result.category.id,
        symptomId: result.symptom.id,
        categoryRef: result.category,
        symptomRef: result.symptom
      }
    })

    // 2. Close Settings drawer (My Notes lives inside Settings)
    navigation.setShowSettings(false)

    // 3. Open WriteNote wizard at Page 1 (content selection) with restored algorithm state and HPI
    setTimeout(() => {
      navigation.showWriteNote({
        ...result.writeNoteData!,
        initialPage: 1,
        initialHpiText: result.hpiText || ''
      })
    }, 400)
  }, [restoreNote, navigation])

  // Import success handler — checks for duplicates, saves imported note with 'external source' tag, then opens My Notes
  const handleImportSuccess = useCallback((data: ImportSuccessData) => {
    // Check for duplicate: does a note with the same encodedText already exist?
    const existingNote = notesStorage.notes.find(n => n.encodedText === data.encodedText)

    if (existingNote) {
      // Duplicate detected — navigate to My Notes with the existing note pre-selected
      // 1. Close Import drawer
      navigation.setShowNoteImport(false)

      // 2. Show duplicate feedback modal
      setShowImportDuplicateModal(true)
      setTimeout(() => setShowImportDuplicateModal(false), 2500)

      // 3. Open Settings → My Notes with the duplicate note pre-selected
      setTimeout(() => {
        setMyNotesInitialSelectedId(existingNote.id)
        setSettingsInitialPanel('my-notes')
        navigation.setShowSettings(true)
      }, 300)
      return
    }

    // Build a temporary SavedNote-like object to use restoreNote
    const tempNote: SavedNote = {
      id: '',
      encodedText: data.encodedText,
      createdAt: new Date().toISOString(),
      symptomIcon: '',
      symptomText: '',
      dispositionType: '',
      dispositionText: '',
      previewText: data.decodedText.slice(0, 200),
      source: 'external source',
    }

    // Restore note to get algorithm state + symptom/category info
    const result = restoreNote(tempNote)
    if (!result.success || !result.writeNoteData || !result.symptom || !result.category) {
      console.warn('Failed to restore imported note:', result.error)
      return
    }

    // 1. Save the note to storage with 'external source' tag
    const disposition = result.writeNoteData.disposition
    const saveResult = notesStorage.saveNote({
      encodedText: data.encodedText,
      previewText: data.decodedText.slice(0, 200),
      symptomIcon: result.symptom.icon || '',
      symptomText: result.symptom.text || 'Imported Note',
      dispositionType: disposition.type,
      dispositionText: disposition.text,
      source: 'external source',
    })

    if (!saveResult.success) {
      // Show error toast instead of success modal
      setStorageError(saveResult.error || 'Failed to import note. Storage may be full.')
      navigation.setShowNoteImport(false)
      return
    }

    // 2. Close Import drawer
    navigation.setShowNoteImport(false)

    // 3. Show success feedback modal
    setShowImportSuccessModal(true)
    setTimeout(() => setShowImportSuccessModal(false), 2500)

    // 4. Open Settings → My Notes so the user can decide what to do with the imported note
    setTimeout(() => {
      setMyNotesInitialSelectedId(null)
      setSettingsInitialPanel('my-notes')
      navigation.setShowSettings(true)
    }, 300)
  }, [restoreNote, notesStorage, navigation])

  // Title logic
  const getTitle = () => {
    if (search.searchInput) return { title: "", show: false }
    return navigation.dynamicTitle
  }

  const title = getTitle()

  // Content key — drives fade-in animation on content change
  const desktopContentKey = useMemo(() => {
    if (search.searchInput) return 'search'
    if (navigation.selectedSymptom && navigation.showQuestionCard)
      return `algo-${navigation.selectedSymptom.icon}-${algorithmKeyRef.current}`
    return 'empty'
  }, [search.searchInput, navigation.selectedSymptom, navigation.showQuestionCard])

  // Compute note status for algorithm page badge:
  // - 'saved' if we have an activeNoteId and source is not external
  // - 'external' if we have an activeNoteId and source is external
  // - null if no active note (fresh algorithm)
  const algorithmNoteStatus: 'new' | 'saved' | 'external' | null = activeNoteId
    ? (activeNoteSource === 'external source' ? 'external' : 'saved')
    : null

  return (
    <div className='h-screen bg-themewhite md:bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div className={`max-w-315 shrink flex-col w-full md:rounded-md md:border md:border-[rgba(0,0,0,0.03)] md:shadow-[0px_2px_4px] md:shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1 relative ${navigation.isMobile ? '' : 'bg-themewhite pb-10'
        }`}>
        {/* Navbar - overlaps content on mobile for blur effect, extends into safe area on iOS */}
        <div className={`${navigation.isMobile
          ? 'absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)] backdrop-blur-xs bg-themewhite/10'
          : 'relative'
          } h-13.75 w-full rounded-t-md flex justify-end`}
          style={navigation.isMobile ? { height: 'calc(env(safe-area-inset-top, 0px) + 3.4375rem)' } : undefined}>
          <NavTop
            search={{
              searchInput: search.searchInput,
              onSearchChange: handleSearchChange,
              onSearchFocus: handleSearchFocus,
              onSearchClear: handleClearSearch,
              searchInputRef: searchInputRef,
              isSearchExpanded: navigation.isSearchExpanded,
              onSearchExpandToggle: navigation.toggleSearchExpanded,
            }}
            actions={{
              onBackClick: handleBackClick,
              onMenuClick: navigation.toggleMenu,
              onMenuClose: navigation.closeMenu,
              onImportClick: handleImportClick,
              onMedicationClick: navigation.handleShowMedications,
              onSettingsClick: handleSettingsClick,
              onInfoClick: navigation.toggleSymptomInfo,
            }}
            ui={{
              showBack: navigation.shouldShowBackButton(!!search.searchInput.trim()),
              showMenu: navigation.shouldShowMenuButton(!!search.searchInput.trim()),
              dynamicTitle: title.title,
              showDynamicTitle: title.show,
              medicationButtonText: navigation.getMedicationButtonText(),
              isMobile: navigation.isMobile,
              isAlgorithmView: navigation.showQuestionCard,
              isMenuOpen: navigation.isMenuOpen,
            }}
          />
        </div>

        {/* Content area — Unified 2-column grid (A: Navigation | B: Content) */}
        <div ref={contentRef} className={`md:h-[94%] h-full relative overflow-hidden ${navigation.isMobile ? 'absolute inset-0' : 'mt-2 mx-2'
          }`}>
          <div
            className="h-full grid gap-1"
            style={{
              gridTemplateColumns: navigation.mainGridTemplate,
              transition: 'grid-template-columns 0.3s ease-in-out',
            }}
            {...(navigation.isMobile && swipeViewDepth > 0 ? swipe.touchHandlers : {})}
          >
            {/* Column A: Navigation carousel */}
            <div className="h-full overflow-hidden" style={{ minWidth: 0 }}>
              <ColumnA
                selectedCategory={navigation.selectedCategory}
                selectedSymptom={navigation.selectedSymptom}
                selectedGuideline={navigation.selectedGuideline}
                onNavigate={handleNavigationClick}
                isMobile={navigation.isMobile}
                panelIndex={navigation.columnAPanel}
                onSwipeBack={() => navigation.handleBackClick()}
                onSwipingChange={handleCarouselSwipingChange}
              />
            </div>

            {/* Column B: Content (algorithm / search / empty) */}
            <div className="h-full overflow-hidden" style={{ minWidth: 0 }}>
              <div key={desktopContentKey} className="h-full animate-desktopContentIn">
                {search.searchInput ? (
                  <div className="h-full overflow-y-auto">
                    <div
                      className="px-2 min-h-full"
                      style={navigation.isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
                    >
                      <SearchResults
                        results={search.searchResults}
                        searchTerm={search.searchInput}
                        onResultClick={handleNavigationClick}
                        isSearching={search.isSearching}
                      />
                    </div>
                  </div>
                ) : navigation.selectedSymptom && navigation.showQuestionCard ? (
                  <div className="h-full overflow-hidden">
                    <AlgorithmPage
                      key={`algo-${navigation.selectedSymptom.icon}-${algorithmKeyRef.current}`}
                      selectedSymptom={navigation.selectedSymptom}
                      onExpandNote={handleExpandNote}
                      isMobile={navigation.isMobile}
                      initialCardStates={restoredAlgorithmState?.cardStates}
                      initialDisposition={restoredAlgorithmState?.disposition}
                      noteStatus={algorithmNoteStatus}
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-secondary text-sm">
                    Select a symptom to see algorithm
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search overlay — rendered on top of grid when searching */}
          {navigation.isMobile && search.searchInput && (
            <div className="absolute inset-0 z-20 bg-themewhite animate-fadeIn">
              <div className="h-full overflow-y-auto">
                <div className="px-2 min-h-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
                  <SearchResults
                    results={search.searchResults}
                    searchTerm={search.searchInput}
                    onResultClick={handleNavigationClick}
                    isSearching={search.isSearching}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Menu backdrop - rendered at App level to avoid overflow-hidden clipping.
            z-20 sits below navbar (z-30) but above content, so menu items remain clickable */}
        {navigation.isMenuOpen && navigation.isMobile && (
          <div
            className="fixed inset-0 z-20"
            onClick={navigation.closeMenu}
          />
        )}
        <NoteImport
          isVisible={navigation.showNoteImport}
          onClose={() => navigation.setShowNoteImport(false)}
          isMobile={navigation.isMobile}
          initialViewState={importInitialView}
          onImportSuccess={handleImportSuccess}
        />
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => { navigation.setShowSettings(false); setSettingsInitialPanel('main'); setMyNotesInitialSelectedId(null) }}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          isMobile={navigation.isMobile}
          initialPanel={settingsInitialPanel}
          initialSelectedId={myNotesInitialSelectedId}
          notes={notesStorage.notes}
          onDeleteNote={notesStorage.deleteNote}
          onEditNote={notesStorage.updateNote}
          onViewNote={handleViewNote}
          onEditNoteInWizard={handleEditNoteInWizard}
        />
        <MedicationsDrawer
          isVisible={navigation.showMedications}
          onClose={() => navigation.setShowMedications(false)}
          selectedMedication={navigation.selectedMedication}
          onMedicationSelect={navigation.handleMedicationSelect}
          isMobile={navigation.isMobile}
        />
        <SymptomInfoDrawer
          isVisible={navigation.showSymptomInfo}
          onClose={() => navigation.setShowSymptomInfo(false)}
          selectedSymptom={navigation.selectedSymptom}
          selectedCategory={navigation.selectedCategory}
          onNavigate={handleNavigationClick}
        />
        {/* WriteNotePage - rendered at App level for proper z-index on mobile */}
        {navigation.isWriteNoteVisible && navigation.writeNoteData && (
          <div className={`${navigation.isMobile
            ? 'fixed inset-0 z-50'
            : 'absolute right-0 top-0 bottom-0 z-40 animate-desktopNoteExpand'
            }`}
            style={!navigation.isMobile ? { width: 'calc(55% - 2px)' } : undefined}
          >
            <WriteNotePage
              disposition={navigation.writeNoteData.disposition}
              algorithmOptions={navigation.writeNoteData.algorithmOptions}
              cardStates={navigation.writeNoteData.cardStates}
              onExpansionChange={navigation.closeWriteNote}
              onNoteSave={handleNoteSave}
              onNoteDelete={handleNoteDelete}
              onNoteUpdate={handleNoteUpdate}
              existingNoteId={activeNoteId}
              existingEncodedText={activeNoteEncodedText}
              selectedSymptom={navigation.writeNoteData.selectedSymptom}
              isMobile={navigation.isMobile}
              initialPage={navigation.writeNoteData.initialPage}
              initialHpiText={navigation.writeNoteData.initialHpiText}
              noteSource={activeNoteSource}
            />
          </div>
        )}
        <UpdateNotification />
        <InstallPrompt />
        <StorageErrorToast message={storageError} onDismiss={clearStorageError} />
        {/* Import Success Modal */}
        {showImportSuccessModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 px-8 py-6 flex flex-col items-center gap-3 animate-[fadeInScale_0.3s_ease-out]">
              <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-primary">Note Imported Successfully</p>
              <p className="text-xs text-tertiary/60">Saved with external source tag</p>
            </div>
          </div>
        )}
        {/* Import Duplicate Modal — shown when importing a note that already exists */}
        {showImportDuplicateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 px-8 py-6 flex flex-col items-center gap-3 animate-[fadeInScale_0.3s_ease-out]">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-primary">Note Already Saved</p>
              <p className="text-xs text-tertiary/60">This note already exists in your saved notes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App