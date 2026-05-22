/**
 * System message service — dev-only RPC wrappers + addressing helpers
 * for the `messageType='system'` carrier.
 *
 * The encryption + fan-out path lives in useMessages.ts (sendSystemMessageToUser /
 * sendSystemMessageToClinic) — this file just owns the RPC surface that resolves
 * a clinic-scoped system group on demand.
 *
 * Server gate: signal_messages_system_gate trigger requires is_dev() +
 * sender_id NOT NULL on any insert with message_type='system'. See migration
 * 20260522_signal_system_messages.sql.
 */

import { supabase } from './supabase'
import { callRpc, type Result } from './result'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('SystemMessageService')

export interface ClinicSystemGroupResult {
  groupId: string
}

/**
 * Resolve (or create) the clinic-scoped system group. Dev-only.
 * Membership in v1: the calling dev as sole admin. Membership broadens later
 * (e.g. all clinic supervisors) without changing the RPC name.
 */
export async function getOrCreateClinicSystemGroup(
  clinicId: string,
): Promise<Result<ClinicSystemGroupResult>> {
  return callRpc<ClinicSystemGroupResult>(
    () => supabase.rpc('get_or_create_clinic_system_group', { p_clinic_id: clinicId }),
    'getOrCreateClinicSystemGroup', logger,
  )
}
