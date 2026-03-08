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
import { clearSignalKeys, destroySignalKeys, getLocalDeviceId } from '../lib/signal/keyManager'
import { clearAllSessions } from '../lib/signal/session'
import { clearMessageStore, destroyMessageStore } from '../lib/signal/messageStore'
import { clearClinicUsersCache } from '../lib/clinicUsersCache'
import { useCallStore } from './useCallStore'
import { unregisterDevice, deleteKeyBundle, primaryLogoutAll, initLoRaMesh } from '../lib/signal/signalService'
import { secureSet, secureGet, secureRemove, persistSupabaseAuth, destroySecureStore } from '../lib/secureStorage'
import { clearOutboundQueue, destroyOutboundQueue } from '../lib/signal/outboundQueue'
import { clearBackupKey, deleteBackup, scheduleBackup, restoreBackup } from '../lib/signal/backupService'
import { unsubscribeFromPush, resyncPushSubscription } from '../lib/pushNotificationService'
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
  /** True for newly approved accounts that haven't set a permanent password yet. */
  needsPasswordSetup: boolean
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
  /** Clear the first-time password setup flag (after new user sets their password). */
  setNeedsPasswordSetup: (value: boolean) => void
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
async function fetchProfileFromSupabase(userId: string): Promise<{ profile: UserTypes; roles: string[]; clinicId: string | null; needsPasswordSetup: boolean }> {
  const profile: UserTypes = {}
  let roles: string[] = []
  let clinicId: string | null = null
  let needsPasswordSetup = false

  // Fetch core profile + clinic name.
  // Try with needs_password_setup first (available after migration).
  // Fall back to the query without it if the column doesn't exist yet.
  const BASE_SELECT = 'first_name, last_name, middle_initial, credential, component, rank, uic, roles, clinic_id, clinics(name), pin_hash, pin_salt, notify_dev_alerts, note_include_hpi, note_include_pe, pe_depth, text_expanders, text_expander_enabled, note_include_plan, plan_order_tags, plan_instruction_tags, plan_order_sets'
  // Optional columns that may not exist yet — appended to BASE_SELECT and
  // gracefully stripped on fallback if the query fails.
  const OPTIONAL_COLS = 'needs_password_setup, tc3_mode'
  let { data, error: fetchError } = await supabase
    .from('profiles')
    .select(`${BASE_SELECT}, ${OPTIONAL_COLS}`)
    .eq('id', userId)
    .single()

  if (fetchError && !data) {
    // Column(s) likely not yet migrated — retry without optional columns
    const fallback = await supabase
      .from('profiles')
      .select(BASE_SELECT)
      .eq('id', userId)
      .single()
    data = fallback.data
    fetchError = fallback.error
  }

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
    if (sec.note_include_plan != null) profile.noteIncludePlan = sec.note_include_plan as boolean
    if (sec.plan_order_tags != null) profile.planOrderTags = sec.plan_order_tags as UserTypes['planOrderTags']
    if (sec.plan_instruction_tags != null) profile.planInstructionTags = sec.plan_instruction_tags as string[]
    if (sec.plan_order_sets != null) profile.planOrderSets = sec.plan_order_sets as UserTypes['planOrderSets']
    if (sec.tc3_mode != null) profile.tc3Mode = sec.tc3_mode as boolean
    if (sec.needs_password_setup === true) needsPasswordSetup = true
  }

  return { profile, roles, clinicId, needsPasswordSetup }
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  user: null,
  loading: true,
  isGuest: false,
  profile: loadProfileFromStorage(),
  roles: [],
  clinicId: null,
  isDevRole: false,
  isSupervisorRole: false,
  isPasswordRecovery: false,
  needsPasswordSetup: false,
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
        // Capture role BEFORE clearing state (set() below nulls it)
        const wasPrimary = get().deviceRole === 'primary'

        stopHeartbeat()

        // NOTE: Supabase key cleanup (unregisterDevice + deleteKeyBundle) is done
        // in signOut() BEFORE the auth token is invalidated.  By this point the
        // token is already dead, so we only clear local state here.

        set({
          user: null,
          isGuest: false,
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

        // Aggressively clear backup state first (detaches onMessageSaved callback)
        clearBackupKey()
        // Clear in-memory session cache
        clearAllSessions()

        if (wasPrimary) {
          // Primary logout: destroy entire IDB databases (nuke containers + encryption key).
          // This ensures no residual data survives — a full clean slate.
          destroySignalKeys().catch(() => {})
          destroyMessageStore().catch(() => {})
          destroyOutboundQueue().catch(() => {})
          destroySecureStore().catch(() => {})
        } else {
          // Linked/provisional logout: purge data from stores but keep
          // database containers and the device encryption key intact so
          // the device can re-authenticate cleanly on next login.
          clearSignalKeys().catch(() => {})
          clearMessageStore().catch(() => {})
          clearOutboundQueue().catch(() => {})
        }

        if (LORA_MESH_ENABLED) {
          import('../lib/lora/loraDb').then(m => m.clearLoraDb()).catch(() => {})
        }
        clearClinicUsersCache().catch(() => {})
        useCallStore.getState().reset()

        // Aggressively wipe browser storage
        try { localStorage.clear() } catch { /* ignore */ }
        try { sessionStorage.clear() } catch { /* ignore */ }
      } else if (session?.user) {
        set({ user: session.user, isGuest: false })
        // Detect password recovery flow (user clicked reset-password email link)
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true })
          // Ensure profile is fetched for recovery logins (token-based new users)
          startHeartbeat(session.user.id)
          get().refreshProfile()
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
        // Fetch profile in the background on sign-in or session resume
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          startHeartbeat(session.user.id)
          get().refreshProfile()

          // Initialize Signal Protocol keys independently of profile fetch.
          // This must not be gated behind refreshProfile so that keys are
          // generated even when the profile fetch fails (e.g., brief network
          // hiccup on PWA resume). initSignalBundle is idempotent.
          initSignalBundle(session.user.id).then(initResult => {
            if (initResult) {
              set({ deviceRole: initResult.role })
              startHeartbeat(session.user.id, initResult.deviceId)
              updateCleanupDeviceId(initResult.deviceId)
              updateCleanupIsPrimary(initResult.role === 'primary')

              // Initialize LoRa mesh subsystem (lazy — no-ops if flag is off)
              initLoRaMesh(session.user.id).catch(() => {})

              // Server-side encrypted backup: restore first on non-primary, then
              // all devices schedule ongoing backups so the server row stays fresh.
              if (initResult.role === 'linked' || initResult.role === 'provisional') {
                restoreBackup(session.user.id)
                  .then(() => scheduleBackup(session.user.id))
                  .catch(() => scheduleBackup(session.user.id))
              } else {
                scheduleBackup(session.user.id)
              }
            }
          }).catch(() => {})
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
        // Remove this device's push subscription (browser + Supabase row)
        await unsubscribeFromPush().catch(() => {})

        if (role === 'primary') {
          // Primary logout: destroy all linked devices + sessions first
          await primaryLogoutAll()
          // Delete server-side encrypted backup
          await deleteBackup(userId).catch(() => {})
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

  setNeedsPasswordSetup: (value) => {
    set({ needsPasswordSetup: value })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return

    try {
      const { profile, roles, clinicId, needsPasswordSetup } = await fetchProfileFromSupabase(user.id)
      const isDev = await isDevUser()

      set({
        profile,
        roles,
        clinicId,
        isDevRole: isDev,
        isSupervisorRole: roles.includes('supervisor'),
        needsPasswordSetup,
      })
      saveProfileToStorage(profile)

      // Prefetch barcode encryption key for offline use (fire-and-forget)
      prefetchBarcodeKey().catch(() => {})

      // Re-sync any existing browser push subscription to the DB so the
      // backend can deliver pushes even if a prior logout left the browser
      // subscription orphaned (browser sub alive, DB row deleted).
      resyncPushSubscription()
    } catch {
      // Profile fetch failed — keep existing state
    }
  },
}))

/** Derived selector: true when a real user is authenticated. */
export const selectIsAuthenticated = (state: AuthState) => !!state.user
