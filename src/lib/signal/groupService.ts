/**
 * Group messaging CRUD via Supabase RPCs.
 *
 * All functions return Result<T> and never throw.
 */

import { supabase } from '../supabase'
import { callRpc, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type { GroupInfo, GroupMember } from './groupTypes'

const logger = createLogger('GroupService')

export async function createGroup(params: {
  name: string
  memberIds: string[]
}): Promise<Result<{ groupId: string; name: string }>> {
  return callRpc<{ groupId: string; name: string }>(
    () => supabase.rpc('create_message_group', {
      p_name: params.name,
      p_member_ids: params.memberIds,
    }),
    'createGroup', logger,
  )
}

export async function fetchMyGroups(): Promise<Result<GroupInfo[]>> {
  return callRpc<GroupInfo[]>(
    () => supabase.rpc('fetch_my_groups'),
    'fetchMyGroups', logger, [],
  )
}

export async function fetchGroupMembers(groupId: string): Promise<Result<GroupMember[]>> {
  return callRpc<GroupMember[]>(
    () => supabase.rpc('fetch_group_members', { p_group_id: groupId }),
    'fetchGroupMembers', logger, [],
  )
}

export async function renameGroup(groupId: string, name: string): Promise<Result<void>> {
  return callRpc(
    () => supabase.rpc('rename_message_group', { p_group_id: groupId, p_name: name }),
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
