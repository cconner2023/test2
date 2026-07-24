/**
 * Anon-bundle service for the OUTBOUND outside-entity channel (medic emails an
 * invite → outside party opens a persistent 1:1 for 24h). Thin wrappers over the
 * token/code-gated SECURITY DEFINER RPCs, called with the intake bundle's anon
 * Supabase client.
 *
 * Imports NOTHING from `src/lib/signal/*` (bundle firewall). The outside private
 * key is unwrapped in-heap from `wrapped_outside_priv` via `outsideEntityKey`
 * (code + URL `#k=` fragment); message crypto is the signal-free `outsideSeal`.
 * ZERO IndexedDB/localStorage/sessionStorage writes anon-side — a reload re-opens
 * the same channel by re-prompting the code (the key is re-unwrapped, not stored).
 *
 * Sibling of `outsideSessionAnonService` (the inbound live-session lane); this is
 * the outbound persisted-key lane. See .claude/Projects/TaskList/outbound-outside-contact.json.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SealedPair } from './outsideEntitySeal'
import type { WrappedOutsidePriv } from './outsideEntityKey'

/** A stored message row. `dir` is 'to_outside' (medic→outside) or 'to_medic' (outside→medic). */
export interface OutsideEntityMessage {
  id: string
  dir?: 'to_outside' | 'to_medic'
  /** Dual-sealed { m, o }; the outside side reads `.o`. */
  sealed: SealedPair
  created_at: string
}

export interface OpenOutsideEntityData {
  entity_id: string
  from_label: string
  /** base64 SPKI ECDH pub of the medic — a seal target for outside→medic replies. */
  medic_pub: string
  /** base64 SPKI ECDH pub of the outside party itself — the other seal target, so
   *  the outside side can read back its OWN replies after a reload. */
  outside_pub: string
  /** Server-stored blob; unwrapped in-heap with the code + `#k=` fragment. */
  wrapped_outside_priv: WrappedOutsidePriv
  expires_at: string
  messages: OutsideEntityMessage[]
}

export type OpenOutsideEntityResult =
  | { ok: true; data: OpenOutsideEntityData }
  | { ok: false; expired?: boolean; locked?: boolean }

/**
 * Open the channel with the raw token (from `?i=`) + the emailed code. bcrypt-
 * gated server-side with dummy-hash timing equalisation + a sliding lockout on
 * repeated bad codes; a plain failure returns `{ ok: false }` (no code oracle).
 * `expired` distinguishes the 24h/revoked terminal state so the UI can render the
 * dedicated expired view instead of a retry prompt.
 */
export async function openOutsideEntity(
  supabase: SupabaseClient,
  token: string,
  code: string,
): Promise<OpenOutsideEntityResult> {
  const { data, error } = await supabase.rpc('open_outside_entity', { p_token: token, p_code: code })
  if (error || !data) return { ok: false }
  const d = data as Record<string, unknown>
  if (!d.ok) {
    return { ok: false, expired: d.expired === true, locked: d.locked === true }
  }
  return { ok: true, data: d as unknown as OpenOutsideEntityData }
}

export interface PollOutsideEntityResult {
  active: boolean
  expires_at?: string
  /** New medic→outside messages since `since` (dir='to_outside' only). */
  messages?: OutsideEntityMessage[]
}

/**
 * Poll for new medic→outside messages. entity_id IS the capability (uuid, no
 * per-poll bcrypt — mirrors poll_outside_session). `since` drains only rows newer
 * than the last one seen. Returns null on transport error (caller keeps polling);
 * `active: false` ⇒ expired/revoked, tear the thread down to the expired view.
 */
export async function pollOutsideEntity(
  supabase: SupabaseClient,
  entityId: string,
  since: string | null,
): Promise<PollOutsideEntityResult | null> {
  const { data, error } = await supabase.rpc('poll_outside_entity', {
    p_entity_id: entityId,
    p_since: since,
  })
  if (error || !data) return null
  return data as PollOutsideEntityResult
}

/**
 * Send an outside→medic reply. `sealed` is already ECIES-sealed to `medic_pub`
 * (via `sealToOutsidePub`). Server flood-caps at 100 inbound msgs/channel/hr and
 * rejects on expiry/revoke. Returns false on any rejection.
 */
export async function postOutsideEntityMessage(
  supabase: SupabaseClient,
  entityId: string,
  sealed: SealedPair,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('post_outside_entity_message', {
    p_entity_id: entityId,
    p_sealed: sealed,
  })
  if (error || !data) return false
  return (data as { ok?: boolean }).ok === true
}
