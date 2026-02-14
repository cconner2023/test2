import { useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'
import { NavTop } from './Components/BasePage/NavTop'
import { SearchResults } from './Components/BasePage/SearchResults'
import { NoteImport } from './Components/Menus/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/BasePage/AlgorithmPage'
import { WriteNotePage } from './Components/Menus/WriteNote/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useNotesStorage } from './Hooks/useNotesStorage'
import { useNoteRestore } from './Hooks/useNoteRestore'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import { useActiveNote } from './Hooks/useActiveNote'
import UpdateNotification from './Components/Modals/UpdateNotification'
import InstallPrompt from './Components/Modals/InstallPrompt'
import StorageErrorToast from './Components/Modals/StorageErrorToast'
import { Settings } from './Components/Menus/Settings'
import { SymptomInfoDrawer } from './Components/Menus/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/Menus/Medications/MedicationsDrawer'
import { ColumnA } from './Components/BasePage/ColumnA'
import { FeedbackModal } from './Components/Modals/FeedbackModal'

// PWA App Shortcut: capture ?view= URL parameter once at module load time
const _initialViewParam = (() => {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view) {
    window.history.replaceState({}, '', window.location.pathname)
  }
  return view
})()

// Post-update navigation: capture and clear the flag set before reload
const _postUpdateNav = (() => {
  try {
    const nav = localStorage.getItem('postUpdateNav')
    if (nav) localStorage.removeItem('postUpdateNav')
    return nav
  } catch { return null }
})()

function AppContent() {
  const searchInputRef = useRef<HTMLInputElement>(null!)
  const { theme, toggleTheme } = useTheme()

  const navigation = useNavigation()
  const search = useSearch()
  const notesStorage = useNotesStorage()
  const { restoreNote } = useNoteRestore()

  const activeNote = useActiveNote({
    navigation,
    notesStorage,
    restoreNote,
    initialViewParam: _initialViewParam,
    postUpdateNav: _postUpdateNav,
  })

  // Cross-column swipe: swipe back from Column B (algorithm) to Column A
  const swipe = useSwipeNavigation({
    enabled: navigation.isMobile && navigation.isMobileColumnB && !search.searchInput && !navigation.isWriteNoteVisible,
    viewDepth: navigation.isMobileColumnB ? 1 : 0,
    onSwipeBack: useCallback(() => {
      navigation.handleBackClick()
    }, [navigation]),
  })

  // Sync search expansion when transitioning to mobile with active search text
  useEffect(() => {
    if (search.searchInput.trim()) {
      navigation.expandSearchOnMobile()
    }
  }, [navigation.isMobile, search.searchInput, navigation.expandSearchOnMobile])

  const handleNavigationClick = useCallback((result: SearchResultType) => {
    // Navigation state change drives the grid column transition and Column A carousel
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation.handleNavigation, search.clearSearch])

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
      navigation.expandSearchOnMobile()
    }
    search.handleSearchChange(value)
  }

  const handleSearchFocus = () => {
    navigation.expandSearchOnMobile()
  }

  const handleClearSearch = () => {
    clearSearchAndCollapse()
  }

  // Settings click handler
  const handleSettingsClick = () => {
    navigation.setShowSettings(true)
  }

  // Title: empty when searching (hides dynamic title), otherwise from navigation
  const title = search.searchInput ? "" : navigation.dynamicTitle

  // Content key — drives fade-in animation on content change.
  // On mobile, search is handled by a separate overlay so the key stays stable
  // to prevent AlgorithmPage from remounting (and losing state) during search.
  const desktopContentKey = useMemo(() => {
    if (!navigation.isMobile && search.searchInput) return 'search'
    if (navigation.selectedSymptom && navigation.showQuestionCard)
      return `algo-${navigation.selectedSymptom.icon}-${activeNote.algorithmKeySuffix}`
    return 'empty'
  }, [navigation.isMobile, search.searchInput, navigation.selectedSymptom, navigation.showQuestionCard, activeNote.algorithmKeySuffix])

  return (
    <div className='h-screen bg-themewhite md:bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div className="max-w-315 shrink flex-col w-full md:rounded-md md:border md:border-[rgba(0,0,0,0.03)] md:shadow-[0px_2px_4px] md:shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1 relative md:bg-themewhite md:pb-10">
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
              dynamicTitle: title,
              medicationButtonText: navigation.getMedicationButtonText(),
              isMobile: navigation.isMobile,
              isAlgorithmView: navigation.showQuestionCard,
              isMenuOpen: navigation.isMenuOpen,
            }}
          />
        </div>

        {/* Content area — Unified 2-column grid (A: Navigation | B: Content) */}
        <div className="md:h-[94%] h-full overflow-hidden absolute inset-0 md:relative md:inset-auto md:mt-2 md:mx-2">
          <div
            className={`h-full grid gap-1 transition-[grid-template-columns] duration-300 ease-in-out ${navigation.mobileGridClass} md:grid-cols-[0.45fr_0.55fr]`}
            {...(navigation.isMobile && navigation.isMobileColumnB ? swipe.touchHandlers : {})}
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
                isVisible={!navigation.isMobileColumnB}
                onSwipeBack={navigation.handleBackClick}
              />
            </div>

            {/* Column B: Content (algorithm / search / empty) */}
            <div className="h-full overflow-hidden" style={{ minWidth: 0 }}>
              <div key={desktopContentKey} className="h-full animate-desktopContentIn">
                {!navigation.isMobile && search.searchInput ? (
                  <div className="h-full overflow-y-auto">
                    <div className="px-2 min-h-full">
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
                      key={`algo-${navigation.selectedSymptom.icon}-${activeNote.algorithmKeySuffix}`}
                      selectedSymptom={navigation.selectedSymptom}
                      onExpandNote={activeNote.handleExpandNote}
                      isMobile={navigation.isMobile}
                      initialCardStates={activeNote.restoredAlgorithmState?.cardStates}
                      initialDisposition={activeNote.restoredAlgorithmState?.disposition}
                      noteSource={activeNote.activeNoteSource}
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
          initialViewState={activeNote.importInitialView}
          onImportSuccess={activeNote.handleImportSuccess}
        />
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => { navigation.setShowSettings(false); activeNote.resetSettingsPanel() }}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          isMobile={navigation.isMobile}
          initialPanel={activeNote.settingsInitialPanel}
          initialSelectedId={activeNote.myNotesInitialSelectedId}
          notes={notesStorage.notes}
          onDeleteNote={notesStorage.deleteNote}
          onEditNote={notesStorage.updateNote}
          onViewNote={activeNote.handleViewNote}
        />
        <MedicationsDrawer
          isVisible={navigation.showMedications}
          onClose={() => navigation.setShowMedications(false)}
          selectedMedication={navigation.selectedMedication}
          onMedicationSelect={navigation.handleMedicationSelect}
        />
        <SymptomInfoDrawer
          isVisible={navigation.showSymptomInfo}
          onClose={() => navigation.setShowSymptomInfo(false)}
          selectedSymptom={navigation.selectedSymptom}
          selectedCategory={navigation.selectedCategory}
          onNavigate={handleNavigationClick}
        />
        {/* WriteNotePage — BaseDrawer handles mobile/desktop positioning */}
        {navigation.writeNoteData && (
          <WriteNotePage
            isVisible={navigation.isWriteNoteVisible}
            disposition={navigation.writeNoteData.disposition}
            algorithmOptions={navigation.writeNoteData.algorithmOptions}
            cardStates={navigation.writeNoteData.cardStates}
            onExpansionChange={navigation.closeWriteNote}
            onNoteSave={activeNote.handleNoteSave}
            onNoteDelete={activeNote.handleNoteDelete}
            onNoteUpdate={activeNote.handleNoteUpdate}
            existingNoteId={activeNote.activeNoteId}
            existingEncodedText={activeNote.activeNoteEncodedText}
            selectedSymptom={navigation.writeNoteData.selectedSymptom}
            isMobile={navigation.isMobile}
            initialPage={navigation.writeNoteData.initialPage}
            initialHpiText={navigation.writeNoteData.initialHpiText}
            noteSource={activeNote.activeNoteSource}
            onAfterSave={activeNote.handleAfterSave}
            timestamp={navigation.writeNoteData.timestamp}
          />
        )}
        <UpdateNotification />
        <InstallPrompt />
        <StorageErrorToast message={activeNote.storageError} onDismiss={activeNote.clearStorageError} />
        {/* Feedback Modals */}
        <FeedbackModal visible={activeNote.showImportSuccessModal} variant="success" title="Note Imported Successfully" subtitle="Saved with external source tag" />
        <FeedbackModal visible={activeNote.showNoteSavedModal} variant="success" title="Note Saved" subtitle="Saved to My Notes" />
        <FeedbackModal visible={activeNote.showImportDuplicateModal} variant="warning" title="Note Already Saved" subtitle="This note already exists in your saved notes" />
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
