import { useRef, useCallback } from 'react'
import './App.css'
import { SideMenu } from './Components/SideMenu'
import { NavTop } from './Components/NavTop'
import { CategoryList } from './Components/CategoryList'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { MedicationPage } from './Components/MedicationPage'
import type { SearchResultType } from './Types/CatTypes'
import { medList, type medListTypes } from './Data/MedData'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useAppAnimate } from './Utilities/AnimationConfig'
import UpdateNotification from './Components/UpdateNotification'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'

interface MedicationListItemProps {
  medication: medListTypes
  isSelected: boolean
  onClick: () => void
}

function MedicationListItem({ medication, isSelected, onClick }: MedicationListItemProps) {
  return (
    <div
      className={`flex flex-col py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md ${isSelected ? 'bg-themewhite2' : ''
        }`}
      onClick={onClick}
    >
      <div className="text-[10pt] font-normal text-primary">
        {medication.icon}
      </div>
      <div className="text-tertiary text-[9pt]">
        {medication.text}
      </div>
    </div>
  )
}

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
    if (navigation.showNoteImport) {
      navigation.setShowNoteImport(false)
    } else if (search.searchInput) {
      search.clearSearch()
      if (navigation.isMobile && navigation.isSearchExpanded) {
        navigation.setSearchExpanded(false)
      }
    } else {
      navigation.handleBackClick()
    }
  }

  const handleImportClick = () => {
    search.clearSearch()
    navigation.handleCategorySelect(null)
    navigation.handleSymptomSelect(null)
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
    if (navigation.showNoteImport) return { title: "Import Note", show: false }
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
              showMedicationList: navigation.isMedicationView,
              medicationButtonText: navigation.getMedicationButtonText(),
              isMobile: navigation.isMobile,
            }}
          />
        </div>

        <SideMenu
          isVisible={navigation.isMenuOpen}
          onClose={navigation.closeMenu}
          onImportClick={handleImportClick}
          onMedicationClick={navigation.handleShowMedications}
          onSettingsClick={handleSettingsClick}
        />

        {/* Note Import */}
        {navigation.showNoteImport && !search.searchInput && (
          <div className='h-full w-full animate-AppearIn'>
            <NoteImport onClose={() => navigation.setShowNoteImport(false)} />
          </div>
        )}

        <div ref={contentRef} className='md:h-[94%] h-full mt-2 mx-2'>
          {!navigation.showNoteImport && (
            <>
              {/* Mobile Stack Navigation - True screen stack with slide animations */}
              {navigation.isMobile && navigation.showMainGrid && (
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

                  {/* Screen: Medication Detail in Main View */}
                  {!search.searchInput && !navigation.showQuestionCard && navigation.showMedicationDetail && !navigation.isMedicationView && navigation.selectedMedication && (
                    <div className="absolute inset-0 bg-themewhite mobile-slide-in-right">
                      <MedicationPage medication={navigation.selectedMedication} />
                    </div>
                  )}

                  {/* Screen: CategoryList (Main/Category/Symptom Navigation) */}
                  {!search.searchInput && !navigation.showQuestionCard && !(navigation.showMedicationDetail && !navigation.isMedicationView) && (
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
              {!navigation.isMobile && navigation.showMainGrid && (
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

                    {/* Column 3: Detail View (Algorithm or Medication) */}
                    <div className="h-full overflow-hidden">
                      {navigation.showQuestionCard && (
                        <AlgorithmPage
                          selectedSymptom={navigation.selectedSymptom}
                          onMedicationClick={navigation.handleMedicationSelect}
                        />
                      )}
                      {navigation.showMedicationDetail && !navigation.isMedicationView && navigation.selectedMedication && (
                        <MedicationPage medication={navigation.selectedMedication} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Medications Stack */}
              {navigation.isMobile && navigation.showMedicationGrid && (
                <div key="mobile-med-stack" className="h-full relative overflow-hidden">
                  {/* Screen: Medication Detail */}
                  {navigation.showMedicationDetail && navigation.selectedMedication && (
                    <div className="absolute inset-0 bg-themewhite mobile-slide-in-right">
                      <MedicationPage medication={navigation.selectedMedication} />
                    </div>
                  )}

                  {/* Screen: Medication List */}
                  {!navigation.showMedicationDetail && (
                    <div className="absolute inset-0 bg-themewhite">
                      <div className="h-full overflow-y-auto px-2 pb-4 bg-themewhite2 rounded-md">
                        {medList.map((medication, index) => (
                          <MedicationListItem
                            key={`med-${index}`}
                            medication={medication}
                            isSelected={navigation.selectedMedication?.text === medication.text}
                            onClick={() => navigation.handleMedicationSelect(medication)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Medications Grid - Two columns (list | detail) */}
              {!navigation.isMobile && navigation.showMedicationGrid && (
                <div key="desktop-med-grid" className="h-full">
                  <div
                    className="h-full grid gap-2 transition-[grid-template-columns] duration-300"
                    style={{ gridTemplateColumns: navigation.medicationGridTemplate }}
                  >

                    {/* Column 1: Medication List */}
                    <div className="rounded-md overflow-hidden">
                      <div className="h-full flex-1 overflow-y-auto px-2 pb-4 bg-themewhite2">
                        {medList.map((medication, index) => (
                          <MedicationListItem
                            key={`med-${index}`}
                            medication={medication}
                            isSelected={navigation.selectedMedication?.text === medication.text}
                            onClick={() => navigation.handleMedicationSelect(medication)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Column 2: Medication Details */}
                    <div className="rounded-md overflow-hidden">
                      {navigation.showMedicationDetail && navigation.selectedMedication ? (
                        <MedicationPage medication={navigation.selectedMedication} />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-tertiary text-sm p-4">
                          <div className="mb-2">Select a medication to view details</div>
                          <div className="text-xs text-tertiary/70">Click on any medication in the list</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => navigation.setShowSettings(false)}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
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