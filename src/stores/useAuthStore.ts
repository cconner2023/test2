/**
 * Zustand store for authentication
 *
 * Centralized user, loading, guest state, profile, and roles.
 * Components subscribe to individual slices (e.g. `useAuthStore(s => s.user)`)
 * for minimal re-renders.
 * The `init()` action sets up `supabase.auth.onAuthStateChange` and runs
 * automatically at module load — no useEffect needed.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { isPinEnabled, hydrateFromCloud, removePin, initPinService } from '../lib/pinService'
import { removeBiometric } from '../lib/biometricService'
import { clearServiceWorkerCaches } from '../lib/cacheService'
import { clearPasswordVerification } from '../lib/authService'
import { prefetchBarcodeKey, clearKeyStore } from '../lib/cryptoService'
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
import { clearCalendarEvents, clearAllPendingVaultSends } from '../lib/calendarEventStore'
import { useCalendarStore } from './useCalendarStore'
import { clearBackupKey, createBackup, scheduleBackup, restoreBackup } from '../lib/signal/backupService'
import { processVaultMessages, clearVaultKey } from '../lib/signal/vaultDevice'
import { deriveAndCacheClinicVaultKey, ensureClinicVaultExists, processClinicVaultMessages, clearClinicVaultKey } from '../lib/signal/clinicVaultDevice'
import { unsubscribeFromPush, resyncPushSubscription } from '../lib/pushNotificationService'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { registerSessionCleanup, updateCleanupToken, updateCleanupDeviceId, updateCleanupIsPrimary } from '../lib/sessionCleanup'
import { attemptSilentRestore } from '../lib/sessionRestore'
import type { User } from '@supabase/supabase-js'
import type { UserTypes, TextExpander } from '../Data/User'
import type { DeviceRole } from '../lib/signal/transportTypes'

const STORAGE_KEY = 'adtmc_user_profile'
const LOCAL_SESSION_KEY = 'adtmc_local_session'
const ROLES_STORAGE_KEY = 'adtmc_user_roles'

/** Cached role metadata — persisted so role-gated features work offline. */
interface CachedRoles {
  roles: string[]
  clinicId: string | null
  isDevRole: boolean
}

export interface LocalSession {
  userId: string
  email: string
  deviceId: string
  createdAt: string
  lastVerifiedAt: string
}

interface AuthState {
  user: User | null
  loading: boolean
  isGuest: boolean
  profile: UserTypes
  roles: string[]
  clinicId: string | null
  isDevRole: boolean
  isSupervisorRole: boolean
  isProviderRole: boolean
  isPasswordRecovery: boolean
  /** True for newly approved accounts that haven't set a permanent password yet. */
  needsPasswordSetup: boolean
  /**
   * True when localSession exists but the Supabase session is dead and silent
   * restore failed. Prompts the SessionReauthScreen overlay.
   */
  needsReauth: boolean
  /** Clinic-level note content (merged with user-level in consumers). */
  clinicTextExpanders: TextExpander[]
  clinicPlanOrderTags: UserTypes['planOrderTags'] | null
  clinicPlanInstructionTags: string[] | null
  clinicPlanOrderSets: UserTypes['planOrderSets'] | null
  deviceRole: DeviceRole | null
  /** Persistent local session — survives Supabase token expiry. Cleared only on deliberate logout. */
  localSession: LocalSession | null
  /** True once critical-path init (Signal + profile) completes. Starts true for returning users. */
  sessionReady: boolean
  /** True once Signal Protocol bundle is initialized. False only during first-login init. */
  signalReady: boolean
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
  /** Clear the reauth flag (e.g. after guest continuation). */
  clearNeedsReauth: () => void
}

// ---- Local Session helpers ----

/** Module-level flag: true only during deliberate user-initiated sign-out.
 *  Lives in JS memory only — cannot be spoofed across sessions. */
let _userInitiatedSignOut = false

/** Sync load from localStorage for instant hydration (prevents login screen flash). */
function loadLocalSessionSync(): LocalSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY)
    if (raw && !raw.startsWith('enc:')) {
      return JSON.parse(raw) as LocalSession
    }
  } catch { /* ignore */ }
  return null
}

/** Persist local session to both secureStorage (encrypted) and localStorage (plaintext backup). */
function persistLocalSession(ls: LocalSession) {
  secureSet(LOCAL_SESSION_KEY, JSON.stringify(ls)).catch(() => {})
  try { localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(ls)) } catch { /* ignore */ }
}

/** Remove local session from all storage layers. */
function clearLocalSessionStorage() {
  secureRemove(LOCAL_SESSION_KEY).catch(() => {})
  try { localStorage.removeItem(LOCAL_SESSION_KEY) } catch { /* ignore */ }
}

// ---- Profile helpers ----

/** Sync initial load: reads legacy plaintext from localStorage for instant render.
 *  New sessions start empty until the async encrypted read completes. */
function loadProfileFromStorage(): UserTypes {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    // Only read plaintext legacy entries (encrypted entries start with 'enc:')
    if (saved && !saved.startsWith('enc:')) {
      return JSON.parse(saved) as UserTypes
    }
  } catch { /* ignore */ }
  return {}
}

/** Async load from encrypted storage (secureStorage). */
async function loadProfileFromSecureStorage(): Promise<UserTypes | null> {
  try {
    const saved = await secureGet(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as UserTypes
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

// ---- Roles helpers ----

/** Sync load from localStorage for instant hydration of role-gated features. */
function loadRolesFromStorage(): CachedRoles | null {
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY)
    if (raw && !raw.startsWith('enc:')) {
      return JSON.parse(raw) as CachedRoles
    }
  } catch { /* ignore */ }
  return null
}

/** Async load from encrypted storage. */
async function loadRolesFromSecureStorage(): Promise<CachedRoles | null> {
  try {
    const raw = await secureGet(ROLES_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as CachedRoles
  } catch { /* ignore */ }
  return null
}

/** Persist roles to encrypted storage and localStorage (for sync hydration on next open). */
function saveRolesToStorage(cached: CachedRoles) {
  const json = JSON.stringify(cached)
  secureSet(ROLES_STORAGE_KEY, json).catch(() => {})
  try { localStorage.setItem(ROLES_STORAGE_KEY, json) } catch { /* ignore */ }
}

function clearRolesStorage() {
  secureRemove(ROLES_STORAGE_KEY).catch(() => {})
  try { localStorage.removeItem(ROLES_STORAGE_KEY) } catch { /* ignore */ }
}

/**
 * Fetch a full profile from Supabase for the given user ID.
 * Returns the UserTypes profile and the roles array.
 */
async function fetchProfileFromSupabase(userId: string): Promise<{ profile: UserTypes; roles: string[]; clinicId: string | null; needsPasswordSetup: boolean; clinicTextExpanders: TextExpander[] | null; clinicPlanOrderTags: UserTypes['planOrderTags'] | null; clinicPlanInstructionTags: string[] | null; clinicPlanOrderSets: UserTypes['planOrderSets'] | null }> {
  const profile: UserTypes = {}
  let roles: string[] = []
  let clinicId: string | null = null
  let needsPasswordSetup = false
  let clinicTextExpanders: TextExpander[] | null = null
  let clinicPlanOrderTags: UserTypes['planOrderTags'] | null = null
  let clinicPlanInstructionTags: string[] | null = null
  let clinicPlanOrderSets: UserTypes['planOrderSets'] | null = null

  // Fetch core profile + clinic name.
  const PROFILE_SELECT = 'first_name, last_name, middle_initial, credential, component, rank, uic, roles, clinic_id, clinics(name), pin_hash, pin_salt, notify_dev_alerts, text_expanders, plan_order_tags, plan_instruction_tags, plan_order_sets, needs_password_setup, favorite_medications, provider_note_templates, overview_widgets, theme'
  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
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
    if (sec.text_expanders != null) profile.textExpanders = sec.text_expanders as TextExpander[]
    if (sec.plan_order_tags != null) profile.planOrderTags = sec.plan_order_tags as UserTypes['planOrderTags']
    if (sec.plan_instruction_tags != null) profile.planInstructionTags = sec.plan_instruction_tags as string[]
    if (sec.plan_order_sets != null) profile.planOrderSets = sec.plan_order_sets as UserTypes['planOrderSets']
    if (sec.favorite_medications != null) profile.favoriteMedications = sec.favorite_medications as string[]
    if (sec.provider_note_templates != null) profile.providerNoteTemplates = sec.provider_note_templates as UserTypes['providerNoteTemplates']
    if ('overview_widgets' in sec) profile.overviewWidgets = sec.overview_widgets as UserTypes['overviewWidgets']
    if (typeof sec.theme === 'string') profile.theme = sec.theme
    if (sec.needs_password_setup === true) needsPasswordSetup = true
  }

  // Fetch clinic-level note content
  if (clinicId) {
    const { data: clinicData } = await supabase
      .from('clinics')
      .select('text_expanders, plan_order_tags, plan_instruction_tags, plan_order_sets')
      .eq('id', clinicId)
      .single()

    if (clinicData) {
      if (clinicData.text_expanders != null) clinicTextExpanders = clinicData.text_expanders as TextExpander[]
      if (clinicData.plan_order_tags != null) clinicPlanOrderTags = clinicData.plan_order_tags as UserTypes['planOrderTags']
      if (clinicData.plan_instruction_tags != null) clinicPlanInstructionTags = clinicData.plan_instruction_tags as string[]
      if (clinicData.plan_order_sets != null) clinicPlanOrderSets = clinicData.plan_order_sets as UserTypes['planOrderSets']
    }
  }

  return { profile, roles, clinicId, needsPasswordSetup, clinicTextExpanders, clinicPlanOrderTags, clinicPlanInstructionTags, clinicPlanOrderSets }
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => {
  const handleSignedOut = (wasPrimary: boolean) => {
    // ---- Involuntary sign-out (token expiry, iOS background kill) ----
    // Preserve local session and all local data. Only clear the Supabase
    // user object so sync pauses. The app remains usable offline.
    // If online with a valid local session, try to silently restore; if that
    // fails, surface the reauth overlay so the user can re-authenticate.
    if (!_userInitiatedSignOut) {
      stopHeartbeat()
      const ls = get().localSession
      set({ user: null })
      if (ls && navigator.onLine) {
        attemptSilentRestore(ls).then(result => {
          if (result === 'needs-reauth') set({ needsReauth: true })
        })
      }
      return
    }

    // ---- Deliberate sign-out: full destructive cleanup ----
    _userInitiatedSignOut = false
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
      isProviderRole: false,
      clinicTextExpanders: [],
      clinicPlanOrderTags: null,
      clinicPlanInstructionTags: null,
      clinicPlanOrderSets: null,
      deviceRole: null,
      localSession: null,
      sessionReady: false,
      signalReady: false,
      needsReauth: false,
    })
    clearLocalSessionStorage()
    clearProfileStorage()
    clearRolesStorage()
    removePin()
    removeBiometric()
    clearPasswordVerification().catch(() => {})
    clearServiceWorkerCaches().catch(() => {})

    // Clear vault wrapping key
    clearVaultKey()
    clearClinicVaultKey()
    // Clear clinic device in-memory cache (IDB destruction handled below per device role)
    import('../lib/signal/clinicKeyManager').then(m => m.clearClinicIdentityCache()).catch(() => {})
    // Aggressively clear backup state first (detaches onMessageSaved callback)
    clearBackupKey()
    // Clear in-memory session cache
    clearAllSessions()
    // Clear clinic encryption key cache
    clearKeyStore().catch(() => {})

    // Calendar events IDB: clear events but PRESERVE tombstones across both
    // logout types. Tombstones prevent vault replay from resurrecting deleted
    // events — destroying the DB wipes them, creating a resurrection vector.
    clearCalendarEvents().catch(() => {})
    clearAllPendingVaultSends().catch(() => {})

    if (wasPrimary) {
      // Primary logout: destroy entire IDB databases (nuke containers + encryption key).
      // This ensures no residual data survives — a full clean slate.
      // Use allSettled so one failure doesn't block others, with nuclear fallback.
      ;(async () => {
        const destroyClinic = import('../lib/signal/clinicKeyManager').then(m => m.destroyClinicSignalKeys())
        const results = await Promise.allSettled([
          destroySignalKeys(),
          destroyMessageStore(),
          destroyOutboundQueue(),
          destroySecureStore(),
          destroyClinic,
        ])
        const dbNames = ['adtmc-signal-store', 'adtmc-message-store', 'adtmc-outbound-queue', 'adtmc-secure-store', 'adtmc-clinic-signal-store']
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            try { indexedDB.deleteDatabase(dbNames[i]) } catch { /* last resort */ }
          }
        })
      })()
    } else {
      // Linked/provisional logout: purge data from stores but keep
      // database containers and the device encryption key intact so
      // the device can re-authenticate cleanly on next login.
      // Clinic IDB is always destroyed (no cross-session reuse needed).
      // Nuclear fallback: if clear fails, force-delete the databases.
      ;(async () => {
        const destroyClinic = import('../lib/signal/clinicKeyManager').then(m => m.destroyClinicSignalKeys())
        const results = await Promise.allSettled([
          clearSignalKeys(),
          clearMessageStore(),
          clearOutboundQueue(),
          destroyClinic,
        ])
        const dbNames = ['adtmc-signal-store', 'adtmc-message-store', 'adtmc-outbound-queue', 'adtmc-clinic-signal-store']
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            try { indexedDB.deleteDatabase(dbNames[i]) } catch { /* last resort */ }
          }
        })
      })()
    }

    if (LORA_MESH_ENABLED) {
      import('../lib/lora/loraDb').then(m => m.clearLoraDb()).catch(() => {})
    }
    clearClinicUsersCache().catch(() => {})
    useCallStore.getState().reset()
    useCalendarStore.setState({ events: [], hydrated: false, vaultReplayDone: false })

    // Aggressively wipe browser storage, but preserve keys that should survive
    // sign-out: FCM token (so push subscriptions survive involuntary SIGNED_OUT
    // events, e.g. iOS PWA kills) and theme (user appearance preference is
    // device-level, not account-level).
    const fcmToken = localStorage.getItem('adtmc_fcm_token')
    const savedTheme = localStorage.getItem('theme')
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }
    if (fcmToken) {
      try { localStorage.setItem('adtmc_fcm_token', fcmToken) } catch { /* ignore */ }
    }
    if (savedTheme) {
      try { localStorage.setItem('theme', savedTheme) } catch { /* ignore */ }
    }
  }

  const handleSignedIn = (userId: string, session: { access_token: string }, event: string) => {
    // Detect password recovery flow (user clicked reset-password email link)
    if (event === 'PASSWORD_RECOVERY') {
      set({ isPasswordRecovery: true })
      // Ensure profile is fetched for recovery logins (token-based new users)
      startHeartbeat(userId)
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
    // Update local session lastVerifiedAt on any successful auth event (including token refresh)
    const currentLS = get().localSession
    if (currentLS) {
      const updated = { ...currentLS, lastVerifiedAt: new Date().toISOString() }
      set({ localSession: updated })
      persistLocalSession(updated)
    }
    // Fetch profile and initialize Signal on sign-in or session resume
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      const isFirstSession = !get().localSession
      startHeartbeat(userId)
      const profileP = get().refreshProfile()

      // Initialize Signal Protocol keys independently of profile fetch.
      // Signal init runs in the background — the app unlocks after profile only.
      // Messaging surfaces read `signalReady` to show a subtle init state.
      initSignalBundle(userId).then(async initResult => {
        if (initResult) {
          set({ deviceRole: initResult.role, signalReady: true })
          startHeartbeat(userId, initResult.deviceId)
          updateCleanupDeviceId(initResult.deviceId)
          updateCleanupIsPrimary(initResult.role === 'primary')

          // Create or update the persistent local session
          const ls: LocalSession = {
            userId,
            email: get().user?.email ?? get().localSession?.email ?? '',
            deviceId: initResult.deviceId,
            createdAt: get().localSession?.createdAt ?? new Date().toISOString(),
            lastVerifiedAt: new Date().toISOString(),
          }
          set({ localSession: ls })
          persistLocalSession(ls)

          // Process vault messages (deferred messages from offline period).
          // If any messages were recovered, create a backup immediately so other
          // devices don't miss them during the 60s periodic backup window.
          processVaultMessages(userId)
            .then(count => { if (count > 0) createBackup(userId).catch(() => {}) })
            .catch(() => {})

          // Initialize clinic vault device (clinic persona — parallel to personal vault)
          // Await profile so clinicId is available on new devices (no localStorage cache)
          try { await profileP } catch { /* profile may have failed — clinicId may still be cached */ }
          const cId = get().clinicId
          if (cId) {
            (async () => {
              try {
                // Fetch the clinic's raw encryption key from Supabase
                const { data: clinicRow } = await supabase
                  .from('clinics')
                  .select('encryption_key')
                  .eq('id', cId)
                  .single()
                if (!clinicRow?.encryption_key) {
                  useCalendarStore.setState({ vaultReplayDone: true })
                  return
                }

                // Reset hydration gates so vault→sync→hydrate pipeline sequences correctly.
                // IDB persists across sessions — no longer cleared on login.
                useCalendarStore.setState({ hydrated: false, vaultReplayDone: false })

                // Derive wrapping key + ensure vault device exists + process unread
                await deriveAndCacheClinicVaultKey(cId, clinicRow.encryption_key)
                await ensureClinicVaultExists(cId, clinicRow.encryption_key)
                await processClinicVaultMessages(cId)

                // Register this browser as a clinic linked device
                const { initClinicDeviceBundle } = await import('../lib/signal/clinicDeviceInit')
                const { clinicDeviceId } = await initClinicDeviceBundle(userId, cId, initResult.deviceId)
                const { useMessagingStore } = await import('./useMessagingStore')
                useMessagingStore.getState().setClinicDeviceId(clinicDeviceId)

                // Unlock calendar — vault replay + clinicDeviceId are both ready
                useCalendarStore.setState({ vaultReplayDone: true })

                // Wire clinic device into heartbeat so last_active_at stays fresh
                const { updateHeartbeatClinicDevice } = await import('../lib/activityHeartbeat')
                updateHeartbeatClinicDevice(cId, clinicDeviceId)

                // Wire clinic device into browser-close cleanup
                const { updateCleanupClinicDeviceId } = await import('../lib/sessionCleanup')
                updateCleanupClinicDeviceId(clinicDeviceId)

                // Server-side TTL cleanup of stale clinic devices (replaces client-side prune)
                const { cleanupStaleClinicDevices } = await import('../lib/signal/signalService')
                cleanupStaleClinicDevices(cId).catch(() => {})
              } catch (e) {
                // Surface vault replay failures so the user knows events may be missing
                console.error('Clinic vault init failed:', e)
                const { useCalendarStore } = await import('./useCalendarStore')
                useCalendarStore.setState({ hydrationError: true, vaultReplayDone: true })
              }
            })()
          } else {
            // No clinic — no vault to replay; unlock calendar immediately
            useCalendarStore.setState({ vaultReplayDone: true })
          }

          // Initialize LoRa mesh subsystem (lazy — no-ops if flag is off)
          initLoRaMesh(userId).catch(() => {})

          // Server-side encrypted backup: restore first, then schedule ongoing
          // backups so the server row stays fresh. All device roles restore —
          // primary included — so conversations survive a logout/re-login cycle.
          restoreBackup(userId)
            .then(() => scheduleBackup(userId))
            .catch(() => scheduleBackup(userId))
        }
      }).catch(() => {
        set({ signalReady: true }) // Mark ready even on failure — don't block UI permanently
        useCalendarStore.setState({ vaultReplayDone: true })
      })

      // Progressive unlock: first login gates UI on profile only (not Signal).
      // Guard on sessionReady directly rather than isFirstSession — localSession can
      // be pre-populated by the async secureGet in init() before INITIAL_SESSION fires,
      // causing isFirstSession to incorrectly evaluate false and leaving the loader stuck.
      if (!get().sessionReady) {
        profileP.finally(() => {
          if (!get().sessionReady) set({ sessionReady: true })
        })
        // Safety net: never block the UI longer than 5 seconds
        setTimeout(() => {
          if (!get().sessionReady) set({ sessionReady: true })
        }, 5_000)
      }
    }
  }

  const cachedRoles = loadRolesFromStorage()

  const hasLocalSession = !!loadLocalSessionSync()

  return {
  user: null,
  loading: !hasLocalSession,
  isGuest: false,
  profile: loadProfileFromStorage(),
  roles: cachedRoles?.roles ?? [],
  clinicId: cachedRoles?.clinicId ?? null,
  isDevRole: cachedRoles?.isDevRole ?? false,
  isSupervisorRole: cachedRoles?.roles.includes('supervisor') ?? false,
  isProviderRole: cachedRoles?.roles.includes('provider') ?? false,
  isPasswordRecovery: false,
  needsPasswordSetup: false,
  clinicTextExpanders: [],
  clinicPlanOrderTags: null,
  clinicPlanInstructionTags: null,
  clinicPlanOrderSets: null,
  deviceRole: null,
  localSession: loadLocalSessionSync(),
  sessionReady: hasLocalSession,
  signalReady: hasLocalSession,
  needsReauth: false,

  init: () => {
    // Hydrate local session from encrypted storage (upgrade over sync localStorage read)
    secureGet(LOCAL_SESSION_KEY).then(raw => {
      if (raw) {
        try {
          const ls = JSON.parse(raw) as LocalSession
          set({ localSession: ls })
        } catch { /* ignore corrupt data */ }
      }
    }).catch(() => {})

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

    // Hydrate roles from encrypted storage (upgrade over sync localStorage read)
    loadRolesFromSecureStorage().then(cached => {
      if (cached) {
        const currentRoles = get().roles
        // Only hydrate if the sync load returned empty
        if (currentRoles.length === 0) {
          set({
            roles: cached.roles,
            clinicId: cached.clinicId,
            isDevRole: cached.isDevRole,
            isSupervisorRole: cached.roles.includes('supervisor'),
            isProviderRole: cached.roles.includes('provider'),
          })
        }
      }
    }).catch(() => {})

    // Register browser-mode cleanup (no-ops if PWA)
    registerSessionCleanup()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Capture role BEFORE clearing state (handleSignedOut nulls it)
        const wasPrimary = get().deviceRole === 'primary'
        handleSignedOut(wasPrimary)
      } else if (session?.user) {
        set({ user: session.user, isGuest: false, needsReauth: false })
        handleSignedIn(session.user.id, session, event)
      }
      if (event === 'INITIAL_SESSION') {
        set({ loading: false })
        // No active session on app open — check if we can restore from localSession
        if (!session) {
          const ls = get().localSession
          if (ls && navigator.onLine) {
            attemptSilentRestore(ls).then(result => {
              if (result === 'needs-reauth') set({ needsReauth: true })
            })
          }
        }
      }
    })

    // Visibility-change safety net: if the app resumes with a dead session that
    // didn't fire SIGNED_OUT (e.g. token expired while the tab was hidden and
    // Supabase's internal refresh already gave up), catch it here.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const state = get()
      if (state.user || !state.localSession || state.needsReauth || !navigator.onLine) return
      attemptSilentRestore(state.localSession).then(result => {
        if (result === 'needs-reauth') set({ needsReauth: true })
      })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  },

  continueAsGuest: () => {
    set({ isGuest: true, user: null, sessionReady: true, signalReady: true, needsReauth: false })
  },

  signOut: async () => {
    _userInitiatedSignOut = true
    // Force-delete keys from Supabase BEFORE signing out.
    // After signOut the auth token is dead and these calls would fail silently.
    const userId = get().user?.id
    const role = get().deviceRole
    if (userId) {
      try {
        // Remove this device's push subscription (browser + Supabase row)
        await unsubscribeFromPush().catch(() => {})

        if (role === 'primary') {
          // Primary logout: flush a final backup so conversations survive re-login
          await createBackup(userId).catch(() => {})
          // Then destroy all linked devices + sessions
          await primaryLogoutAll()
        }
        // Then clean up own device (both primary and linked)
        const deviceId = await getLocalDeviceId()
        if (deviceId) {
          const cleanups: Promise<unknown>[] = [
            unregisterDevice(userId, deviceId),
            deleteKeyBundle(userId, deviceId),
          ]
          // Also clean up clinic device registration + key bundle (registered under clinicId)
          const cId = get().clinicId
          if (cId) {
            const { makeClinicDeviceId } = await import('../lib/signal/clinicKeyManager')
            const clinicDeviceId = makeClinicDeviceId(userId, deviceId)
            cleanups.push(
              unregisterDevice(cId, clinicDeviceId),
              deleteKeyBundle(cId, clinicDeviceId),
            )
          }
          await Promise.all(cleanups)
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

  clearNeedsReauth: () => {
    set({ needsReauth: false })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return

    try {
      const { profile, roles, clinicId, needsPasswordSetup, clinicTextExpanders, clinicPlanOrderTags, clinicPlanInstructionTags, clinicPlanOrderSets } = await fetchProfileFromSupabase(user.id)
      set({
        profile,
        roles,
        clinicId,
        isDevRole: roles.includes('dev'),
        isSupervisorRole: roles.includes('supervisor'),
        isProviderRole: roles.includes('provider'),
        needsPasswordSetup,
        clinicTextExpanders: clinicTextExpanders ?? [],
        clinicPlanOrderTags: clinicPlanOrderTags ?? null,
        clinicPlanInstructionTags: clinicPlanInstructionTags ?? null,
        clinicPlanOrderSets: clinicPlanOrderSets ?? null,
      })
      saveProfileToStorage(profile)
      saveRolesToStorage({ roles, clinicId, isDevRole: roles.includes('dev') })

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
}})

// Auto-initialize auth listener at module load (no useEffect delay)
useAuthStore.getState().init()

/** Derived selector: true when a real user is authenticated (Supabase session or persistent local session). */
export const selectIsAuthenticated = (state: AuthState) => !!state.user || !!state.localSession
