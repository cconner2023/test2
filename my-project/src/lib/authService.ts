/**
 * Authentication service wrapping Supabase Auth.
 *
 * Provides:
 * - User registration with profile creation
 * - Login/logout
 * - Session management
 * - Auth state change listeners
 */
import { supabase } from './supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | null
  session: Session | null
  error: AuthError | null
}

export interface ProfileData {
  display_name: string
  rank: string
  uic: string
}

/**
 * Register a new user with email/password and create their profile.
 */
export async function signUp(
  email: string,
  password: string,
  profile: ProfileData
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { user: null, session: null, error }
  }

  // Update the auto-created profile with user-provided data
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name,
        rank: profile.rank,
        uic: profile.uic,
      })
      .eq('id', data.user.id)

    if (profileError) {
      console.error('Failed to update profile after signup:', profileError)
    }

    // Auto-associate clinic based on UIC
    await associateClinic(data.user.id, profile.uic)
  }

  return {
    user: data.user,
    session: data.session,
    error: null,
  }
}

/**
 * Log in with email and password.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return {
    user: data.user,
    session: data.session,
    error: error,
  }
}

/**
 * Log out the current user.
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Get the current session (returns null if not authenticated).
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Get the current user.
 */
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback)
}

/**
 * Associate a user with a clinic based on their UIC.
 */
async function associateClinic(userId: string, uic: string): Promise<void> {
  if (!uic) return

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('uic', uic)
    .single()

  if (clinic) {
    await supabase
      .from('profiles')
      .update({ clinic_id: clinic.id })
      .eq('id', userId)
  }
}

/**
 * Get the user's profile from Supabase.
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

/**
 * Update the user's profile.
 */
export async function updateProfile(
  userId: string,
  updates: Partial<ProfileData>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  // Re-associate clinic if UIC changed
  if (!error && updates.uic) {
    await associateClinic(userId, updates.uic)
  }

  return { data, error }
}
