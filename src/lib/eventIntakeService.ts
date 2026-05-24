/**
 * Event Intake Service
 *
 * Thin wrapper layer over the event-intake Supabase RPCs. Pure I/O — no
 * messaging-side fanout lives here. The `purge_intake` / `purge_clinic_intake_conversation`
 * RPCs return the `deleted_origin_ids` + `group_id` that callers need to
 * post the standard `messageType='delete'` envelope; the fanout itself
 * lives in `useEventIntakeMessaging` so it can reuse the messaging-side
 * encrypt + send primitives from useMessages.
 *
 * SECURITY: passphrase plaintext is returned ONLY by the generate paths of
 * `mintEventIntakeCredential` / `rotateEventIntakePassphrase`. Callers must
 * route it directly into the visible-once modal's local state and drop it
 * on dismiss — never into a store, never into a log.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { callRpc } from './result'
import type { Result } from './result'

const logger = createLogger('EventIntake')

// ─── Supervisor credential lifecycle ────────────────────────────

export interface MintResult {
  id: string
  passcode: string
  /** Present only when the server generated the passphrase. */
  passphrase?: string
  passphraseWasGenerated: boolean
}

export async function mintEventIntakeCredential(
  clinicId: string,
  opts: { passphrase?: string } = {},
): Promise<Result<MintResult>> {
  const res = await callRpc(
    () => supabase.rpc('mint_event_intake_credential', {
      p_clinic_id: clinicId,
      p_passphrase: opts.passphrase ?? null,
    }),
    'mint_event_intake_credential',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return {
    ok: true,
    data: {
      id: data.id as string,
      passcode: data.passcode as string,
      passphrase: data.passphrase as string | undefined,
      passphraseWasGenerated: data.passphrase_was_generated === true,
    },
  }
}

export async function rotateEventIntakePasscode(
  clinicId: string,
): Promise<Result<{ passcode: string }>> {
  const res = await callRpc(
    () => supabase.rpc('rotate_event_intake_passcode', { p_clinic_id: clinicId }),
    'rotate_event_intake_passcode',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return { ok: true, data: { passcode: data.passcode as string } }
}

export async function rotateEventIntakePassphrase(
  clinicId: string,
  opts: { passphrase?: string } = {},
): Promise<Result<{ passphrase?: string; passphraseWasGenerated: boolean }>> {
  const res = await callRpc(
    () => supabase.rpc('rotate_event_intake_passphrase', {
      p_clinic_id: clinicId,
      p_passphrase: opts.passphrase ?? null,
    }),
    'rotate_event_intake_passphrase',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return {
    ok: true,
    data: {
      passphrase: data.passphrase as string | undefined,
      passphraseWasGenerated: data.passphrase_was_generated === true,
    },
  }
}

export async function killEventIntakeCredential(
  clinicId: string,
): Promise<Result<void>> {
  return await callRpc(
    () => supabase.rpc('kill_event_intake_credential', { p_clinic_id: clinicId }),
    'kill_event_intake_credential',
    logger,
  )
}

export interface IntakeCredentialMetadata {
  id: string
  passcode: string
  passcode_rotated_at: string
  passphrase_rotated_at: string
  created_at: string
}

export async function getEventIntakeCredential(
  clinicId: string,
): Promise<Result<IntakeCredentialMetadata | null>> {
  const res = await callRpc(
    () => supabase.rpc('get_event_intake_credential', { p_clinic_id: clinicId }),
    'get_event_intake_credential',
    logger,
  )
  if (!res.ok) return res
  if (res.data === null || res.data === undefined) {
    return { ok: true, data: null }
  }
  return { ok: true, data: res.data as IntakeCredentialMetadata }
}

// ─── Anon submission surface (called by intake bundle only) ─────

export async function resolveEventIntakeCode(
  passcode: string,
): Promise<Result<{ clinicName: string }>> {
  const res = await callRpc(
    () => supabase.rpc('resolve_event_intake_code', { p_passcode: passcode }),
    'resolve_event_intake_code',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return { ok: true, data: { clinicName: data.clinic_name as string } }
}

export interface IntakeSubmitPayload {
  requester_name: string
  requester_org: string | null
  requester_email: string
  requested_start: string
  requested_end: string
  title: string
}

export async function submitEventIntake(
  passcode: string,
  passphrase: string,
  payload: IntakeSubmitPayload,
): Promise<Result<{ status: 'submitted' }>> {
  const res = await callRpc(
    () => supabase.rpc('submit_event_intake', {
      p_passcode: passcode,
      p_passphrase: passphrase,
      p_payload: payload,
    }),
    'submit_event_intake',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: { status: 'submitted' } }
}

// ─── Triage (supervisor surface) ────────────────────────────────

export interface MarkApprovedResult {
  clinic_id: string
  group_id: string
  approved_origin_id: string
}

export async function markEventIntakeApproved(
  intakeId: string,
  eventId: string,
): Promise<Result<MarkApprovedResult>> {
  const res = await callRpc(
    () => supabase.rpc('mark_event_intake_approved', {
      p_intake_id: intakeId,
      p_event_id: eventId,
    }),
    'mark_event_intake_approved',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: res.data as MarkApprovedResult }
}

export interface PurgeIntakeResult {
  clinic_id: string
  group_id: string
  deleted_origin_ids: string[]
}

export async function purgeIntake(
  intakeId: string,
): Promise<Result<PurgeIntakeResult>> {
  const res = await callRpc(
    () => supabase.rpc('purge_intake', { p_intake_id: intakeId }),
    'purge_intake',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: res.data as PurgeIntakeResult }
}

export interface PurgeClinicIntakeResult {
  group_id: string
  deleted_origin_ids: string[]
}

export async function purgeClinicIntakeConversation(
  clinicId: string,
): Promise<Result<PurgeClinicIntakeResult>> {
  const res = await callRpc(
    () => supabase.rpc('purge_clinic_intake_conversation', { p_clinic_id: clinicId }),
    'purge_clinic_intake_conversation',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: res.data as PurgeClinicIntakeResult }
}
