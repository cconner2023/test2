/**
 * SYSTEM-as-sender X3DH-initiate — the ONE shared sender path.
 *
 * Factored out of systemIdentity.encryptAsSystem so BOTH the client
 * (systemIdentity, device_id='primary') AND the intake edge function
 * (supabase/functions/intake-submit, device_id='edge') import the SAME function,
 * guaranteeing byte-identical wire output (no fork, no drift).
 *
 * SECURITY-CRITICAL but DENO-IMPORTABLE: depends ONLY on the pure crypto modules
 * (x3dh / ratchet / sealedSender / keyPrimitives) — no IndexedDB, no keyStore, no
 * zustand, no supabase client. Every call is a fresh X3DH with no persisted ratchet
 * state, so concurrent senders never desync; the recipient sees an InitialMessage
 * and decrypts via the unchanged processIncomingMessage path.
 */

import { x3dhInitiate } from './x3dh'
import { initSender, ratchetEncrypt } from './ratchet'
import { seal, type SealedEnvelope } from './sealedSender'
import { importDhPublicKey } from './keyPrimitives'
import type { StoredLocalIdentity, PublicKeyBundle, InitialMessage } from './types'

/**
 * Encrypt `serialized` as `senderUuid` (using the supplied identity keys) for ONE
 * recipient device. Returns the sealed envelope to insert as the message payload.
 *
 * @param identity        sender identity (signing + DH keypairs + base64 forms).
 *                        deviceId/createdAt/nextPreKeyId are irrelevant to the math.
 * @param senderUuid      logical sender id stamped in the sealed-sender cert.
 * @param recipientId     recipient user id (bound into the cert).
 * @param recipientBundle recipient device's published key bundle (consumes its OTP).
 */
export async function encryptAsSystemWith(
  identity: StoredLocalIdentity,
  senderUuid: string,
  recipientId: string,
  recipientBundle: PublicKeyBundle,
  serialized: string,
): Promise<SealedEnvelope> {
  // 1. X3DH initiator from `identity` to the recipient's bundle.
  const x3dh = await x3dhInitiate(identity, recipientBundle)

  // 2. Init sender ratchet against recipient's signed pre-key.
  const peerSpk = await importDhPublicKey(recipientBundle.signedPreKey.publicKey)
  const ratchetState = await initSender(
    x3dh.sharedSecret,
    peerSpk,
    recipientBundle.signedPreKey.publicKey,
  )

  // 3. Encrypt the first message.
  const ptBytes = new TextEncoder().encode(serialized)
  const { message } = await ratchetEncrypt(ratchetState, ptBytes, x3dh.associatedData)

  // 4. Assemble the InitialMessage with the sender identity in the X3DH fields.
  const initialMessage: InitialMessage = {
    identitySigningKey: identity.signingPublicKeyBase64,
    identityDhKey: identity.dhPublicKeyBase64,
    ephemeralKey: x3dh.ephemeralPublicKeyBase64,
    signedPreKeyId: x3dh.signedPreKeyId,
    oneTimePreKeyId: x3dh.oneTimePreKeyId,
    message,
  }

  // 5. Seal — cert signed by `identity`'s signing key, addressed to the recipient.
  return seal(
    initialMessage as unknown as Record<string, unknown>,
    senderUuid,
    identity,
    recipientId,
    recipientBundle.identityDhKey,
  )
}
