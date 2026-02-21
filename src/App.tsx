import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { WriteNotePage } from './Components/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useNotesStorage } from './Hooks/useNotesStorage'
import { useNoteRestore } from './Hooks/useNoteRestore'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import { useActiveNote } from './Hooks/useActiveNote'
import UpdateNotification from './Components/UpdateNotification'
import InstallPrompt from './Components/InstallPrompt'
import StorageErrorToast from './Components/StorageErrorToast'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/MedicationsDrawer'
import { ColumnA } from './Components/ColumnA'
import { FeedbackModal } from './Components/FeedbackModal'
import { useProfileAvatar } from './Hooks/useProfileAvatar'
import { useAuth } from './Hooks/useAuth'
import { useAuthStore } from './stores/useAuthStore'
import { TrainingDrawer } from './Components/TrainingDrawer'
import { getTaskData } from './Data/TrainingData'
import { isPinEnabled, isSessionUnlocked, clearSessionUnlocked } from './lib/pinService'
import { PinLockScreen } from './Components/PinLockScreen'
import { SetPasswordScreen } from './Components/SetPasswordScreen'
import { ErrorBoundary } from './Components/ErrorBoundary'

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
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && !isSessionUnlocked())

  // Re-lock when app goes to background (tab switch, app switch on mobile)
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden' && isPinEnabled() && !isPinLocked) {
        clearSessionUnlocked()
        setIsPinLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [isPinLocked])

  const handlePinUnlock = useCallback(() => {
    setIsPinLocked(false)
  }, [])

  // Initialise the Zustand auth store listener (once per mount)
  useEffect(() => useAuthStore.getState().init(), [])

  const navigation = useNavigation()
  const search = useSearch()
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false)
  const notesStorage = useNotesStorage(isNotePanelOpen)
  const { restoreNote } = useNoteRestore()
  const { user } = useAuth()
  const avatarState = useProfileAvatar(user?.id)
  const { currentAvatar, customImage, isCustom } = avatarState

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
    // Intercept training items — split by guidelineType
    if (result.type === 'training' && result.data?.guidelineType) {

      // STP training tasks — navigate to algorithm if symptom context exists, otherwise open training drawer
      if (result.data.guidelineType === 'stp-task') {
        const taskId = result.data.taskId
        if (taskId) {
          if (result.data?.categoryRef && result.data?.symptomRef) {
            // Symptom context exists — navigate to algorithm and open training drawer
            navigation.handleNavigation({
              type: 'CC',
              id: result.data.symptomId!,
              icon: result.data.symptomRef.icon,
              text: result.data.symptomRef.text,
              data: {
                categoryId: result.data.categoryId,
                symptomId: result.data.symptomId,
                categoryRef: result.data.categoryRef,
                symptomRef: result.data.symptomRef
              }
            })
            // Deferred so it doesn't get clobbered by CLOSE_ALL_DRAWERS in handleNavigation
            requestAnimationFrame(() => {
              if (navigation.isMobile) {
                navigation.setShowTrainingDrawer(taskId)
              } else {
                activeNote.openTrainingTask(taskId)
                navigation.setShowSettings(true)
              }
            })
          } else {
            // No symptom context — open training drawer/panel only
            if (navigation.isMobile) {
              navigation.setShowTrainingDrawer(taskId)
            } else {
              activeNote.openTrainingTask(taskId)
              navigation.setShowSettings(true)
            }
          }
        }
        search.clearSearch()
        return
      }

      // STP/MEDCOM items from CategoryList/SymptomInfoDrawer — taskId is on result.icon
      if (result.data.guidelineType === 'stp' || result.data.guidelineType === 'medcom') {
        const taskId = result.icon
        if (taskId && getTaskData(taskId)) {
          if (result.data?.categoryRef && result.data?.symptomRef) {
            // Symptom context exists — navigate to algorithm and open training drawer
            navigation.handleNavigation({
              type: 'CC',
              id: result.data.symptomId!,
              icon: result.data.symptomRef.icon,
              text: result.data.symptomRef.text,
              data: {
                categoryId: result.data.categoryId,
                symptomId: result.data.symptomId,
                categoryRef: result.data.categoryRef,
                symptomRef: result.data.symptomRef
              }
            })
            // Deferred so it doesn't get clobbered by CLOSE_ALL_DRAWERS in handleNavigation
            requestAnimationFrame(() => {
              if (navigation.isMobile) {
                navigation.setShowTrainingDrawer(taskId)
              } else {
                activeNote.openTrainingTask(taskId)
                navigation.setShowSettings(true)
              }
            })
          } else {
            // No symptom context — open training drawer/panel only
            if (navigation.isMobile) {
              navigation.setShowTrainingDrawer(taskId)
            } else {
              activeNote.openTrainingTask(taskId)
              navigation.setShowSettings(true)
            }
          }
          search.clearSearch()
          return
        }
        search.clearSearch()
        return
      }
    }

    // Navigation state change drives the grid column transition and Column A carousel
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation.handleNavigation, search.clearSearch, navigation.setShowTrainingDrawer, navigation.isMobile, navigation.setShowSettings, activeNote.openTrainingTask])

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
      <div id="app-drawer-root" className="max-w-315 shrink flex-col w-full md:rounded-md md:border md:border-[rgba(0,0,0,0.03)] md:shadow-[0px_2px_4px] md:shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full space-y-1 relative md:bg-themewhite md:pb-10">
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
              onSearchClear: () => search.clearSearch(),
              onSearchCollapse: () => navigation.setSearchExpanded(false),
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
              noteSource: navigation.showQuestionCard ? activeNote.activeNoteSource : null,
              mobileAvatar: {
                avatarSvg: currentAvatar.svg,
                customImage,
                isCustom,
              },
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
              <div key={desktopContentKey} className="h-full animate-desktopContentIn md:pt-3">
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
                    <ErrorBoundary>
                    <AlgorithmPage
                      key={`algo-${navigation.selectedSymptom.icon}-${activeNote.algorithmKeySuffix}`}
                      selectedSymptom={navigation.selectedSymptom}
                      onExpandNote={activeNote.handleExpandNote}
                      isMobile={navigation.isMobile}
                      initialCardStates={activeNote.restoredAlgorithmState?.cardStates}
                      initialDisposition={activeNote.restoredAlgorithmState?.disposition}
                      noteSource={activeNote.activeNoteSource}
                    />
                    </ErrorBoundary>
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
        <ErrorBoundary>
        <NoteImport
          isVisible={navigation.showNoteImport}
          onClose={() => navigation.setShowNoteImport(false)}
          initialViewState={activeNote.importInitialView}
          onImportSuccess={activeNote.handleImportSuccess}
          isMobile={navigation.isMobile}
        />
        </ErrorBoundary>
        <ErrorBoundary>
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => { navigation.setShowSettings(false); activeNote.resetSettingsPanel() }}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          isMobile={navigation.isMobile}
          initialPanel={activeNote.settingsInitialPanel}
          initialSelectedId={activeNote.myNotesInitialSelectedId}
          initialTrainingTaskId={activeNote.initialTrainingTaskId}
          notes={notesStorage.notes}
          clinicNotes={notesStorage.clinicNotes}
          onDeleteNote={notesStorage.deleteNote}
          onDeleteClinicNote={notesStorage.deleteClinicNote}
          onEditNote={notesStorage.updateNote}
          onViewNote={activeNote.handleViewNote}
          avatar={avatarState}
          onNotePanelChange={setIsNotePanelOpen}
          syncStatus={{
            isOnline: notesStorage.isOnline,
            isSyncing: notesStorage.isSyncing,
            pendingCount: notesStorage.pendingCount,
            errorCount: notesStorage.errorCount,
            lastSyncTime: notesStorage.lastSyncTime,
          }}
        />
        </ErrorBoundary>
        <ErrorBoundary>
        <MedicationsDrawer
          isVisible={navigation.showMedications}
          onClose={() => navigation.setShowMedications(false)}
          selectedMedication={navigation.selectedMedication}
          onMedicationSelect={navigation.handleMedicationSelect}
        />
        </ErrorBoundary>
        <ErrorBoundary>
        <SymptomInfoDrawer
          isVisible={navigation.showSymptomInfo}
          onClose={() => navigation.setShowSymptomInfo(false)}
          selectedSymptom={navigation.selectedSymptom}
          selectedCategory={navigation.selectedCategory}
          onNavigate={handleNavigationClick}
        />
        </ErrorBoundary>
        <ErrorBoundary>
        <TrainingDrawer
          isVisible={navigation.showTrainingDrawer}
          onClose={() => navigation.setShowTrainingDrawer(null)}
          taskId={navigation.trainingDrawerTaskId}
        />
        </ErrorBoundary>
        {/* WriteNotePage — BaseDrawer handles mobile/desktop positioning */}
        {navigation.writeNoteData && (
          <ErrorBoundary>
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
            initialPeText={navigation.writeNoteData.initialPeText}
            noteSource={activeNote.activeNoteSource}
            onAfterSave={activeNote.handleAfterSave}
            timestamp={navigation.writeNoteData.timestamp}
          />
          </ErrorBoundary>
        )}
        <UpdateNotification />
        <InstallPrompt />
        <StorageErrorToast message={activeNote.storageError} onDismiss={activeNote.clearStorageError} />
        {/* Feedback Modals */}
        <FeedbackModal visible={activeNote.showImportSuccessModal} variant="success" title="Note Imported Successfully" subtitle="Saved with external source tag" />
        <FeedbackModal visible={activeNote.showNoteSavedModal} variant="success" title="Note Saved" subtitle="Saved to My Notes" />
        <FeedbackModal visible={activeNote.showImportDuplicateModal} variant="warning" title="Note Already Saved" subtitle="This note already exists in your saved notes" />
      </div>
      {isPinLocked && <PinLockScreen onUnlock={handlePinUnlock} />}
      {useAuthStore((s) => s.isPasswordRecovery) && <SetPasswordScreen />}
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
