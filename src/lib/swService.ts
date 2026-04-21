// swService.ts — Service worker lifecycle manager.
// Calls registerSW exactly once at initSW(), regardless of auth state.
// Unauthenticated users get silent auto-apply; authenticated users get the prompt.
import { registerSW } from 'virtual:pwa-register'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('PWA')
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

export interface SWState {
  updateAvailable: boolean
  offlineReady: boolean
  isUpdating: boolean
  registration: ServiceWorkerRegistration | undefined
}

type Listener = (state: SWState) => void

let _state: SWState = {
  updateAvailable: false,
  offlineReady: false,
  isUpdating: false,
  registration: undefined,
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
  _state.registration?.update()
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
  // Lazy import avoids circular deps; module is already loaded so this is near-instant
  const { useAuthStore } = await import('../stores/useAuthStore')

  const decide = (): boolean => {
    const { user, localSession, loading } = useAuthStore.getState()
    if (loading) return false // auth hasn't resolved yet — wait

    if (!user && !localSession) {
      logger.info('No active session — applying update silently')
      update(true).catch(() => {})
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
      update(true).catch(() => {})
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
        const { version: newVersion } = await res.json()
        if (newVersion === __APP_VERSION__) {
          logger.info('Same version, applying silently')
          await update(true)
          return
        }
        logger.info(`New version ${newVersion} (current: ${__APP_VERSION__})`)
      } catch (e) {
        logger.warn('Could not fetch version.json, continuing', e)
      }

      await applyOrPrompt(update)
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
          r.update()
        }, UPDATE_CHECK_INTERVAL_MS)
      }
    },
    onRegisterError(error) {
      logger.error('Service Worker registration failed:', error)
    },
  })

  _updateFn = update
}
