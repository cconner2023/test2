import { useRef, useCallback } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { CategoryList } from './Components/CategoryList'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
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

  const handleNavigationClick = useCallback((result: SearchResultType) => {
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation, search])

  const handleBackClick = () => {
    if (search.searchInput) {
      search.clearSearch()
      if (navigation.isMobile && navigation.isSearchExpanded) {
        navigation.setSearchExpanded(false)
      }
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
    search.clearSearch()
    if (navigation.isMobile && navigation.isSearchExpanded) {
      navigation.setSearchExpanded(false)
    }
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
    <div className='h-screen bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div className='bg-themewhite max-w-315 shrink flex-col w-full rounded-md border pb-10 border-[rgba(0,0,0,0.03)] shadow-[0px_2px_4px] shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1 relative'>
        {/* Navbar */}
        <div className='relative h-13.75 w-full rounded-t-md flex justify-end'>
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
              showBack: navigation.shouldShowBackButton(!!search.searchInput.trim(), navigation.showNoteImport),
              showMenu: navigation.shouldShowMenuButton(!!search.searchInput.trim(), navigation.showNoteImport),
              dynamicTitle: title.title,
              showDynamicTitle: title.show,
              medicationButtonText: navigation.getMedicationButtonText(),
              isMobile: navigation.isMobile,
              isAlgorithmView: navigation.showQuestionCard,
              isMenuOpen: navigation.isMenuOpen,
            }}
          />
        </div>

        <div ref={contentRef} className='md:h-[94%] h-full mt-2 mx-2'>
            <>
              {/* Mobile Stack Navigation - True screen stack with slide animations */}
              {navigation.isMobile && (
                <div key="mobile-stack" className="h-full relative overflow-hidden">
                  {/* Screen: Search Results */}
                  {search.searchInput && (
                    <div className="absolute inset-0 bg-themewhite mobile-slide-in-right">
                      <SearchResults
                        results={search.searchResults}
                        searchTerm={search.searchInput}
                        onResultClick={handleNavigationClick}
                        isSearching={search.isSearching}
                      />
                    </div>
                  )}

                  {/* Screen: AlgorithmPage (Detail View) */}
                  {!search.searchInput && navigation.showQuestionCard && (
                    <div className="absolute inset-0 bg-themewhite mobile-slide-in-right">
                      <AlgorithmPage
                        selectedSymptom={navigation.selectedSymptom}
                        onMedicationClick={navigation.handleMedicationSelect}
                      />
                    </div>
                  )}

                  {/* Screen: CategoryList (Main/Category/Symptom Navigation) */}
                  {!search.searchInput && !navigation.showQuestionCard && (
                    <div className="absolute inset-0 bg-themewhite">
                      <CategoryList
                        selectedCategory={navigation.selectedCategory}
                        selectedSymptom={navigation.selectedSymptom}
                        selectedGuideline={navigation.selectedGuideline}
                        onNavigate={handleNavigationClick}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Grid - Multi-column layout with responsive sizing */}
              {!navigation.isMobile && (
                <div key="desktop-grid" className="h-full">
                  <div
                    className="h-full grid transition-[grid-template-columns] gap-1"
                    style={{ gridTemplateColumns: navigation.mainGridTemplate }}
                  >

                    {/* Column 1: Categories/Symptoms/Guidelines Navigation */}
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

                    {/* Column 3: Detail View (Algorithm) */}
                    <div className="h-full overflow-hidden">
                      {navigation.showQuestionCard && (
                        <AlgorithmPage
                          selectedSymptom={navigation.selectedSymptom}
                          onMedicationClick={navigation.handleMedicationSelect}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

            </>
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