/**
 * Authentication service wrapping Supabase Auth.
 *
 * Provides:
 * - User registration with profile creation
 * - Login
 */
import { supabase } from './supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { useAuthStore } from '../stores/useAuthStore'
import { createLogger } from '../Utilities/Logger'
import { hashWithSalt, verifyHash } from './cryptoUtils'
import { secureSet, secureGet, secureRemove } from './secureStorage'
import { deriveAndStoreBackupKey } from './signal/backupService'
import { generateVaultIdentity, uploadVaultDevice, deriveAndCacheVaultKey, ensureVaultExists, setVaultKeyReady } from './signal/vaultDevice'
import { succeed, fail, getErrorMessage as getErrMsg, type ServiceResult } from './result'
import { rememberSignInEmail } from './loginPrefill'

const logger = createLogger('AuthService')

// --- Offline password verification (mirrors PIN hash pattern) ---

const PW_KEYS = {
  hash: 'adtmc_pw_verify_hash',
  salt: 'adtmc_pw_verify_salt',
} as const

let _pwHash: string | null = null
let _pwSalt: string | null = null
let _pwHydrated = false

async function hydratePwCache(): Promise<void> {
  if (_pwHydrated) return
  _pwHash = await secureGet(PW_KEYS.hash)
  _pwSalt = await secureGet(PW_KEYS.salt)
  _pwHydrated = true
}

export async function storePasswordHash(password: string): Promise<void> {
  try {
    const { hash, salt } = await hashWithSalt(password)
    await secureSet(PW_KEYS.hash, hash)
    await secureSet(PW_KEYS.salt, salt)
    _pwHash = hash
    _pwSalt = salt
    _pwHydrated = true
  } catch {
    // Storage full or unavailable
  }
}

export async function verifyPasswordLocally(password: string): Promise<boolean> {
  try {
    await hydratePwCache()
    if (!_pwHash || !_pwSalt) return false
    return verifyHash(password, _pwHash, _pwSalt)
  } catch {
    return false
  }
}

export async function clearPasswordVerification(): Promise<void> {
  try {
    await secureRemove(PW_KEYS.hash)
    await secureRemove(PW_KEYS.salt)
    _pwHash = null
    _pwSalt = null
    _pwHydrated = false
  } catch {
    // fail silently
  }
}

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

    // Generate vault device while password is in scope.
    // Awaited with single retry — the vault makes the user messageable immediately.
    try {
      const vaultBundle = await generateVaultIdentity(data.user.id, password)
      const uploadResult = await uploadVaultDevice(data.user.id, vaultBundle)
      if (!uploadResult.ok) {
        // Retry once on upload failure
        await uploadVaultDevice(data.user.id, vaultBundle)
      }
    } catch {
      // Single retry on generation failure
      try {
        const vaultBundle = await generateVaultIdentity(data.user.id, password)
        await uploadVaultDevice(data.user.id, vaultBundle)
      } catch {
        logger.warn('Vault creation failed after retry — will be created on next sign-in')
      }
    }
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

  // Post-login setup: cache secrets and warm the message vault.
  if (!error && data.user) {
    // Prefill the address on the next visit — LoginScreen reads it back and the
    // user only types a password. Cleared by the "Not you?" affordance there.
    rememberSignInEmail(email)
    // Store password hash for offline lock-screen verification
    storePasswordHash(password).catch(() => {})
    // Derive non-extractable backup CryptoKey from password (password is NOT cached)
    deriveAndStoreBackupKey(password, data.user.id).catch(() => {})
    // Ensure vault exists (migration for pre-vault users), then cache wrapping key.
    // Sequential: deriveAndCacheVaultKey needs the vault row to exist before fetching salt.
    // Retry once on failure — vault is critical for messageability.
    // The promise is registered so processVaultMessages can await it instead of racing.
    const vaultKeyP = ensureVaultExists(data.user.id, password)
      .then(() => deriveAndCacheVaultKey(password, data.user.id))
      .catch(() =>
        ensureVaultExists(data.user.id, password)
          .then(() => deriveAndCacheVaultKey(password, data.user.id))
          .catch(() => logger.warn('Vault ensure failed after retry'))
      )
    setVaultKeyReady(vaultKeyP)

    // System identity no longer needs a password-derived wrapping key at
    // sign-in: it's wrapped with a SHARED dev key fetched lazily during
    // ensureSystemIdentity (is_dev-gated `get_system_shared`). See
    // systemIdentity.ts bootstrapInternal.
  }

  return {
    user: data.user,
    session: data.session,
    error: error,
  }
}

/**
 * Associate a user with a clinic based on their UIC.
 * UIC-match only — the legacy additional_user_ids fallback was retired in PR 7
 * (surrogate clinic membership replaces it; admin/supervisor-set, never auto).
 */
async function associateClinic(userId: string, uic: string): Promise<void> {
  if (!uic) return

  const upperUic = uic.toUpperCase().trim()

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
  }
}

/**
 * Delete the current user's own account.
 * Calls the delete_own_account RPC which purges all user data
 * (notes, training, sync queue, account requests, profile, auth).
 */
export async function deleteOwnAccount(): Promise<ServiceResult> {
  try {
    const user = useAuthStore.getState().user
    if (!user) return fail('Not authenticated')

    // RPC may not yet exist in generated types — cast to bypass until migration runs
    const { error } = await (supabase.rpc as (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>)('delete_own_account')
    if (error) return fail(error.message)
    return succeed()
  } catch (e) {
    logger.error('Failed to delete account:', e)
    return fail(getErrMsg(e))
  }
}

/**
 * Self-service cluster departure (PCS out-processing). The signed-in user removes
 * THEMSELVES from their home cluster via leave_own_cluster (SECURITY DEFINER; nulls
 * their own clinic_id + uic, and RAISES if they're the sole supervisor so a cluster
 * can't be orphaned). Lands them in the zero-cluster "between assignments" state —
 * their gaining unit's supervisor pulls them into the next cluster (no self-join).
 *
 * refreshProfile's clean-break eviction is guarded on a NON-NULL home clinic (a null
 * read is ambiguous with a failed fetch), so it deliberately won't fire on a
 * leave-to-zero. We therefore evict the left cluster's local data explicitly here,
 * using the clinic id the RPC echoes back, before refreshing the profile to null.
 */
export async function leaveOwnCluster(): Promise<ServiceResult> {
  try {
    const user = useAuthStore.getState().user
    if (!user) return fail('Not authenticated')

    // RPC not yet in generated types — cast to bypass until types regenerate.
    const { data, error } = await (supabase.rpc as (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>)('leave_own_cluster')
    if (error) return fail(error.message)

    const leftClinicId = (data as { left_clinic_id?: string } | null)?.left_clinic_id
    if (leftClinicId) {
      const { evictClinicData } = await import('./clinicEviction')
      await evictClinicData(leftClinicId).catch(() => { /* best-effort teardown */ })
    }
    await useAuthStore.getState().refreshProfile()
    return succeed()
  } catch (e) {
    logger.error('Failed to leave cluster:', e)
    return fail(getErrMsg(e))
  }
}

/** Loose client-side email shape check — the RPC re-validates authoritatively. */
function isEmailShape(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

/**
 * Change the signed-in user's own login email. Direct self-service — the server
 * (update_own_email) only authenticates the caller (any authenticated user may
 * change their own). Email lives in auth.users + identities (not profiles), so
 * the RPC updates both and preserves the confirmed state. There is no email
 * verification (no BAA → the app can't send mail), so the UI gates this behind
 * a confirm dialog that echoes the typed address.
 *
 * After the change, the local session JWT still carries the OLD email claim, so
 * we refresh the session — the onAuthStateChange listener repopulates
 * useAuthStore.user with the new email. The refresh failing doesn't undo the
 * change; the new email surfaces on the next token refresh regardless.
 */
export async function updateOwnEmail(email: string): Promise<ServiceResult> {
  try {
    const user = useAuthStore.getState().user
    if (!user) return fail('Not authenticated')

    const trimmed = email.trim()
    if (!isEmailShape(trimmed)) return fail('Enter a valid email address.')

    const { error } = await supabase.rpc('update_own_email', { p_new_email: trimmed })
    if (error) return fail(error.message)

    // Pull a fresh JWT so the new email claim propagates into the store.
    await supabase.auth.refreshSession().catch(() => {})
    return succeed()
  } catch (e) {
    logger.error('Failed to update own email:', e)
    return fail(getErrMsg(e))
  }
}
