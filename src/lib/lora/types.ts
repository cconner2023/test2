/**
 * LoRa Mesh — type definitions and constants.
 *
 * Compact binary wire format designed for LoRa's 250-byte payload limit.
 * All types are self-contained — no dependencies on Signal Protocol.
 */

// ---- Wire Format ----

/** Frame types on the mesh network. */
export type LoRaMessageType =
  | 0x01  // Data — encrypted Signal payload
  | 0x02  // Confirmation — delivery acknowledgement
  | 0x03  // KillSwitch — stop propagation of a message

/**
 * Binary message frame for LoRa transmission.
 *
 * Fixed header: 45 bytes + variable path segment + payload + 8-byte signature.
 * Fits within LoRa's 250-byte max payload.
 */
export interface LoRaFrame {
  version: number           // 1 byte  — 0x01 for Phase 1
  type: LoRaMessageType     // 1 byte
  messageId: Uint8Array     // 16 bytes — UUID as raw bytes
  senderId: Uint8Array      // 8 bytes  — truncated SHA-256 of user UUID
  recipientId: Uint8Array   // 8 bytes  — truncated SHA-256 of user UUID
  sequence: number          // 4 bytes  — uint32
  timestamp: number         // 4 bytes  — unix epoch seconds, uint32
  hopCount: number          // 1 byte   — current hop count
  maxHops: number           // 1 byte   — TTL
  segmentInfo: number       // 1 byte   — 0 = single frame; upper 4 bits = index, lower 4 = total
  pathLength: number        // 1 byte   — number of 8-byte hops in path
  path: Uint8Array          // pathLength * 8 bytes — hop trail for return path
  payload: Uint8Array       // remaining bytes — encrypted Signal Protocol ciphertext
  signature: Uint8Array     // 8 bytes  — truncated HMAC for relay verification
}

/** Delivery acknowledgement sent back along the reverse path. */
export interface ConfirmationFrame {
  version: number           // 1 byte
  type: 0x02                // always Confirmation
  messageId: Uint8Array     // 16 bytes — references original message
  recipientId: Uint8Array   // 8 bytes  — original sender (confirmation target)
  senderId: Uint8Array      // 8 bytes  — confirming node
  timestamp: number         // 4 bytes
  signature: Uint8Array     // 8 bytes
}

// ---- Witness Record (IDB) ----

/** Tracks frames this node has seen/relayed, stored in IndexedDB. */
export interface WitnessRecord {
  messageId: string         // hex string of 16-byte ID
  senderId: string          // hex string of 8-byte truncated ID
  recipientId: string       // hex string of 8-byte truncated ID
  sequence: number
  timestamp: number         // epoch seconds (from frame)
  prevHop: string           // hex of 8-byte node that sent to us
  nextHop: string           // hex of 8-byte node we forwarded to (or 'self' if delivered)
  createdAt: number         // local Date.now() for TTL pruning
  confirmed: boolean        // set true when confirmation received
}

// ---- Route Cache (IDB) ----

/** Learned route to a destination, derived from observed traffic. */
export interface RouteEntry {
  destinationId: string     // hex 8-byte truncated ID
  nextHop: string           // hex 8-byte node to forward to
  fullPath: string[]        // ordered hex IDs from source to destination
  priority: number          // 0-255 (higher = better route)
  lastSuccess: number       // epoch seconds
  ttl: number               // epoch seconds when entry expires
}

// ---- Mesh Adapter ----

import type { Result } from '../result'

export type MeshAdapterState = 'disconnected' | 'connecting' | 'connected' | 'error'
export type BleConnectionState = MeshAdapterState  // backward compat

export interface MeshAdapterEvents {
  onStateChange: (state: MeshAdapterState) => void
  onReceive: (frame: Uint8Array) => void  // raw bytes from LoRa module
  onError: (error: string) => void
}
export type BleAdapterEvents = MeshAdapterEvents  // backward compat

export interface MeshAdapter {
  state: MeshAdapterState
  requestDevice(): Promise<Result<void>>
  connect(): Promise<Result<void>>
  disconnect(): void
  isConnected(): boolean
  send(data: Uint8Array): Promise<Result<void>>
  startAutoReconnect(intervalMs?: number): void
  stopAutoReconnect(): void
}

// ---- Node Identity ----

/** This node's identity on the LoRa mesh. */
export interface LoRaNodeId {
  userId: string            // full Supabase UUID
  shortId: Uint8Array       // 8-byte truncated SHA-256
  shortIdHex: string        // hex string of shortId
}

// ---- Constants ----

/** Maximum LoRa radio payload in bytes. */
export const LORA_MAX_PAYLOAD = 250

/** Fixed header size before path segment. */
export const LORA_HEADER_FIXED = 46 // version(1)+type(1)+msgId(16)+sender(8)+recipient(8)+seq(4)+ts(4)+hop(1)+maxHop(1)+seg(1)+pathLen(1)

/** Bytes per path hop entry. */
export const LORA_PATH_ENTRY = 8

/** Truncated HMAC signature size. */
export const LORA_SIGNATURE = 8

/** Maximum allowed hops before frame is dropped. */
export const LORA_MAX_HOPS = 10

/** Witness records expire after this many days. */
export const WITNESS_TTL_DAYS = 7

/** Confirmed witness records expire faster (hours). */
export const WITNESS_CONFIRMED_TTL_HOURS = 24

/** Route cache entries expire after this many days. */
export const ROUTE_TTL_DAYS = 30

/** Maximum witness records before budget pruning. */
export const MAX_WITNESS_RECORDS = 10_000

/** Maximum route cache entries. */
export const MAX_ROUTE_ENTRIES = 1_000

// ---- BLE GATT UUIDs (Nordic UART Service pattern) ----

export const LORA_BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
export const LORA_BLE_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // write to module
export const LORA_BLE_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // notify from module
