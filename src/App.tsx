import { useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { CategoryList } from './Components/CategoryList'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { WriteNotePage } from './Components/WriteNotePage'
import type { NoteSaveData } from './Components/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useNotesStorage } from './Hooks/useNotesStorage'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import { useAppAnimate } from './Utilities/AnimationConfig'
import UpdateNotification from './Components/UpdateNotification'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/MedicationsDrawer'
import { MyNotes } from './Components/MyNotes'

function AppContent() {
  const searchInputRef = useRef<HTMLInputElement>(null!)
  const { theme, toggleTheme } = useTheme()

  const [contentRef] = useAppAnimate<HTMLDivElement>()

  const navigation = useNavigation()
  const search = useSearch()
  const notesStorage = useNotesStorage()

  // Compute mobile view depth: 0 = categories, 1 = subcategories, 2 = algorithm
  const mobileViewDepth = useMemo(() => {
    if (navigation.showQuestionCard && navigation.selectedSymptom) return 2
    if (navigation.selectedCategory) return 1
    return 0
  }, [navigation.showQuestionCard, navigation.selectedSymptom, navigation.selectedCategory])

  // Swipe navigation for mobile views
  const swipe = useSwipeNavigation({
    enabled: navigation.isMobile && !search.searchInput && !navigation.isWriteNoteVisible,
    viewDepth: mobileViewDepth,
    onSwipeBack: useCallback(() => {
      navigation.handleBackClick()
    }, [navigation]),
  })

  // Sync search expansion when transitioning to mobile with active search text
  useEffect(() => {
    if (navigation.isMobile && search.searchInput.trim() && !navigation.isSearchExpanded) {
      navigation.setSearchExpanded(true)
    }
  }, [navigation.isMobile, search.searchInput, navigation.isSearchExpanded, navigation.setSearchExpanded])

  const handleNavigationClick = useCallback((result: SearchResultType) => {
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
    } else {
      navigation.handleBackClick()
    }
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

  // My Notes click handler
  const handleMyNotesClick = () => {
    navigation.setShowMyNotes(true)
  }

  // Note save handler
  const handleNoteSave = useCallback((data: NoteSaveData) => {
    notesStorage.saveNote({
      encodedText: data.encodedText,
      previewText: data.previewText,
      symptomIcon: data.symptomIcon,
      symptomText: data.symptomText,
      dispositionType: data.dispositionType,
      dispositionText: data.dispositionText,
    })
  }, [notesStorage])

  // Title logic
  const getTitle = () => {
    if (search.searchInput) return { title: "", show: false }
    return navigation.dynamicTitle
  }

  const title = getTitle()

  // Compute swipe transform styles for mobile views
  const getSwipeStyle = useCallback((layerDepth: number): React.CSSProperties => {
    // Only apply swipe transforms on mobile during active swipe
    if (!navigation.isMobile || (!swipe.isSwiping && !swipe.animatingDirection)) {
      return {}
    }

    // Current view being swiped away (top layer)
    if (layerDepth === mobileViewDepth) {
      return {
        transform: `translateX(${swipe.offsetX}px)`,
        transition: swipe.isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }
    }

    // Layer below (will be revealed): slight parallax from left
    if (layerDepth === mobileViewDepth - 1) {
      const parallaxOffset = -80 + (swipe.offsetX / window.innerWidth) * 80
      return {
        transform: `translateX(${parallaxOffset}px)`,
        transition: swipe.isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)',
        opacity: 0.6 + (swipe.offsetX / window.innerWidth) * 0.4,
      }
    }

    return {}
  }, [navigation.isMobile, swipe.isSwiping, swipe.animatingDirection, swipe.offsetX, mobileViewDepth])

  // Determine if a layer should be visible during swipe (to show the layer being revealed underneath)
  const isLayerVisibleDuringSwipe = useCallback((layerDepth: number): boolean => {
    if (!swipe.isSwiping && !swipe.animatingDirection) return false
    // Show the layer below the current one during swipe
    return layerDepth === mobileViewDepth - 1
  }, [swipe.isSwiping, swipe.animatingDirection, mobileViewDepth])


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
              onMyNotesClick: handleMyNotesClick,
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

        {/* Content area  */}
        <div ref={contentRef} className={`md:h-[94%] h-full relative overflow-hidden ${navigation.isMobile ? 'absolute inset-0' : 'mt-2 mx-2'
          }`}>
          {/* Mobile Layout - absolute stacking with swipe navigation */}
          <div
            className={`${navigation.isMobile ? 'block' : 'hidden'} h-full relative`}
            {...(navigation.isMobile ? swipe.touchHandlers : {})}
          >
            {/* CategoryList - base layer (depth 0) */}
            <div
              className={`absolute inset-0 will-change-transform ${!search.searchInput && !navigation.showQuestionCard
                ? 'opacity-100 z-10'
                : isLayerVisibleDuringSwipe(0)
                  ? 'z-5 pointer-events-none'
                  : 'opacity-0 z-0 pointer-events-none'
                } ${!swipe.isSwiping && !swipe.animatingDirection ? 'transition-opacity duration-200' : ''}`}
              style={getSwipeStyle(0)}
            >
              <div className="h-full overflow-y-auto">
                {/* Spacer accounts for safe area + navbar, scrolls with content */}
                <div className="px-2 bg-themewhite min-h-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
                  <CategoryList
                    selectedCategory={navigation.selectedCategory}
                    selectedSymptom={navigation.selectedSymptom}
                    selectedGuideline={navigation.selectedGuideline}
                    onNavigate={handleNavigationClick}
                  />
                </div>
              </div>
            </div>

            {/* SearchResults - overlay when searching */}
            <div className={`absolute inset-0 transition-opacity duration-200 ${search.searchInput ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'
              }`}>
              <div className="h-full overflow-y-auto">
                <div className="px-2 bg-themewhite min-h-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
                  <SearchResults
                    results={search.searchResults}
                    searchTerm={search.searchInput}
                    onResultClick={handleNavigationClick}
                    isSearching={search.isSearching}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout - 2-panel master-detail (navigation | content) */}
          <div className={`${navigation.isMobile ? 'hidden' : 'block'} h-full`}>
            <div className="h-full grid gap-1"
              style={{
                gridTemplateColumns: navigation.mainGridTemplate,
                transition: 'grid-template-columns 0.3s ease-in-out'
              }}
            >
              {/* Column 1 (Left): Always show CategoryList */}
              <div className="h-full overflow-y-auto bg-themewhite">
                <CategoryList
                  selectedCategory={navigation.selectedCategory}
                  selectedSymptom={navigation.selectedSymptom}
                  selectedGuideline={navigation.selectedGuideline}
                  onNavigate={handleNavigationClick}
                  desktopMode={true}
                />
              </div>

              {/* Column 2 (Right): Content area */}
              <div className="h-full overflow-hidden">
                {search.searchInput ? (
                  <div className="h-full overflow-y-auto">
                    <SearchResults
                      results={search.searchResults}
                      searchTerm={search.searchInput}
                      onResultClick={handleNavigationClick}
                      isSearching={search.isSearching}
                    />
                  </div>
                ) : navigation.selectedSymptom && navigation.showQuestionCard ? (
                  <div className="h-full overflow-hidden">
                    <AlgorithmPage
                      selectedSymptom={navigation.selectedSymptom}
                      onMedicationClick={navigation.handleMedicationSelect}
                      onExpandNote={navigation.showWriteNote}
                      isMobile={navigation.isMobile}
                    />
                  </div>
                ) : (
                  // Empty state when nothing is selected
                  <div className="h-full flex items-center justify-center text-secondary text-sm">
                    Select a symptom to see algorithm
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AlgorithmPage - mobile only: absolute positioned overlay (depth 2) */}
          {navigation.isMobile && navigation.selectedSymptom && (
            <div
              className={`absolute inset-0 will-change-transform ${!search.searchInput && navigation.showQuestionCard
                ? 'opacity-100 z-20'
                : 'opacity-0 z-0 pointer-events-none'
                } ${!swipe.isSwiping && !swipe.animatingDirection ? 'transition-opacity duration-200' : ''}`}
              style={getSwipeStyle(2)}
              {...swipe.touchHandlers}
            >
              <div className="h-full overflow-hidden bg-themewhite">
                <AlgorithmPage
                  selectedSymptom={navigation.selectedSymptom}
                  onMedicationClick={navigation.handleMedicationSelect}
                  onExpandNote={navigation.showWriteNote}
                  isMobile={navigation.isMobile}
                />
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
        />
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => navigation.setShowSettings(false)}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          isMobile={navigation.isMobile}
          onMyNotesClick={handleMyNotesClick}
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
        <MyNotes
          isVisible={navigation.showMyNotes}
          onClose={() => navigation.setShowMyNotes(false)}
          isMobile={navigation.isMobile}
          notes={notesStorage.notes}
          onDeleteNote={notesStorage.deleteNote}
          onEditNote={notesStorage.updateNote}
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
              isExpanded={true}
              onExpansionChange={navigation.closeWriteNote}
              onNoteSave={handleNoteSave}
              selectedSymptom={navigation.writeNoteData.selectedSymptom}
              isMobile={navigation.isMobile}
            />
          </div>
        )}
        <UpdateNotification />
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