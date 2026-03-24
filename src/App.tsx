import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { DRAWER_TIMING } from './Utilities/constants'
import './App.css'
import { NavTop } from './Components/NavTop'
import { SideNav } from './Components/SideNav'
import { SearchResults } from './Components/SearchResults'
import { ThemeProvider, useTheme } from './Utilities/ThemeContext'
import { AvatarProvider } from './Utilities/AvatarContext'
import { AlgorithmPage } from './Components/AlgorithmPage'
import type { SearchResultType } from './Types/CatTypes'
import { useSearch } from './Hooks/useSearch'
import { useNavigation } from './Hooks/useNavigation'
import { useNavigationStore } from './stores/useNavigationStore'
import { useSwipeNavigation } from './Hooks/useSwipeNavigation'
import { useMenuSlide, MENU_NAV_WIDTH_MOBILE, MENU_NAV_WIDTH_DESKTOP } from './Hooks/useMenuSlide'
import { useMessagesSlide } from './Hooks/useMessagesSlide'
import UpdateNotification from './Components/UpdateNotification'
import InstallPrompt from './Components/InstallPrompt'
import { ColumnA } from './Components/ColumnA'
import { TC3DesktopLayout } from './Components/TC3/TC3DesktopLayout'
import { TC3MobileWizard } from './Components/TC3/TC3MobileWizard'

import { useNoteImport } from './Hooks/useNoteImport'
import { isEncryptedBarcode, decryptBarcode } from './Utilities/NoteCodec'
import { useProfileAvatar } from './Hooks/useProfileAvatar'
import { useAuth } from './Hooks/useAuth'
import { useAuthStore } from './stores/useAuthStore'
import { LockGate } from './Components/LockGate'
import { ErrorBoundary } from './Components/ErrorBoundary'
import { MessagesProvider, useMessagesContext } from './Hooks/MessagesContext'
import { CallProvider } from './Hooks/CallContext'
import { CallOverlay } from './Components/Settings/CallOverlay'
import { MessageNotificationToast } from './Components/MessageNotificationToast'
import { TourProvider } from './Components/Tour/TourProvider'
import { PushNotificationToast } from './Components/PushNotificationToast'
import { usePushNotifications } from './Hooks/usePushNotifications'
import type { MessageNotification } from './Hooks/useMessageNotifications'

// ── Lazy-loaded drawers/panels (code-split into separate chunks) ──
const Settings = lazy(() => import('./Components/Settings').then(m => ({ default: m.Settings })))
const KnowledgeBaseDrawer = lazy(() => import('./Components/KnowledgeBaseDrawer').then(m => ({ default: m.KnowledgeBaseDrawer })))
const TrainingDrawer = lazy(() => import('./Components/TrainingDrawer').then(m => ({ default: m.TrainingDrawer })))
const MessagesDrawer = lazy(() => import('./Components/MessagesDrawer').then(m => ({ default: m.MessagesDrawer })))
const PropertyDrawer = lazy(() => import('./Components/PropertyDrawer').then(m => ({ default: m.PropertyDrawer })))
const AdminDrawer = lazy(() => import('./Components/AdminDrawer').then(m => ({ default: m.AdminDrawer })))
const SupervisorDrawer = lazy(() => import('./Components/SupervisorDrawer').then(m => ({ default: m.SupervisorDrawer })))
const ProviderDrawer = lazy(() => import('./Components/ProviderDrawer').then(m => ({ default: m.ProviderDrawer })))
const MapOverlayDrawer = lazy(() => import('./Components/MapOverlay/MapOverlayPanel'))
const CalendarDrawer = lazy(() => import('./Components/CalendarDrawer').then(m => ({ default: m.CalendarDrawer })))
const WriteNotePage = lazy(() => import('./Components/WriteNotePage').then(m => ({ default: m.WriteNotePage })))
const SymptomInfoDrawer = lazy(() => import('./Components/SymptomInfoDrawer').then(m => ({ default: m.SymptomInfoDrawer })))
const NoteImport = lazy(() => import('./Components/NoteImport').then(m => ({ default: m.NoteImport })))

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

  // Auth store self-initializes at module load (no useEffect needed)

  const navigation = useNavigation()
  const search = useSearch()
  const { user } = useAuth()
  const avatarState = useProfileAvatar(user?.id)
  const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false

  // ── Menu slide (mobile: swipe + click, desktop: click-only) ──
  const menuNavWidth = navigation.isMobile ? MENU_NAV_WIDTH_MOBILE : MENU_NAV_WIDTH_DESKTOP
  const menuSlide = useMenuSlide({
    enabled: true,
    isOpen: navigation.isMenuOpen,
    onOpen: useCallback(() => {
      if (!navigation.isMenuOpen) navigation.toggleMenu()
    }, [navigation.isMenuOpen, navigation.toggleMenu]),
    onClose: navigation.closeMenu,
    width: menuNavWidth,
    disableGestures: !navigation.isMobile,
  })

  // ── Settings/training targeting state (lightweight replacement for useActiveNote) ──
  const [searchFocused, setSearchFocused] = useState(false)
  const headerCollapseSpring = useSpring({
    collapse: searchFocused ? 1 : 0,
    config: { tension: 280, friction: 28 },
  })
  const [settingsInitialPanel, setSettingsInitialPanel] = useState<'main' | 'release-notes' | 'user-profile'>('main')
  const [initialTrainingTaskId, setInitialTrainingTaskId] = useState<string | null>(null)
  const [initialPeerId, setInitialPeerId] = useState<string | null>(null)
  const [initialGroupId, setInitialGroupId] = useState<string | null>(null)
  const [initialPeerName, setInitialPeerName] = useState<string | null>(null)

  // ── Messages slide (mobile only — mirrors menuSlide from the right) ──
  const handleMessagesClose = useCallback(() => {
    navigation.setShowMessagesDrawer(false)
    setInitialPeerId(null)
    setInitialGroupId(null)
    setInitialPeerName(null)
  }, [navigation.setShowMessagesDrawer])

  const handleMessagesOpen = useCallback(() => {
    navigation.setShowMessagesDrawer(true)
  }, [navigation.setShowMessagesDrawer])

  const messagesSlide = useMessagesSlide({
    enabled: navigation.isMobile,
    isOpen: navigation.showMessagesDrawer,
    onOpen: handleMessagesOpen,
    onClose: handleMessagesClose,
  })
  const [updateVisible, setUpdateVisible] = useState(false)
  const [installVisible, setInstallVisible] = useState(false)
  const [postUpdatePending, setPostUpdatePending] = useState(!!_postUpdateNav)
  const [importInitialView, setImportInitialView] = useState<'input' | 'scanning' | undefined>(
    _initialViewParam === 'import' ? 'scanning' : undefined
  )
  const [importInitialBarcode, setImportInitialBarcode] = useState<string | undefined>()
  const [importAutoPickImage, setImportAutoPickImage] = useState(false)
  const [importError, setImportError] = useState('')
  const importErrorTimer = useRef<number>(0)
  const importWasOpenedRef = useRef(false)
  const { importFromBarcode } = useNoteImport()

  // PWA App Shortcut / Post-update: open the appropriate view on mount
  useEffect(() => {
    if (_postUpdateNav === 'release-notes') {
      setSettingsInitialPanel('release-notes')
      navigation.setShowSettings(true)
    } else if (_initialViewParam === 'import') {
      navigation.setShowNoteImport(true)
    } else if (_initialViewParam === 'training') {
      navigation.setShowKnowledgeBase(true, 'training')
    } else if (_initialViewParam === 'kb') {
      navigation.setShowKnowledgeBase(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear the import initial view / barcode state when the import drawer is closed
  useEffect(() => {
    if (navigation.showNoteImport) {
      importWasOpenedRef.current = true
    } else if (importWasOpenedRef.current) {
      if (importInitialView) setImportInitialView(undefined)
      if (importInitialBarcode) setImportInitialBarcode(undefined)
      if (importAutoPickImage) setImportAutoPickImage(false)
    }
  }, [navigation.showNoteImport, importInitialView, importInitialBarcode, importAutoPickImage])

  // Tour system: listen for demo import requests
  useEffect(() => {
    const handler = (e: Event) => {
      const barcode = (e as CustomEvent).detail as string
      setImportInitialBarcode(barcode)
      setImportInitialView(undefined)
      navigation.setShowNoteImport(true)
    }
    window.addEventListener('tour:open-import', handler)
    return () => window.removeEventListener('tour:open-import', handler)
  }, [navigation])

  const showImportError = useCallback((msg: string) => {
    clearTimeout(importErrorTimer.current)
    setImportError(msg)
    importErrorTimer.current = window.setTimeout(() => setImportError(''), 3000)
  }, [])

  // Inline import submit: on mobile, decode first and only open drawer on success.
  // On desktop, pass through to drawer for decode.
  const handleInlineImportSubmit = useCallback(async (barcodeText: string) => {
    setImportError('')
    if (navigation.isMobile) {
      try {
        let payload = barcodeText
        if (isEncryptedBarcode(barcodeText)) {
          const decrypted = await decryptBarcode(barcodeText)
          if (!decrypted) {
            showImportError('Sign in and connect to sync encryption key')
            return
          }
          payload = decrypted
        }
        importFromBarcode(payload) // throws on bad input
        navigation.setImportExpanded(false)
        setImportInitialBarcode(barcodeText)
        setImportInitialView(undefined)
        navigation.setShowNoteImport(true)
      } catch {
        showImportError('Unrecognized code — check the text and try again')
      }
    } else {
      navigation.setImportExpanded(false)
      setImportInitialBarcode(barcodeText)
      setImportInitialView(undefined)
      navigation.setShowNoteImport(true)
    }
  }, [navigation.isMobile, navigation.setImportExpanded, navigation.setShowNoteImport, importFromBarcode])

  const openTrainingTask = useCallback((taskId: string) => {
    setInitialTrainingTaskId(taskId)
    navigation.setShowKnowledgeBase(true, 'training-detail')
  }, [navigation.setShowKnowledgeBase])

  const resetSettingsPanel = useCallback(() => {
    setSettingsInitialPanel('main')
  }, [])

  const handleKnowledgeBaseClick = useCallback(() => {
    setInitialTrainingTaskId(null)
    navigation.setShowKnowledgeBase(true)
  }, [navigation.setShowKnowledgeBase])

  const handleMessagesClick = useCallback(() => {
    setInitialPeerId(null)
    setInitialGroupId(null)
    setInitialPeerName(null)
    navigation.setShowMessagesDrawer(true)
  }, [navigation.setShowMessagesDrawer])

  const handlePropertyClick = useCallback(() => {
    navigation.setShowPropertyDrawer(true)
  }, [navigation.setShowPropertyDrawer])


  const handleMapOverlayClick = useCallback(() => {
    navigation.setShowMapOverlayDrawer(true)
  }, [navigation.setShowMapOverlayDrawer])

  const handleCalendarClick = useCallback(() => {
    navigation.setShowCalendarDrawer(true)
  }, [navigation.setShowCalendarDrawer])

  const handleAdminClick = useCallback(() => {
    navigation.setShowAdminDrawer(true)
  }, [navigation.setShowAdminDrawer])

  const handleSupervisorClick = useCallback(() => {
    navigation.setShowSupervisorDrawer(true)
  }, [navigation.setShowSupervisorDrawer])

  const handleMenuItemClick = useCallback((action: string) => {
    switch (action) {
      case 'import':
        if (navigation.isMobile) {
          navigation.toggleImportExpanded()
        } else {
          navigation.setShowNoteImport(true)
        }
        break
      case 'knowledgebase':
        handleKnowledgeBaseClick()
        break
      case 'messages':
        handleMessagesClick()
        break
      case 'property':
        handlePropertyClick()
        break
      case 'provider':
        navigation.setShowProviderDrawer(true)
        break
      case 'supervisor':
        handleSupervisorClick()
        break
      case 'admin':
        handleAdminClick()
        break
case 'mapOverlay':
        handleMapOverlayClick()
        break
      case 'calendar':
        handleCalendarClick()
        break
      case 'settings':
        navigation.setShowSettings(true)
        break
      case 'settings-profile':
        setSettingsInitialPanel('user-profile')
        navigation.setShowSettings(true)
        break
    }
  }, [navigation.isMobile, navigation.toggleImportExpanded, navigation.setShowNoteImport, navigation.setShowSettings, handleKnowledgeBaseClick, handleMessagesClick, handlePropertyClick, handleMapOverlayClick, handleCalendarClick, handleSupervisorClick, handleAdminClick])

  // Callback for notification toast tap — opens MessagesDrawer to the target conversation
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
    navigation.setShowMessagesDrawer(true)
  }, [navigation.setShowMessagesDrawer])

  // Cross-column swipe: swipe back from Column B (algorithm) to Column A,
  // or swipe left from right edge to open messages
  const swipe = useSwipeNavigation({
    enabled: navigation.isMobile && !search.searchInput && !navigation.isWriteNoteVisible,
    viewDepth: navigation.isMobileColumnB ? 1 : 0,
    onSwipeBack: useCallback(() => {
      navigation.handleBackClick()
    }, [navigation]),
    onRightEdgeDrag: navigation.isMobile ? messagesSlide.onEdgeDrag : undefined,
    onRightEdgeDragEnd: navigation.isMobile ? messagesSlide.onEdgeDragEnd : undefined,
  })

  // When search is cleared while expanded, collapse back
  useEffect(() => {
    if (!search.searchInput.trim() && navigation.isSearchExpanded) {
      navigation.setSearchExpanded(false)
    }
  }, [search.searchInput, navigation.isSearchExpanded, navigation.setSearchExpanded])

  const handleNavigationClick = useCallback((result: SearchResultType) => {
    // Intercept training items — split by guidelineType
    if (result.type === 'training' && result.data?.guidelineType) {

      const openTrainingForResult = (taskId: string) => {
        if (navigation.isMobile) {
          // Mobile: quick-view TrainingDrawer for search results
          navigation.setShowTrainingDrawer(taskId)
        } else {
          // Desktop: open KB directly to task detail
          openTrainingTask(taskId)
        }
      }

      const openTrainingForTask = (taskId: string) => {
        if (result.data?.categoryRef && result.data?.symptomRef) {
          // If already viewing this symptom, open KB directly — skip the
          // redundant CC navigation whose CLOSE_ALL_DRAWERS + rAF deferral
          // causes ColumnA's carousel to briefly lose its panel position.
          const s = useNavigationStore.getState()
          const alreadyViewing =
            s.viewState === 'questions' &&
            s.selectedCategory?.id === result.data.categoryId &&
            s.selectedSymptom?.id === result.data.symptomId

          if (alreadyViewing) {
            openTrainingForResult(taskId)
          } else {
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
            requestAnimationFrame(() => openTrainingForResult(taskId))
          }
        } else {
          openTrainingForResult(taskId)
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
        if (taskId) {
          import('./Data/TrainingData').then(({ getTaskData }) => {
            if (getTaskData(taskId)) openTrainingForTask(taskId)
          })
        }
        search.clearSearch()
        return
      }
    }

    // Screener / calculator → open KB to the right view
    if (result.type === 'screener' && result.data?.kbCategoryId) {
      navigation.setShowKnowledgeBase(true, 'screener', null, result.data.kbCategoryId)
      search.clearSearch()
      return
    }
    if (result.type === 'calculator' && result.data?.kbCategoryId) {
      navigation.setShowKnowledgeBase(true, 'calculator', null, result.data.kbCategoryId)
      search.clearSearch()
      return
    }

    // Navigation state change drives the grid column transition and Column A carousel
    navigation.handleNavigation(result)
    search.clearSearch()
  }, [navigation.handleNavigation, search.clearSearch, navigation.setShowTrainingDrawer, navigation.isMobile, openTrainingTask, navigation.setShowKnowledgeBase])

  const clearSearchAndCollapse = useCallback(() => {
    search.clearSearch()
    if (navigation.isSearchExpanded) {
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
    <TourProvider onboardingBlocked={updateVisible || installVisible || postUpdatePending}>
    <MessagesProvider>
    <CallProvider>
    <div className='h-screen bg-themewhite md:bg-themewhite2 items-center flex justify-center overflow-hidden'>
      <div id="app-drawer-root" className="max-w-315 shrink w-full md:rounded-md md:border md:border-[rgba(0,0,0,0.03)] md:shadow-[0px_2px_4px] md:shadow-[rgba(0,0,0,0.1)] overflow-hidden md:m-5 md:h-[85%] h-full relative md:bg-themewhite md:pb-10">

        {/* Viewport strip — SideNav + content side by side, pans to reveal nav or shift for messages */}
        <div
          className="flex h-full"
          style={{
            width: `calc(100% + ${menuNavWidth}px)`,
            transform: navigation.isMobile
              ? `translateX(${menuSlide.position - menuNavWidth - messagesSlide.progress * 80}px)`
              : `translateX(${menuSlide.position - menuNavWidth}px)`,
            transition: (menuSlide.isDragging || messagesSlide.isDragging) ? 'none' : `transform ${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
            willChange: (menuSlide.isDragging || messagesSlide.isDragging) ? 'transform' : 'auto',
          }}
        >
          {/* SideNav — same level, left of content */}
          <div className="h-full shrink-0" style={{ width: menuNavWidth }}>
            <SideNav
              onClose={navigation.closeMenu}
              onMenuItemClick={handleMenuItemClick}
              isMobile={navigation.isMobile}
            />
          </div>

          {/* Content — takes full viewport width */}
          <animated.div
            className="flex flex-col h-full flex-1 min-w-0 relative"
            style={{
              '--header-collapse': headerCollapseSpring.collapse,
            } as React.CSSProperties}
          >
          {/* Navbar - overlaps content on mobile for blur effect, extends into safe area on iOS */}
          <animated.div className={`${navigation.isMobile
            ? 'absolute top-0 left-0 right-0 z-30 pt-[var(--sat)] backdrop-blur-xs bg-themewhite/10 overflow-hidden h-[3.75rem]'
            : 'relative h-13.75'
            } w-full rounded-t-md flex justify-end`}
            style={navigation.isMobile ? {
              height: headerCollapseSpring.collapse.to(
                (c: number) => `calc((var(--sat, 0px) + 3.75rem) * ${1 - c})`
              ),
              opacity: headerCollapseSpring.collapse.to((c: number) => 1 - c),
              transform: headerCollapseSpring.collapse.to(
                (c: number) => `scale(${1 - c * 0.03})`
              ),
            } : undefined}>
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
              import={{
                isImportExpanded: navigation.isImportExpanded,
                onImportExpandToggle: navigation.toggleImportExpanded,
                onImportSubmit: handleInlineImportSubmit,
                onImportScan: () => { setImportError(''); navigation.setImportExpanded(false); setImportInitialView('scanning'); navigation.setShowNoteImport(true); },
                onImportImage: () => { setImportError(''); navigation.setImportExpanded(false); setImportAutoPickImage(true); navigation.setShowNoteImport(true); },
                importError,
              }}
              actions={{
                onBackClick: handleBackClick,
                onMenuClick: navigation.toggleMenu,
                onKnowledgeBaseClick: handleKnowledgeBaseClick,
                onInfoClick: navigation.toggleSymptomInfo,
                onMessagesClick: handleMessagesClick,
              }}
              ui={{
                showBack: navigation.shouldShowBackButton(!!search.searchInput.trim()),
                showMenu: navigation.shouldShowMenuButton(!!search.searchInput.trim()),
                dynamicTitle: title,
                isMobile: navigation.isMobile,
                isAlgorithmView: navigation.showQuestionCard,
                isSearchFocused: searchFocused,
              }}
            />
          </animated.div>

          {/* Content area — TC3 mode uses dedicated layouts; normal mode uses 2-column grid */}
          <div className="md:flex-1 h-full overflow-hidden absolute inset-0 md:relative md:inset-auto md:mt-2 md:mx-2">
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
              {...(navigation.isMobile ? swipe.touchHandlers : {})}
            >
              {/* Column A: Navigation carousel (ADTMC) */}
              <div className="h-full overflow-hidden" style={{ minWidth: 0 }}>
                <ColumnA
                  onNavigate={handleNavigationClick}
                  onEdgeDrag={navigation.isMobile ? menuSlide.onEdgeDrag : undefined}
                  onEdgeDragEnd={navigation.isMobile ? menuSlide.onEdgeDragEnd : undefined}
                  onRightEdgeDrag={navigation.isMobile ? messagesSlide.onEdgeDrag : undefined}
                  onRightEdgeDragEnd={navigation.isMobile ? messagesSlide.onEdgeDragEnd : undefined}
                  searchInput={search.searchInput}
                  onSearchChange={navigation.isMobile ? handleSearchChange : undefined}
                  searchResults={search.searchResults}
                  isSearching={search.isSearching}
                  onSearchFocusChange={setSearchFocused}
                  headerCollapse={headerCollapseSpring.collapse}
                />
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
                        searchInput={search.searchInput}
                        onSearchChange={navigation.isMobile ? handleSearchChange : undefined}
                        onSearchFocusChange={setSearchFocused}
                        searchResults={search.searchResults}
                        isSearching={search.isSearching}
                        onSearchResultClick={handleNavigationClick}
                        headerCollapse={headerCollapseSpring.collapse}
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

          </div>

          {/* Menu backdrop — overlays content when menu is open, handles tap/drag to close */}
          <div
            className="absolute inset-0 z-40 bg-black"
            style={{
              opacity: menuSlide.backdropOpacity,
              transition: menuSlide.backdropTransition,
              pointerEvents: navigation.isMenuOpen ? 'auto' : 'none',
              touchAction: navigation.isMenuOpen ? 'none' : 'auto',
            }}
            onClick={navigation.isMobile ? undefined : navigation.closeMenu}
            {...(navigation.isMobile ? menuSlide.closeHandlers : {})}
          />

          {/* Messages backdrop — overlays content when messages is open */}
          {navigation.isMobile && (
            <div
              className="absolute inset-0 z-40 bg-black"
              style={{
                opacity: messagesSlide.backdropOpacity,
                transition: messagesSlide.backdropTransition,
                pointerEvents: (navigation.showMessagesDrawer || messagesSlide.progress > 0) ? 'auto' : 'none',
                touchAction: (navigation.showMessagesDrawer || messagesSlide.progress > 0) ? 'none' : 'auto',
              }}
              {...messagesSlide.closeHandlers}
            />
          )}
          </animated.div>
        </div>

        {/* Messages panel — slides over content from right (mobile only, always mounted) */}
        {navigation.isMobile && (
          <div
            className="absolute inset-0 z-50 overflow-hidden touch-pan-y"
            style={{
              transform: `translateX(${(1 - messagesSlide.progress) * 100}%)`,
              transition: messagesSlide.transition,
              willChange: messagesSlide.isDragging ? 'transform' : 'auto',
              pointerEvents: (navigation.showMessagesDrawer || messagesSlide.progress > 0) ? 'auto' : 'none',
            }}

          >
            <ErrorBoundary>
            <Suspense fallback={null}>
            <MessagesDrawer
              isVisible={navigation.showMessagesDrawer}
              onClose={handleMessagesClose}
              initialPeerId={initialPeerId}
              initialGroupId={initialGroupId}
              initialPeerName={initialPeerName}
            />
            </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* ── Drawers — outside the transform wrapper so position:fixed works correctly ── */}
        <ErrorBoundary>
        <Suspense fallback={null}>
        <NoteImport
          isVisible={navigation.showNoteImport}
          onClose={() => navigation.setShowNoteImport(false)}
          initialViewState={importInitialView}
          initialBarcodeText={importInitialBarcode}
          autoPickImage={importAutoPickImage}
          isMobile={navigation.isMobile}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <Settings
          isVisible={navigation.showSettings}
          onClose={() => { navigation.setShowSettings(false); resetSettingsPanel(); setPostUpdatePending(false) }}
          isDarkMode={theme === 'dark'}
          onToggleTheme={toggleTheme}
          initialPanel={settingsInitialPanel}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <KnowledgeBaseDrawer
          isVisible={navigation.showKnowledgeBase}
          onClose={() => navigation.setShowKnowledgeBase(false)}
          initialView={navigation.kbInitialView}
          initialTaskId={initialTrainingTaskId}
          initialMedication={navigation.kbInitialMedication}
          initialScreenerId={navigation.kbInitialScreenerId}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <SymptomInfoDrawer
          isVisible={navigation.showSymptomInfo}
          onClose={() => navigation.setShowSymptomInfo(false)}
          selectedSymptom={navigation.selectedSymptom}
          selectedCategory={navigation.selectedCategory}
          onNavigate={handleNavigationClick}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <TrainingDrawer
          isVisible={navigation.showTrainingDrawer}
          onClose={() => navigation.setShowTrainingDrawer(null)}
          taskId={navigation.trainingDrawerTaskId}
        />
        </Suspense>
        </ErrorBoundary>
        {/* Messages — desktop only (mobile is in the viewport strip above) */}
        {!navigation.isMobile && (
          <ErrorBoundary>
          <Suspense fallback={null}>
          <MessagesDrawer
            isVisible={navigation.showMessagesDrawer}
            onClose={handleMessagesClose}
            initialPeerId={initialPeerId}
            initialGroupId={initialGroupId}
            initialPeerName={initialPeerName}
          />
          </Suspense>
          </ErrorBoundary>
        )}
        <ErrorBoundary>
        <Suspense fallback={null}>
        <PropertyDrawer
          isVisible={navigation.showPropertyDrawer}
          onClose={() => navigation.setShowPropertyDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <MapOverlayDrawer
          isVisible={navigation.showMapOverlayDrawer}
          onClose={() => navigation.setShowMapOverlayDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <CalendarDrawer
          isVisible={navigation.showCalendarDrawer}
          onClose={() => navigation.setShowCalendarDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <AdminDrawer
          isVisible={navigation.showAdminDrawer}
          onClose={() => navigation.setShowAdminDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <SupervisorDrawer
          isVisible={navigation.showSupervisorDrawer}
          onClose={() => navigation.setShowSupervisorDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
        <Suspense fallback={null}>
        <ProviderDrawer
          isVisible={navigation.showProviderDrawer}
          onClose={() => navigation.setShowProviderDrawer(false)}
        />
        </Suspense>
        </ErrorBoundary>
        {/* WriteNotePage — BaseDrawer handles mobile/desktop positioning */}
        {navigation.writeNoteData && (
          <ErrorBoundary>
          <Suspense fallback={null}>
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
          </Suspense>
          </ErrorBoundary>
        )}
        <UpdateNotification onVisibilityChange={setUpdateVisible} />
        {!updateVisible && <InstallPrompt onVisibilityChange={setInstallVisible} />}
      </div>
      <CallOverlay />
      <MessageToastBridge onTap={handleNotificationTap} />
      <PushToastBridge />
    </div>
    </CallProvider>
    </MessagesProvider>
    </TourProvider>
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

/** Renders foreground push notification toasts (dev alerts, etc.). */
function PushToastBridge() {
  const { foregroundPush, dismissForegroundPush } = usePushNotifications()
  return (
    <PushNotificationToast
      notification={foregroundPush}
      onDismiss={dismissForegroundPush}
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
