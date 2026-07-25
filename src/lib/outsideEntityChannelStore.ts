/**
 * Key custody for the OUTBOUND outside-entity 1:1 channel.
 *
 * The channel's medic private key (`medic_priv_jwk`) is the ONLY copy in existence —
 * the server holds `wrapped_outside_priv` for the OUTSIDE party, never the medic's
 * half. Lose it and the channel is unreadable forever.
 *
 * WHY THIS IS NOT A MESSAGE. It used to live inside the `outside_entity` control
 * message's content. That made "delete every message in this conversation" and
 * "destroy the channel" the same operation, which is wrong: blanking a thread must
 * leave the channel live so the pipeline keeps delivering. A key is channel state,
 * not conversation content, so it gets its own store and its own lifecycle:
 *
 *   delete MESSAGE(s)     → thread blanks, channel keeps working (record untouched)
 *   delete CONVERSATION   → kill switch: revoke server-side + drop the record here
 *   24h expiry / purge    → record is garbage, swept on next read
 *
 * WHY ITS OWN DATABASE. Putting it in `adtmc-message-store` would mean bumping that
 * DB's version, and IndexedDB refuses to open a database whose on-disk version is
 * newer than the one requested — so a device that ran this build and then loaded an
 * older one would fail to open its message store entirely. A separate database is
 * invisible to older builds instead of breaking them.
 *
 * AT REST: the private JWK is encrypted with the same device-local AES-GCM key used
 * by messageStore (`encryptString`). Cross-device continuity is the encrypted backup,
 * not this store — see `backupService`.
 */

import type { DBSchema } from 'idb'
import { createIdbSingleton } from './idbFactory'
import { encryptString, decryptString } from './secureStorage'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('OutsideEntityChannelStore')

/** Everything needed to operate one outbound channel, independent of its messages. */
export interface OutsideEntityChannel {
  /** outside_entities.id — also the medic-side conversation key. */
  entity_id: string
  /** Cluster label the recipient sees as the sender. */
  from_label: string
  /** Recipient email. Display only — never on the wire. */
  recipient_email: string
  /** base64 SPKI ECDH pub of the medic (a seal target for outside→medic). */
  medic_pub: string
  /** THE ONLY COPY of the channel private key. Encrypted at rest. */
  medic_priv_jwk: JsonWebKey
  /** base64 SPKI ECDH pub of the outside party (the other seal target). */
  outside_pub: string
  /** ISO — channel mint time. */
  created_at: string
  /** ISO — server 24h hard expiry. */
  expires_at: string
}

/** Wire form in IDB: `medic_priv_jwk` is stored as an encrypted JSON string. */
type StoredChannel = Omit<OutsideEntityChannel, 'medic_priv_jwk'> & { medic_priv_jwk: string }

interface ChannelDB extends DBSchema {
  channels: {
    key: string // entity_id
    value: StoredChannel
  }
}

const CHANNEL_DB_NAME = 'adtmc-outside-entity-channels'
const CHANNEL_DB_VERSION = 1

const { getDb, destroy: destroyChannelDb } = createIdbSingleton<ChannelDB>(
  CHANNEL_DB_NAME,
  CHANNEL_DB_VERSION,
  {
    upgrade(db) {
      if (!db.objectStoreNames.contains('channels')) {
        db.createObjectStore('channels', { keyPath: 'entity_id' })
      }
    },
  },
)

async function toStored(c: OutsideEntityChannel): Promise<StoredChannel> {
  return { ...c, medic_priv_jwk: await encryptString(JSON.stringify(c.medic_priv_jwk)) }
}

async function fromStored(s: StoredChannel): Promise<OutsideEntityChannel | null> {
  try {
    return { ...s, medic_priv_jwk: JSON.parse(await decryptString(s.medic_priv_jwk)) as JsonWebKey }
  } catch (e) {
    // Undecryptable (device key rotated / cleared). The channel is dead either way —
    // surfacing null lets callers render it ended instead of throwing mid-render.
    logger.warn('Channel record could not be decrypted:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Insert or replace a channel record. */
export async function putOutsideEntityChannel(channel: OutsideEntityChannel): Promise<void> {
  const db = await getDb()
  await db.put('channels', await toStored(channel))
}

/** One channel by id. Null if absent, expired, or undecryptable. */
export async function getOutsideEntityChannel(entityId: string): Promise<OutsideEntityChannel | null> {
  const db = await getDb()
  const row = await db.get('channels', entityId)
  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) return null
  return fromStored(row)
}

/** Every live channel. Expired records are swept as a side effect. */
export async function getAllOutsideEntityChannels(): Promise<OutsideEntityChannel[]> {
  const db = await getDb()
  const rows = await db.getAll('channels')
  const now = Date.now()
  const live: OutsideEntityChannel[] = []
  const dead: string[] = []
  for (const row of rows) {
    if (new Date(row.expires_at).getTime() <= now) { dead.push(row.entity_id); continue }
    const c = await fromStored(row)
    if (c) live.push(c)
  }
  if (dead.length > 0) {
    const tx = db.transaction('channels', 'readwrite')
    await Promise.all([...dead.map(id => tx.store.delete(id)), tx.done])
  }
  return live
}

/**
 * Destroy a channel record. This is the local half of the kill switch — pair it with
 * `revokeOutsideEntity` so the server row (and the outside party's wrapped key) dies
 * too. Idempotent.
 */
export async function removeOutsideEntityChannel(entityId: string): Promise<void> {
  const db = await getDb()
  await db.delete('channels', entityId)
}

/** Drop the whole store (logout / cluster eviction). */
export async function destroyOutsideEntityChannels(): Promise<void> {
  await destroyChannelDb()
}

/** The legacy card shape — an `outside_entity` content that still carries the key. */
interface LegacyKeyBearingCard {
  type: string
  entity_id?: string
  from_label?: string
  recipient_email?: string
  medic_pub?: string
  medic_priv_jwk?: JsonWebKey
  outside_pub?: string
  created_at?: string
  expires_at?: string
}

/**
 * MIGRATION — lift channel keys out of legacy `outside_entity` control messages.
 *
 * Channels minted before the key moved keep `medic_priv_jwk` inside the card content.
 * Nothing reads it there any more, so without this an in-flight channel would go
 * silently unreadable the moment the medic upgraded. Scans the hydrated conversations
 * and writes any key-bearing card into the store.
 *
 * Idempotent and non-destructive: an existing record always wins (it is the live one),
 * and the card is left untouched — the field is harmless once the store has it, and
 * rewriting messages during hydration risks tripping the tombstone guards.
 *
 * Safe to delete once no pre-migration channel can still be alive (they expire at 24h).
 */
export async function migrateLegacyChannelKeys(
  conversations: Record<string, { content?: unknown }[]>,
): Promise<number> {
  const now = Date.now()
  let migrated = 0
  for (const msgs of Object.values(conversations)) {
    for (const m of msgs) {
      const c = m.content as LegacyKeyBearingCard | undefined
      if (c?.type !== 'outside_entity' || !c.medic_priv_jwk || !c.entity_id) continue
      if (!c.expires_at || new Date(c.expires_at).getTime() <= now) continue
      const db = await getDb()
      if (await db.get('channels', c.entity_id)) continue
      try {
        await putOutsideEntityChannel({
          entity_id: c.entity_id,
          from_label: c.from_label ?? 'Medical section',
          recipient_email: c.recipient_email ?? '',
          medic_pub: c.medic_pub ?? '',
          medic_priv_jwk: c.medic_priv_jwk,
          outside_pub: c.outside_pub ?? '',
          created_at: c.created_at ?? new Date().toISOString(),
          expires_at: c.expires_at,
        })
        migrated++
      } catch (e) {
        logger.warn(`Could not migrate legacy channel ${c.entity_id}:`, e instanceof Error ? e.message : e)
      }
    }
  }
  if (migrated > 0) logger.info(`Migrated ${migrated} legacy outbound channel key(s) out of message content`)
  return migrated
}
