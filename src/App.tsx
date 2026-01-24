// App.tsx - UPDATED TO USE YOUR LAYOUT HOOK
import { useState, useRef, useEffect } from 'react'
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
import { medList } from './Data/MedData'
import { useLayout } from './Hooks/useLayoutState'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useSwipeGesture } from './Hooks/useSwipeGesture'

function AppContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showNoteImport, setShowNoteImport] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null!)
  const { toggleTheme } = useTheme()

  // Use your existing layout hook
  const layout = useLayout() as any

  // Single auto-animate for switching between main and medication grids
  const [contentRef] = useAutoAnimate<HTMLDivElement>({
    duration: 300,
    easing: 'ease-in-out',
  })

  // Swipe gesture for CategoryList navigation (right swipe to go back)
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isSwiping,
    swipeDirection,
    swipeProgress
  } = useSwipeGesture({
    onSwipeRight: () => {
      // Only handle right swipe when we're in a nested view and no search/import
      if (!layout.hasSearchInput && !showNoteImport) {
        if (layout.selectedSymptom) {
          console.log("↪️ Swipe right: Going back from symptom to category")
          layout.handleSymptomSelect(null)
        } else if (layout.selectedCategory && !layout.selectedSymptom) {
          console.log("↪️ Swipe right: Going back to main categories")
          layout.handleCategorySelect(null)
        }
      }
    },
    threshold: 60,
    minVelocity: 0.2
  })

  // Close menu on desktop resize, reset search expansion
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        if (isMenuOpen) setIsMenuOpen(false)
        if (isSearchExpanded) setIsSearchExpanded(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMenuOpen, isSearchExpanded])

  // Use your layout's back functionality
  const handleBackClick = () => {
    if (showNoteImport) {
      setShowNoteImport(false)
    } else if (layout.hasSearchInput) {
      layout.clearSearch()
      if (layout.isMobile && isSearchExpanded) {
        setIsSearchExpanded(false)
      }
    } else {
      // Use your layout hook's methods
      if (layout.selectedMedication) {
        layout.handleMedicationSelect(null)
      } else if (layout.selectedSymptom) {
        layout.handleSymptomSelect(null)
      } else if (layout.selectedCategory) {
        layout.handleCategorySelect(null)
      } else if (layout.isMedicationView) {
        // Exit medication view
        layout.handleShowMedications()
      }
    }
  }

  const handleMedicationClick = () => {
    console.log("Medication button clicked")
    layout.handleShowMedications()
  }

  const handleImportClick = () => {
    layout.clearSearch()
    layout.handleCategorySelect(null)
    layout.handleSymptomSelect(null)
    setShowNoteImport(true)
    if (layout.isMobile && isSearchExpanded) {
      setIsSearchExpanded(false)
    }
  }

  const handleSearchChange = (value: string) => {
    if (value.trim() !== "") {
      setShowNoteImport(false)
      if (layout.isMobile && !isSearchExpanded) {
        setIsSearchExpanded(true)
      }
    }
    layout.handleSearchChange(value)
  }

  const handleSearchResultClick = (result: SearchResultType) => {
    layout.handleSearchResultClick(result)
    setShowNoteImport(false)
    if (layout.isMobile && isSearchExpanded) {
      setIsSearchExpanded(false)
    }
  }

  const handleSearchFocus = () => {
    if (layout.isMobile && !isSearchExpanded) {
      setIsSearchExpanded(true)
    }
  }

  const handleClearSearch = () => {
    layout.clearSearch()
    if (layout.isMobile && isSearchExpanded) {
      setIsSearchExpanded(false)
    }
  }

  // Title logic - use your layout's dynamic title if available
  const getTitle = () => {
    if (layout.hasSearchInput) return { title: "", show: false }
    if (showNoteImport) return { title: "Import Note", show: false }

    // Check if your layout hook has dynamicTitle
    if ('dynamicTitle' in layout) {
      return {
        title: (layout as any).dynamicTitle?.title || "",
        show: (layout as any).dynamicTitle?.show || false
      }
    }

    // Fallback logic
    if (layout.selectedMedication) {
      return { title: layout.selectedMedication.text, show: true }
    }
    if (layout.selectedSymptom) {
      return { title: layout.selectedSymptom.text, show: true }
    }
    if (layout.selectedCategory) {
      return { title: layout.selectedCategory.text, show: true }
    }

    return { title: "", show: false }
  }

  const title = getTitle()

  // Check if we should show swipe indicators
  const showSwipeBackIndicator = !layout.hasSearchInput &&
    !showNoteImport &&
    (layout.selectedSymptom || layout.selectedCategory)

  return (
    <div className='h-screen bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div className='bg-themewhite max-w-315 shrink flex-col w-full rounded-md border pb-10 border-[rgba(0,0,0,0.03)] shadow-[0px_2px_4px] shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1'>
        {/* Navbar */}
        <div className='relative h-13.75 w-full rounded-t-md flex justify-end'>
          <NavTop
            searchInput={layout.searchInput}
            onSearchChange={handleSearchChange}
            onSearchFocus={handleSearchFocus}
            onSearchClear={handleClearSearch}
            showBack={layout.shouldShowBackButton(showNoteImport)}
            showMenu={layout.shouldShowMenuButton(showNoteImport)}
            onBackClick={handleBackClick}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onImportClick={handleImportClick}
            medicationButtonText={layout.getMedicationButtonText()}
            onMedicationClick={handleMedicationClick}
            dynamicTitle={title.title}
            showDynamicTitle={title.show}
            searchInputRef={searchInputRef}
            showMedicationList={layout.isMedicationView}
            isMobile={layout.isMobile}
            isSearchExpanded={isSearchExpanded}
            onSearchExpandToggle={() => setIsSearchExpanded(!isSearchExpanded)}
          />

          <SideMenu
            isVisible={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onImportClick={() => {
              setIsMenuOpen(false)
              handleImportClick()
            }}
            onMedicationClick={() => {
              setIsMenuOpen(false)
              handleMedicationClick()
            }}
            onToggleTheme={() => {
              setIsMenuOpen(false)
              toggleTheme()
            }}
          />
        </div>

        {/* Note Import */}
        {showNoteImport && !layout.hasSearchInput && (
          <div className='h-full w-full animate-AppearIn'>
            <NoteImport onClose={() => setShowNoteImport(false)} />
          </div>
        )}

        {/* Main Content - Animated grid switching */}
        {!showNoteImport && (
          <div
            ref={contentRef}
            className='h-[94%] mt-2 mx-2 relative'
          >
            {/* Swipe Progress Indicator */}
            {showSwipeBackIndicator && isSwiping && swipeDirection === 'right' && (
              <div
                className="absolute left-0 top-0 bottom-0 w-2 bg-themeblue3/30 z-10 rounded-r-md transition-all duration-150"
                style={{ width: `${swipeProgress * 0.5}%` }}
              />
            )}

            {/* ADTMC Grid */}
            {layout.showMainGrid && (
              <div
                key="main-grid"
                className="h-full"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  // Reset on mouse leave
                  if (isSwiping) {
                    setTimeout(() => {
                      handleMouseUp({ clientX: 0 } as React.MouseEvent);
                    }, 0);
                  }
                }}
              >
                <div
                  className="h-full grid transition-[grid-template-columns] md:gap-1"
                  style={{
                    gridTemplateColumns: layout.mainGridTemplate,
                    transform: isSwiping && swipeDirection === 'right' ?
                      `translateX(${swipeProgress * 0.3}px)` : 'translateX(0)',
                    transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
                  }}
                >

                  {/* Column 1: Categories */}
                  <div className="h-full overflow-hidden">
                    {!layout.hasSearchInput && (
                      <CategoryList
                        selectedCategory={layout.selectedCategory}
                        selectedSymptom={layout.selectedSymptom}
                        selectedMedication={layout.selectedMedication}
                        selectedGuideline={layout.selectedGuideline}
                        onCategorySelect={layout.handleCategorySelect}
                        onSymptomSelect={layout.handleSymptomSelect}
                        onMedicationSelect={layout.handleMedicationSelect}
                        onGuidelineSelect={layout.handleGuidelineSelect}
                      />
                    )}
                  </div>

                  {/* Column 2: Search Results */}
                  <div className="h-full overflow-hidden">
                    {layout.hasSearchInput && (
                      <SearchResults
                        results={layout.searchResults}
                        searchTerm={layout.searchInput}
                        onResultClick={handleSearchResultClick}
                        isSearching={layout.isSearching}
                      />
                    )}
                  </div>

                  {/* Column 3: Algorithm/Medication */}
                  <div className="h-full overflow-hidden">
                    {layout.showQuestionCard && (
                      <AlgorithmPage
                        selectedSymptom={layout.selectedSymptom}
                        onMedicationClick={layout.handleMedicationSelect}
                      />
                    )}
                    {layout.showMedicationDetail && !layout.isMedicationView && layout.selectedMedication && (
                      <MedicationPage medication={layout.selectedMedication} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Medications Grid */}
            {layout.showMedicationGrid && (
              <div key="medication-grid" className="h-full">
                <div
                  className="h-full grid md:gap-2 transition-[grid-template-columns] duration-300"
                  style={{ gridTemplateColumns: layout.medicationGridTemplate }}
                >

                  {/* Column 1: Medication List */}
                  <div className=" rounded-md overflow-hidden">
                    {(!layout.showMedicationDetail || !layout.isMobile) && (
                      <div className="h-full flex-1 overflow-y-auto px-2 pb-4 bg-themewhite2">
                        {medList.map((medication, index) => (
                          <div
                            key={`med-${index}`}
                            className={`flex flex-col py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md ${layout.selectedMedication?.text === medication.text ? 'bg-themewhite2' : ''
                              }`}
                            onClick={() => layout.handleMedicationSelect(medication)}
                          >
                            <div className="text-[10pt] font-normal text-primary">
                              {medication.icon}
                            </div>
                            <div className="text-tertiary text-[9pt]">
                              {medication.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Medication Details */}
                  <div className=" rounded-md overflow-hidden">
                    {layout.showMedicationDetail && layout.selectedMedication ? (
                      <MedicationPage medication={layout.selectedMedication} />
                    ) : !layout.isMobile && (
                      <div className="h-full flex flex-col items-center justify-center text-tertiary text-sm p-4">
                        <div className="mb-2">Select a medication to view details</div>
                        <div className="text-xs text-tertiary/70">Click on any medication in the list</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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