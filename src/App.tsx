import { useRef, useCallback, useEffect } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { CategoryList } from './Components/CategoryList'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { WriteNotePage } from './Components/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useAppAnimate } from './Utilities/AnimationConfig'
import UpdateNotification from './Components/UpdateNotification'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/MedicationsDrawer'

function AppContent() {
  const searchInputRef = useRef<HTMLInputElement>(null!)
  const { theme, toggleTheme } = useTheme()

  const [contentRef] = useAppAnimate<HTMLDivElement>()

  const navigation = useNavigation()
  const search = useSearch()

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

  // Title logic
  const getTitle = () => {
    if (search.searchInput) return { title: "", show: false }
    return navigation.dynamicTitle
  }

  const title = getTitle()


  return (
    <div className='h-screen bg-themewhite md:bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div className={`max-w-315 shrink flex-col w-full md:rounded-md md:border md:border-[rgba(0,0,0,0.03)] md:shadow-[0px_2px_4px] md:shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1 relative ${navigation.isMobile ? '' : 'bg-themewhite pb-10'
        }`}>
        {/* Navbar - overlaps content on mobile for blur effect, extends into safe area on iOS */}
        <div className={`${navigation.isMobile
          ? 'absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)] backdrop-blur-sm bg-themewhite/70'
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

        {/* Content area - components rendered once, CSS controls layout */}
        <div ref={contentRef} className={`md:h-[94%] h-full relative overflow-hidden ${navigation.isMobile ? 'absolute inset-0' : 'mt-2 mx-2'
          }`}>
          {/* Mobile Layout - absolute stacking */}
          <div className={`${navigation.isMobile ? 'block' : 'hidden'} h-full relative`}>
            {/* CategoryList - base layer - content scrolls behind navbar */}
            <div className={`absolute inset-0 transition-opacity duration-200 ${!search.searchInput && !navigation.showQuestionCard ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}>
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

          {/* Desktop Layout - grid */}
          <div className={`${navigation.isMobile ? 'hidden' : 'block'} h-full`}>
            <div className="h-full grid transition-[grid-template-columns] gap-1"
              style={{ gridTemplateColumns: !navigation.isMobile && search.searchInput ? '1fr 1fr 0fr' : navigation.mainGridTemplate }}
            >
              {/* Column 1: Categories Navigation */}
              <div className="h-full overflow-y-scroll">
                {!search.searchInput && (
                  <CategoryList
                    selectedCategory={navigation.selectedCategory}
                    selectedSymptom={navigation.selectedSymptom}
                    selectedGuideline={navigation.selectedGuideline}
                    onNavigate={handleNavigationClick}
                  />
                )}
              </div>

              {/* Column 2: Search Results */}
              <div className="h-full overflow-hidden">
                {search.searchInput && (
                  <SearchResults
                    results={search.searchResults}
                    searchTerm={search.searchInput}
                    onResultClick={handleNavigationClick}
                    isSearching={search.isSearching}
                  />
                )}
              </div>

              {/* Column 3: placeholder for grid structure */}
              <div className="h-full overflow-hidden" />
            </div>
          </div>

          {/* AlgorithmPage - rendered ONCE, positioned based on layout */}
          {navigation.selectedSymptom && (
            <div className={`transition-opacity duration-200 ${navigation.isMobile
              ? `absolute inset-0 ${!search.searchInput && navigation.showQuestionCard ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`
              : `absolute right-0 top-0 bottom-0 bg-themewhite ${!search.searchInput && navigation.showQuestionCard ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
              }`}
              style={!navigation.isMobile ? {
                width: !search.searchInput && navigation.showQuestionCard ? 'calc(55% - 2px)' : '0%',
                transition: 'width 300ms, opacity 200ms'
              } : undefined}
            >
              <div className="h-full overflow-hidden">
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
              isExpanded={true}
              onExpansionChange={navigation.closeWriteNote}
              onNoteSave={(note: string) => {
                console.log('Note saved:', note);
              }}
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