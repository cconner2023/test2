/**
 * Admin Service
 *
 * Handles admin operations like approving/rejecting account requests
 * and managing user roles.
 *
 * Role changes go through SECURITY DEFINER RPC functions to prevent
 * privilege escalation via direct table updates.
 */

import { supabase } from './supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { useInvalidationStore } from '../stores/useInvalidationStore'
import type { AccountRequest } from './accountRequestService'
import type { AvatarBlob } from '../Types/SupervisorTestTypes'
import { createLogger } from '../Utilities/Logger'
import {
  generateClinicKeyBase64,
  encryptWithRawKey,
  decryptWithRawKey,
  encryptClinicField,
} from './cryptoService'
import { provisionClinicVaultAsAdmin } from './signal/clinicVaultDevice'
import { validatePasswordComplexity } from './constants'
import { getErrorMessage } from '../Utilities/errorUtils'
import { succeed, fail, type ServiceResult } from './result'
import { classifySupabaseError, ErrorCode } from './errorCodes'
import { validateRpcResult, validateRpcArray } from './validators'
import {
  deltaRead,
  revalidateDeltaCache,
  invalidateDeltaCache,
  localStorageBase,
  type DeltaCacheConfig,
} from './deltaCache'
import { getAdminCache, putAdminCache, clearAdminCache } from './offlineDb'

const logger = createLogger('AdminService')

/**
 * SWR freshness window for the admin delta caches (users + clinics). A warm read
 * past this age serves cached rows instantly AND kicks a background delta, so a
 * dev editing across a long session still catches others' writes. These are
 * monitoring views — see the memTtlMs note in src/lib/deltaCache.ts.
 */
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000

export interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  middle_initial: string | null
  credential: string | null
  component: string | null
  rank: string | null
  uic: string | null
  roles: string[]
  clinic_id: string | null
  clinic_name: string | null
  /** Intra-clinic sub-unit (platoon/squad) id; null = HQ / unassigned. Render-
   *  only grouping — never an access boundary. See Utilities/subCluster.ts. */
  sub_cluster_id: string | null
  surrogate_clinic_id: string | null
  surrogate_clinic_name: string | null
  created_at: string
  last_active_at: string | null
  avatar_id: string | null
  avatar_blob?: AvatarBlob | null
  supervisor_created: boolean
}

/**
 * Check if the current user has dev role
 */
export async function isDevUser(): Promise<boolean> {
  try {
    const user = useAuthStore.getState().user
    if (!user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    return profile?.roles?.includes('dev') ?? false
  } catch {
    return false
  }
}

/**
 * Promise cache for getAllAccountRequests, keyed by the `requests` invalidation
 * generation plus the status filter (callers pass 'pending' for the summary and
 * undefined for the full list — distinct cache entries). AdminSummary and
 * AdminRequestsList both load on every drawer open; without this each fired its
 * own round-trip. Bust via invalidate('requests'). Mirrors the listAllUsers /
 * listClinics caches.
 */
let accountRequestsCache: { gen: number; byStatus: Map<string, Promise<AccountRequest[]>> } | null = null

/**
 * Get all account requests, optionally filtered by status (dev only).
 * Served from the gen-keyed promise cache; bust via invalidate('requests').
 */
export async function getAllAccountRequests(
  status?: 'pending' | 'approved' | 'rejected'
): Promise<AccountRequest[]> {
  const gen = useInvalidationStore.getState().generations.requests
  const key = status ?? '__all__'
  if (!accountRequestsCache || accountRequestsCache.gen !== gen) {
    accountRequestsCache = { gen, byStatus: new Map() }
  }
  const cached = accountRequestsCache.byStatus.get(key)
  if (cached) return cached

  const promise = fetchAccountRequests(status, gen, key)
  accountRequestsCache.byStatus.set(key, promise)
  return promise
}

async function fetchAccountRequests(
  status: 'pending' | 'approved' | 'rejected' | undefined,
  gen: number,
  key: string,
): Promise<AccountRequest[]> {
  try {
    let query = supabase
      .from('account_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      middle_initial: row.middle_initial,
      credential: row.credential,
      rank: row.rank,
      component: row.component,
      uic: row.uic,
      status: row.status,
      request_type: row.request_type || 'new_account',
      status_check_token: row.status_check_token || null,
      user_id: row.user_id,
      requested_at: row.requested_at,
      reviewed_at: row.reviewed_at,
      rejection_reason: row.rejection_reason,
      notes: row.notes,
    }))
  } catch (error) {
    logger.error('Failed to get account requests:', error)
    // Drop this entry so the next call retries instead of caching the empty fallback.
    if (accountRequestsCache?.gen === gen) accountRequestsCache.byStatus.delete(key)
    return []
  }
}

/**
 * Approve an account request and create the user account.
 *
 * The user already set their password when submitting the request.
 * The RPC creates the auth user using the stored password hash.
 * The user can immediately log in with their email and password.
 */
export async function approveAccountRequest(
  requestId: string,
): Promise<ServiceResult<{ userId: string; email: string; firstName: string; lastName: string }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { data, error: approveError } = await supabase.rpc('approve_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
    })

    if (approveError) {
      const code = classifySupabaseError(approveError)
      if (code === ErrorCode.RATE_LIMITED) {
        return fail('Rate limited. Please try again later.')
      }
      return fail(approveError.message)
    }

    const validated = validateRpcResult<{
      user_id: string
      email: string
      first_name: string
      last_name: string
      message: string
    }>(data, ['user_id'], 'approveAccountRequest')

    if (!validated.ok) {
      return fail(validated.error ?? 'Approval succeeded but returned unexpected data')
    }

    // Approval created a new auth user + profile — pull it into the user cache.
    void bustUserCache()

    return succeed({
      userId: validated.data.user_id,
      email: validated.data.email,
      firstName: validated.data.first_name,
      lastName: validated.data.last_name,
    })
  } catch (error) {
    logger.error('Failed to approve request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Send the "account approved" notification email via Magic Link template.
 * Returns a ServiceResult so callers can surface delivery failures — the
 * user account is already created at this point, so a failure here is
 * non-fatal but worth telling the admin about.
 */
export async function sendApprovalEmail(email: string): Promise<ServiceResult> {
  try {
    // send-auth-email mints a 24h magic link (GoTrue) and delivers it via Resend,
    // with .mil relay routing. Replaces the old GoTrue signInWithOtp magic-link send.
    const { error } = await supabase.functions.invoke('send-auth-email', {
      body: { kind: 'magiclink', email },
    })
    if (error) {
      logger.warn('Approval notification email failed:', error)
      return fail(error.message)
    }
    return succeed()
  } catch (error) {
    logger.warn('Approval notification email failed:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Reject an account request.
 * The RPC function verifies the caller has dev role via auth.uid().
 */
export async function rejectAccountRequest(
  requestId: string,
  reason: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('reject_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
      reason,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reject request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Reopen a rejected account request (move back to pending).
 * Guards with .eq('status', 'rejected') to prevent stale-state corruption.
 */
export async function reopenAccountRequest(
  requestId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('account_requests')
      .update({
        status: 'pending',
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      })
      .eq('id', requestId)
      .eq('status', 'rejected')

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reopen request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Permanently delete an account request.
 */
export async function deleteAccountRequest(
  requestId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('account_requests')
      .delete()
      .eq('id', requestId)

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to delete account request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', userId)
      .single()

    return data?.roles || []
  } catch {
    return []
  }
}

/**
 * Set all roles for a user in a single RPC call.
 * The RPC verifies the caller has dev role — prevents self-escalation.
 */
export async function setUserRoles(
  userId: string,
  roles: ('medic' | 'supervisor' | 'dev' | 'provider')[]
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: roles,
    })

    if (error) return fail(error.message)
    void bustUserCache()
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * Add a role to a user via SECURITY DEFINER RPC function.
 * The RPC verifies the caller has dev role — prevents self-escalation.
 */
export async function addUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev' | 'provider'
): Promise<ServiceResult> {
  try {
    const currentRoles = await getUserRoles(userId)

    if (currentRoles.includes(role)) return succeed()

    const newRoles = [...currentRoles, role] as ('medic' | 'supervisor' | 'dev' | 'provider')[]

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) return fail(error.message)
    void bustUserCache()
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * Remove a role from a user via SECURITY DEFINER RPC function.
 */
export async function removeUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev' | 'provider'
): Promise<ServiceResult> {
  try {
    const currentRoles = await getUserRoles(userId)
    const newRoles = currentRoles.filter(r => r !== role) as ('medic' | 'supervisor' | 'dev' | 'provider')[]

    if (newRoles.length === currentRoles.length) return succeed() // Role wasn't present

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) return fail(error.message)
    void bustUserCache()
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * Admin user list — tier-2 deltaCache (see v2/conventions egress drawer).
 *
 * Five admin surfaces (AdminSummary, AdminRequestsList, AdminClinicsList,
 * AdminUsersList, AdminUserDetail) call listAllUsers on mount, and the admin
 * drawer never rides the offline-first IDB pipeline, so every open used to
 * re-pull the FULL user list (incl. avatar_blob) — the dominant account-
 * maintenance egress sink. Now: a persisted base + an `updated_at`-keyed delta
 * (admin_list_users(p_since)) — a cold read pulls the full list once, then every
 * reload pulls only the users that actually changed.
 *
 * Persisted base lives in IDB (adminCache store), NOT localStorage, because rows
 * carry avatar_blob (encrypted photo) — too large for the ~5MB localStorage quota.
 *
 * HARD-DELETE / AUTH-EDIT caveat: profiles has no archived_at, so a delete can't
 * ride an updated_at delta; and updateUserEmail touches auth.users (not profiles)
 * so it never advances updated_at. Both must WIPE this cache (bustUserCache({wipe:
 * true})) to force a cold refetch. Every other mutation does a cheap delta-since-
 * hwm revalidate. Dev-only single-actor console, so cross-device delete staleness
 * between wipes is acceptable (same posture as feature_vote_cycles).
 */
interface AdminUserDelta extends AdminUser {
  updated_at: string
}

// `:v2` bump (2026-06-26): admin_list_users gained the sub_cluster_id column.
// Delta caches don't re-pull a row whose updated_at hasn't advanced, so an
// existing base persisted before the column existed would serve rows missing
// sub_cluster_id forever (roster/tree sub-unit grouping silently falls back to
// HQ). Changing the key orphans the old base and forces one cold full read.
const USER_CACHE_KEY = 'user:all:v2'

const userCacheCfg: DeltaCacheConfig<AdminUser, AdminUserDelta> = {
  key: USER_CACHE_KEY,
  loadBase: async (key) => {
    const e = await getAdminCache(key)
    if (!e) return null
    return { rows: e.rows as AdminUser[], hwm: e.hwm, stale: Date.now() - e.ts > ADMIN_CACHE_TTL_MS }
  },
  saveBase: (key, rows, hwm) => putAdminCache(key, rows, hwm),
  fetchDelta: async (since) => {
    // p_since was added by the admin_list_users_since_delta migration; cast the
    // args until database.types.ts is regenerated.
    const { data, error } = await supabase.rpc(
      'admin_list_users',
      (since ? { p_since: since } : {}) as never,
    )
    if (error) throw error
    const validated = validateRpcArray<AdminUserDelta>(data, ['id', 'email'], 'listAllUsers')
    if (!validated.ok) {
      logger.error('listAllUsers validation failed:', validated.error)
      throw new Error(validated.error ?? 'listAllUsers validation failed')
    }
    return validated.data.map(u => ({
      ...u,
      supervisor_created: u.supervisor_created ?? false,
      surrogate_clinic_id: u.surrogate_clinic_id ?? null,
      surrogate_clinic_name: u.surrogate_clinic_name ?? null,
    }))
  },
  // Strip the delta cursor; AdminUser doesn't carry updated_at.
  toRow: ({ updated_at, ...row }) => row,
  memTtlMs: ADMIN_CACHE_TTL_MS,
  // A background revalidate that picked up another device's (or our own deferred,
  // now-flushed) write bumps the 'users' gen so an open admin list re-reads it.
  onRevalidated: () => useInvalidationStore.getState().invalidate('users'),
}

/**
 * Bust the admin user cache after a mutation. `wipe` forces a cold refetch — use
 * it for a hard delete or an auth.users-only change (email) that can't ride the
 * updated_at delta. Otherwise a cheap delta-since-hwm revalidate that pulls only
 * the touched row. Returns a promise the caller may await before re-listing.
 */
export function bustUserCache(opts?: { wipe?: boolean }): Promise<unknown> {
  if (opts?.wipe) {
    invalidateDeltaCache(USER_CACHE_KEY)
    return clearAdminCache(USER_CACHE_KEY)
  }
  return revalidateDeltaCache(userCacheCfg)
}

/** Match the RPC's `order by last_name, first_name nulls last` — deltaCache
 *  returns insertion order, so the public sort contract is restored here. */
function compareAdminUsers(a: AdminUser, b: AdminUser): number {
  // Empty/null names sort last (matches the RPC's `nulls last`).
  const cmp = (x: string | null, y: string | null) => {
    const xe = x == null || x === ''
    const ye = y == null || y === ''
    if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1
    return x.toLowerCase().localeCompare(y.toLowerCase())
  }
  const ln = cmp(a.last_name, b.last_name)
  return ln !== 0 ? ln : cmp(a.first_name, b.first_name)
}

/**
 * List all users (profiles + email). Dev only. Cache-first delta read; never
 * throws (deltaRead serves the stale base on network failure).
 */
export async function listAllUsers(): Promise<AdminUser[]> {
  const rows = await deltaRead(userCacheCfg)
  return [...rows].sort(compareAdminUsers)
}

/**
 * Create a new user directly (dev only).
 */
export async function createUser(userData: {
  email: string
  tempPassword: string
  firstName: string
  lastName: string
  middleInitial?: string
  credential?: string
  component?: string
  rank?: string
  uic?: string
  roles?: ('medic' | 'supervisor' | 'dev' | 'provider')[]
}): Promise<ServiceResult<{ userId?: string }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const createPwError = validatePasswordComplexity(userData.tempPassword)
    if (createPwError) return fail(createPwError)

    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: userData.email,
      p_temp_password: userData.tempPassword,
      p_first_name: userData.firstName,
      p_last_name: userData.lastName,
      p_middle_initial: userData.middleInitial || undefined,
      p_credential: userData.credential || undefined,
      p_component: userData.component || undefined,
      p_rank: userData.rank || undefined,
      p_uic: userData.uic || undefined,
      p_roles: userData.roles as ('medic' | 'supervisor' | 'dev' | 'provider')[] | undefined,
    })

    if (error) return fail(error.message)

    const validated = validateRpcResult<{ user_id: string; email: string; message: string }>(
      data, ['user_id'], 'createUser'
    )
    // New profile row (updated_at = now) flows in via the next delta.
    void bustUserCache()
    return succeed({ userId: validated.ok ? validated.data.user_id : undefined })
  } catch (error) {
    logger.error('Failed to create user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Reset a user's password (dev only).
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const resetPwError = validatePasswordComplexity(newPassword)
    if (resetPwError) return fail(resetPwError)

    const { error } = await supabase.rpc('admin_reset_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reset password:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Delete a user and all associated data (dev only).
 * Calls admin_delete_user RPC which removes notes, training
 * completions, sync queue entries, account requests, profile,
 * auth identity, and auth user. Prevents self-deletion.
 */
export async function deleteUser(
  userId: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    if (currentUser.id === userId) return fail('Cannot delete your own account')

    const { error } = await supabase.rpc('admin_delete_user', {
      p_target_user_id: userId,
    })

    if (error) return fail(error.message)
    // Hard delete — no archived_at to ride the delta, so wipe + cold refetch.
    await bustUserCache({ wipe: true })
    return succeed()
  } catch (error) {
    logger.error('Failed to delete user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Force-logout a user across all devices (dev only).
 * Invalidates all auth sessions and clears device registrations + Signal key bundles.
 * The user must re-authenticate and re-register on every device.
 */
export async function forceLogoutUser(
  userId: string
): Promise<ServiceResult<{ sessionsDeleted?: number; devicesDeleted?: number; bundlesDeleted?: number }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { data, error } = await supabase.rpc('admin_force_logout', {
      p_target_user_id: userId,
    })

    if (error) return fail(error.message)

    const result = data as { sessions_deleted?: number; devices_deleted?: number; bundles_deleted?: number } | null
    return succeed({
      sessionsDeleted: result?.sessions_deleted ?? 0,
      devicesDeleted: result?.devices_deleted ?? 0,
      bundlesDeleted: result?.bundles_deleted ?? 0,
    })
  } catch (error) {
    logger.error('Failed to force logout user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Clinic summary returned by listClinics.
 */
export interface AdminClinic {
  id: string
  name: string
  uics: string[]
  /** @deprecated — superseded by parent_clinic_id reverse lookup. Retained
   *  for one release while consumers migrate. New writes should use
   *  parent_clinic_id on the child row instead of mutating this array. */
  child_clinic_ids: string[]
  associated_clinic_ids: string[]
  location: string | null
  location_id: string | null
  /** Single-parent command tree. Null = root clinic. Edited admin-only. */
  parent_clinic_id: string | null
}

/**
 * Canonical installation/post taxonomy (public.locations).
 * Source of truth for the location picker; clinics reference rows via location_id.
 */
export interface AdminLocation {
  id: string
  country_code: string
  subdivision: string | null
  installation: string
  sub_area: string | null
  display_name: string
  timezone: string
  command: string | null
  lat: number | null
  lon: number | null
  parent_id: string | null
}

// The location taxonomy (~50–200 rows) is canonical, almost never changes, yet
// listLocations() runs on mount from ~7 surfaces (ClinicPanel, SupervisorDrawer,
// MapOverlayPanel, admin screens). It rides the generic deltaCache — the SAME
// egress discipline as users + clinics: a persisted base, then a DELTA keyed on
// updated_at so an idle revalidate transfers nothing. NIPR-safe (plain PostgREST,
// no storage-CDN). A cold device does ONE full fetch (the `since=null` fallback),
// then delta forever. No bundled seed — there is no committed artifact to go
// stale (the prior build-time encrypted seed + scripts/build-locations-seed.mjs
// are gone; staleness self-heals on first online read).
const LOCATION_COLUMNS = 'id, country_code, subdivision, installation, sub_area, display_name, timezone, command, lat, lon, parent_id'

/** Background-revalidate TTL for the persisted base. Aligned with the rest of the
 *  admin drawer (ADMIN_CACHE_TTL_MS) so locations revalidate on cold start exactly
 *  like users/clinics — a stale persisted base (and a warm-memory read past the
 *  window, via memTtlMs below) kicks a background delta. */
const LOCATIONS_TTL_MS = ADMIN_CACHE_TTL_MS

/** A delta row carries the soft-delete + cursor fields the picker shape omits. */
interface LocationDeltaRow extends AdminLocation { archived_at: string | null; updated_at: string }

/** Rows changed since `since`. When `since` is null this is the cold fallback —
 *  full live set only. When set, archived rows MUST come through so deltaCache
 *  can drop a freshly-archived location from every reader's base. */
async function fetchLocationsDelta(since: string | null): Promise<LocationDeltaRow[]> {
  let q = supabase.from('locations').select(`${LOCATION_COLUMNS}, archived_at, updated_at`).order('updated_at')
  q = since ? q.gt('updated_at', since) : q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as LocationDeltaRow[]
}

// Generic deltaCache config for the locations taxonomy — mirrors userCacheCfg /
// clinicCacheCfg. localStorage-backed (small set, no PHI); fresh `adtmc_locations_v3`
// prefix so the retired bespoke v2 cache (different key) is ignored, not migrated.
const LOCATION_CACHE_KEY = 'location:all'
const locationsPersistence = localStorageBase<AdminLocation>('adtmc_locations_v3', LOCATIONS_TTL_MS)
const locationCacheCfg: DeltaCacheConfig<AdminLocation, LocationDeltaRow> = {
  key: LOCATION_CACHE_KEY,
  loadBase: locationsPersistence.loadBase,
  saveBase: locationsPersistence.saveBase,
  fetchDelta: fetchLocationsDelta,
  // Strip the delta cursor + tombstone; AdminLocation carries neither.
  toRow: ({ archived_at, updated_at, ...row }) => row,
  // Same SWR posture as users/clinics — a warm-memory read past the window kicks
  // a background delta so a session that's already loaded locations still catches
  // another device's writes.
  memTtlMs: ADMIN_CACHE_TTL_MS,
  onRevalidated: () => useInvalidationStore.getState().invalidate('locations'),
}

/** Reconcile after a dev location mutation. The delta-since-hwm returns exactly
 *  the row just written (or the archive tombstone), so the EDITING device sees its
 *  change immediately. Cheap — a delta, not a cold refetch. */
function commitLocationsMutation(): Promise<AdminLocation[]> {
  return revalidateDeltaCache(locationCacheCfg)
}

/**
 * List all non-archived locations. Authenticated; small set (~50–200 rows).
 * Cache-first delta read (memory → persisted → cold full fetch); never throws
 * (deltaRead serves the stale base on network failure).
 */
export async function listLocations(): Promise<AdminLocation[]> {
  return deltaRead(locationCacheCfg)
}

/**
 * Create a location (dev only — RLS-gated). Parent is optional; cycle
 * prevention is enforced by the locations_no_cycle trigger.
 */
export async function createLocation(data: {
  country_code: string
  subdivision?: string | null
  installation: string
  sub_area?: string | null
  display_name: string
  /** Optional — auto-filled from device IANA tz on the writer. Column retained
   *  NOT NULL for now but unused at read time (clients render in device tz). */
  timezone?: string
  command?: string | null
  lat?: number | null
  lon?: number | null
  parent_id?: string | null
}): Promise<ServiceResult<{ id: string }>> {
  try {
    const tz = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const { data: result, error } = await supabase
      .from('locations')
      .insert({
        country_code: data.country_code,
        subdivision: data.subdivision ?? null,
        installation: data.installation,
        sub_area: data.sub_area ?? null,
        display_name: data.display_name,
        timezone: tz,
        command: data.command ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        parent_id: data.parent_id ?? null,
      })
      .select('id')
      .single()
    if (error) return fail(error.message)
    await commitLocationsMutation()
    return succeed({ id: result.id })
  } catch (error) {
    logger.error('Failed to create location:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Update a location (dev only). Pass parent_id: null to detach.
 * Cycle prevention enforced by the locations_no_cycle trigger.
 */
export async function updateLocation(
  id: string,
  updates: {
    country_code?: string
    subdivision?: string | null
    installation?: string
    sub_area?: string | null
    display_name?: string
    timezone?: string
    command?: string | null
    lat?: number | null
    lon?: number | null
    parent_id?: string | null
  }
): Promise<ServiceResult<Record<string, never>>> {
  try {
    const { error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', id)
    if (error) return fail(error.message)
    await commitLocationsMutation()
    return succeed({})
  } catch (error) {
    logger.error('Failed to update location:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Archive a location (soft-delete — locations are never hard-deleted because
 * clinics.location_id FK is ON DELETE RESTRICT). Sets archived_at = now().
 */
export async function archiveLocation(id: string): Promise<ServiceResult<Record<string, never>>> {
  try {
    const { error } = await supabase
      .from('locations')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return fail(error.message)
    await commitLocationsMutation()
    return succeed({})
  } catch (error) {
    logger.error('Failed to archive location:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Cache decrypted clinic locations keyed by the tuple that uniquely identifies
 * the ciphertext: clinic id + encryption key + ciphertext. If any of those
 * change (rotation, re-encrypt, location update), the cache naturally misses.
 */
const locationDecryptCache = new Map<string, string | null>()

/**
 * Admin clinic list — tier-2 deltaCache. Same egress discipline as listAllUsers,
 * but the persisted base lives in localStorage (clinic rows are small — no blob).
 * Cold read pulls the full live set once; reloads pull only clinics whose
 * `updated_at` advanced (the trg_clinics_updated_at trigger bumps it, and the
 * reciprocal-association sync bumps each touched peer's row too).
 *
 * The persisted base stores the DECRYPTED location string (operational, non-PHI)
 * and NEVER the encryption_key — decryption happens inside fetchDelta.
 *
 * HARD-DELETE caveat: clinics has no archived_at, so deleteClinic WIPES the cache
 * (bustClinicCache({wipe:true})). Create/update do a cheap revalidate.
 */
interface ClinicDeltaRow extends AdminClinic {
  updated_at: string
}

const CLINIC_CACHE_KEY = 'clinic:all'
const clinicBase = localStorageBase<AdminClinic>('beacon.admincache', ADMIN_CACHE_TTL_MS)

const clinicCacheCfg: DeltaCacheConfig<AdminClinic, ClinicDeltaRow> = {
  key: CLINIC_CACHE_KEY,
  loadBase: clinicBase.loadBase,
  saveBase: clinicBase.saveBase,
  fetchDelta: async (since) => {
    let q = supabase
      .from('clinics')
      .select('id, name, uics, child_clinic_ids, associated_clinic_ids, location, location_id, parent_clinic_id, encryption_key, updated_at')
      .order('updated_at')
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) throw error

    // Decrypt location fields using each clinic's own encryption key (memoized).
    return Promise.all(
      (data || []).map(async (row) => {
        let location: string | null = row.location
        if (row.encryption_key && row.location) {
          const cacheKey = `${row.id}:${row.encryption_key}:${row.location}`
          const cached = locationDecryptCache.get(cacheKey)
          if (cached !== undefined) {
            location = cached
          } else {
            location = await decryptWithRawKey(row.encryption_key, row.location)
            locationDecryptCache.set(cacheKey, location)
          }
        }
        return {
          id: row.id,
          name: row.name,
          uics: row.uics || [],
          child_clinic_ids: row.child_clinic_ids || [],
          associated_clinic_ids: row.associated_clinic_ids || [],
          location,
          location_id: row.location_id ?? null,
          parent_clinic_id: row.parent_clinic_id ?? null,
          updated_at: row.updated_at as string,
        }
      })
    )
  },
  // Strip the delta cursor (also drops encryption_key — never persisted).
  toRow: ({ updated_at, ...row }) => row,
  memTtlMs: ADMIN_CACHE_TTL_MS,
  onRevalidated: () => useInvalidationStore.getState().invalidate('clinics'),
}

/**
 * Bust the admin clinic cache after a mutation. `wipe` forces a cold refetch
 * (hard delete); otherwise a cheap delta-since-hwm revalidate. Returns a promise
 * the caller may await before re-listing (createClinic does, to find the new row).
 */
export function bustClinicCache(opts?: { wipe?: boolean }): Promise<unknown> {
  if (opts?.wipe) {
    invalidateDeltaCache(CLINIC_CACHE_KEY)
    clinicBase.clearBase(CLINIC_CACHE_KEY)
    return Promise.resolve()
  }
  return revalidateDeltaCache(clinicCacheCfg)
}

/**
 * List all clinics. Dev only. Cache-first delta read; never throws. Sorted by
 * name to preserve the public contract (deltaCache returns insertion order).
 */
export async function listClinics(): Promise<AdminClinic[]> {
  const rows = await deltaRead(clinicCacheCfg)
  return [...rows].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Create a new clinic (dev only).
 *
 * The clinic row is created first. Vault provisioning and reciprocal
 * association sync happen afterward — if either fails, the clinic still
 * exists, so we return the failures as `warnings` rather than failing the
 * whole operation. The UI should surface these to the admin.
 */
export async function createClinic(data: {
  name: string
  location?: string
  location_id?: string | null
  uics?: string[]
  child_clinic_ids?: string[]
  associated_clinic_ids?: string[]
  parent_clinic_id?: string | null
}): Promise<ServiceResult<{ id?: string; warnings?: string[] }>> {
  try {
    const rawKey = generateClinicKeyBase64()
    const encryptedLocation = data.location
      ? await encryptWithRawKey(rawKey, data.location)
      : null

    // Auto-associate with existing clinics that share the same canonical location.
    // Legacy clinics without location_id don't participate until backfilled.
    const seedAssociated = new Set(data.associated_clinic_ids || [])
    if (data.location_id) {
      const { data: sameLocation, error: locError } = await supabase
        .from('clinics')
        .select('id')
        .eq('location_id', data.location_id)
      if (locError) {
        logger.error('Failed to query same-location clinics for auto-association:', locError.message)
      } else {
        for (const row of sameLocation || []) seedAssociated.add(row.id)
      }
    }
    const initialAssociated = [...seedAssociated]

    const { data: result, error } = await supabase
      .from('clinics')
      .insert({
        name: data.name,
        location: encryptedLocation,
        location_id: data.location_id ?? null,
        uics: data.uics || [],
        child_clinic_ids: data.child_clinic_ids || [],
        associated_clinic_ids: initialAssociated,
        parent_clinic_id: data.parent_clinic_id ?? null,
        encryption_key: rawKey,
        vault_chain_key: rawKey,
        vault_iteration: 0,
      })
      .select('id')
      .single()

    if (error) return fail(error.message)

    const newId = result.id
    const warnings: string[] = []

    // Provision clinic vault device immediately so the encryption identity
    // exists from creation — not deferred until first member login.
    if (newId) {
      const vaultResult = await provisionClinicVaultAsAdmin(newId, rawKey)
      if (!vaultResult.ok) {
        logger.error('Clinic created but vault provisioning failed:', vaultResult.error)
        warnings.push('Vault provisioning failed — messaging for this clinic may not work until retried')
      }
    }

    // Reciprocal: add new clinic to each associated clinic's array
    if (newId && initialAssociated.length > 0) {
      const syncFailures = await syncAssociatedClinics(newId, [], initialAssociated)
      if (syncFailures.length > 0) {
        warnings.push(`Peer clinic sync failed for ${syncFailures.length} clinic(s)`)
      }
    }

    // Await the revalidate so a caller that re-lists (handleClinicCreated) finds
    // the new row. The new clinic + any bumped peers ride the delta-since-hwm.
    await bustClinicCache()

    return succeed({ id: newId, warnings: warnings.length > 0 ? warnings : undefined })
  } catch (error) {
    logger.error('Failed to create clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Check whether a clinic has its vault rows provisioned. Returns false if
 * vault_device_keys row is missing — the rescue UI uses this to decide
 * whether to surface the "Provision vault" action.
 */
export async function clinicHasVault(clinicId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('vault_device_keys')
    .select('user_id')
    .eq('user_id', clinicId)
    .maybeSingle()
  if (error) {
    logger.error('clinicHasVault check failed:', error.message)
    return true
  }
  return !!data
}

/**
 * Admin rescue: provision the vault for an existing clinic that is missing
 * its vault rows. Fetches the clinic's encryption_key, generates fresh
 * X3DH material client-side, and submits via admin_provision_clinic_vault.
 */
export async function rescueClinicVault(
  clinicId: string,
): Promise<ServiceResult<void>> {
  try {
    const { data: row, error } = await supabase
      .from('clinics')
      .select('encryption_key')
      .eq('id', clinicId)
      .single()
    if (error || !row?.encryption_key) {
      return fail(error?.message || 'Clinic encryption key not found')
    }
    const result = await provisionClinicVaultAsAdmin(clinicId, row.encryption_key)
    if (!result.ok) return fail(result.error)
    return succeed(undefined)
  } catch (error) {
    logger.error('rescueClinicVault failed:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Admin rescue: re-batch associated_clinic_ids for every clinic at a given
 * location. Forces the full peer set to be mutually associated. Dev-only,
 * gated server-side in the RPC. Returns the number of clinics touched.
 */
export async function rescueClinicAssociationsByLocation(
  locationId: string,
): Promise<ServiceResult<{ touched: number }>> {
  try {
    const { data, error } = await supabase.rpc('admin_rescue_clinic_associations_by_location', {
      p_location_id: locationId,
    })
    if (error) return fail(error.message)
    return succeed({ touched: (data as number | null) ?? 0 })
  } catch (error) {
    logger.error('rescueClinicAssociationsByLocation failed:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Sync associated_clinic_ids reciprocally.
 * Adds `clinicId` to every clinic in `added`, removes it from every clinic in `removed`.
 * Returns a list of peer clinic ids that failed — empty if everything succeeded.
 */
async function syncAssociatedClinics(clinicId: string, removed: string[], added: string[]): Promise<string[]> {
  const failures: string[] = []

  // Disassociate via RPC (bi-directional, audited, marks invites as revoked)
  for (const peerId of removed) {
    const { error } = await supabase.rpc('disassociate_clinic', {
      p_clinic_id: clinicId,
      p_peer_clinic_id: peerId,
    })
    if (error) {
      logger.error(`disassociate_clinic failed for peer ${peerId}:`, error.message)
      failures.push(peerId)
    }
  }

  // Add this clinic to newly associated clinics
  for (const peerId of added) {
    const { data: peer, error: fetchError } = await supabase
      .from('clinics')
      .select('associated_clinic_ids')
      .eq('id', peerId)
      .single()
    if (fetchError || !peer) {
      logger.error(`peer clinic ${peerId} fetch failed:`, fetchError?.message)
      failures.push(peerId)
      continue
    }
    const existing: string[] = peer.associated_clinic_ids || []
    if (!existing.includes(clinicId)) {
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ associated_clinic_ids: [...existing, clinicId] })
        .eq('id', peerId)
      if (updateError) {
        logger.error(`peer clinic ${peerId} update failed:`, updateError.message)
        failures.push(peerId)
      }
    }
  }

  return failures
}

/**
 * Update an existing clinic (dev only).
 */
export async function updateClinic(
  id: string,
  updates: {
    name?: string
    location?: string | null
    location_id?: string | null
    uics?: string[]
    child_clinic_ids?: string[]
    associated_clinic_ids?: string[]
    parent_clinic_id?: string | null
  }
): Promise<ServiceResult<{ warnings?: string[] }>> {
  try {
    // Encrypt legacy free-text location if it's being updated (location_id is plain).
    const payload: Record<string, unknown> = { ...updates }
    if (updates.location !== undefined && updates.location !== null) {
      payload.location = await encryptClinicField(id, updates.location)
    }

    const warnings: string[] = []

    // Reciprocal sync: diff old vs new associated_clinic_ids
    if (updates.associated_clinic_ids !== undefined) {
      const { data: current } = await supabase
        .from('clinics')
        .select('associated_clinic_ids')
        .eq('id', id)
        .single()
      const oldIds: string[] = current?.associated_clinic_ids || []
      const newIds = updates.associated_clinic_ids
      const added = newIds.filter(cid => !oldIds.includes(cid))
      const removed = oldIds.filter(cid => !newIds.includes(cid))
      const syncFailures = await syncAssociatedClinics(id, removed, added)
      if (syncFailures.length > 0) {
        warnings.push(`Peer clinic sync failed for ${syncFailures.length} clinic(s)`)
      }
    }

    const { error } = await supabase
      .from('clinics')
      .update(payload)
      .eq('id', id)

    if (error) return fail(error.message)
    // Edited clinic + any reciprocal peers ride the delta (each bumps updated_at).
    await bustClinicCache()
    return succeed({ warnings: warnings.length > 0 ? warnings : undefined })
  } catch (error) {
    logger.error('Failed to update clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Delete a clinic (dev only).
 */
export async function deleteClinic(
  id: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('clinics')
      .delete()
      .eq('id', id)

    if (error) return fail(error.message)
    // Hard delete — no archived_at to ride the delta, so wipe + cold refetch.
    await bustClinicCache({ wipe: true })
    return succeed()
  } catch (error) {
    logger.error('Failed to delete clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Set a user's clinic assignment (dev only).
 * Pass null to clear the clinic.
 *
 * Uses the admin_set_clinic RPC function which verifies the
 * caller has dev role and validates the clinic exists.
 */
export async function setUserClinic(
  userId: string,
  clinicId: string | null
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('admin_set_clinic', {
      p_target_user_id: userId,
      p_clinic_id: clinicId,
    })

    if (error) return fail(error.message)
    // clinic_id change bumps profiles.updated_at (+ clears surrogate via trigger).
    void bustUserCache()
    return succeed()
  } catch (error) {
    logger.error('Failed to set user clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Replace a user's entire active loan set atomically (dev-only).
 *
 * Admin paths edit by clinic id, so they can't go through the supervisor RPCs
 * that require an invite code. The server reconciles rows in one transaction
 * and refuses to loan the soldier to their own home clinic.
 */
export async function setUserLoans(
  userId: string,
  clinicIds: string[],
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('admin_set_user_loans', {
      p_user_id: userId,
      p_clinic_ids: clinicIds,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to set user loans:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * List all loan rows relevant to a clinic (dev only). Returns 'in' rows
 * (loans pointing at this clinic) and 'out' rows (loans for users whose
 * home is this clinic). Bypasses the profile_clinic_loans RLS scope which
 * would otherwise hide rows for clinics outside the dev's own membership.
 */
export async function listClinicLoans(
  clinicId: string,
): Promise<{ inUserIds: string[]; outMap: Map<string, string[]> }> {
  try {
    const { data, error } = await supabase.rpc('admin_list_clinic_loans', {
      p_clinic_id: clinicId,
    })
    if (error) {
      logger.error('listClinicLoans failed:', error.message)
      return { inUserIds: [], outMap: new Map() }
    }
    const rows = (data ?? []) as { user_id: string; clinic_id: string; direction: 'in' | 'out' }[]
    const inUserIds: string[] = []
    const outMap = new Map<string, string[]>()
    for (const r of rows) {
      if (r.direction === 'in') {
        inUserIds.push(r.user_id)
      } else {
        const arr = outMap.get(r.user_id) ?? []
        arr.push(r.clinic_id)
        outMap.set(r.user_id, arr)
      }
    }
    return { inUserIds, outMap }
  } catch (error) {
    logger.error('listClinicLoans threw:', error)
    return { inUserIds: [], outMap: new Map() }
  }
}

/**
 * Read a single user's loan clinic_ids (dev only). Bypasses
 * profile_clinic_loans RLS so the admin user editor sees current loans
 * regardless of whether the caller shares a clinic with the target.
 */
export async function listUserLoans(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_user_loans', {
      p_user_id: userId,
    })
    if (error) {
      logger.error('listUserLoans failed:', error.message)
      return []
    }
    return ((data ?? []) as { clinic_id: string }[]).map(r => r.clinic_id)
  } catch (error) {
    logger.error('listUserLoans threw:', error)
    return []
  }
}

/**
 * Update a user's profile fields (dev only).
 */
export async function updateUserProfile(
  userId: string,
  profileData: {
    firstName?: string
    lastName?: string
    middleInitial?: string
    credential?: string
    component?: string
    rank?: string
    uic?: string
  }
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('update_user_profile', {
      p_target_user_id: userId,
      p_as_role: 'dev',
      p_first_name: profileData.firstName || undefined,
      p_last_name: profileData.lastName || undefined,
      p_middle_initial: profileData.middleInitial ?? undefined,
      p_credential: profileData.credential ?? undefined,
      p_component: profileData.component ?? undefined,
      p_rank: profileData.rank ?? undefined,
      p_uic: profileData.uic || undefined,
    })

    if (error) return fail(error.message)
    void bustUserCache()
    return succeed()
  } catch (error) {
    logger.error('Failed to update profile:', error)
    return fail(getErrorMessage(error))
  }
}

/** Loose client-side email shape check — server re-validates authoritatively. */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

/**
 * Update an existing user's login email. Dev only.
 * Email lives in auth.users + auth.identities (not profiles), so this goes
 * through the admin_update_user_email RPC which updates both and preserves
 * the confirmed state. The user keeps their password and logs in with the
 * corrected address.
 */
export async function updateUserEmail(
  userId: string,
  email: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('admin_update_user_email', {
      target_user_id: userId,
      new_email: email,
    })

    if (error) return fail(error.message)
    // Email lives in auth.users, NOT profiles — it never advances updated_at, so
    // the delta can't carry it. Wipe to force a cold refetch with the new email.
    await bustUserCache({ wipe: true })
    return succeed()
  } catch (error) {
    logger.error('Failed to update user email:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Correct a pending account request's email before approval — the earliest
 * point a typo can be caught, before any auth account is created. Dev has
 * UPDATE RLS on account_requests (same path as reopenAccountRequest).
 */
export async function updateAccountRequestEmail(
  requestId: string,
  email: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('account_requests')
      .update({ email: email.trim().toLowerCase() })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update request email:', error)
    return fail(getErrorMessage(error))
  }
}
