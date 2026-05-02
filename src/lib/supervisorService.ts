import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import { validateRpcResult } from './validators'
import { validatePasswordComplexity } from './constants'
import { encryptWithRawKey, decryptWithRawKey } from './cryptoService'
import type { TextExpander, PlanOrderTags, PlanOrderSet } from '../Data/User'

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

export async function getClinicDetails(
  clinicId: string
): Promise<ClinicDetails> {
  try {
    const { data } = await supabase
      .from('clinics')
      .select('name, uics, location, encryption_key, associated_clinic_ids, rooms, huddle_tasks')
      .eq('id', clinicId)
      .single()

    if (!data) return { name: null, uics: [], location: null, associatedClinicIds: [], rooms: [], huddleTasks: [] }

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
      associatedClinicIds: data.associated_clinic_ids ?? [],
      rooms: (data.rooms as ClinicRoom[]) ?? [],
      huddleTasks: ((data as { huddle_tasks?: ClinicHuddleTask[] }).huddle_tasks as ClinicHuddleTask[]) ?? [],
    }
  } catch {
    return { name: null, uics: [], location: null, associatedClinicIds: [], rooms: [], huddleTasks: [] }
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
