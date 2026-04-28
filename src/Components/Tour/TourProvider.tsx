import { lazy, Suspense, useCallback, useState, useEffect, createContext, useContext } from 'react'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useTour, type TourActionHandler } from '../../Hooks/useTour'
import type { TourDefinition } from '../../Data/tourDefinitions'
import { catData } from '../../Data/CatData'
import { useAuth } from '../../Hooks/useAuth'
import { useTheme } from '../../Utilities/ThemeContext'
import { GUIDED_TOURS_ENABLED } from '../../lib/featureFlags'
import { useOnboardingReady } from '../../Hooks/useOnboardingReady'
import { useNavPreferencesStore } from '../../stores/useNavPreferencesStore'

const TourOverlay = lazy(() => import('./TourOverlay').then(m => ({ default: m.TourOverlay })))
const GettingStartedScene = lazy(() => import('./scenes/GettingStartedScene'))

// ─── Context ─────────────────────────────────────────────────────────────────

interface TourContextValue {
  startTour: (tourId: string) => void
  isActive: boolean
  availableTours: TourDefinition[]
  isCompleted: (tourId: string) => boolean
  hasSeenFirstLaunch: boolean
  resetAllTours: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTourContext() {
  return useContext(TourContext)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Click a DOM element by data-tour attribute. Returns true if found. */
function clickTarget(target: string): boolean {
  const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null
  if (el) {
    el.click()
    return true
  }
  return false
}

/** Wait for a data-tour element to appear in the DOM (max ~3s) */
function waitForTarget(target: string, timeout = 3000): Promise<boolean> {
  return new Promise(resolve => {
    const el = document.querySelector(`[data-tour="${target}"]`)
    if (el) { resolve(true); return }

    const observer = new MutationObserver(() => {
      if (document.querySelector(`[data-tour="${target}"]`)) {
        observer.disconnect()
        resolve(true)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(false) }, timeout)
  })
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function TourProvider({ children, onboardingBlocked = false }: { children: React.ReactNode; onboardingBlocked?: boolean }) {
  const { isDevRole } = useAuth()
  if (!GUIDED_TOURS_ENABLED && !isDevRole) return <>{children}</>
  return <TourProviderInner onboardingBlocked={onboardingBlocked}>{children}</TourProviderInner>
}

function TourProviderInner({ children, onboardingBlocked }: { children: React.ReactNode; onboardingBlocked: boolean }) {
  const nav = useNavigationStore
  const isMobile = nav((s) => s.isMobile)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [tooltipHidden, setTooltipHidden] = useState(false)
  const [curtainVisible, setCurtainVisible] = useState(false)

  const closeAllDrawers = useCallback(() => {
    const store = nav.getState()
    store.closeMenu()
    store.setShowSettings(false)
    store.setShowKnowledgeBase(false)
    store.setShowMessagesDrawer(false)
    store.setShowCalendarDrawer(false)
    store.setShowSupervisorDrawer(false)
    store.setShowProviderDrawer(false)
    store.setShowPropertyDrawer(false)
    store.setShowAdminDrawer(false)
  }, [nav])

  // Map string action keys to navigation store calls
  const handleAction: TourActionHandler = useCallback(async (action: string) => {
    const store = nav.getState()

    // ── close:all ──────────────────────────────────────────
    if (action === 'close:all') {
      closeAllDrawers()
      store.resetToMain()
      return
    }

    // ── close:sidenav ──────────────────────────────────────
    if (action === 'close:sidenav') {
      store.closeMenu()
      return
    }

    // ── open:sidenav ───────────────────────────────────────
    if (action === 'open:sidenav') {
      store.setShowSettings(false)
      store.setShowKnowledgeBase(false)
      store.setShowMessagesDrawer(false)
      store.setShowCalendarDrawer(false)
      store.setShowSupervisorDrawer(false)
      store.setShowProviderDrawer(false)
      if (!store.isMenuOpen) store.toggleMenu()
      return
    }

    // ── click:target — programmatic click on a data-tour element ──
    const clickMatch = action.match(/^click:(.+)$/)
    if (clickMatch) {
      const target = clickMatch[1]
      // Wait for the element if it doesn't exist yet
      await waitForTarget(target)
      await new Promise(r => setTimeout(r, 100))
      clickTarget(target)
      return
    }

    // ── scroll-to:target — scroll a data-tour element into view ──
    const scrollMatch = action.match(/^scroll-to:(.+)$/)
    if (scrollMatch) {
      const target = scrollMatch[1]
      await waitForTarget(target)
      const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await new Promise(r => setTimeout(r, 400))
      }
      return
    }

    // ── navigate:category:id — select a category in ColumnA ──
    const catMatch = action.match(/^navigate:category:(\d+)$/)
    if (catMatch) {
      const categoryId = parseInt(catMatch[1], 10)
      const category = catData.find(c => c.id === categoryId)
      if (category) {
        store.handleNavigation({
          type: 'category',
          id: category.id,
          icon: category.icon || '',
          text: category.text || '',
          data: { categoryRef: category },
        })
      }
      return
    }

    // ── navigate:symptom:categoryId:symptomId — select a symptom ──
    const symMatch = action.match(/^navigate:symptom:(\d+):(\d+)$/)
    if (symMatch) {
      const categoryId = parseInt(symMatch[1], 10)
      const symptomId = parseInt(symMatch[2], 10)
      const category = catData.find(c => c.id === categoryId)
      const symptom = category?.contents?.find(s => s.id === symptomId)
      if (category && symptom) {
        store.handleNavigation({
          type: 'CC',
          id: symptom.id!,
          icon: symptom.icon || '',
          text: symptom.text || '',
          data: { categoryRef: category, symptomRef: symptom, categoryId },
        })
      }
      return
    }

    // ── answer:cardIndex:answerIndex — click an algorithm answer button ──
    const answerMatch = action.match(/^answer:(\d+):(\d+)$/)
    if (answerMatch) {
      const cardIndex = answerMatch[1]
      const answerIndex = answerMatch[2]
      const target = `answer-${cardIndex}-${answerIndex}`
      await waitForTarget(target, 2000)
      await new Promise(r => setTimeout(r, 200))
      clickTarget(target)
      return
    }

    // ── navigate:settings:back — slide right back to main settings ──
    if (action === 'navigate:settings:back') {
      window.dispatchEvent(new CustomEvent('tour:settings-back'))
      return
    }

    // ── navigate:settings:panel ──
    const settingsNav = action.match(/^navigate:settings:(.+)$/)
    if (settingsNav) {
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: settingsNav[1] }))
      return
    }

    // ── open:writenote — open WriteNotePage with all sections enabled ──
    if (action === 'open:writenote') {
      // Set global flag before mount so WriteNotePage initializes with all sections
      window.__tourNoteOverride = true
      clickTarget('algorithm-expand-note')
      // Wait for WriteNotePage to mount (HPI is the first page)
      await waitForTarget('writenote-edit-page', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── restore:note-sections — revert tour overrides ──
    if (action === 'restore:note-sections') {
      window.__tourNoteOverride = false
      window.dispatchEvent(new CustomEvent('tour:restore-note-sections'))
      return
    }

    // ── inject:note-hpi / inject:note-pe / inject:note-plan — fill WriteNotePage sections ──
    if (action === 'inject:note-hpi') {
      window.dispatchEvent(new CustomEvent('tour:inject-hpi'))
      return
    }
    if (action === 'inject:note-pe') {
      window.dispatchEvent(new CustomEvent('tour:inject-pe'))
      return
    }
    if (action === 'inject:note-plan') {
      window.dispatchEvent(new CustomEvent('tour:inject-plan'))
      return
    }

    // ── pe: actions — physical exam preview interactions ──
    if (action.startsWith('pe:open-preview:')) {
      const blockKey = action.slice('pe:open-preview:'.length)
      window.dispatchEvent(new CustomEvent('tour:pe-open-preview', { detail: blockKey }))
      return
    }
    if (action === 'pe:mark-normal') {
      window.dispatchEvent(new CustomEvent('tour:pe-mark-normal'))
      return
    }
    if (action.startsWith('pe:toggle-abnormal:')) {
      const abnormalKey = action.slice('pe:toggle-abnormal:'.length)
      window.dispatchEvent(new CustomEvent('tour:pe-toggle-abnormal', { detail: abnormalKey }))
      return
    }
    if (action === 'pe:reset') {
      window.dispatchEvent(new CustomEvent('tour:pe-reset'))
      return
    }
    if (action === 'pe:close-preview') {
      window.dispatchEvent(new CustomEvent('tour:pe-close-preview'))
      return
    }
    if (action.startsWith('pe:switch-preview:')) {
      const blockKey = action.slice('pe:switch-preview:'.length)
      window.dispatchEvent(new CustomEvent('tour:pe-close-preview'))
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:pe-open-preview', { detail: blockKey }))
      return
    }

    // ── inject:expander — inject a temporary text expander ──
    if (action === 'inject:expander') {
      window.dispatchEvent(new CustomEvent('tour:inject-expander'))
      return
    }

    // ── cleanup:expander — remove the temporary text expander ──
    if (action === 'cleanup:expander') {
      window.dispatchEvent(new CustomEvent('tour:cleanup-expander'))
      return
    }

    // ── expander:demo:* — text expander tour interactive demo ──
    if (action === 'expander:demo:open-and-type') {
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'text-templates' }))
      return
    }
    if (action === 'expander:demo:submit') {
      window.dispatchEvent(new CustomEvent('tour:expander-submit'))
      return
    }
    if (action.startsWith('expander:demo:build-')) {
      const step = action.replace('expander:demo:build-', '')
      window.dispatchEvent(new CustomEvent('tour:expander-build', { detail: step }))
      return
    }
    if (action === 'expander:demo:accept') {
      window.dispatchEvent(new CustomEvent('tour:expander-accept'))
      return
    }
    if (action === 'expander:demo:finish') {
      window.dispatchEvent(new CustomEvent('tour:expander-cleanup'))

      // Same as return:guided-tours — fade, navigate, reopen
      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── calendar:setup — inject mock event, open calendar on month view ──
    if (action === 'calendar:setup') {
      const { createCalendarTourEvent, CALENDAR_TOUR_EVENT_PREFIX } = await import('../../Data/GuidedTourData')
      const { useCalendarStore } = await import('../../stores/useCalendarStore')
      const { useAuthStore } = await import('../../stores/useAuthStore')
      const authState = useAuthStore.getState()
      const calStore = useCalendarStore.getState()

      // Remove any leftover tour events
      calStore.events.forEach(e => { if (e.id.startsWith(CALENDAR_TOUR_EVENT_PREFIX)) calStore.removeEvent(e.id) })

      const clinicId = authState.clinicId ?? ''
      const userId = authState.user?.id ?? ''
      const mockEvent = createCalendarTourEvent(clinicId, userId)
      calStore.addEvent(mockEvent)
      calStore.setView('month')

      // Select today so the mock event is visible
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      calStore.setSelectedDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`)

      closeAllDrawers()
      store.closeMenu()
      await new Promise(r => setTimeout(r, 50))
      store.setShowCalendarDrawer(true)
      await waitForTarget('calendar-month-grid', 5000)
      await new Promise(r => setTimeout(r, 400))
      return
    }

    // ── calendar:view:* — switch calendar view ──
    if (action.startsWith('calendar:view:')) {
      const view = action.replace('calendar:view:', '') as 'month' | 'day' | 'troops' | 'huddle'
      const { useCalendarStore } = await import('../../stores/useCalendarStore')
      // Huddle band lives inside troops view — switching to 'huddle' just routes there
      const storeView = view === 'huddle' ? 'troops' : view
      useCalendarStore.getState().setView(storeView)
      const targetMap = { month: 'calendar-month-grid', day: 'calendar-day-view', troops: 'calendar-troops-view', huddle: 'calendar-huddle-band' }
      await waitForTarget(targetMap[view], 3000)
      await new Promise(r => setTimeout(r, 200))
      return
    }

    // ── calendar:select-huddle-category — set form category to huddle ──
    if (action === 'calendar:select-huddle-category') {
      window.dispatchEvent(new CustomEvent('tour:calendar-select-category', { detail: 'huddle' }))
      await waitForTarget('event-form-huddle-task', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── calendar:open-export-import — open the calendar add menu ──
    if (action === 'calendar:open-export-import') {
      clickTarget('calendar-add-event')
      await waitForTarget('calendar-export-import', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── note:open-ddx — open differential picker on WriteNotePage ──
    if (action === 'note:open-ddx') {
      window.dispatchEvent(new CustomEvent('tour:open-ddx'))
      await new Promise(r => setTimeout(r, 300))
      return
    }
    if (action === 'note:select-ddx-demo') {
      window.dispatchEvent(new CustomEvent('tour:select-ddx-demo'))
      await new Promise(r => setTimeout(r, 300))
      return
    }
    if (action === 'note:close-ddx') {
      window.dispatchEvent(new CustomEvent('tour:close-ddx'))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── calendar:open-controls — open mobile controls drawer ──
    if (action === 'calendar:open-controls') {
      window.dispatchEvent(new CustomEvent('tour:calendar-open-controls'))
      await waitForTarget('calendar-controls-drawer', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── calendar:close-controls — close mobile controls drawer ──
    if (action === 'calendar:close-controls') {
      window.dispatchEvent(new CustomEvent('tour:calendar-close-controls'))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── calendar:open-event-form — click add button, wait for form ──
    if (action === 'calendar:open-event-form') {
      const { useCalendarStore } = await import('../../stores/useCalendarStore')
      useCalendarStore.getState().setView('month')
      await new Promise(r => setTimeout(r, 200))
      clickTarget('calendar-add-event')
      await waitForTarget('event-form-title', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── calendar:cleanup — remove mock event, return to guided tours ──
    if (action === 'calendar:cleanup') {
      const { CALENDAR_TOUR_EVENT_PREFIX } = await import('../../Data/GuidedTourData')
      const { useCalendarStore } = await import('../../stores/useCalendarStore')
      const calStore = useCalendarStore.getState()
      calStore.events.forEach(e => { if (e.id.startsWith(CALENDAR_TOUR_EVENT_PREFIX)) calStore.removeEvent(e.id) })

      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── messaging:open-self-chat — dismiss provisional modal + open self-chat ──
    if (action === 'messaging:open-self-chat') {
      window.dispatchEvent(new CustomEvent('tour:messaging-dismiss-provisional'))
      await new Promise(r => setTimeout(r, 100))
      window.dispatchEvent(new CustomEvent('tour:messaging-open-self-chat'))
      await waitForTarget('messages-input', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── messaging:send-note — send a test note to self ──
    if (action === 'messaging:send-note') {
      window.dispatchEvent(new CustomEvent('tour:messaging-send-note'))
      await waitForTarget('messages-latest-bubble', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── messaging:send-reply — send a threaded reply to the test note ──
    if (action === 'messaging:send-reply') {
      window.dispatchEvent(new CustomEvent('tour:messaging-send-reply'))
      await waitForTarget('messages-thread-badge', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── messaging:open-thread — click the thread badge to open thread view ──
    if (action === 'messaging:open-thread') {
      clickTarget('messages-thread-badge')
      await waitForTarget('messages-thread-overlay', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── messaging:cleanup — delete tour messages, return to guided tours ──
    if (action === 'messaging:cleanup') {
      window.dispatchEvent(new CustomEvent('tour:messaging-cleanup'))
      await new Promise(r => setTimeout(r, 600))

      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── open:symptom-info — open the symptom info drawer ──
    if (action === 'open:symptom-info') {
      store.setShowSymptomInfo(true)
      return
    }

    // ── close:symptom-info — close the symptom info drawer ──
    if (action === 'close:symptom-info') {
      store.setShowSymptomInfo(false)
      return
    }

    // ── setup:writenote-demo — reconstruct A-1 algorithm state and open WriteNotePage ──
    if (action === 'setup:writenote-demo') {
      const [{ Algorithm }, { reconstructCardStates, parseNoteEncoding }, { generateGuidedBarcode }] = await Promise.all([
        import('../../Data/Algorithms'),
        import('../../Utilities/noteParser'),
        import('../../Data/GuidedTourData'),
      ])
      const algo = Algorithm.find(a => a.id === 'A-1')
      if (!algo) return
      const barcode = generateGuidedBarcode()
      const parsed = parseNoteEncoding(barcode)
      if (!parsed) return
      const { cardStates, disposition } = reconstructCardStates(algo.options, parsed)
      if (!disposition) return

      window.__tourNoteOverride = true
      store.openWriteNote({
        disposition,
        algorithmOptions: algo.options,
        cardStates,
        selectedSymptom: { icon: 'A-1', text: 'Sore Throat/Hoarseness' },
      })
      await waitForTarget('writenote-edit-page', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── open:import-demo — generate demo barcode and open NoteImport ──
    if (action === 'open:import-demo') {
      const { generateGuidedBarcode } = await import('../../Data/GuidedTourData')
      const barcode = generateGuidedBarcode()
      closeAllDrawers()
      store.closeWriteNote()
      await new Promise(r => setTimeout(r, 100))
      window.dispatchEvent(new CustomEvent('tour:open-import', { detail: barcode }))
      await waitForTarget('import-note-preview', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── supervisor:open-first-area — click the first coverage area to navigate into it ──
    if (action === 'supervisor:open-first-area') {
      window.dispatchEvent(new CustomEvent('tour:supervisor-open-first-area'))
      await waitForTarget('supervisor-task-list', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── supervisor:cleanup — reset to base state, close supervisor, return to guided tours ──
    if (action === 'supervisor:cleanup') {
      // Reset supervisor drawer to base view before closing
      window.dispatchEvent(new CustomEvent('tour:supervisor-back'))
      await new Promise(r => setTimeout(r, 100))
      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── clinic:open — close all, open Settings → Clinic panel ──
    if (action === 'clinic:open') {
      closeAllDrawers()
      store.closeMenu()
      await new Promise(r => setTimeout(r, 50))
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'clinic' }))
      await waitForTarget('clinic-identity-card', 5000)
      await new Promise(r => setTimeout(r, 400))
      return
    }

    // ── clinic:cleanup — reset clinic state, return to guided tours ──
    if (action === 'clinic:cleanup') {
      window.dispatchEvent(new CustomEvent('tour:clinic-cancel-edit'))
      await new Promise(r => setTimeout(r, 300))

      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── planorderset:setup — open Settings → Plan panel, enable edit ──
    if (action === 'planorderset:setup') {
      closeAllDrawers()
      store.closeMenu()
      await new Promise(r => setTimeout(r, 50))
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'plan-settings' }))
      await new Promise(r => setTimeout(r, 400))
      window.dispatchEvent(new CustomEvent('tour:plan-enable-edit'))
      await waitForTarget('plan-settings-panel', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:add-med-1 — stage Tylenol 325mg tab ──
    if (action === 'planorderset:add-med-1') {
      window.dispatchEvent(new CustomEvent('tour:plan-stage-tag', { detail: { key: 'meds', tag: 'Tylenol 325mg tab' } }))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:add-med-2 — stage Mucinex 500mg tab ──
    if (action === 'planorderset:add-med-2') {
      window.dispatchEvent(new CustomEvent('tour:plan-stage-tag', { detail: { key: 'meds', tag: 'Mucinex 500mg tab' } }))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:add-instruction — stage instruction tag ──
    if (action === 'planorderset:add-instruction') {
      window.dispatchEvent(new CustomEvent('tour:plan-stage-tag', { detail: { key: 'instructions', tag: 'Encouraged adequate hand hygiene and hydration, rest.' } }))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:add-followup — stage follow-up tag ──
    if (action === 'planorderset:add-followup') {
      window.dispatchEvent(new CustomEvent('tour:plan-stage-tag', { detail: { key: 'followUp', tag: 'F/U in 10-14 days if persists; sooner if worsens or changes significantly.' } }))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:start-compose — start composing an order set ──
    if (action === 'planorderset:start-compose') {
      window.dispatchEvent(new CustomEvent('tour:plan-start-compose', { detail: { name: 'URI Basic' } }))
      await new Promise(r => setTimeout(r, 400))
      return
    }

    // ── planorderset:select-tags — select all staged tags in compose mode ──
    if (action === 'planorderset:select-tags') {
      const tags = [
        { key: 'meds', tag: 'Tylenol 325mg tab' },
        { key: 'meds', tag: 'Mucinex 500mg tab' },
        { key: 'instructions', tag: 'Encouraged adequate hand hygiene and hydration, rest.' },
        { key: 'followUp', tag: 'F/U in 10-14 days if persists; sooner if worsens or changes significantly.' },
      ]
      for (const t of tags) {
        window.dispatchEvent(new CustomEvent('tour:plan-toggle-preset', { detail: t }))
        await new Promise(r => setTimeout(r, 100))
      }
      await new Promise(r => setTimeout(r, 200))
      return
    }

    // ── planorderset:save-compose — save the composed order set ──
    if (action === 'planorderset:save-compose') {
      window.dispatchEvent(new CustomEvent('tour:plan-save-compose'))
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── planorderset:cleanup — cancel edit (discards staging), return to guided tours ──
    if (action === 'planorderset:cleanup') {
      window.dispatchEvent(new CustomEvent('tour:plan-cancel-edit'))
      await new Promise(r => setTimeout(r, 300))

      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── provider:setup — inject demo template, open Settings → Provider Templates ──
    if (action === 'provider:setup') {
      const { GUIDED_PROVIDER_TEMPLATE, PROVIDER_TOUR_TEMPLATE_PREFIX } = await import('../../Data/GuidedTourData')
      const { useAuthStore } = await import('../../stores/useAuthStore')
      const authStore = useAuthStore.getState()
      const current = authStore.profile.providerNoteTemplates ?? []
      const cleaned = current.filter(t => !t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX))
      authStore.patchProfile({ providerNoteTemplates: [...cleaned, { ...GUIDED_PROVIDER_TEMPLATE }] })

      closeAllDrawers()
      store.closeMenu()
      await new Promise(r => setTimeout(r, 50))
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'provider-templates' }))
      await waitForTarget('settings-provider-templates', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── provider:open-and-import — close settings, open provider, decode guided barcode ──
    if (action === 'provider:open-and-import') {
      const { generateGuidedBarcode } = await import('../../Data/GuidedTourData')
      const barcode = generateGuidedBarcode()

      closeAllDrawers()
      store.closeMenu()
      await new Promise(r => setTimeout(r, 50))
      store.setShowProviderDrawer(true)
      await waitForTarget('provider-hpi', 3000)
      await new Promise(r => setTimeout(r, 300))
      window.dispatchEvent(new CustomEvent('tour:provider-import', { detail: barcode }))
      await waitForTarget('provider-medic-context', 5000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── provider:apply-template — apply the demo template to fill SOAP sections ──
    if (action === 'provider:apply-template') {
      window.dispatchEvent(new CustomEvent('tour:provider-apply-template'))
      await new Promise(r => setTimeout(r, 400))
      return
    }

    // ── provider:go-to-output — navigate to output view ──
    if (action === 'provider:go-to-output') {
      window.dispatchEvent(new CustomEvent('tour:provider-go-to-output'))
      await waitForTarget('provider-output', 3000)
      await new Promise(r => setTimeout(r, 300))
      return
    }

    // ── provider:cleanup — remove demo template, return to guided tours ──
    if (action === 'provider:cleanup') {
      const { PROVIDER_TOUR_TEMPLATE_PREFIX } = await import('../../Data/GuidedTourData')
      const { useAuthStore } = await import('../../stores/useAuthStore')
      const authStore = useAuthStore.getState()
      const current = authStore.profile.providerNoteTemplates ?? []
      authStore.patchProfile({ providerNoteTemplates: current.filter(t => !t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX)) })

      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── return:guided-tours — fade tooltip, fade to black, navigate back, open Settings → Guided Tours ──
    if (action === 'return:guided-tours') {
      // 1. Fade out tooltip + spotlight first (200ms matches tooltip transition)
      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))

      // 2. Fade to black (covers carousel transitions)
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))

      // 3. Navigate back through the carousel while hidden
      closeAllDrawers()
      store.closeMenu()
      store.closeWriteNote()

      // Step back: symptom → subcategory → main
      if (store.selectedSymptom) {
        store.handleBackClick()
        await new Promise(r => setTimeout(r, 100))
      }
      if (store.selectedCategory) {
        store.handleBackClick()
        await new Promise(r => setTimeout(r, 100))
      }

      // 4. Open Settings → Guided Tours
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))

      // 5. Fade out (tooltipHidden resets when next tour starts)
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── pin:X / unpin:X — toggle KB pin for tour demos ──
    const pinMatch = action.match(/^(pin|unpin):(.+)$/)
    if (pinMatch) {
      const [, verb, id] = pinMatch
      const prefs = useNavPreferencesStore.getState()
      const isPinned = prefs.pinnedKB.includes(id)
      if ((verb === 'pin' && !isPinned) || (verb === 'unpin' && isPinned)) {
        prefs.togglePinKB(id)
      }
      return
    }

    // ── open:X — close everything, then open the target drawer ──
    const openMatch = action.match(/^open:(.+)$/)
    if (openMatch) {
      const target = openMatch[1]
      store.closeMenu()
      closeAllDrawers()
      await new Promise(r => setTimeout(r, 50))

      switch (target) {
        case 'knowledgebase': store.setShowKnowledgeBase(true); break
        case 'messages': store.setShowMessagesDrawer(true); break
        case 'calendar': store.setShowCalendarDrawer(true); break
        case 'settings': store.setShowSettings(true); break
        case 'supervisor': store.setShowSupervisorDrawer(true); break
        case 'provider': store.setShowProviderDrawer(true); break
        case 'import': store.toggleImportExpanded(); break
        case 'admin': store.setShowAdminDrawer(true); break
        case 'property':
          store.setShowPropertyDrawer(true)
          await waitForTarget('property-locations', 5000)
          await new Promise(r => setTimeout(r, 300))
          break
        case 'tc3': {
          const { useAuthStore } = await import('../../stores/useAuthStore')
          useAuthStore.getState().patchProfile({ tc3Mode: true })
          await waitForTarget('tc3-casualty-info', 3000)
          break
        }
      }
    }

    // ── tc3:advance-page — advance mobile wizard to MARCH page ──
    if (action === 'tc3:advance-page') {
      const { useTC3Store } = await import('../../stores/useTC3Store')
      useTC3Store.getState().setWizardStep(1)
      await waitForTarget('tc3-march', 2000)
      return
    }

    // ── property:cleanup — close property drawer, return to guided tours ──
    if (action === 'property:cleanup') {
      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }

    // ── tc3:cleanup — exit TC3 mode, reset wizard, return to guided tours ──
    if (action === 'tc3:cleanup') {
      setTooltipHidden(true)
      await new Promise(r => setTimeout(r, 250))
      setCurtainVisible(true)
      await new Promise(r => setTimeout(r, 350))
      const { useAuthStore } = await import('../../stores/useAuthStore')
      const { useTC3Store } = await import('../../stores/useTC3Store')
      useAuthStore.getState().patchProfile({ tc3Mode: false })
      useTC3Store.getState().setWizardStep(0)
      closeAllDrawers()
      store.closeMenu()
      store.setShowSettings(true)
      await new Promise(r => setTimeout(r, 350))
      window.dispatchEvent(new CustomEvent('tour:settings-navigate', { detail: 'guided-tours' }))
      setCurtainVisible(false)
      await new Promise(r => setTimeout(r, 350))
      return
    }
  }, [nav, closeAllDrawers])

  const tour = useTour(handleAction, isMobile)

  // ── Onboarding readiness (drain infrastructure — no auto-start yet) ─────
  // Tracks when all blocking overlays (update, install prompt, post-update
  // release notes) have cleared. Available for future use when we decide
  // how/when to trigger the welcome tour.
  const _onboardingReady = useOnboardingReady(onboardingBlocked)
  void _onboardingReady

  // Reset tooltip visibility when a new tour starts
  useEffect(() => {
    if (tour.isActive) setTooltipHidden(false)
  }, [tour.isActive])

  const contextValue: TourContextValue = {
    startTour: tour.startTour,
    isActive: tour.isActive,
    availableTours: tour.availableTours,
    isCompleted: tour.isCompleted,
    hasSeenFirstLaunch: tour.hasSeenFirstLaunch,
    resetAllTours: tour.resetAllTours,
  }

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {tour.isActive && tour.activeStep && (
        <Suspense fallback={null}>
          {tour.activeTour?.scene === 'getting-started' && (
            <GettingStartedScene currentStep={tour.currentStep} isMobile={isMobile} />
          )}
          <TourOverlay
            activeStep={tour.activeStep}
            currentStep={tour.currentStep}
            totalSteps={tour.totalSteps}
            isPlaying={tour.isPlaying}
            isPausePoint={tour.isPausePoint}
            progressPercent={tour.progressPercent}
            hideStepperDots={tour.activeTour?.hideStepperDots}
            hidden={tooltipHidden}
            onNext={tour.nextStep}
            onPrev={tour.prevStep}
            onSkip={tour.skipTour}
            onTogglePlay={tour.togglePlay}
          />
        </Suspense>
      )}
      {/* Branded curtain — covers navigation transitions between tour segments */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${
          curtainVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: isDark ? 'rgba(25,35,45,1)' : 'rgba(240,242,245,1)' }}
      >
        <svg className="w-16 h-16" viewBox="0 0 40 40" fill="none" style={{ animation: 'solSpin 2s linear infinite' }}>
          <g transform="translate(20,20)">
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={isDark ? 'rgba(129,161,181,1)' : 'rgba(0,66,92,1)'} />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={isDark ? 'rgba(129,161,181,1)' : 'rgba(0,66,92,1)'} transform="rotate(60)" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={isDark ? 'rgba(129,161,181,1)' : 'rgba(0,66,92,1)'} transform="rotate(120)" />
          </g>
        </svg>
        <div
          className="mt-3.5 w-[140px] h-[3px] rounded-sm overflow-hidden"
          style={{ background: isDark ? 'rgba(0,66,92,0.25)' : 'rgba(0,66,92,0.1)' }}
        >
          <div
            className="h-full w-[30%] rounded-sm"
            style={{ background: 'rgba(21,142,172,1)', animation: 'splashPulse 1.2s ease-in-out infinite' }}
          />
        </div>
      </div>
    </TourContext.Provider>
  )
}
