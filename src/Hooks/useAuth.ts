import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(true) // Start as guest by default

  useEffect(() => {
    // Rely on onAuthStateChange for all auth state transitions.
    // Modern Supabase fires INITIAL_SESSION as its first event,
    // restoring the persisted session from localStorage.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsGuest(true)
      } else if (session?.user) {
        setUser(session.user)
        setIsGuest(false)
      }
      // Only clear loading after the initial session check completes
      if (event === 'INITIAL_SESSION') {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const continueAsGuest = () => {
    setIsGuest(true)
    setUser(null)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // onAuthStateChange handler already sets user=null and isGuest=true
  }

  return {
    user,
    loading,
    isGuest,
    isAuthenticated: !!user,
    continueAsGuest,
    signOut,
  }
}
