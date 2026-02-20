/**
 * Authentication service wrapping Supabase Auth.
 *
 * Provides:
 * - User registration with profile creation
 * - Login
 */
import { supabase } from './supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('AuthService')

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
      logger.error('Failed to update profile after signup:', profileError)
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

  // Fire-and-forget: notify dev users of login
  if (!error && data.user) {
    supabase.functions.invoke('send-push-notification', {
      body: {
        type: 'user_login',
        name: null,
        email,
        author_id: data.user.id,
      },
    }).catch(() => { /* push notification delivery is best-effort */ })
  }

  return {
    user: data.user,
    session: data.session,
    error: error,
  }
}

/**
 * Associate a user with a clinic based on their UIC.
 * Searches the clinics.uics array for a match, then falls back
 * to checking additional_user_ids.
 */
async function associateClinic(userId: string, uic: string): Promise<void> {
  if (!uic) return

  const upperUic = uic.toUpperCase().trim()

  // Find clinic whose uics array contains this UIC
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .contains('uics', [upperUic])
    .limit(1)
    .single()

  if (clinic) {
    await supabase
      .from('profiles')
      .update({ clinic_id: clinic.id })
      .eq('id', userId)
    return
  }

  // Fall back: check if user is in a clinic's additional_user_ids
  const { data: attachedClinic } = await supabase
    .from('clinics')
    .select('id')
    .contains('additional_user_ids', [userId])
    .limit(1)
    .single()

  if (attachedClinic) {
    await supabase
      .from('profiles')
      .update({ clinic_id: attachedClinic.id })
      .eq('id', userId)
  }
}
