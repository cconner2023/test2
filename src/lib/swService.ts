// swService.ts — Service worker lifecycle manager.
// Calls registerSW exactly once at initSW(), regardless of auth state.
//
// Prompt-always: every new build waits (sw.ts) and surfaces the "Update
// available" card. Nothing reloads the page except the user's tap — workbox
// reloads on `controlling` after the waiting worker skips waiting (the claim in
// sw.ts fires it). No silent applies, no automatic reloads.
import { registerSW } from 'virtual:pwa-register'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('PWA')
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
/** Floor between resume-triggered update checks (visibilitychange can flap). */
const RESUME_CHECK_MIN_GAP_MS = 30 * 1000
const UPDATE_DISMISS_TIMEOUT_MS = 60 * 60 * 1000

export interface SWState {
  updateAvailable: boolean
  /** Version published in version.json for the waiting update, when known. */
  newVersion: string | null
  /** The update card was dismissed ("Later") within the last hour. */
  dismissed: boolean
  offlineReady: boolean
  isUpdating: boolean
  registration: ServiceWorkerRegistration | undefined
}

type Listener = (state: SWState) => void

let _state: SWState = {
  updateAvailable: false,
  newVersion: null,
  dismissed: false,
  offlineReady: false,
  isUpdating: false,
  registration: undefined,
}

// Dismissal lives here, not in the card, so it expires in-session too — a
// backgrounded iOS PWA can stay alive for days without remounting anything.
let dismissTimer: ReturnType<typeof setTimeout> | undefined

function scheduleDismissExpiry(ms: number): void {
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    dismissTimer = undefined
    try { localStorage.removeItem('updateDismissed') } catch { /* storage unavailable */ }
    patch({ dismissed: false })
  }, ms)
}

;(() => {
  try {
    const at = parseInt(localStorage.getItem('updateDismissed') ?? '', 10)
    if (isNaN(at)) return
    const remaining = UPDATE_DISMISS_TIMEOUT_MS - (Date.now() - at)
    if (remaining > 0) {
      _state = { ..._state, dismissed: true }
      scheduleDismissExpiry(remaining)
    } else {
      localStorage.removeItem('updateDismissed')
    }
  } catch { /* storage unavailable — treat as not dismissed */ }
})()

export function dismissUpdate(): void {
  try { localStorage.setItem('updateDismissed', Date.now().toString()) } catch { /* storage unavailable */ }
  patch({ dismissed: true })
  scheduleDismissExpiry(UPDATE_DISMISS_TIMEOUT_MS)
}

let _updateFn: ((reloadPage?: boolean) => Promise<void>) | null = null
const _listeners = new Set<Listener>()

function patch(update: Partial<SWState>) {
  _state = { ..._state, ...update }
  _listeners.forEach(fn => fn(_state))
}

export function subscribe(listener: Listener): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function getState(): SWState {
  return _state
}

export async function skipWaiting(): Promise<void> {
  if (!_updateFn) return
  patch({ isUpdating: true })
  try { localStorage.removeItem('updateDismissed') } catch { /* storage unavailable */ }
  try { localStorage.setItem('postUpdateNav', 'release-notes') } catch { /* storage unavailable */ }
  await _updateFn(true)
}

export function checkForUpdate(): void {
  _state.registration?.update().catch(() => {})
}

let _initialized = false

export function initSW(): void {
  if (_initialized) return
  _initialized = true

  const update = registerSW({
    immediate: true,
    async onNeedRefresh() {
      logger.info('New content available')
      // Label only — the card shows whenever a new worker is waiting.
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`)
        if (res.ok) {
          const { version } = await res.json() as { version?: unknown }
          if (typeof version === 'string') patch({ newVersion: version })
        }
      } catch (e) {
        logger.warn('Could not fetch version.json', e)
      }
      patch({ updateAvailable: true })
    },
    onOfflineReady() {
      logger.info('App ready to work offline')
      patch({ offlineReady: true })
    },
    onRegistered(r) {
      logger.info('Service Worker registered:', r?.scope)
      patch({ registration: r })
      if (r) {
        setInterval(() => {
          logger.debug('Checking for updates...')
          r.update().catch(() => {})
        }, UPDATE_CHECK_INTERVAL_MS)
        // iOS freezes timers for a backgrounded PWA and resuming it is not a
        // navigation, so the interval alone can leave a device on a stale build
        // indefinitely — never fetching the new sw.js. Check on every return to
        // the foreground.
        let lastResumeCheck = 0
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return
          const now = Date.now()
          if (now - lastResumeCheck < RESUME_CHECK_MIN_GAP_MS) return
          lastResumeCheck = now
          logger.debug('Resumed — checking for updates...')
          r.update().catch(() => {})
        })
      }
    },
    onRegisterError(error) {
      logger.error('Service Worker registration failed:', error)
    },
  })

  _updateFn = update
}
