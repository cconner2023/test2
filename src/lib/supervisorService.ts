import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import { validateRpcResult } from './validators'
import { validatePasswordComplexity } from './constants'
import { encryptWithRawKey, decryptWithRawKey } from './cryptoService'
import type { TextExpander, PlanOrderTags, PlanOrderSet } from '../Data/User'
import type { CategoryColorMap } from '../Types/CalendarTypes'
import type { Json } from '../Types/database.types.generated'

const logger = createLogger('SupervisorService')

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SupervisorClinic {
  id: string
  name: string
  uics: string[]
  location: string | null
}

export interface ClinicMember {
  id: string
  first_name: string | null
  last_name: string | null
  middle_initial: string | null
  rank: string | null
  credential: string | null
  uic: string | null
  avatar_id: string | null
  email: string
}

interface ClinicRow {
  id: string
  name: string
  uics: string[]
  location: string | null
  encryption_key: string | null
}

// ─── Get My Clinics ────────────────────────────────────────────────────────

export async function getSupervisorClinics(): Promise<ServiceResult<{ clinics: SupervisorClinic[] }>> {
  try {
    const { data, error } = await supabase.rpc('supervisor_get_my_clinics')
    if (error) return fail(error.message)

    const rows = (data as ClinicRow[] | null) ?? []

    const clinics = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        uics: row.uics || [],
        location: row.encryption_key
          ? await decryptWithRawKey(row.encryption_key, row.location)
          : row.location,
      }))
    )

    return succeed({ clinics })
  } catch (error) {
    logger.error('Failed to get supervisor clinics:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic ─────────────────────────────────────────────────────────

export async function updateSupervisorClinic(
  clinicId: string,
  updates: { name?: string; location?: string | null; uics?: string[] },
  encryptionKey?: string | null
): Promise<ServiceResult> {
  try {
    let encryptedLocation: string | null | undefined
    if (updates.location !== undefined) {
      if (updates.location && encryptionKey) {
        encryptedLocation = await encryptWithRawKey(encryptionKey, updates.location)
      } else {
        encryptedLocation = updates.location
      }
    }

    const { error } = await supabase.rpc('supervisor_update_clinic', {
      p_clinic_id: clinicId,
      p_name: updates.name || null,
      p_location: encryptedLocation !== undefined ? encryptedLocation : null,
      p_uics: updates.uics || null,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── List Clinic Members ───────────────────────────────────────────────────

export async function listClinicMembers(
  clinicId: string
): Promise<ServiceResult<{ members: ClinicMember[] }>> {
  try {
    const { data, error } = await supabase.rpc('supervisor_list_clinic_members', {
      p_clinic_id: clinicId,
    })

    if (error) return fail(error.message)
    return succeed({ members: (data as ClinicMember[] | null) ?? [] })
  } catch (error) {
    logger.error('Failed to list clinic members:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Add Member ────────────────────────────────────────────────────────────

export async function addClinicMember(
  clinicId: string,
  userId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_add_member', {
      p_clinic_id: clinicId,
      p_user_id: userId,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to add clinic member:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Remove Member ─────────────────────────────────────────────────────────

export async function removeClinicMember(
  clinicId: string,
  userId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_remove_member', {
      p_clinic_id: clinicId,
      p_user_id: userId,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to remove clinic member:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Find User by Email ────────────────────────────────────────────────────

export interface UserLookupResult {
  found: boolean
  user_id?: string
  first_name?: string | null
  last_name?: string | null
  rank?: string | null
  credential?: string | null
  clinic_id?: string | null
}

export async function findUserByEmail(
  email: string
): Promise<ServiceResult<UserLookupResult>> {
  try {
    const { data, error } = await supabase.rpc('supervisor_find_user_by_email', {
      p_email: email,
    })

    if (error) return fail(error.message)
    return succeed(data as UserLookupResult)
  } catch (error) {
    logger.error('Failed to find user by email:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Create User ───────────────────────────────────────────────────────────

export async function createClinicUser(userData: {
  clinicId: string
  email: string
  tempPassword: string
  firstName: string
  lastName: string
  middleInitial?: string
  credential?: string
  component?: string
  rank?: string
  uic?: string
  roles?: ('medic' | 'supervisor' | 'provider')[]
}): Promise<ServiceResult<{ userId?: string }>> {
  try {
    const pwError = validatePasswordComplexity(userData.tempPassword)
    if (pwError) return fail(pwError)

    const { data, error } = await supabase.rpc('supervisor_create_user', {
      p_clinic_id: userData.clinicId,
      p_email: userData.email,
      p_temp_password: userData.tempPassword,
      p_first_name: userData.firstName,
      p_last_name: userData.lastName,
      p_middle_initial: userData.middleInitial || undefined,
      p_credential: userData.credential || undefined,
      p_component: userData.component || undefined,
      p_rank: userData.rank || undefined,
      p_uic: userData.uic || undefined,
      p_roles: userData.roles ?? ['medic'],
    })

    if (error) return fail(error.message)

    const validated = validateRpcResult<{ user_id: string; email: string; message: string }>(
      data, ['user_id'], 'supervisorCreateUser'
    )
    return succeed({ userId: validated.ok ? validated.data.user_id : undefined })
  } catch (error) {
    logger.error('Failed to create user:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Reset Member Password ────────────────────────────────────────────────

export async function supervisorResetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ServiceResult> {
  try {
    const pwError = validatePasswordComplexity(newPassword)
    if (pwError) return fail(pwError)

    const { error } = await supabase.rpc('supervisor_reset_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reset member password:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Disassociate Clinic ──────────────────────────────────────────────────

export async function disassociateClinic(
  clinicId: string,
  peerClinicId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('disassociate_clinic', {
      p_clinic_id: clinicId,
      p_peer_clinic_id: peerClinicId,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to disassociate clinic:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Get Clinic Encryption Key ─────────────────────────────────────────────

export async function getClinicEncryptionKey(
  clinicId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('clinics')
      .select('encryption_key')
      .eq('id', clinicId)
      .single()
    return data?.encryption_key ?? null
  } catch {
    return null
  }
}

// ─── Get Clinic Details (UICs + decrypted location) ───────────────────────

export interface ClinicDetails {
  name: string | null
  uics: string[]
  location: string | null
  location_id: string | null
  associatedClinicIds: string[]
  rooms: ClinicRoom[]
  huddleTasks: ClinicHuddleTask[]
}

export interface ClinicRoom {
  id: string
  name: string
  sort_order: number
}

/** Supervisor-defined huddle station (e.g. "Front Desk", "Triage"). Same shape as ClinicRoom. */
export interface ClinicHuddleTask {
  id: string
  name: string
  sort_order: number
}

/** Supervisor-defined provider appointment type (e.g. "20-min in-person"). Drives templated-slot generation. */
export interface ClinicAppointmentType {
  id: string
  name: string
  duration_min: number
  sort_order: number
}

/**
 * Supervisor-authored Pre-Combat Check template (e.g. "Pre-Mission PCC").
 * Stored on clinics.pre_combat_checks (jsonb). Attachable to any calendar event
 * via event.pcc; subtasks are snapshot-copied on attach (template-independent).
 */
export type PCCItem =
  | { id: string; kind: 'property_item';     ref: string; label_override?: string | null }
  | { id: string; kind: 'property_location'; ref: string }
  | { id: string; kind: 'task';              label: string }

export interface ClinicPreCombatCheck {
  id: string
  name: string
  sort_order: number
  items: PCCItem[]
}

export async function getClinicDetails(
  clinicId: string
): Promise<ClinicDetails> {
  try {
    const { data } = await supabase
      .from('clinics')
      .select('name, uics, location, location_id, encryption_key, associated_clinic_ids, rooms, huddle_tasks')
      .eq('id', clinicId)
      .single()

    if (!data) return { name: null, uics: [], location: null, location_id: null, associatedClinicIds: [], rooms: [], huddleTasks: [] }

    let location: string | null = data.location ?? null
    if (location && data.encryption_key) {
      try {
        location = await decryptWithRawKey(data.encryption_key, location)
      } catch {
        location = null
      }
    }

    return {
      name: data.name ?? null,
      uics: data.uics ?? [],
      location,
      location_id: (data as { location_id?: string | null }).location_id ?? null,
      associatedClinicIds: data.associated_clinic_ids ?? [],
      rooms: (data.rooms as ClinicRoom[]) ?? [],
      huddleTasks: ((data as { huddle_tasks?: ClinicHuddleTask[] }).huddle_tasks as ClinicHuddleTask[]) ?? [],
    }
  } catch {
    return { name: null, uics: [], location: null, location_id: null, associatedClinicIds: [], rooms: [], huddleTasks: [] }
  }
}

// ─── Update Clinic Location ID (dedicated RPC) ─────────────────────────────

export async function updateSupervisorClinicLocationId(
  clinicId: string,
  locationId: string | null,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_location_id', {
      p_clinic_id: clinicId,
      p_location_id: locationId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic location:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Rooms (dedicated RPC) ───────────────────────────────────

export async function updateSupervisorClinicRooms(
  clinicId: string,
  rooms: ClinicRoom[],
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_rooms', {
      p_clinic_id: clinicId,
      p_rooms: rooms,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic rooms:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Huddle Tasks (dedicated RPC) ────────────────────────────

export async function updateSupervisorClinicHuddleTasks(
  clinicId: string,
  tasks: ClinicHuddleTask[],
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_huddle_tasks', {
      p_clinic_id: clinicId,
      p_tasks: tasks,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic huddle tasks:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Pre-Combat Checks (dedicated RPC) ──────────────────────

export async function updateSupervisorClinicPreCombatChecks(
  clinicId: string,
  pcc: ClinicPreCombatCheck[],
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_pre_combat_checks', {
      p_clinic_id: clinicId,
      p_pcc: pcc,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic pre-combat checks:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Appointment Types (dedicated RPC) ───────────────────────

export async function updateSupervisorClinicAppointmentTypes(
  clinicId: string,
  types: ClinicAppointmentType[],
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_appointment_types', {
      p_clinic_id: clinicId,
      p_types: types,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic appointment types:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Calendar Category Colors (dedicated RPC) ────────────────

export async function updateSupervisorClinicCalendarColors(
  clinicId: string,
  colors: CategoryColorMap,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_calendar_colors', {
      p_clinic_id: clinicId,
      p_colors: colors as Json,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic calendar colors:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Get Member Profile (for inline editing) ─────────────────────────────

export interface MemberProfileData {
  firstName: string | null
  lastName: string | null
  middleInitial: string | null
  credential: string | null
  component: string | null
  rank: string | null
  uic: string | null
  roles: string[]
  homeClinicId?: string | null
  homeClinicName?: string | null
}

export async function getMemberProfile(
  userId: string
): Promise<ServiceResult<MemberProfileData>> {
  try {
    const { data, error } = await supabase.rpc('supervisor_get_member_profile', {
      p_user_id: userId,
    })

    if (error) return fail(error.message)
    if (!data) return fail('Profile not found')

    const row = data as {
      first_name: string | null
      last_name: string | null
      middle_initial: string | null
      credential: string | null
      component: string | null
      rank: string | null
      uic: string | null
      roles: string[] | null
      home_clinic_id?: string | null
      home_clinic_name?: string | null
    }

    return succeed({
      firstName: row.first_name,
      lastName: row.last_name,
      middleInitial: row.middle_initial,
      credential: row.credential,
      component: row.component,
      rank: row.rank,
      uic: row.uic,
      roles: row.roles ?? ['medic'],
      homeClinicId: row.home_clinic_id ?? null,
      homeClinicName: row.home_clinic_name ?? null,
    })
  } catch (error) {
    logger.error('Failed to get member profile:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Member Profile ────────────────────────────────────────────────

export async function updateMemberProfile(
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
    const { error } = await supabase.rpc('update_user_profile', {
      p_target_user_id: userId,
      p_as_role: 'supervisor',
      p_first_name: profileData.firstName || undefined,
      p_last_name: profileData.lastName || undefined,
      p_middle_initial: profileData.middleInitial ?? undefined,
      p_credential: profileData.credential ?? undefined,
      p_component: profileData.component ?? undefined,
      p_rank: profileData.rank ?? undefined,
      p_uic: profileData.uic || undefined,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update member profile:', error)
    return fail(getErrorMessage(error))
  }
}

export async function setMemberRoles(
  userId: string,
  roles: ('medic' | 'supervisor' | 'provider')[]
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: roles,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to set member roles:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Loan / Transfer / Remove Soldier ─────────────────────────────────────
//
// Three supervisor actions on a single soldier. Authorization on the server is
// either (a) supervisor of the relevant clinic, or (b) possession of the target
// clinic's invite code — mirroring how clinic-to-clinic association works.
//
// The migration adds three RPCs; this file defines the client contract.

/**
 * Loan a soldier to another clinic (sets `surrogate_clinic_id`).
 * Auth: supervisor of the soldier's home clinic, plus a valid invite code for
 * the target clinic (skipped server-side if the caller already supervises it).
 */
export async function loanSoldierToClinic(
  userId: string,
  targetClinicCode: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_loan_user', {
      p_user_id: userId,
      p_target_clinic_code: targetClinicCode.toUpperCase().trim(),
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to loan soldier:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Loan a soldier to a clinic that already has an accepted association with
 * the soldier's home clinic. Bypasses the invite-code requirement since the
 * two clinics are already linked. Use this for the multi-select Loans UI
 * when adding from the associated-clinics list.
 */
export async function loanSoldierToAssociatedClinic(
  userId: string,
  targetClinicId: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_loan_user_to_clinic', {
      p_user_id: userId,
      p_target_clinic_id: targetClinicId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to loan soldier (associated):', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Promote one of the soldier's existing loan clinics to be their home cluster.
 * Old home becomes a regular loan row; the rest of the loan set is preserved.
 * Auth: supervisor of the soldier's current home clinic; target must already
 * be an active loan (no new auth surface created).
 */
export async function setSoldierHomeClinic(
  userId: string,
  targetClinicId: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_set_home_clinic', {
      p_user_id: userId,
      p_target_clinic_id: targetClinicId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to set home clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Transfer a soldier to another clinic (moves `clinic_id`, clears any surrogate).
 * Auth: supervisor of the soldier's home clinic, plus a valid invite code for
 * the target clinic.
 */
export async function transferSoldierToClinic(
  userId: string,
  targetClinicCode: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_transfer_user', {
      p_user_id: userId,
      p_target_clinic_code: targetClinicCode.toUpperCase().trim(),
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to transfer soldier:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Recall a soldier from a single loan-target clinic. Auth: supervisor of either
 * the soldier's home clinic or the loan-target clinic (server-resolved).
 */
export async function endLoanFromClinic(
  userId: string,
  clinicId: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_end_loan_user', {
      p_user_id: userId,
      p_clinic_id: clinicId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to end loan:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Recall a soldier from every active loan in one call. Auth: supervisor of
 * the soldier's home clinic (loan-side callers should use endLoanFromClinic
 * per-clinic).
 */
export async function endAllLoans(
  userId: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_end_all_loans_user', {
      p_user_id: userId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to end all loans:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Context-aware removal:
 *  - soldier loaned out from caller's clinic → clears surrogate (recall).
 *  - soldier loaned into caller's clinic    → clears surrogate (end loan).
 *  - soldier in caller's clinic, no loan    → clears `clinic_id` (eject).
 * Server resolves which side the caller is on.
 */
export async function removeSoldierFromClinic(
  userId: string,
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_remove_user', {
      p_user_id: userId,
    })
    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to remove soldier:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Get Clinic Note Content ──────────────────────────────────────────────

export interface ClinicNoteContent {
  textExpanders: TextExpander[]
  planOrderTags: PlanOrderTags | null
  planInstructionTags: string[]
  planOrderSets: PlanOrderSet[]
}

export async function getClinicNoteContent(
  clinicId: string
): Promise<ServiceResult<ClinicNoteContent>> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('text_expanders, plan_order_tags, plan_instruction_tags, plan_order_sets')
      .eq('id', clinicId)
      .single()

    if (error) return fail(error.message)

    return succeed({
      textExpanders: (data?.text_expanders as TextExpander[] | null) ?? [],
      planOrderTags: (data?.plan_order_tags as PlanOrderTags | null) ?? null,
      planInstructionTags: (data?.plan_instruction_tags as string[] | null) ?? [],
      planOrderSets: (data?.plan_order_sets as PlanOrderSet[] | null) ?? [],
    })
  } catch (error) {
    logger.error('Failed to get clinic note content:', error)
    return fail(getErrorMessage(error))
  }
}

// ─── Update Clinic Note Content ───────────────────────────────────────────

export async function updateClinicNoteContent(
  clinicId: string,
  content: Partial<ClinicNoteContent>
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('supervisor_update_clinic_note_content', {
      p_clinic_id: clinicId,
      p_text_expanders: content.textExpanders !== undefined ? content.textExpanders : null,
      p_plan_order_tags: content.planOrderTags !== undefined ? content.planOrderTags : null,
      p_plan_instruction_tags: content.planInstructionTags !== undefined ? content.planInstructionTags : null,
      p_plan_order_sets: content.planOrderSets !== undefined ? content.planOrderSets : null,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic note content:', error)
    return fail(getErrorMessage(error))
  }
}
