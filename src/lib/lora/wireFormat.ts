/**
 * LoRa Mesh — binary wire format codec.
 *
 * Encodes/decodes LoRaFrame and ConfirmationFrame to/from compact
 * Uint8Array for transmission over LoRa radio (250 byte limit).
 *
 * Uses DataView for endian-safe binary packing (big-endian / network order).
 */

import type { LoRaFrame, ConfirmationFrame, LoRaMessageType } from './types'
import { LORA_HEADER_FIXED, LORA_PATH_ENTRY, LORA_SIGNATURE } from './types'

// ---- Frame Encoding ----

/** Serialize a LoRaFrame to bytes for transmission. */
export function encodeFrame(frame: LoRaFrame): Uint8Array {
  const pathBytes = frame.pathLength * LORA_PATH_ENTRY
  const totalLen = LORA_HEADER_FIXED + pathBytes + frame.payload.length + LORA_SIGNATURE
  const buf = new ArrayBuffer(totalLen)
  const view = new DataView(buf)
  const out = new Uint8Array(buf)
  let offset = 0

  // Header
  view.setUint8(offset++, frame.version)
  view.setUint8(offset++, frame.type)

  out.set(frame.messageId, offset); offset += 16
  out.set(frame.senderId, offset); offset += 8
  out.set(frame.recipientId, offset); offset += 8

  view.setUint32(offset, frame.sequence); offset += 4
  view.setUint32(offset, frame.timestamp); offset += 4
  view.setUint8(offset++, frame.hopCount)
  view.setUint8(offset++, frame.maxHops)
  view.setUint8(offset++, frame.segmentInfo)
  view.setUint8(offset++, frame.pathLength)

  // Path
  out.set(frame.path.subarray(0, pathBytes), offset); offset += pathBytes

  // Payload
  out.set(frame.payload, offset); offset += frame.payload.length

  // Signature (last 8 bytes)
  out.set(frame.signature.subarray(0, LORA_SIGNATURE), offset)

  return out
}

/** Deserialize bytes into a LoRaFrame. Returns null on invalid data. */
export function decodeFrame(bytes: Uint8Array): LoRaFrame | null {
  if (bytes.length < LORA_HEADER_FIXED + LORA_SIGNATURE) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  const version = view.getUint8(offset++)
  const type = view.getUint8(offset++) as LoRaMessageType
  if (type !== 0x01 && type !== 0x02 && type !== 0x03) return null

  const messageId = bytes.slice(offset, offset + 16); offset += 16
  const senderId = bytes.slice(offset, offset + 8); offset += 8
  const recipientId = bytes.slice(offset, offset + 8); offset += 8

  const sequence = view.getUint32(offset); offset += 4
  const timestamp = view.getUint32(offset); offset += 4
  const hopCount = view.getUint8(offset++)
  const maxHops = view.getUint8(offset++)
  const segmentInfo = view.getUint8(offset++)
  const pathLength = view.getUint8(offset++)

  const pathBytes = pathLength * LORA_PATH_ENTRY
  if (bytes.length < LORA_HEADER_FIXED + pathBytes + LORA_SIGNATURE) return null

  const path = bytes.slice(offset, offset + pathBytes); offset += pathBytes

  // Payload = everything between path and trailing signature
  const payloadEnd = bytes.length - LORA_SIGNATURE
  const payload = bytes.slice(offset, payloadEnd)

  const signature = bytes.slice(payloadEnd, payloadEnd + LORA_SIGNATURE)

  return {
    version, type, messageId, senderId, recipientId,
    sequence, timestamp, hopCount, maxHops, segmentInfo,
    pathLength, path, payload, signature,
  }
}

// ---- Confirmation Encoding ----

/** Confirmation frame is fixed at 45 bytes (version+type+msgId+recipient+sender+ts+sig). */
const CONFIRMATION_SIZE = 1 + 1 + 16 + 8 + 8 + 4 + LORA_SIGNATURE // 46

export function encodeConfirmation(conf: ConfirmationFrame): Uint8Array {
  const buf = new ArrayBuffer(CONFIRMATION_SIZE)
  const view = new DataView(buf)
  const out = new Uint8Array(buf)
  let offset = 0

  view.setUint8(offset++, conf.version)
  view.setUint8(offset++, conf.type)
  out.set(conf.messageId, offset); offset += 16
  out.set(conf.recipientId, offset); offset += 8
  out.set(conf.senderId, offset); offset += 8
  view.setUint32(offset, conf.timestamp); offset += 4
  out.set(conf.signature.subarray(0, LORA_SIGNATURE), offset)

  return out
}

export function decodeConfirmation(bytes: Uint8Array): ConfirmationFrame | null {
  if (bytes.length < CONFIRMATION_SIZE) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  const version = view.getUint8(offset++)
  const type = view.getUint8(offset++)
  if (type !== 0x02) return null

  const messageId = bytes.slice(offset, offset + 16); offset += 16
  const recipientId = bytes.slice(offset, offset + 8); offset += 8
  const senderId = bytes.slice(offset, offset + 8); offset += 8
  const timestamp = view.getUint32(offset); offset += 4
  const signature = bytes.slice(offset, offset + LORA_SIGNATURE)

  return { version, type: 0x02, messageId, recipientId, senderId, timestamp, signature }
}

// ---- UUID Conversion ----

/** Convert a UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000") to 16 raw bytes. */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) throw new Error(`Invalid UUID: ${uuid}`)
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Convert 16 raw bytes back to a UUID string with dashes. */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error('Expected 16 bytes for UUID')
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// ---- Short ID (8-byte truncated SHA-256) ----

/** Derive an 8-byte short ID from a full Supabase user UUID via SHA-256. */
export async function userIdToShortId(userId: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(userId)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return new Uint8Array(hash).slice(0, 8)
}

/** Convert an 8-byte ID to a 16-character hex string. */
export function shortIdToHex(id: Uint8Array): string {
  return bytesToHex(id.subarray(0, 8))
}

// ---- HMAC Signature ----

/** Compute a truncated HMAC-SHA256 (first 8 bytes) over raw frame bytes. */
export async function computeSignature(
  frameBytes: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign('HMAC', key, frameBytes)
  return new Uint8Array(sig).slice(0, LORA_SIGNATURE)
}

// ---- Segmentation ----

/** Split a payload into segments that fit within maxPayloadBytes. */
export function segmentPayload(payload: Uint8Array, maxPayloadBytes: number): Uint8Array[] {
  if (payload.length <= maxPayloadBytes) return [payload]

  const segments: Uint8Array[] = []
  let offset = 0
  while (offset < payload.length) {
    const end = Math.min(offset + maxPayloadBytes, payload.length)
    segments.push(payload.slice(offset, end))
    offset = end
  }

  if (segments.length > 15) {
    throw new Error(`Payload too large: ${segments.length} segments (max 15)`)
  }

  return segments
}

/**
 * Reassemble segments into a complete payload.
 * Returns null if any segment is missing.
 */
export function reassemblePayload(
  segments: Map<number, Uint8Array>,
  total: number,
): Uint8Array | null {
  if (segments.size !== total) return null

  let totalLen = 0
  for (let i = 0; i < total; i++) {
    const seg = segments.get(i)
    if (!seg) return null
    totalLen += seg.length
  }

  const result = new Uint8Array(totalLen)
  let offset = 0
  for (let i = 0; i < total; i++) {
    const seg = segments.get(i)!
    result.set(seg, offset)
    offset += seg.length
  }

  return result
}

// ---- Internal Helpers ----

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
