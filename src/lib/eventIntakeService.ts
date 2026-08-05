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
 * `mintIntakeLine` / `rotateIntakeLinePassphrase`. Callers must route it directly
 * into the visible-once modal's local state and drop it on dismiss — never into a
 * store, never into a log.
 *
 * A cluster holds SEVERAL credentials now ("lines"): the supervisor surface is keyed
 * by credential id, while the anon surface stays keyed by passcode, which is what
 * made the outsider-facing half line-addressable for free.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { callRpc } from './result'
import type { Result } from './result'

const logger = createLogger('EventIntake')

// ─── Supervisor line lifecycle ──────────────────────────────────

/**
 * How an intake line picks who hears it.
 *
 *   'cluster'      — everyone in the cluster, the pre-lines behavior.
 *   'sub_clusters' — only members of the listed sub-units.
 *
 * `scopeMembers` is additive in EITHER mode, for the duty-roster case a sub-unit
 * filter can't express (an SD line is 1–3 named people drawn across platoons).
 * There is no implicit "unset means everyone": with several lines per cluster,
 * that default is how a new line silently blasts the battalion.
 */
export type IntakeLineScopeMode = 'cluster' | 'sub_clusters'

/**
 * The HQ/unassigned bucket's stand-in id inside `scopeSubClusters`.
 *
 * Members with `sub_cluster_id IS NULL` belong to no sub-unit, so listing every
 * real sub-unit still misses them. `scope_sub_clusters` is `uuid[]`, which rules
 * out a readable marker; the nil uuid is the one value `gen_random_uuid` cannot
 * mint, so it can never collide with a real sub-unit. `_intake_line_scope` reads
 * it server-side.
 */
export const HQ_SCOPE_ID = '00000000-0000-0000-0000-000000000000'

export interface IntakeLineScope {
  scopeMode: IntakeLineScopeMode
  subClusters: string[]
  members: string[]
}

export interface MintResult {
  id: string
  passcode: string
  /** Present only when the server generated the passphrase. */
  passphrase?: string
  passphraseWasGenerated: boolean
}

export async function mintIntakeLine(
  clinicId: string,
  opts: { name: string; passphrase?: string; scope?: IntakeLineScope } = { name: 'Main' },
): Promise<Result<MintResult>> {
  const res = await callRpc(
    () => supabase.rpc('mint_intake_line', {
      p_clinic_id: clinicId,
      p_name: opts.name,
      p_passphrase: opts.passphrase ?? null,
      p_scope_mode: opts.scope?.scopeMode ?? 'cluster',
      p_sub_clusters: opts.scope?.subClusters ?? [],
      p_members: opts.scope?.members ?? [],
    }),
    'mint_intake_line',
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

export async function renameIntakeLine(
  credentialId: string,
  name: string,
): Promise<Result<{ name: string }>> {
  const res = await callRpc(
    () => supabase.rpc('rename_intake_line', { p_cred_id: credentialId, p_name: name }),
    'rename_intake_line',
    logger,
  )
  if (!res.ok) return res
  return { ok: true, data: { name: (res.data as Record<string, unknown>).name as string } }
}

/**
 * Repoint a line. The server does NOT check that the sub-cluster ids still exist
 * or hold anyone: a supervisor may scope a line to a sub-unit before the roster
 * catches up, and a deleted sub-unit leaves a dangling id that contributes nobody.
 * The returned counts are what the UI warns on.
 */
export async function setIntakeLineScope(
  credentialId: string,
  scope: IntakeLineScope,
): Promise<Result<{ scopeMembersCount: number; reachableDevices: number }>> {
  const res = await callRpc(
    () => supabase.rpc('set_intake_line_scope', {
      p_cred_id: credentialId,
      p_scope_mode: scope.scopeMode,
      p_sub_clusters: scope.subClusters,
      p_members: scope.members,
    }),
    'set_intake_line_scope',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return {
    ok: true,
    data: {
      scopeMembersCount: Number(data.scope_members_count ?? 0),
      reachableDevices: Number(data.reachable_devices ?? 0),
    },
  }
}

export async function rotateIntakeLinePasscode(
  credentialId: string,
): Promise<Result<{ passcode: string }>> {
  const res = await callRpc(
    () => supabase.rpc('rotate_intake_line_passcode', { p_cred_id: credentialId }),
    'rotate_intake_line_passcode',
    logger,
  )
  if (!res.ok) return res
  const data = res.data as Record<string, unknown>
  return { ok: true, data: { passcode: data.passcode as string } }
}

export async function rotateIntakeLinePassphrase(
  credentialId: string,
  opts: { passphrase?: string } = {},
): Promise<Result<{ passphrase?: string; passphraseWasGenerated: boolean }>> {
  const res = await callRpc(
    () => supabase.rpc('rotate_intake_line_passphrase', {
      p_cred_id: credentialId,
      p_passphrase: opts.passphrase ?? null,
    }),
    'rotate_intake_line_passphrase',
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

export async function killIntakeLine(
  credentialId: string,
): Promise<Result<void>> {
  return await callRpc(
    () => supabase.rpc('kill_intake_line', { p_cred_id: credentialId }),
    'kill_intake_line',
    logger,
  )
}

export interface IntakeLine {
  id: string
  /** Supervisor-facing label — 'HQ On-Call', 'SD Phone', 'Alpha Line'. */
  name: string
  passcode: string
  passcode_rotated_at: string
  passphrase_rotated_at: string
  created_at: string
  /** GATE-2 master "allow calls" toggle. Per line. */
  oncall_enabled?: boolean
  /** GATE-2 "allow text messaging" toggle — outside→cluster one-way message. */
  outside_message_enabled?: boolean
  /** GATE-2 "allow event requests" toggle — the scheduling-intake channel. Defaults
   *  true (a line that predates the column has intake on). */
  intake_enabled?: boolean
  /** OUTBOUND outside-contact toggle — lets members email a secure 1:1 invite. */
  outbound_enabled?: boolean
  /** Duration (s) of this line's voicemail greeting, or null if none is set. Presence
   *  flag for the settings row — the audio blob is fetched separately via getLineGreeting. */
  oncall_greeting_dur?: number | null
  scope_mode: IntakeLineScopeMode
  scope_sub_clusters: string[]
  scope_members: string[]
  /** How many cluster members this line currently addresses. */
  scope_members_count: number
  /** How many of those are on duty right now — the scope intersected with
   *  clinics.oncall, which is exactly the set the push fan rings. */
  oncall_count: number
  /** How many of those hold a provisioned device. Zero means outside contact on this
   *  line goes nowhere — legitimate while a supervisor plans ahead of the roster, but
   *  it has to be visible. */
  reachable_devices: number
}

/**
 * Line voicemail greeting — the operational announcement an OUTSIDE caller hears
 * when their on-call call goes unanswered. PLAINTEXT base64 (the anon caller holds no
 * key, so it can't be sealed like inbound voicemail/text; it's a deliberately-public
 * announcement, no PHI). Mirror of the per-user profiles.voicemail_greeting, at line
 * scope. `audio` = base64 of the raw recording blob.
 */
export interface OncallGreeting {
  audio: string
  mime: string
  dur: number
}

/** Every intake line for the cluster, oldest first. Supervisor-gated. */
export async function listIntakeLines(
  clinicId: string,
): Promise<Result<IntakeLine[]>> {
  const res = await callRpc(
    () => supabase.rpc('list_intake_lines', { p_clinic_id: clinicId }),
    'list_intake_lines',
    logger,
  )
  if (!res.ok) return res
  const rows = (res.data ?? []) as (IntakeLine & { oncall_greeting_dur?: unknown })[]
  return {
    ok: true,
    // `oncall_greeting_dur` arrives as text (jsonb ->> 'dur') — coerce to a number.
    data: rows.map((r) => ({
      ...r,
      scope_sub_clusters: r.scope_sub_clusters ?? [],
      scope_members: r.scope_members ?? [],
      oncall_greeting_dur: r.oncall_greeting_dur == null ? null : Number(r.oncall_greeting_dur),
    })),
  }
}

/** Set (or clear, with `null`) a line's voicemail greeting. Supervisor-gated. */
export async function setLineGreeting(
  credentialId: string,
  greeting: OncallGreeting | null,
): Promise<Result<void>> {
  return await callRpc(
    () => supabase.rpc('set_line_greeting', { p_cred_id: credentialId, p_greeting: greeting }),
    'set_line_greeting',
    logger,
  )
}

/** Fetch a line's full greeting audio (for settings playback). Supervisor-gated. */
export async function getLineGreeting(
  credentialId: string,
): Promise<Result<OncallGreeting | null>> {
  const res = await callRpc(
    () => supabase.rpc('get_line_greeting', { p_cred_id: credentialId }),
    'get_line_greeting',
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
