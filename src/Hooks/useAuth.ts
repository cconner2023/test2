import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * Thin wrapper around the Zustand auth store.
 * Uses useShallow for a single subscription with shallow equality,
 * so consumers only re-render when a selected field actually changes.
 */
export function useAuth() {
  return useAuthStore(useShallow((s) => ({
    user: s.user,
    loading: s.loading,
    isGuest: s.isGuest,
    isAuthenticated: !!s.user,
    continueAsGuest: s.continueAsGuest,
    signOut: s.signOut,
    profile: s.profile,
    roles: s.roles,
    isDevRole: s.isDevRole,
    isSupervisorRole: s.isSupervisorRole,
    refreshProfile: s.refreshProfile,
    clinicId: s.clinicId,
  })))
}
