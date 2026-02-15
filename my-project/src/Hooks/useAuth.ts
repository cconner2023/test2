import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(true) // Start as guest by default

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setIsGuest(false) // Not guest if authenticated
      } else {
        setIsGuest(true) // Default to guest
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsGuest(false)
      } else {
        setUser(null)
        setIsGuest(true) // Back to guest on logout
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
    setUser(null)
    setIsGuest(false)
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
