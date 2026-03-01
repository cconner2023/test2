/**
 * Group messaging CRUD via Supabase RPCs.
 *
 * All functions return Result<T> and never throw.
 */

import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type { GroupInfo, GroupMember } from './groupTypes'

const logger = createLogger('GroupService')

export async function createGroup(params: {
  name: string
  memberIds: string[]
}): Promise<Result<{ groupId: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .rpc('create_message_group', {
        p_name: params.name,
        p_member_ids: params.memberIds,
      })

    if (error) {
      logger.error('createGroup RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(data as unknown as { groupId: string; name: string })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('createGroup exception:', msg)
    return err(msg)
  }
}

export async function fetchMyGroups(): Promise<Result<GroupInfo[]>> {
  try {
    const { data, error } = await supabase
      .rpc('fetch_my_groups')

    if (error) {
      logger.error('fetchMyGroups RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok((data ?? []) as unknown as GroupInfo[])
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchMyGroups exception:', msg)
    return err(msg)
  }
}

export async function fetchGroupMembers(groupId: string): Promise<Result<GroupMember[]>> {
  try {
    const { data, error } = await supabase
      .rpc('fetch_group_members', { p_group_id: groupId })

    if (error) {
      logger.error('fetchGroupMembers RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok((data ?? []) as unknown as GroupMember[])
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchGroupMembers exception:', msg)
    return err(msg)
  }
}

export async function renameGroup(groupId: string, name: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .rpc('rename_message_group', { p_group_id: groupId, p_name: name })

    if (error) {
      logger.error('renameGroup RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('renameGroup exception:', msg)
    return err(msg)
  }
}

export async function leaveGroup(groupId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .rpc('leave_message_group', { p_group_id: groupId })

    if (error) {
      logger.error('leaveGroup RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('leaveGroup exception:', msg)
    return err(msg)
  }
}

export async function addGroupMember(groupId: string, userId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .rpc('add_group_member', { p_group_id: groupId, p_user_id: userId })

    if (error) {
      logger.error('addGroupMember RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('addGroupMember exception:', msg)
    return err(msg)
  }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .rpc('remove_group_member', { p_group_id: groupId, p_user_id: userId })

    if (error) {
      logger.error('removeGroupMember RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('removeGroupMember exception:', msg)
    return err(msg)
  }
}
