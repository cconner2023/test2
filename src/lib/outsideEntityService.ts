/**
 * Cluster/medic-side service for the OUTBOUND outside-entity 1:1 channel — the
 * reverse of the inbound QR/passphrase lanes: a clinic member emails a secure
 * invite to an outside recipient, then chats 1:1 for 24h. Sibling of
 * `outsideSessionService`, but medic-INITIATED and dev-gated end-to-end.
 *
 * Crypto is the signal-free stack (`outsideEntityKey` wrap/unwrap, `outsideEntitySeal`
 * dual-seal, `outsideSeal` ECIES) — NOTHING from `src/lib/signal/*`. The medic's
 * per-channel private key lives in `outsideEntityChannelStore` (encrypted at rest,
 * keyed by entity_id) and is imported transiently here to open inbound replies. It
 * used to live inside the card's content; it moved so that deleting messages blanks a
 * thread without destroying the channel.
 *
 * The medic never persists the fragment_secret or the code (both are emailed by the
 * edge fn and then discarded) — the URL `#k=` fragment is created here only to hand
 * to the invite edge fn, exactly like the recipient email.
 */

import { supabase } from './supabase'
import { callRpc, type Result } from './result'
import { createLogger } from '../Utilities/Logger'
import { generateOutsideKeypair, wrapOutsidePriv } from './outsideEntityKey'
import { sealPair, openAsMedic, type SealedPair } from './outsideEntitySeal'
import { computeEmailHmac } from './outsideEmailHmac'
import { getClinicRawKeyBase64 } from './cryptoService'
import { putOutsideEntityChannel, type OutsideEntityChannel } from './outsideEntityChannelStore'
import type { OutsideEntityContent, OutsideEntityMessageEntry } from './signal/messageContent'

const logger = createLogger('OutsideEntityService')

// ── random material ─────────────────────────────────────────────────────────
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** URL-safe base64 (no padding) of `n` random bytes — for the token + fragment. */
function randomUrlToken(n = 32): string {
  let bin = ''
  for (const b of randomBytes(n)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Human-typeable code (Crockford-ish base32, no ambiguous chars) — emailed to the
 *  recipient and entered at open. 10 chars ≈ 50 bits, gated further by bcrypt+lockout. */
function randomCode(len = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789' // no I,L,O,0,1,U
  let out = ''
  for (const b of randomBytes(len)) out += alphabet[b % alphabet.length]
  return out
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function importMedicPriv(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
}

const HOURS_24_MS = 24 * 60 * 60 * 1000

/** Message shown wherever a .mil recipient is refused — composer hint and service error. */
export const MIL_UNSUPPORTED_MESSAGE = 'Military (.mil) addresses are not supported for outbound contact.'

/**
 * True for any military recipient. Mirrors the outside-invite-send edge fn's hard
 * reject so the composer can refuse BEFORE a channel is minted — the server check
 * still stands as the authority, but hitting it leaves a live orphan channel behind.
 * Slightly stricter than the edge rule: a bare `mil` domain and a trailing root dot
 * (`army.mil.`) count too.
 */
export function isMilEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1]?.replace(/\.$/, '') ?? ''
  return domain === 'mil' || domain.endsWith('.mil')
}

export interface CreateOutboundParams {
  clinicId: string
  recipientEmail: string
  /** Medic-chosen label the recipient sees. Defaults 'Medical section'. */
  fromLabel?: string
}

export interface CreateOutboundResult {
  entityId: string
  /** The card content to insert locally via useMessages.addMessage. Key-free. */
  content: OutsideEntityContent
  /** The channel record, already persisted to `outsideEntityChannelStore`. */
  channel: OutsideEntityChannel
}

/**
 * Mint a channel + email the invite. Generates the outside keypair (private half
 * wrapped under W=HKDF(fragment,code) and stored server-side) AND a medic keypair
 * (private half kept ONLY in the returned card). Stores opaque fields via
 * create_outside_entity, then hands token/code/fragment/email to the invite edge fn.
 * Returns the card content; the caller inserts it. NEVER logs the email/code/fragment.
 */
export async function createOutboundOutsideEntity(
  params: CreateOutboundParams,
): Promise<Result<CreateOutboundResult>> {
  const { clinicId, recipientEmail } = params
  const fromLabel = (params.fromLabel ?? '').trim() || 'Medical section'
  const email = recipientEmail.trim().toLowerCase()
  // Refuse before minting: the edge fn rejects .mil too, but only after
  // create_outside_entity has already provisioned a channel nobody can use.
  if (isMilEmail(email)) return { ok: false, error: MIL_UNSUPPORTED_MESSAGE }

  try {
    // Two keypairs: the outside party's (private wrapped for the server) and the
    // medic's (private kept in-card only).
    const outside = await generateOutsideKeypair()
    const medic = await generateOutsideKeypair()
    const medicPrivJwk = await crypto.subtle.exportKey('jwk', medic.privateKey)

    const token = randomUrlToken()
    const fragment = randomUrlToken()
    const code = randomCode()
    const tokenHash = await sha256Hex(token)
    const wrapped = await wrapOutsidePriv(outside.privateKey, fragment, code)

    // Best-effort dedupe HMAC — null if the clinic key can't be fetched offline.
    let emailHmac: string | null = null
    const rawKey = await getClinicRawKeyBase64(clinicId)
    if (rawKey) emailHmac = await computeEmailHmac(email, rawKey)

    const created = await callRpc<string>(
      () => supabase.rpc('create_outside_entity', {
        p_token_hash: tokenHash,
        p_code: code,
        p_outside_pub: outside.publicKeyB64,
        p_medic_pub: medic.publicKeyB64,
        p_wrapped_outside_priv: wrapped,
        p_email_hmac: emailHmac,
        p_from_label: fromLabel,
      }),
      'create_outside_entity', logger,
    )
    if (!created.ok) return created
    const entityId = created.data

    // Email the invite (link + code). The edge fn re-binds to this entity, rejects
    // .mil, and persists/logs nothing. A delivery failure still leaves a live
    // channel — surfaced to the caller so it can offer a resend.
    const { data: sendRes, error: sendErr } = await supabase.functions.invoke('outside-invite-send', {
      body: { token, code, fragment, email },
    })
    if (sendErr || !(sendRes as { ok?: boolean } | null)?.ok) {
      const reason = (sendRes as { reason?: string } | null)?.reason
      return { ok: false, error: reason === 'mil_unsupported'
        ? MIL_UNSUPPORTED_MESSAGE
        : 'The channel was created but the invite email could not be sent.' }
    }

    const nowIso = new Date().toISOString()
    const expiresIso = new Date(Date.now() + HOURS_24_MS).toISOString()

    // The channel key goes to its own store, NOT into the card — so deleting the
    // card (or every message in the thread) blanks the conversation without
    // destroying the channel. Persisted BEFORE the card is returned: if this write
    // fails there is no readable channel, so fail the whole mint rather than leave
    // an invite in someone's inbox that nobody can answer.
    const channel: OutsideEntityChannel = {
      entity_id: entityId,
      from_label: fromLabel,
      recipient_email: email,
      medic_pub: medic.publicKeyB64,
      medic_priv_jwk: medicPrivJwk,
      outside_pub: outside.publicKeyB64,
      created_at: nowIso,
      expires_at: expiresIso,
    }
    try {
      await putOutsideEntityChannel(channel)
    } catch (err) {
      logger.error('Could not persist the outbound channel key', err)
      void revokeOutsideEntity(entityId)
      return { ok: false, error: 'Could not start outbound contact on this device.' }
    }

    const content: OutsideEntityContent = {
      type: 'outside_entity',
      entity_id: entityId,
      from_label: fromLabel,
      recipient_email: email,
      medic_pub: medic.publicKeyB64,
      outside_pub: outside.publicKeyB64,
      created_at: nowIso,
      expires_at: expiresIso,
      replies: [],
    }
    return { ok: true, data: { entityId, content, channel } }
  } catch (err) {
    logger.error('createOutboundOutsideEntity failed', err)
    return { ok: false, error: 'Could not start outbound contact.' }
  }
}

/**
 * Seal a medic→outside reply to BOTH pubs and post it. On success returns the
 * optimistic entry the caller turns into a normal local message. Never returns the
 * sealed blob.
 *
 * Keyed on the CHANNEL record, not the card — the card no longer carries key
 * material and may not even exist (a blanked thread is still a live channel).
 */
export async function sendOutsideEntityReply(
  channel: OutsideEntityChannel,
  text: string,
): Promise<Result<OutsideEntityMessageEntry>> {
  try {
    const pair: SealedPair = await sealPair(text, channel.medic_pub, channel.outside_pub)
    const res = await callRpc<{ ok?: boolean }>(
      () => supabase.rpc('send_outside_entity_message', { p_entity_id: channel.entity_id, p_sealed: pair }),
      'send_outside_entity_message', logger,
    )
    if (!res.ok) return res
    if (res.data?.ok !== true) return { ok: false, error: 'Message could not be sent (the channel may have expired).' }
    return { ok: true, data: { id: `local-${crypto.randomUUID()}`, dir: 'to_outside', text, created_at: new Date().toISOString() } }
  } catch (err) {
    logger.error('sendOutsideEntityReply failed', err)
    return { ok: false, error: 'Message could not be sent.' }
  }
}

export interface InboundPollResult {
  active: boolean
  /** New outside→medic replies since `since`, decrypted (dir 'to_medic'). */
  entries: OutsideEntityMessageEntry[]
}

/**
 * CATCH-UP DRAIN for outside→medic replies. Live delivery rides the signal transport
 * now (outside-entity-relay → per-device envelope → routeOutsideEntityReply), so this
 * is the backstop, not the main path: it recovers replies authored while this medic
 * had no keyed device, or whose envelope failed to decrypt. Entry ids are the
 * outside_entity_messages row ids — the SAME identity the relayed envelope carries —
 * so a reply recovered here can never double up with its pushed copy.
 *
 * `active:false` ⇒ expired/revoked (flip the conversation to its ended state).
 * Returns null on transport error (safe to retry).
 */
export async function pollOutsideEntityInbound(
  channel: OutsideEntityChannel,
  since: string | null,
): Promise<InboundPollResult | null> {
  const { data, error } = await supabase.rpc('poll_outside_entity_inbound', {
    p_entity_id: channel.entity_id,
    p_since: since,
  })
  if (error || !data) return null
  const res = data as { active?: boolean; messages?: { id: string; sealed: SealedPair; created_at: string }[] }
  if (!res.active) return { active: false, entries: [] }
  const rows = res.messages ?? []
  if (rows.length === 0) return { active: true, entries: [] }
  let priv: CryptoKey
  try {
    priv = await importMedicPriv(channel.medic_priv_jwk)
  } catch {
    return { active: true, entries: [] }
  }
  const entries: OutsideEntityMessageEntry[] = []
  for (const r of rows) {
    try {
      const text = await openAsMedic(priv, r.sealed)
      entries.push({ id: r.id, dir: 'to_medic', text, created_at: r.created_at })
    } catch { /* undecryptable — drop */ }
  }
  return { active: true, entries }
}

/**
 * Hard-revoke the channel server-side (deletes the outside_entities row → destroys
 * wrapped_outside_priv, so the outside party's tab flips to the expired view on its
 * next poll).
 *
 * Pair with `removeOutsideEntityChannel` so the local key dies too and cannot
 * resurrect from an encrypted backup on another device. `useMessages.deleteConversation`
 * does both, in that order, and aborts the delete if this call fails — the local key
 * is the only thing that could ever retry, so it must outlive a failed revoke.
 */
export async function revokeOutsideEntity(entityId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('revoke_outside_entity', { p_entity_id: entityId }),
    'revoke_outside_entity', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}
