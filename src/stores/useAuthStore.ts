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
import { isPinEnabled, hydrateFromCloud } from '../lib/pinService'
import { isDevUser } from '../lib/adminService'
import type { User } from '@supabase/supabase-js'
import type { UserTypes } from '../Data/User'

const STORAGE_KEY = 'adtmc_user_profile'

interface AuthState {
  user: User | null
  loading: boolean
  isGuest: boolean
  profile: UserTypes
  roles: string[]
  isDevRole: boolean
  isSupervisorRole: boolean
  isPasswordRecovery: boolean
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

function loadProfileFromStorage(): UserTypes {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return migratePeDepth(JSON.parse(saved) as UserTypes)
  } catch { /* ignore */ }
  return {}
}

function saveProfileToStorage(profile: UserTypes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch { /* ignore */ }
}

function clearProfileStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

/**
 * Fetch a full profile from Supabase for the given user ID.
 * Returns the UserTypes profile and the roles array.
 */
async function fetchProfileFromSupabase(userId: string): Promise<{ profile: UserTypes; roles: string[] }> {
  const profile: UserTypes = {}
  let roles: string[] = []

  // Fetch core profile + clinic name
  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name, middle_initial, credential, component, rank, uic, roles, clinics(name), pin_hash, pin_salt, notifications_enabled, notify_clinic_notes, notify_dev_alerts, note_include_hpi, note_include_pe, pe_depth')
    .eq('id', userId)
    .single()

  if (data) {
    const clinicRow = data.clinics as { name: string } | null

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
    if (sec.pin_hash && sec.pin_salt && !isPinEnabled()) {
      hydrateFromCloud(sec.pin_hash as string, sec.pin_salt as string)
    }

    profile.notificationsEnabled = (sec.notifications_enabled as boolean) ?? false
    if (sec.notify_clinic_notes != null) profile.notifyClinicNotes = sec.notify_clinic_notes as boolean
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
  }

  return { profile, roles }
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  user: null,
  loading: true,
  isGuest: true,
  profile: loadProfileFromStorage(),
  roles: [],
  isDevRole: false,
  isSupervisorRole: false,
  isPasswordRecovery: false,

  init: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({
          user: null,
          isGuest: true,
          profile: {},
          roles: [],
          isDevRole: false,
          isSupervisorRole: false,
        })
        clearProfileStorage()
      } else if (session?.user) {
        set({ user: session.user, isGuest: false })
        // Detect password recovery flow (user clicked reset-password email link)
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true })
        }
        // Fetch profile in the background on sign-in
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
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
    await supabase.auth.signOut({ scope: 'local' })
    // onAuthStateChange handler already clears state
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
      const { profile, roles } = await fetchProfileFromSupabase(user.id)
      const isDev = await isDevUser()

      set({
        profile,
        roles,
        isDevRole: isDev,
        isSupervisorRole: roles.includes('supervisor'),
      })
      saveProfileToStorage(profile)
    } catch {
      // Profile fetch failed — keep existing state
    }
  },
}))

/** Derived selector: true when a real user is authenticated. */
export const selectIsAuthenticated = (state: AuthState) => !!state.user
