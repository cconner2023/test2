/**
 * Zustand store for authentication
 *
 * Centralized user, loading, guest state, profile, and roles.
 * Components subscribe to individual slices (e.g. `useAuthStore(s => s.user)`)
 * for minimal re-renders.
 * The `init()` action sets up `supabase.auth.onAuthStateChange` and returns
 * a cleanup function — call it from a useEffect.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { isPinEnabled, hydrateFromCloud, removePin, initPinService } from '../lib/pinService'
import { removeBiometric } from '../lib/biometricService'
import { clearServiceWorkerCaches } from '../lib/cacheService'
import { clearPasswordVerification } from '../lib/authService'
import { isDevUser } from '../lib/adminService'
import { prefetchBarcodeKey } from '../lib/cryptoService'
import { startHeartbeat, stopHeartbeat } from '../lib/activityHeartbeat'
import { initSignalBundle } from '../lib/signal/signalInit'
import { clearSignalKeys, getLocalDeviceId } from '../lib/signal/keyManager'
import { clearAllSessions } from '../lib/signal/session'
import { clearMessageStore } from '../lib/signal/messageStore'
import { clearClinicUsersCache } from '../lib/clinicUsersCache'
import { useCallStore } from './useCallStore'
import { unregisterDevice, deleteKeyBundle, primaryLogoutAll } from '../lib/signal/signalService'
import { secureSet, secureGet, secureRemove, persistSupabaseAuth } from '../lib/secureStorage'
import { clearOutboundQueue } from '../lib/signal/outboundQueue'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { registerSessionCleanup, updateCleanupToken, updateCleanupDeviceId, updateCleanupIsPrimary } from '../lib/sessionCleanup'
import type { User } from '@supabase/supabase-js'
import type { UserTypes, TextExpander } from '../Data/User'
import type { DeviceRole } from '../lib/signal/transportTypes'

const STORAGE_KEY = 'adtmc_user_profile'

interface AuthState {
  user: User | null
  loading: boolean
  isGuest: boolean
  profile: UserTypes
  roles: string[]
  clinicId: string | null
  isDevRole: boolean
  isSupervisorRole: boolean
  isPasswordRecovery: boolean
  deviceRole: DeviceRole | null
}

interface AuthActions {
  /** Set up auth listener. Returns cleanup function. */
  init: () => () => void
  continueAsGuest: () => void
  signOut: () => Promise<void>
  /** Merge fields into the in-memory profile and persist to localStorage. No network. */
  patchProfile: (fields: Partial<UserTypes>) => void
  /** Re-fetch profile from Supabase and update store. */
  refreshProfile: () => Promise<void>
  /** Clear the password recovery flag (after user sets their password). */
  setPasswordRecovery: (value: boolean) => void
}

function migratePeDepth(profile: UserTypes): UserTypes {
  const d = profile.peDepth as string | undefined
  if (d === 'focused') profile.peDepth = 'minimal'
  else if (d === 'standard' || d === 'comprehensive') profile.peDepth = 'expanded'
  return profile
}

/** Sync initial load: reads legacy plaintext from localStorage for instant render.
 *  New sessions start empty until the async encrypted read completes. */
function loadProfileFromStorage(): UserTypes {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    // Only read plaintext legacy entries (encrypted entries start with 'enc:')
    if (saved && !saved.startsWith('enc:')) {
      return migratePeDepth(JSON.parse(saved) as UserTypes)
    }
  } catch { /* ignore */ }
  return {}
}

/** Async load from encrypted storage (secureStorage). */
async function loadProfileFromSecureStorage(): Promise<UserTypes | null> {
  try {
    const saved = await secureGet(STORAGE_KEY)
    if (saved) return migratePeDepth(JSON.parse(saved) as UserTypes)
  } catch { /* ignore */ }
  return null
}

/** Persist profile to encrypted storage and remove any plaintext remnant. */
function saveProfileToStorage(profile: UserTypes) {
  secureSet(STORAGE_KEY, JSON.stringify(profile)).catch(() => {})
  // Remove any legacy plaintext entry
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

function clearProfileStorage() {
  secureRemove(STORAGE_KEY).catch(() => {})
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

/**
 * Fetch a full profile from Supabase for the given user ID.
 * Returns the UserTypes profile and the roles array.
 */
async function fetchProfileFromSupabase(userId: string): Promise<{ profile: UserTypes; roles: string[]; clinicId: string | null }> {
  const profile: UserTypes = {}
  let roles: string[] = []
  let clinicId: string | null = null

  // Fetch core profile + clinic name
  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name, middle_initial, credential, component, rank, uic, roles, clinic_id, clinics(name), pin_hash, pin_salt, notify_dev_alerts, notify_messages, note_include_hpi, note_include_pe, pe_depth, text_expanders, text_expander_enabled')
    .eq('id', userId)
    .single()

  if (data) {
    const clinicRow = data.clinics as { name: string } | null
    clinicId = (data as Record<string, unknown>).clinic_id as string | null

    profile.firstName = data.first_name ?? undefined
    profile.lastName = data.last_name ?? undefined
    profile.middleInitial = data.middle_initial ?? undefined
    profile.credential = (data.credential as UserTypes['credential']) ?? undefined
    profile.component = (data.component as UserTypes['component']) ?? undefined
    profile.rank = data.rank ?? undefined
    profile.uic = data.uic ?? undefined
    profile.clinicName = clinicRow?.name ?? undefined

    roles = (data.roles as string[]) ?? []

    // PIN hydration
    const sec = data as Record<string, unknown>
    await initPinService()
    if (sec.pin_hash && sec.pin_salt && !isPinEnabled()) {
      await hydrateFromCloud(sec.pin_hash as string, sec.pin_salt as string)
    }

    if (sec.notify_dev_alerts != null) profile.notifyDevAlerts = sec.notify_dev_alerts as boolean
    if (sec.notify_messages != null) profile.notifyMessages = sec.notify_messages as boolean
    if (sec.note_include_hpi != null) profile.noteIncludeHPI = sec.note_include_hpi as boolean
    if (sec.note_include_pe != null) profile.noteIncludePE = sec.note_include_pe as boolean
    if (sec.pe_depth != null) {
      const raw = sec.pe_depth as string
      // Migrate old depth values to new minimal/expanded scheme
      if (raw === 'focused' || raw === 'minimal') profile.peDepth = 'minimal'
      else if (raw === 'standard' || raw === 'comprehensive' || raw === 'expanded') profile.peDepth = 'expanded'
      else profile.peDepth = raw as UserTypes['peDepth']
    }
    if (sec.text_expanders != null) profile.textExpanders = sec.text_expanders as TextExpander[]
    if (sec.text_expander_enabled != null) profile.textExpanderEnabled = sec.text_expander_enabled as boolean
  }

  return { profile, roles, clinicId }
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  user: null,
  loading: true,
  isGuest: true,
  profile: loadProfileFromStorage(),
  roles: [],
  clinicId: null,
  isDevRole: false,
  isSupervisorRole: false,
  isPasswordRecovery: false,
  deviceRole: null,

  init: () => {
    // Hydrate profile from encrypted storage (fast, runs before Supabase fetch)
    loadProfileFromSecureStorage().then(cached => {
      if (cached && Object.keys(cached).length > 0) {
        const current = get().profile
        // Only hydrate if the sync load returned empty
        if (Object.keys(current).length === 0) {
          set({ profile: cached })
        }
      }
    }).catch(() => {})

    // Register browser-mode cleanup (no-ops if PWA)
    registerSessionCleanup()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        stopHeartbeat()

        // NOTE: Supabase key cleanup (unregisterDevice + deleteKeyBundle) is done
        // in signOut() BEFORE the auth token is invalidated.  By this point the
        // token is already dead, so we only clear local state here.

        set({
          user: null,
          isGuest: true,
          profile: {},
          roles: [],
          clinicId: null,
          isDevRole: false,
          isSupervisorRole: false,
          deviceRole: null,
        })
        clearProfileStorage()
        removePin()
        removeBiometric()
        clearPasswordVerification().catch(() => {})
        clearServiceWorkerCaches().catch(() => {})
        clearSignalKeys().catch(() => {})
        clearAllSessions().catch(() => {})
        clearMessageStore().catch(() => {})
        clearOutboundQueue().catch(() => {})
        if (LORA_MESH_ENABLED) {
          import('../lib/lora/loraDb').then(m => m.clearLoraDb()).catch(() => {})
        }
        clearClinicUsersCache().catch(() => {})
        useCallStore.getState().reset()
      } else if (session?.user) {
        set({ user: session.user, isGuest: false })
        // Detect password recovery flow (user clicked reset-password email link)
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true })
        }
        // Keep cleanup handler's token in sync for pagehide
        if (session.access_token) {
          updateCleanupToken(session.access_token)
        }
        // Persist Supabase auth to IDB for service worker (sign-in + token refresh)
        if (session.access_token) {
          const url = import.meta.env.VITE_SUPABASE_URL as string
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
          persistSupabaseAuth(url, session.access_token, anonKey).catch(() => {})
        }
        // Fetch profile in the background on sign-in
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          startHeartbeat(session.user.id)
          get().refreshProfile()
        }
      }
      if (event === 'INITIAL_SESSION') {
        set({ loading: false })
      }
    })

    return () => subscription.unsubscribe()
  },

  continueAsGuest: () => {
    set({ isGuest: true, user: null })
  },

  signOut: async () => {
    // Force-delete keys from Supabase BEFORE signing out.
    // After signOut the auth token is dead and these calls would fail silently.
    const userId = get().user?.id
    const role = get().deviceRole
    if (userId) {
      try {
        if (role === 'primary') {
          // Primary logout: destroy all linked devices + sessions first
          await primaryLogoutAll()
        }
        // Then clean up own device (both primary and linked)
        const deviceId = await getLocalDeviceId()
        if (deviceId) {
          await Promise.all([
            unregisterDevice(userId, deviceId),
            deleteKeyBundle(userId, deviceId),
          ])
        }
      } catch {
        // Best-effort — continue with sign-out even if cleanup fails
      }
    }

    await supabase.auth.signOut({ scope: 'local' })
    // onAuthStateChange handler clears local state (IDB, sessions, etc.)
  },

  patchProfile: (fields) => {
    const next = { ...get().profile, ...fields }
    set({ profile: next })
    saveProfileToStorage(next)
  },

  setPasswordRecovery: (value) => {
    set({ isPasswordRecovery: value })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return

    try {
      const { profile, roles, clinicId } = await fetchProfileFromSupabase(user.id)
      const isDev = await isDevUser()

      set({
        profile,
        roles,
        clinicId,
        isDevRole: isDev,
        isSupervisorRole: roles.includes('supervisor'),
      })
      saveProfileToStorage(profile)

      // Prefetch barcode encryption key for offline use (fire-and-forget)
      prefetchBarcodeKey().catch(() => {})

      // Initialize Signal Protocol key bundle with device role classification
      initSignalBundle(user.id).then(initResult => {
        if (initResult) {
          set({ deviceRole: initResult.role })
          startHeartbeat(user.id, initResult.deviceId)
          updateCleanupDeviceId(initResult.deviceId)
          updateCleanupIsPrimary(initResult.role === 'primary')
        }
      }).catch(() => {})
    } catch {
      // Profile fetch failed — keep existing state
    }
  },
}))

/** Derived selector: true when a real user is authenticated. */
export const selectIsAuthenticated = (state: AuthState) => !!state.user
