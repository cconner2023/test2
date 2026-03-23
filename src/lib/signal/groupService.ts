/**
 * Group messaging CRUD via Supabase RPCs.
 *
 * All functions return Result<T> and never throw.
 */

import { supabase } from '../supabase'
import { callRpc, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type { GroupInfo, GroupMember } from './groupTypes'
import { encryptGroupName, decryptGroupName, generateGroupSecret, setGroupSecret } from './groupNameCrypto'

const logger = createLogger('GroupService')

export async function createGroup(params: {
  name: string
  memberIds: string[]
}): Promise<Result<{ groupId: string; name: string }>> {
  // Create with plaintext to obtain the server-assigned groupId, then immediately
  // overwrite with the per-group encrypted name so plaintext is transient in the DB.
  const result = await callRpc<{ groupId: string; name: string }>(
    () => supabase.rpc('create_message_group', {
      p_name: params.name,
      p_member_ids: params.memberIds,
    }),
    'createGroup', logger,
  )

  if (!result.ok) return result

  const { groupId } = result.data

  // Generate and persist a random group secret so name encryption is not
  // derivable from the public groupId. Distribution to other members will
  // piggyback on sender key distribution (future integration work).
  const secret = generateGroupSecret()
  await setGroupSecret(groupId, secret)

  const encryptedName = await encryptGroupName(groupId, params.name)
  await callRpc(
    () => supabase.rpc('rename_message_group', { p_group_id: groupId, p_name: encryptedName }),
    'createGroup:rename', logger,
  )

  return { ok: true, data: { groupId, name: params.name } }
}

export async function fetchMyGroups(): Promise<Result<GroupInfo[]>> {
  const result = await callRpc<GroupInfo[]>(
    () => supabase.rpc('fetch_my_groups'),
    'fetchMyGroups', logger, [],
  )
  if (!result.ok) return result
  const decrypted = await Promise.all(
    result.data.map(async (g) => ({
      ...g,
      name: await decryptGroupName(g.groupId, g.name),
    })),
  )
  return { ok: true, data: decrypted }
}

export async function fetchGroupMembers(groupId: string): Promise<Result<GroupMember[]>> {
  return callRpc<GroupMember[]>(
    () => supabase.rpc('fetch_group_members', { p_group_id: groupId }),
    'fetchGroupMembers', logger, [],
  )
}

export async function renameGroup(groupId: string, name: string): Promise<Result<void>> {
  const encryptedName = await encryptGroupName(groupId, name)
  return callRpc(
    () => supabase.rpc('rename_message_group', { p_group_id: groupId, p_name: encryptedName }),
    'renameGroup', logger,
  )
}

export async function leaveGroup(groupId: string): Promise<Result<void>> {
  return callRpc(
    () => supabase.rpc('leave_message_group', { p_group_id: groupId }),
    'leaveGroup', logger,
  )
}

export async function addGroupMember(groupId: string, userId: string): Promise<Result<void>> {
  return callRpc(
    () => supabase.rpc('add_group_member', { p_group_id: groupId, p_user_id: userId }),
    'addGroupMember', logger,
  )
}

export async function removeGroupMember(groupId: string, userId: string): Promise<Result<void>> {
  return callRpc(
    () => supabase.rpc('remove_group_member', { p_group_id: groupId, p_user_id: userId }),
    'removeGroupMember', logger,
  )
}

/**
 * Lazily get or create the system calendar group for a clinic.
 * Idempotent — concurrent calls return the same group_id.
 * Returns the group UUID on success.
 */
export async function getOrCreateClinicCalendarGroup(clinicId: string): Promise<Result<string>> {
  const result = await callRpc<{ groupId: string }>(
    () => supabase.rpc('get_or_create_clinic_calendar_group', { p_clinic_id: clinicId }),
    'getOrCreateClinicCalendarGroup', logger,
  )
  if (!result.ok) return result
  return { ok: true, data: result.data.groupId }
}
