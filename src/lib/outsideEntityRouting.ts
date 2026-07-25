/**
 * Routing for outside→medic replies that arrive over the SIGNAL transport.
 *
 * The `outside-entity-relay` edge fn re-authors each outside reply as a real
 * per-device SYSTEM envelope (t:'oer'). By the time it reaches here the signal layer
 * has already decrypted the TRANSPORT, but the body is still ECIES-sealed to the
 * channel's `medic_pub` — the edge never saw plaintext and neither did the server.
 * This module opens that inner seal with the channel key from
 * `outsideEntityChannelStore`.
 *
 * Called from every path that decrypts a message (realtime, catch-up, vault drain),
 * exactly as `routeCalendarEvent` / `routePropertyEvent` are. An 'oer' is never a
 * bubble in its raw form: the caller swaps the decrypted text in and re-authors a
 * normal message into the channel's conversation, so the whole downstream pipeline
 * (unread, notification, preview, backup, delete) treats it as an ordinary 1:1.
 *
 * Imports NOTHING from `src/lib/signal/*` beyond the content type.
 */

import type { MessageContent, OutsideEntityReplyContent } from './signal/messageContent'
import { openSealed } from './outsideSeal'
import { getOutsideEntityChannel } from './outsideEntityChannelStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('OutsideEntityRouting')

/** True if the content is a relayed outside→medic reply. */
export function isOutsideEntityReply(
  content: MessageContent | undefined | null,
): content is OutsideEntityReplyContent {
  return content?.type === 'outside_entity_reply'
}

function importMedicPriv(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
}

/**
 * Open a relayed reply with the channel key.
 *
 * Returns null when the channel record is gone (deleted conversation, expired, purged,
 * or this device never held the key) — the caller must DROP the message rather than
 * render a placeholder, because a null here means the medic legitimately has no
 * capability to read it. A null is not an error condition: it is the kill switch and
 * the 24h expiry both working as designed.
 */
export async function routeOutsideEntityReply(
  content: OutsideEntityReplyContent,
): Promise<string | null> {
  const channel = await getOutsideEntityChannel(content.entity_id)
  if (!channel) return null
  try {
    const priv = await importMedicPriv(channel.medic_priv_jwk)
    return await openSealed(priv, content.sealed)
  } catch (e) {
    logger.warn(`Could not open outside reply for ${content.entity_id}:`, e instanceof Error ? e.message : e)
    return null
  }
}
