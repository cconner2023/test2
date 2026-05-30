/**
 * On-call voicemail key wrap/unwrap — SECURITY-CRITICAL (src/lib/signal/*).
 *
 * GRANT (2026-05-26, REV7): authorized solely for the supervisor-authed-URL +
 * passphrase credential + SYSTEM-send on-call path. Wraps the clinic voicemail
 * PRIVATE key (P-256 ECDH, PKCS8-base64) to a cluster member's Signal vault
 * identity via the existing sealedSender primitives, and unwraps it back. This
 * is the ONLY on-call file that touches Signal crypto; the wrapped envelope is
 * fanned as an `oncall-key-wrap` SYSTEM message (via distribute_oncall_key) and
 * decryption capability therefore equals cluster membership.
 *
 * The no-PHI-on-wire invariant is untouched: only the sealed key crosses the
 * wire; the voicemail audio is an E2E-encrypted attachment payload.
 */

import { loadLocalIdentity } from './keyStore'
import { getVaultIdentityDh } from './vaultDevice'
import { seal, unseal, type SealedEnvelope } from './sealedSender'

/** Wrap the voicemail private key (PKCS8 base64) to one recipient's vault. */
export async function wrapForVaultRecipient(
  privPkcs8B64: string,
  myUuid: string,
  recipientUuid: string,
  recipientDhKeyB64: string,
): Promise<SealedEnvelope> {
  const me = await loadLocalIdentity()
  if (!me) throw new Error('local identity unavailable')
  return seal({ k: privPkcs8B64 }, myUuid, me, recipientUuid, recipientDhKeyB64)
}

/** Unwrap a received voicemail key envelope → the PKCS8-base64 private key.
 *  The wrap is sealed to the recipient's portable VAULT identity (the
 *  device_id='vault' bundle that get_oncall_wrap_targets selects), NOT this
 *  physical device's local identity — so any device that has restored the vault
 *  from the password backup can open it (re-login / new device / cleared
 *  localStorage all recover). */
export async function unwrapFromVault(envelope: SealedEnvelope, myUuid: string): Promise<string> {
  const vault = await getVaultIdentityDh(myUuid)
  if (!vault) throw new Error('vault identity unavailable')
  // skipExpiry: a key-wrap may sit unread for days, like vault messages.
  const { inner } = await unseal(envelope, myUuid, vault.dhPrivateKey, vault.dhPublicKeyBase64, { skipExpiry: true })
  const k = (inner as { k?: unknown }).k
  if (typeof k !== 'string') throw new Error('malformed oncall key wrap')
  return k
}
