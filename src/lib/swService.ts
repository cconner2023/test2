// swService.ts — Service worker lifecycle manager.
// Calls registerSW exactly once at initSW(), regardless of auth state.
// Unauthenticated users get silent auto-apply; authenticated users get the prompt.
import { registerSW } from 'virtual:pwa-register'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('PWA')
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
/** Floor between resume-triggered update checks (visibilitychange can flap). */
const RESUME_CHECK_MIN_GAP_MS = 30 * 1000
/** A silent update reloads immediately only this soon after launch/resume —
 *  before the user is into a task. Later ones wait for the app to background. */
const SILENT_APPLY_WINDOW_MS = 10 * 1000
const UPDATE_DISMISS_TIMEOUT_MS = 60 * 60 * 1000

/** Last launch or return to the foreground. Module load counts as a launch. */
let lastResumeAt = Date.now()

/** Numeric dotted-version compare: <0 when a < b. Missing parts count as 0. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function isForcedUpdate(): boolean {
  try { return localStorage.getItem('appBuildId') === null } catch { return false }
}

function stampBuildId(): void {
  try { localStorage.setItem('appBuildId', __BUILD_ID__) } catch { /* storage unavailable */ }
}

/**
 * Silent (non-optional) update: stamp a flag so the index.html splash can show
 * "Installing update…" on the imminent reload — otherwise an unprompted reload
 * reads as a glitch. The splash script clears the flag after reading it.
 *
 * The reload must not land mid-task (a note, a form, a live call). Apply now
 * when the page is hidden or the user only just launched/resumed; otherwise
 * defer to the next time the app goes to the background.
 */
let silentApplyDeferred = false
function silentApply(update: (reloadPage?: boolean) => Promise<void>): void {
  const apply = () => {
    try { localStorage.setItem('updateReloadPending', '1') } catch { /* storage unavailable */ }
    update(true).catch(() => {})
  }
  const justResumed = Date.now() - lastResumeAt < SILENT_APPLY_WINDOW_MS
  if (document.visibilityState === 'hidden' || justResumed) {
    apply()
    return
  }
  if (silentApplyDeferred) return
  silentApplyDeferred = true
  logger.info('Update ready — applying when the app is next backgrounded')
  const onHide = () => {
    if (document.visibilityState !== 'hidden') return
    document.removeEventListener('visibilitychange', onHide)
    silentApplyDeferred = false
    apply()
  }
  document.addEventListener('visibilitychange', onHide)
}

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

/**
 * Waits for the auth store to finish loading, then decides whether to
 * auto-apply the update silently (no session) or prompt the user (has session).
 *
 * Uses Zustand's store.subscribe() — safe to call before React mounts.
 * localSession is sync-hydrated from localStorage so it's available immediately;
 * Supabase user is async, so we wait on the loading flag before deciding.
 */
async function applyOrPrompt(update: (reloadPage?: boolean) => Promise<void>) {
  if (isForcedUpdate()) {
    logger.info('No build ID — pre-auth build detected, force applying update')
    silentApply(update)
    return
  }

  // Lazy import avoids circular deps; module is already loaded so this is near-instant
  const { useAuthStore } = await import('../stores/useAuthStore')

  const decide = (): boolean => {
    const { user, localSession, loading } = useAuthStore.getState()
    if (loading) return false // auth hasn't resolved yet — wait

    if (!user && !localSession) {
      logger.info('No active session — applying update silently')
      silentApply(update)
    } else {
      logger.info('Active session — showing update prompt')
      patch({ updateAvailable: true })
    }
    return true
  }

  if (decide()) return

  // Auth is still loading — subscribe until it resolves
  let resolved = false
  const unsub = useAuthStore.subscribe(() => {
    if (resolved) return
    if (decide()) {
      resolved = true
      unsub()
    }
  })

  // Safety net: if auth never resolves (network stall etc.), give up after 5s
  // LockGate forces loading=false after 3s so this should never be needed
  setTimeout(() => {
    if (resolved) return
    resolved = true
    unsub()
    const { user, localSession } = useAuthStore.getState()
    if (!user && !localSession) {
      logger.info('Auth timeout — no session found, applying update silently')
      silentApply(update)
    } else {
      logger.warn('Auth timeout — showing update prompt conservatively')
      patch({ updateAvailable: true })
    }
  }, 5000)
}

let _initialized = false

export function initSW(): void {
  if (_initialized) return
  _initialized = true

  const update = registerSW({
    immediate: true,
    async onNeedRefresh() {
      logger.info('New content available, checking version...')
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`)
        if (!res.ok) throw new Error(`version.json returned ${res.status}`)
        const { version: newVersion, minVersion } = await res.json() as { version: string; minVersion?: string }
        patch({ newVersion: typeof newVersion === 'string' ? newVersion : null })
        if (newVersion === __APP_VERSION__) {
          logger.info('Same version, applying silently')
          silentApply(update)
          return
        }
        // Mandatory update: this client is below the published floor (a
        // wire-protocol break it can't interoperate across) — no prompt.
        if (minVersion && compareVersions(__APP_VERSION__, minVersion) < 0) {
          logger.info(`Version ${__APP_VERSION__} below minimum ${minVersion}, applying silently`)
          silentApply(update)
          return
        }
        logger.info(`New version ${newVersion} (current: ${__APP_VERSION__})`)
      } catch (e) {
        logger.warn('Could not fetch version.json, continuing', e)
      }

      await applyOrPrompt(update)
    },
    onOfflineReady() {
      stampBuildId() // stamp after SW fully activates — avoids race with onNeedRefresh/isForcedUpdate
      logger.info('App ready to work offline')
      patch({ offlineReady: true })
    },
    onRegistered(r) {
      logger.info('Service Worker registered:', r?.scope)
      patch({ registration: r })
      // Self-heal appBuildId. It's otherwise stamped only in onOfflineReady,
      // which fires on first install only — never on updates — so any install
      // predating the stamp stays null forever, and isForcedUpdate() then
      // force-applies EVERY update silently (the update prompt never shows).
      // A controlled page is a known, post-auth install (sw.ts already
      // skip-waits genuine pre-auth builds via the sw-meta gate before
      // onNeedRefresh can fire), so stamping here is safe and lets updates
      // prompt as intended. Mirrors sw.ts stamping sw-meta on every activate.
      if (navigator.serviceWorker.controller) stampBuildId()
      if (r) {
        setInterval(() => {
          logger.debug('Checking for updates...')
          r.update().catch(() => {})
        }, UPDATE_CHECK_INTERVAL_MS)
        // iOS freezes timers for a backgrounded PWA and resuming it is not a
        // navigation, so the interval alone can leave a device on a stale build
        // indefinitely — never fetching the new sw.js.
        // Check on every return to the foreground.
        let lastResumeCheck = 0
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return
          const now = Date.now()
          lastResumeAt = now
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
