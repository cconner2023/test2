import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'
import { NavTop } from './Components/NavTop'
import { SearchResults } from './Components/SearchResults'
import { NoteImport } from './Components/NoteImport'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AvatarProvider } from './Utilities/AvatarContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import { WriteNotePage } from './Components/WriteNotePage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import UpdateNotification from './Components/UpdateNotification'
import InstallPrompt from './Components/InstallPrompt'
import { Settings } from './Components/Settings'
import { SymptomInfoDrawer } from './Components/SymptomInfoDrawer'
import { MedicationsDrawer } from './Components/MedicationsDrawer'
import { ColumnA } from './Components/ColumnA'
import { TC3DesktopLayout } from './Components/TC3/TC3DesktopLayout'
import { TC3MobileWizard } from './Components/TC3/TC3MobileWizard'

import { useProfileAvatar } from './Hooks/useProfileAvatar'
import { useAuth } from './Hooks/useAuth'
import { useAuthStore } from './stores/useAuthStore'
import { TrainingDrawer } from './Components/TrainingDrawer'
import { getTaskData } from './Data/TrainingData'
import { LockGate } from './Components/LockGate'
import { ErrorBoundary } from './Components/ErrorBoundary'
import { MessagesProvider, useMessagesContext } from './Hooks/MessagesContext'
import { CallProvider } from './Hooks/CallContext'
import { CallOverlay } from './Components/Settings/CallOverlay'
import { MessageNotificationToast } from './Components/MessageNotificationToast'
import type { MessageNotification } from './Hooks/useMessageNotifications'

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

  // Initialise the Zustand auth store listener (once per mount)
  useEffect(() => useAuthStore.getState().init(), [])

  const navigation = useNavigation()
  const search = useSearch()
  const { user } = useAuth()
  const avatarState = useProfileAvatar(user?.id)
  const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false

  // ── Settings/training targeting state (lightweight replacement for useActiveNote) ──
  const [settingsInitialPanel, setSettingsInitialPanel] = useState<'main' | 'release-notes' | 'training' | 'messages'>('main')
  const [initialTrainingTaskId, setInitialTrainingTaskId] = useState<string | null>(null)
  const [initialPeerId, setInitialPeerId] = useState<string | null>(null)
  const [initialGroupId, setInitialGroupId] = useState<string | null>(null)
  const [initialPeerName, setInitialPeerName] = useState<string | null>(null)
  const [updateVisible, setUpdateVisible] = useState(false)
  const [importInitialView, setImportInitialView] = useState<'input' | 'scanning' | undefined>(
    _initialViewParam === 'import' ? 'scanning' : undefined
  )
  const importWasOpenedRef = useRef(false)

  // PWA App Shortcut / Post-update: open the appropriate view on mount
  useEffect(() => {
    if (_postUpdateNav === 'release-notes') {
      setSettingsInitialPanel('release-notes')
      navigation.setShowSettings(true)
    } else if (_initialViewParam === 'import') {
      navigation.setShowNoteImport(true)
    } else if (_initialViewParam === 'training') {
      setSettingsInitialPanel('training')
      navigation.setShowSettings(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear the import initial view state when the import drawer is closed
  useEffect(() => {
    if (navigation.showNoteImport) {
      importWasOpenedRef.current = true
    } else if (importWasOpenedRef.current && importInitialView) {
      setImportInitialView(undefined)
    }
  }, [navigation.showNoteImport, importInitialView])

  const openTrainingTask = useCallback((taskId: string) => {
    setSettingsInitialPanel('training')
    setInitialTrainingTaskId(taskId)
  }, [])

  const resetSettingsPanel = useCallback(() => {
    setSettingsInitialPanel('main')
    setInitialTrainingTaskId(null)
    setInitialPeerId(null)
    setInitialGroupId(null)
    setInitialPeerName(null)
  }, [])

  // Callback for notification toast tap — opens Settings to the target conversation
  const handleNotificationTap = useCallback((n: MessageNotification) => {
    if (n.isGroup && n.groupId) {
      setInitialGroupId(n.groupId)
      setInitialPeerId(null)
      setInitialPeerName(n.groupName ?? 'Group')
    } else {
      setInitialPeerId(n.peerId)
      setInitialGroupId(null)
      setInitialPeerName(n.senderName)
    }
    setSettingsInitialPanel('messages')
    navigation.setShowSettings(true)
  }, [navigation])

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

      const openTrainingPanel = (taskId: string) => {
        if (navigation.isMobile) {
          navigation.setShowTrainingDrawer(taskId)
        } else {
          openTrainingTask(taskId)
          navigation.setShowSettings(true)
        }
      }

      const openTrainingForTask = (taskId: string) => {
        if (result.data?.categoryRef && result.data?.symptomRef) {
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
          requestAnimationFrame(() => openTrainingPanel(taskId))
        } else {
          openTrainingPanel(taskId)
        }
      }

      if (result.data.guidelineType === 'stp-task') {
        const taskId = result.data.taskId
        if (taskId) openTrainingForTask(taskId)
        search.clearSearch()
        return
      }

      if (result.data.guidelineType === 'stp' || result.data.guidelineType === 'medcom') {
        const taskId = result.icon
        if (taskId && getTaskData(taskId)) openTrainingForTask(taskId)
        search.clearSearch()
        return
      }
    }

    // Navigation state change drives the grid column transition and Column A carousel
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation.handleNavigation, search.clearSearch, navigation.setShowTrainingDrawer, navigation.isMobile, navigation.setShowSettings, openTrainingTask])

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

  const handleSearchChange = (value: string) => {
    if (value.trim() !== "") {
      navigation.setShowNoteImport(false)
      navigation.expandSearchOnMobile()
    }
    search.handleSearchChange(value)
  }

  // Title: empty when searching, "TC3" when in TC3 mode on mobile, otherwise from navigation
  const title = search.searchInput ? "" : (tc3Mode && navigation.isMobile ? "TC3" : navigation.dynamicTitle)

  // Content key — drives fade-in animation on content change.
  // On mobile, search is handled by a separate overlay so the key stays stable
  // to prevent AlgorithmPage from remounting (and losing state) during search.
  const desktopContentKey = useMemo(() => {
    if (!navigation.isMobile && search.searchInput) return 'search'
    if (navigation.selectedSymptom && navigation.showQuestionCard)
      return `algo-${navigation.selectedSymptom.icon}`
    return 'empty'
  }, [navigation.isMobile, search.searchInput, navigation.selectedSymptom, navigation.showQuestionCard])

  return (
    <AvatarProvider value={avatarState}>
    <MessagesProvider>
    <CallProvider>
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
              onSearchFocus: navigation.expandSearchOnMobile,
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
              onImportClick: () => navigation.setShowNoteImport(true),
              onMedicationClick: navigation.handleShowMedications,
              onSettingsClick: () => navigation.setShowSettings(true),
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

        {/* Content area — TC3 mode uses dedicated layouts; normal mode uses 2-column grid */}
        <div className="md:h-[94%] h-full overflow-hidden absolute inset-0 md:relative md:inset-auto md:mt-2 md:mx-2">
          {tc3Mode ? (
            // TC3 mode: mobile wizard or desktop 2-column front/back layout
            navigation.isMobile ? (
              <TC3MobileWizard />
            ) : (
              <TC3DesktopLayout />
            )
          ) : (
          <div
            className={`h-full grid gap-1 transition-[grid-template-columns] duration-300 ease-in-out ${navigation.mobileGridClass} md:grid-cols-[0.45fr_0.55fr]`}
            {...(navigation.isMobile && navigation.isMobileColumnB ? swipe.touchHandlers : {})}
          >
            {/* Column A: Navigation carousel (ADTMC) */}
            <div className="h-full overflow-hidden" style={{ minWidth: 0 }}>
              <ColumnA onNavigate={handleNavigationClick} />
            </div>

            {/* Column B: Content — algorithm, search, or empty */}
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
                      key={`algo-${navigation.selectedSymptom.icon}`}
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
          )}

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
          initialViewState={importInitialView}
          isMobile={navigation.isMobile}
        />
        </ErrorBoundary>
        <ErrorBoundary>
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => { navigation.setShowSettings(false); resetSettingsPanel() }}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          initialPanel={settingsInitialPanel}
          initialTrainingTaskId={initialTrainingTaskId}
          initialPeerId={initialPeerId}
          initialGroupId={initialGroupId}
          initialPeerName={initialPeerName}
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
            selectedSymptom={navigation.writeNoteData.selectedSymptom}
            isMobile={navigation.isMobile}
            initialPage={navigation.writeNoteData.initialPage}
          />
          </ErrorBoundary>
        )}
        <UpdateNotification onVisibilityChange={setUpdateVisible} />
        {!updateVisible && <InstallPrompt />}
      </div>
      <CallOverlay />
      <MessageToastBridge onTap={handleNotificationTap} />
    </div>
    </CallProvider>
    </MessagesProvider>
    </AvatarProvider>
  )
}

/** Bridges MessagesContext notification state to the MessageNotificationToast UI. */
function MessageToastBridge({ onTap }: { onTap: (n: MessageNotification) => void }) {
  const ctx = useMessagesContext()
  if (!ctx) return null

  return (
    <MessageNotificationToast
      notification={ctx.notification}
      onDismiss={ctx.dismissNotification}
      onTap={(n) => { ctx.dismissNotification(); onTap(n) }}
    />
  )
}

function App() {
  return (
    <ThemeProvider>
      <LockGate>
        <AppContent />
      </LockGate>
    </ThemeProvider>
  )
}

export default App
