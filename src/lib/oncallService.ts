/**
 * On-call service (main app, authed). Thin wrappers over the on-call RPCs plus
 * the supervisor key-distribution orchestration. Pure I/O + crypto glue.
 *
 * Split from the anon bundle's oncallAnonService (request/poll/voicemail) so the
 * intake bundle never pulls in `src/lib/signal/*` (bundle firewall). This file
 * IS allowed to touch signal (oncallKeyWrap) — it runs in the main app only.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { callRpc } from './result'
import type { Result } from './result'
import { generateVoicemailKeypair } from './oncallSeal'
import { wrapForVaultRecipient } from './signal/oncallKeyWrap'

const logger = createLogger('Oncall')

// ─── GATE 3: presence (any cluster member toggles self or teammate) ───
export async function toggleOncallPresence(
  clinicId: string,
  userId: string,
  on: boolean,
): Promise<Result<{ on: boolean }>> {
  const res = await callRpc(
    () => supabase.rpc('toggle_oncall_presence', { p_clinic_id: clinicId, p_user_id: userId, p_on: on }),
    'toggle_oncall_presence', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: { on } }
}

// ─── Medic call control ───
export async function acceptOncall(
  callId: string,
  answerSdp: RTCSessionDescriptionInit,
): Promise<{ won: boolean }> {
  const res = await callRpc(
    () => supabase.rpc('accept_oncall', { p_call_id: callId, p_answer_sdp: answerSdp }),
    'accept_oncall', logger,
  )
  if (!res.ok) return { won: false }
  return { won: (res.data as { won?: boolean })?.won === true }
}

export async function markOncallEnded(callId: string): Promise<void> {
  await callRpc(
    () => supabase.rpc('mark_oncall_ended', { p_call_id: callId }),
    'mark_oncall_ended', logger,
  )
}

// ─── GATE 2: supervisor master toggle + voicemail key lifecycle ───

/** Wrap the freshly generated voicemail private key to every cluster member and
 *  fan the oncall-key-wrap SYSTEM messages. Best-effort per member. */
async function distributeVoicemailKey(clinicId: string, credentialId: string, privPkcs8B64: string, version: number): Promise<void> {
  const me = (await supabase.auth.getUser()).data.user?.id
  if (!me) throw new Error('not authenticated')

  const targetsRes = await callRpc<Array<{ user_id: string; identity_dh_key: string }>>(
    () => supabase.rpc('get_oncall_wrap_targets', { p_clinic_id: clinicId }),
    'get_oncall_wrap_targets', logger,
  )
  if (!targetsRes.ok) throw new Error('could not load wrap targets')

  const wraps: Array<{ user_id: string; wrapped: unknown }> = []
  for (const t of targetsRes.data) {
    if (!t.identity_dh_key) continue
    try {
      const wrapped = await wrapForVaultRecipient(privPkcs8B64, me, t.user_id, t.identity_dh_key)
      wraps.push({ user_id: t.user_id, wrapped })
    } catch (e) {
      logger.warn(`Failed to wrap voicemail key for ${t.user_id}:`, e instanceof Error ? e.message : e)
    }
  }

  await callRpc(
    () => supabase.rpc('distribute_oncall_key', {
      p_clinic_id: clinicId,
      p_credential_id: credentialId,
      p_wrapper_version: version,
      p_wraps: wraps,
    }),
    'distribute_oncall_key', logger,
  )
}

/**
 * Provision (or rotate) the clinic INBOUND key — the single P-256 keypair that seals
 * BOTH voicemail audio and outside text. The key hinges on the credential lifecycle:
 * minted with the credential and rotated with the passcode (orchestrated in
 * IntakeMintSection), NOT a separately-toggled control. Generates a fresh keypair,
 * stores the public half on the credential (set_clinic_inbound_key — no flag change),
 * and wraps+distributes the private half to every cluster member.
 *
 * ROTATION = CLEAN SLATE: a fresh keypair discards the old one, so any undelivered/
 * unread sealed voicemails + messages become permanently unrecoverable. Intended —
 * rotating the QR/passcode revokes the old credential and its in-flight content.
 */
export async function provisionInboundKey(clinicId: string): Promise<Result<true>> {
  const { privPkcs8B64, pubSpkiB64 } = await generateVoicemailKeypair()
  const res = await callRpc(
    () => supabase.rpc('set_clinic_inbound_key', { p_clinic_id: clinicId, p_recipient_pub_b64: pubSpkiB64 }),
    'set_clinic_inbound_key', logger,
  )
  if (!res.ok) return res
  const credentialId = (res.data as { credential_id: string }).credential_id
  await distributeVoicemailKey(clinicId, credentialId, privPkcs8B64, Date.now())
  return { ok: true, data: true }
}

/** Does the clinic credential already have an inbound key? */
async function hasInboundKey(clinicId: string): Promise<boolean> {
  const credRes = await callRpc<{ oncall_has_key?: boolean } | null>(
    () => supabase.rpc('get_event_intake_credential', { p_clinic_id: clinicId }),
    'get_event_intake_credential', logger,
  )
  return credRes.ok && credRes.data?.oncall_has_key === true
}

/** Enable on-call (GATE 2). Flips the master flag only — the inbound key is provisioned
 *  with the credential (mint/rotate). Self-heals legacy credentials by provisioning if
 *  the key is somehow missing. */
export async function enableOncall(clinicId: string): Promise<Result<true>> {
  if (!(await hasInboundKey(clinicId))) {
    const prov = await provisionInboundKey(clinicId)
    if (!prov.ok) return prov
  }
  const res = await callRpc(
    () => supabase.rpc('set_oncall_master', { p_clinic_id: clinicId, p_enabled: true }),
    'set_oncall_master', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Disable on-call (GATE 2). Leaves the inbound key in place. */
export async function disableOncall(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_oncall_master', { p_clinic_id: clinicId, p_enabled: false }),
    'set_oncall_master', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Enable the outside→cluster one-way message channel. Flips the flag only (the inbound
 *  key is provisioned with the credential); self-heals legacy credentials if missing. */
export async function enableOutsideMessaging(clinicId: string): Promise<Result<true>> {
  if (!(await hasInboundKey(clinicId))) {
    const prov = await provisionInboundKey(clinicId)
    if (!prov.ok) return prov
  }
  const res = await callRpc(
    () => supabase.rpc('set_outside_message_enabled', { p_clinic_id: clinicId, p_enabled: true }),
    'set_outside_message_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Disable the outside→cluster message channel. Leaves the inbound key in place. */
export async function disableOutsideMessaging(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_outside_message_enabled', { p_clinic_id: clinicId, p_enabled: false }),
    'set_outside_message_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}
