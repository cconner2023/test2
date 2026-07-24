/**
 * Dual-seal for the OUTBOUND outside-entity 1:1 channel. Every stored message is
 * sealed to BOTH parties' public keys so each side can read the FULL thread from
 * the server copy alone — the load-bearing property that lets the IDB-free outside
 * tab re-open and see its own past replies after a reload (it re-derives its key
 * but keeps no plaintext), and lets a medic on any device read the outside's
 * replies pulled from the entity.
 *
 *   sealed = { m: <ECIES to medic_pub>, o: <ECIES to outside_pub> }
 *     • the medic side opens `.m` with its private key
 *     • the outside side opens `.o` with its unwrapped private key
 *
 * Built on the signal-free `outsideSeal` ephemeral-static ECIES (fresh ephemeral
 * per seal → per-message forward secrecy on each leg). Imports NOTHING from
 * `src/lib/signal/*` (anon bundle firewall). No-PHI-on-the-wire governs the
 * plaintext (operational vocabulary only).
 */

import { sealToOutsidePub, openSealed, type SealedPayload } from './outsideSeal'

/** A message sealed to both parties: `.m` readable by the medic, `.o` by the outside party. */
export interface SealedPair {
  m: SealedPayload
  o: SealedPayload
}

/** Seal `plaintext` to both the medic and the outside public keys. */
export async function sealPair(
  plaintext: string,
  medicPubB64: string,
  outsidePubB64: string,
): Promise<SealedPair> {
  const [m, o] = await Promise.all([
    sealToOutsidePub(medicPubB64, plaintext),
    sealToOutsidePub(outsidePubB64, plaintext),
  ])
  return { m, o }
}

/** Outside side: open a stored pair with the tab's unwrapped private key (reads `.o`). */
export function openAsOutside(privateKey: CryptoKey, pair: SealedPair): Promise<string> {
  return openSealed(privateKey, pair.o)
}

/** Medic side: open a stored pair with the medic private key (reads `.m`). */
export function openAsMedic(privateKey: CryptoKey, pair: SealedPair): Promise<string> {
  return openSealed(privateKey, pair.m)
}
