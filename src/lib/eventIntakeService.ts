/**
 * Event Intake Service
 *
 * Thin wrapper layer over the event-intake Supabase RPCs. Pure I/O. The
 * triage actions (`intake_action` for approve/decline, `purge_clinic_intake_conversation`
 * for bulk cleanup) handle their own messaging-side fanout server-side via
 * plaintext SYSTEM-authored 'intake-delete' envelopes; callers just await
 * the RPC and optimistically strip their local copy.
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
  /** GATE-2 master "allow calls" toggle (get_event_intake_credential extension). */
  oncall_enabled?: boolean
  /** GATE-2 "allow text messaging" toggle — outside→cluster one-way message. */
  outside_message_enabled?: boolean
  /** GATE-2 "allow event requests" toggle — the scheduling-intake channel. Defaults
   *  true (a credential that predates the column has intake on). */
  intake_enabled?: boolean
  /** Duration (s) of the cluster voicemail greeting, or null if none is set. Presence
   *  flag for the settings row — the audio blob is fetched separately via getOncallGreeting. */
  oncall_greeting_dur?: number | null
}

/**
 * Cluster voicemail greeting — the operational announcement an OUTSIDE caller hears
 * when their on-call call goes unanswered. PLAINTEXT base64 (the anon caller holds no
 * key, so it can't be sealed like inbound voicemail/text; it's a deliberately-public
 * announcement, no PHI). Mirror of the per-user profiles.voicemail_greeting, at clinic
 * scope. `audio` = base64 of the raw recording blob.
 */
export interface OncallGreeting {
  audio: string
  mime: string
  dur: number
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
  // `oncall_greeting_dur` arrives as text (jsonb ->> 'dur') — coerce to a number.
  const raw = res.data as IntakeCredentialMetadata & { oncall_greeting_dur?: unknown }
  const durRaw = raw.oncall_greeting_dur
  return {
    ok: true,
    data: {
      ...raw,
      oncall_greeting_dur: durRaw == null ? null : Number(durRaw),
    },
  }
}

/** Set (or clear, with `null`) the cluster voicemail greeting. Supervisor-gated. */
export async function setOncallGreeting(
  clinicId: string,
  greeting: OncallGreeting | null,
): Promise<Result<void>> {
  return await callRpc(
    () => supabase.rpc('set_oncall_greeting', { p_clinic_id: clinicId, p_greeting: greeting }),
    'set_oncall_greeting',
    logger,
  )
}

/** Fetch the full cluster greeting audio (for settings playback). Supervisor-gated. */
export async function getOncallGreeting(
  clinicId: string,
): Promise<Result<OncallGreeting | null>> {
  const res = await callRpc(
    () => supabase.rpc('get_oncall_greeting', { p_clinic_id: clinicId }),
    'get_oncall_greeting',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: (res.data as OncallGreeting | null) ?? null }
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

// NOTE: the event-intake SUBMISSION path lives in src/lib/oncallAnonService.ts
// (submitEventIntake), which runs in the signal-free anon bundle and seals the
// detail to the clinic inbound key before it leaves the device. It is NOT here:
// this module imports the main authed `./supabase` client and the seal helpers
// are anon-bundle-scoped. The former plaintext wrapper + IntakeSubmitPayload were
// removed when intake moved to the sealed envelope.

// ─── Triage (supervisor surface) ────────────────────────────────

/**
 * Unified approve/decline for an outside event-intake request.
 *
 * Server-side: stamps `event_intake_requests.status` ('approved' | 'declined'),
 * sets `event_id` on accepted, server-deletes the original intake-request
 * signal_messages rows, and fans out plaintext SYSTEM-authored 'intake-delete'
 * envelopes so live clients strip local state via the early-exit branch in
 * useSignalMessages.decryptRow / systemIdentity.drainSystemInbox.
 *
 * Supersedes `purge_intake` + `mark_event_intake_approved`.
 */
export interface IntakeActionResult {
  group_id: string
  delete_origin_id: string
  deleted_origin_ids: string[]
}

export type IntakeAction = 'accepted' | 'declined'

export async function intakeAction(
  intakeId: string,
  action: IntakeAction,
  eventId?: string,
): Promise<Result<IntakeActionResult>> {
  const res = await callRpc(
    () => supabase.rpc('intake_action', {
      p_intake_id: intakeId,
      p_action: action,
      p_event_id: eventId ?? null,
    }),
    'intake_action',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: res.data as IntakeActionResult }
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
