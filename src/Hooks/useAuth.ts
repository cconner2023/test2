import { useAuthStore, selectIsAuthenticated } from '../stores/useAuthStore'

/**
 * Thin wrapper around the Zustand auth store.
 * Preserves the identical return interface so no consumers need changes.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const isGuest = useAuthStore((s) => s.isGuest)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const signOut = useAuthStore((s) => s.signOut)

  return {
    user,
    loading,
    isGuest,
    isAuthenticated,
    continueAsGuest,
    signOut,
  }
}
