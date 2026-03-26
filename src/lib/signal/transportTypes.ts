/**
 * TypeScript types for Signal Protocol Supabase transport layer.
 *
 * These map to the `signal_key_bundles` and `signal_messages` tables
 * and the `consume_peer_bundle` RPC return shape.
 */

// ---- Protocol Message Types ----

/** All wire-level message types in the Signal transport layer. */
export type SignalMessageType =
  | 'initial'                   // X3DH key exchange (first message to a new device)
  | 'message'                   // User-visible chat message
  | 'request'                   // Contact/group request
  | 'request-accepted'          // Contact/group request acceptance
  | 'sync'                      // Multi-device sync (own devices only)
  | 'delete'                    // Delete-for-everyone
  | 'receipt'                   // Delivery receipt (not user-visible, no push notification)
  | 'sender-key-distribution'   // Sender key distribution via 1:1 pairwise session
  | 'sender-key-message'        // Group message encrypted with sender key (pre-encrypted, no Double Ratchet)
  | 'clinic-vault'              // Clinic entity shared-key message (symmetric AES, no Signal session required)

// ---- Device Hierarchy ----

export type DeviceRole = 'primary' | 'linked' | 'provisional'

export interface DeviceRegistrationResult {
  registered: boolean
  role?: DeviceRole
  hasPrimary?: boolean
  primaryDeviceId?: string | null
  error?: string
}

export interface SyncMessagePayload {
  forPeerId: string           // peer this message belongs to
  serialized: string          // serializeContent() output
  originalMessageType: 'initial' | 'message' | 'request' | 'request-accepted' | 'delete'
  originalTimestamp: string
  originalMessageId: string   // for dedup on receiving device
  forGroupId?: string         // group this message belongs to (if group message)
  originId?: string           // shared origin UUID for delete-for-everyone
}

// ---- Key Bundle Row (signal_key_bundles) ----

export interface SignalKeyBundleRow {
  user_id: string
  device_id: string
  identity_signing_key: string
  identity_dh_key: string
  signed_pre_key_id: number
  signed_pre_key: string
  signed_pre_key_sig: string
  one_time_pre_keys: Array<{ keyId: number; publicKey: string }>
  updated_at: string
}

// ---- consume_peer_bundle RPC result ----

export interface PeerBundleRpcResult {
  userId: string
  deviceId: string
  identitySigningKey: string
  identityDhKey: string
  signedPreKeyId: number
  signedPreKey: string
  signedPreKeySig: string
  oneTimePreKey: { keyId: number; publicKey: string } | null
}

// ---- Message Row (signal_messages) ----

export interface SignalMessageRow {
  [key: string]: unknown
  id: string
  sender_id: string | null   // nullable (sealed sender — not stored in DB)
  recipient_id: string
  sender_device_id: string | null
  recipient_device_id: string | null
  group_id: string | null
  origin_id: string | null
  message_type: SignalMessageType
  payload: Record<string, unknown>
  created_at: string
  read_at: string | null
}

/** A registered device for a peer (returned by fetch_peer_devices RPC). */
export interface PeerDevice {
  deviceId: string
  deviceLabel: string | null
  lastActiveAt: string
}

/** Input for one device-specific message in a fan-out send. */
export interface FanOutMessageInput {
  recipientDeviceId: string
  payload: Record<string, unknown>
  messageType: SignalMessageType
}

// ---- Decrypted message surfaced to the UI ----

import type { MessageContent } from './messageContent'

export interface DecryptedSignalMessage {
  id: string
  senderId: string
  recipientId: string
  plaintext: string
  /** Structured content (text or image). Populated after parsing the decrypted payload. */
  content?: MessageContent
  messageType: SignalMessageType
  createdAt: string
  readAt: string | null
  /** Delivery status for outgoing messages (undefined = delivered/incoming). */
  status?: 'sending' | 'delivered'
  /** Root message ID this message is a reply to (thread ID). */
  threadId?: string
  /** Short preview of the root message text (for display without lookup). */
  replyPreview?: string
  /** Group ID if this is a group message (null/undefined = 1:1). */
  groupId?: string
  /** Shared origin UUID across all fan-out copies (for delete-for-everyone). */
  originId?: string
  /** Populated on read-sync messages — signals that peer's messages were read on another device. */
  _readSync?: { peerId: string; messageIds: string[]; readAt: string }
  /** Present when this message is a delivery receipt (not a user-visible message). */
  _deliveryReceipt?: { messageIds: string[]; deliveredAt: string }
}
