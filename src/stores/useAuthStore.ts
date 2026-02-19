/**
 * Zustand store for authentication
 *
 * Centralized user, loading, and guest state previously managed with useState inside useAuth. components  subscribe to individual slices (e.g. `useAuthStore(s => s.user)`) for minimal re-renders.
 * The `init()` action sets up `supabase.auth.onAuthStateChange` and returns a cleanup function — call it from a useEffect.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  isGuest: boolean
}

interface AuthActions {
  /** Set up auth listener. Returns cleanup function. */
  init: () => () => void
  continueAsGuest: () => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  loading: true,
  isGuest: true,

  init: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, isGuest: true })
      } else if (session?.user) {
        set({ user: session.user, isGuest: false })
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
    await supabase.auth.signOut()
    // onAuthStateChange handler already sets user=null and isGuest=true
  },
}))

/** Derived selector: true when a real user is authenticated. */
export const selectIsAuthenticated = (state: AuthState) => !!state.user
