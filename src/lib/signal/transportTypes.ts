/**
 * TypeScript types for Signal Protocol Supabase transport layer.
 *
 * These map to the `signal_key_bundles` and `signal_messages` tables
 * and the `consume_peer_bundle` RPC return shape.
 */

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
  sender_id: string
  recipient_id: string
  sender_device_id: string | null
  recipient_device_id: string | null
  message_type: 'initial' | 'message' | 'request' | 'request-accepted'
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
  messageType: 'initial' | 'message' | 'request' | 'request-accepted'
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
  messageType: 'initial' | 'message' | 'request' | 'request-accepted'
  createdAt: string
  readAt: string | null
}
