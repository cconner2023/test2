/**
 * Barcode codec — compact encrypted Data Matrix encoding.
 *
 * Produces the smallest possible ASCII-safe barcode string by:
 *
 * 1. Binary packing: replaces "!{base64}" text segments with raw deflated
 *    bytes (\x00{2-byte-length}{bytes}), saving ~33% per segment.
 * 2. Outer deflateRaw: compresses the entire mixed buffer.
 * 3. AES-256-GCM encryption: PHI protection (+28 bytes for IV + auth tag).
 * 4. Base64 encoding: ASCII-safe for Data Matrix and ZXing decode.
 *
 * Output: "enc:" + base64(IV(12) + ciphertext + tag(16))
 *
 * Falls back to plain ASCII pipe-delimited when no encryption key available.
 */

import { deflateRaw, inflateRaw } from 'pako'
import bwipjs from 'bwip-js'
import { getBarcodeKey } from '../lib/cryptoService'
import { uint8ToBase64, base64ToUint8 } from './textCodec'
import { aesGcmEncrypt, aesGcmDecrypt } from '../lib/aesGcm'
import { logError } from './ErrorHandler'

/** Dual-format encrypted barcode: raw bytes for binary barcode, text for clipboard. */
export interface EncryptedBarcode {
  bytes: Uint8Array;   // raw IV + ciphertext + tag → binary barcode
  text: string;        // "enc:{base64(bytes)}" → clipboard/paste
}

// ---- Constants ----

/** Prefix for the encrypted barcode display/paste format. */
export const ENCRYPTED_PREFIX = 'enc:'

/**
 * Marker byte for embedded raw deflated blobs inside the mixed buffer.
 * 0x00 never appears in printable ASCII pipe-delimited content.
 */
const BLOB_MARKER = 0x00

// ---- Binary packing (strip base64 overhead from text segments) ----

/**
 * Replace each "!{base64}" compressed text segment with
 * \x00{2-byte big-endian length}{raw deflated bytes}, saving ~33% per segment.
 */
function packToMixedBinary(asciiPayload: string): Uint8Array {
  const parts = asciiPayload.split('|')
  const buffers: Uint8Array[] = []
  let totalLen = 0

  for (let pi = 0; pi < parts.length; pi++) {
    if (pi > 0) {
      buffers.push(new Uint8Array([0x7C])) // '|'
      totalLen += 1
    }

    const packed = packSegment(parts[pi])
    buffers.push(packed)
    totalLen += packed.length
  }

  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }
  return result
}

function packSegment(segment: string): Uint8Array {
  const prefix = segment[0]

  if ((prefix === 'H' || prefix === 'h') && segment[1] === '!') {
    return packPrefixedBlob(prefix, segment.substring(2))
  }

  if ((prefix === 'P' || prefix === 'p') && segment[1] === '!') {
    return packPrefixedBlob(prefix, segment.substring(2))
  }

  if ((prefix === 'N' || prefix === 'n') && segment[1] === '!') {
    return packPrefixedBlob(prefix, segment.substring(2))
  }

  if ((prefix === 'X' || prefix === 'x') && segment[1] === '!') {
    return packPrefixedBlob(prefix, segment.substring(2))
  }

  if (prefix === 'P' && (segment.startsWith('P3:') || segment.startsWith('P2:'))) {
    return packPECompact(segment)
  }

  if (prefix === 'U' || prefix === 'u') {
    return packUserSegment(segment)
  }

  return new TextEncoder().encode(segment)
}

function packPrefixedBlob(prefix: string, base64Content: string): Uint8Array {
  const raw = base64ToUint8(base64Content)
  const prefixBytes = new TextEncoder().encode(prefix)
  const result = new Uint8Array(prefixBytes.length + 3 + raw.length)
  result.set(prefixBytes, 0)
  result[prefixBytes.length] = BLOB_MARKER
  result[prefixBytes.length + 1] = (raw.length >> 8) & 0xFF
  result[prefixBytes.length + 2] = raw.length & 0xFF
  result.set(raw, prefixBytes.length + 3)
  return result
}

function packPECompact(segment: string): Uint8Array {
  const sections = segment.split('~')
  const packedSections: Uint8Array[] = []
  let totalLen = 0

  for (let si = 0; si < sections.length; si++) {
    if (si > 0) {
      packedSections.push(new Uint8Array([0x7E])) // '~'
      totalLen += 1
    }

    const sec = sections[si]

    if (si === 3) {
      const packed = packAbnormalDetails(sec)
      packedSections.push(packed)
      totalLen += packed.length
    } else if (si === 4 && sec.startsWith('!')) {
      const raw = base64ToUint8(sec.substring(1))
      const blob = new Uint8Array(3 + raw.length)
      blob[0] = BLOB_MARKER
      blob[1] = (raw.length >> 8) & 0xFF
      blob[2] = raw.length & 0xFF
      blob.set(raw, 3)
      packedSections.push(blob)
      totalLen += blob.length
    } else {
      const bytes = new TextEncoder().encode(sec)
      packedSections.push(bytes)
      totalLen += bytes.length
    }
  }

  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const buf of packedSections) {
    result.set(buf, offset)
    offset += buf.length
  }
  return result
}

function packAbnormalDetails(details: string): Uint8Array {
  if (!details) return new Uint8Array(0)

  const entries = details.split(',')
  const buffers: Uint8Array[] = []
  let totalLen = 0

  for (let ei = 0; ei < entries.length; ei++) {
    if (ei > 0) {
      buffers.push(new Uint8Array([0x2C])) // ','
      totalLen += 1
    }

    const entry = entries[ei]
    const bangIdx = entry.indexOf('.!')
    if (bangIdx >= 0) {
      const prefixPart = entry.substring(0, bangIdx + 1)
      const base64Part = entry.substring(bangIdx + 2)
      const prefixBytes = new TextEncoder().encode(prefixPart)
      const raw = base64ToUint8(base64Part)
      const buf = new Uint8Array(prefixBytes.length + 3 + raw.length)
      buf.set(prefixBytes, 0)
      buf[prefixBytes.length] = BLOB_MARKER
      buf[prefixBytes.length + 1] = (raw.length >> 8) & 0xFF
      buf[prefixBytes.length + 2] = raw.length & 0xFF
      buf.set(raw, prefixBytes.length + 3)
      buffers.push(buf)
      totalLen += buf.length
    } else {
      const bytes = new TextEncoder().encode(entry)
      buffers.push(bytes)
      totalLen += bytes.length
    }
  }

  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }
  return result
}

function packUserSegment(segment: string): Uint8Array {
  const segPrefix = segment[0]
  const value = segment.substring(1)
  const dotParts = value.split('.')
  if (dotParts.length >= 4) {
    const namesPart = dotParts.slice(3).join('.')
    if (namesPart.startsWith('!')) {
      const prefix = `${segPrefix}${dotParts[0]}.${dotParts[1]}.${dotParts[2]}.`
      const raw = base64ToUint8(namesPart.substring(1))
      const prefixBytes = new TextEncoder().encode(prefix)
      const result = new Uint8Array(prefixBytes.length + 3 + raw.length)
      result.set(prefixBytes, 0)
      result[prefixBytes.length] = BLOB_MARKER
      result[prefixBytes.length + 1] = (raw.length >> 8) & 0xFF
      result[prefixBytes.length + 2] = raw.length & 0xFF
      result.set(raw, prefixBytes.length + 3)
      return result
    }
  }
  return new TextEncoder().encode(segment)
}

// ---- Unpack: restore mixed binary back to ASCII pipe-delimited string ----

function unpackFromMixedBinary(data: Uint8Array): string {
  let result = ''
  let i = 0

  while (i < data.length) {
    if (data[i] === BLOB_MARKER) {
      const len = (data[i + 1] << 8) | data[i + 2]
      const raw = data.slice(i + 3, i + 3 + len)
      result += '!' + uint8ToBase64(raw)
      i += 3 + len
    } else {
      result += String.fromCharCode(data[i])
      i += 1
    }
  }

  return result
}

// ---- Encrypt / Decrypt ----

/**
 * Encrypt an ASCII barcode payload.
 *
 * Pipeline: pack (strip base64) → deflateRaw → AES-GCM → "enc:" + base64
 *
 * Returns the "enc:{base64}" string, or null if no encryption key available.
 */
export async function encryptBarcode(asciiPayload: string): Promise<string | null> {
  const key = await getBarcodeKey()
  if (!key) return null

  try {
    const packed = packToMixedBinary(asciiPayload)
    const compressed = deflateRaw(packed)

    const binary = await aesGcmEncrypt(key, compressed)

    return ENCRYPTED_PREFIX + uint8ToBase64(binary)
  } catch (err) {
    logError('barcodeCodec.encrypt', err)
    return null
  }
}

/**
 * Encrypt an ASCII barcode payload, returning both raw bytes and text formats.
 *
 * Pipeline: pack (strip base64) → deflateRaw → AES-GCM → { bytes, text: "enc:" + base64 }
 *
 * Returns null if no encryption key available.
 */
export async function encryptBarcodeWithBytes(asciiPayload: string): Promise<EncryptedBarcode | null> {
  const key = await getBarcodeKey()
  if (!key) return null

  try {
    const packed = packToMixedBinary(asciiPayload)
    const compressed = deflateRaw(packed)
    const binary = await aesGcmEncrypt(key, compressed)

    return {
      bytes: binary,
      text: ENCRYPTED_PREFIX + uint8ToBase64(binary),
    }
  } catch (err) {
    logError('barcodeCodec.encryptWithBytes', err)
    return null
  }
}

/**
 * Decrypt an "enc:{base64}" barcode string back to ASCII pipe-delimited format.
 *
 * Pipeline: base64 decode → AES-GCM decrypt → inflateRaw → unpack blobs → ASCII
 *
 * Returns the original ASCII string, or null on failure.
 */
export async function decryptBarcode(text: string): Promise<string | null> {
  if (!text.startsWith(ENCRYPTED_PREFIX)) return null

  const key = await getBarcodeKey()
  if (!key) return null

  try {
    const binary = base64ToUint8(text.slice(ENCRYPTED_PREFIX.length))

    const plainBytes = await aesGcmDecrypt(key, binary)

    const inflated = inflateRaw(plainBytes)
    return unpackFromMixedBinary(inflated)
  } catch (err) {
    logError('barcodeCodec.decrypt', err)
    return null
  }
}

/**
 * Decrypt raw bytes (from a binary Data Matrix scan) back to ASCII pipe-delimited format.
 *
 * Pipeline: AES-GCM decrypt → inflateRaw → unpack blobs → ASCII
 *
 * Skips base64 decode since raw bytes come directly from the scanner.
 */
export async function decryptBarcodeBytes(bytes: Uint8Array): Promise<string | null> {
  const key = await getBarcodeKey()
  if (!key) return null

  try {
    const plainBytes = await aesGcmDecrypt(key, bytes)
    const inflated = inflateRaw(plainBytes)
    return unpackFromMixedBinary(inflated)
  } catch (err) {
    logError('barcodeCodec.decryptBytes', err)
    return null
  }
}

/** Check if a string is an encrypted barcode ("enc:" prefix). */
export function isEncryptedBarcode(text: string): boolean {
  return !!text && text.startsWith(ENCRYPTED_PREFIX)
}

/** Convert a Uint8Array to a binary string (each byte → one char via charCode). Chunked to avoid call stack overflow. */
function bytesToBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return chunks.join('');
}

// ---- 3-path decrypt waterfall ----

/**
 * 3-path barcode decrypt waterfall.
 * 1. Raw binary bytes (from BYTE_SEGMENTS or camera scanner)
 * 2. Text-mode encrypted barcode ("enc:{base64}")
 * 3. Binary-mode barcode decoded as ISO-8859-1 (no "enc:" prefix, no pipes)
 * Falls through to plaintext if no decrypt path matches.
 * Returns null if decryption was needed but failed (missing key).
 */
export async function decryptBarcodePayload(
  text: string,
  rawBytes?: Uint8Array | null,
): Promise<string | null> {
  // Path 1: raw binary bytes available
  if (rawBytes && rawBytes.length > 0 && !isEncryptedBarcode(text)) {
    const decrypted = await decryptBarcodeBytes(rawBytes)
    if (decrypted) return decrypted
  }

  // Path 2: text-mode encrypted barcode ("enc:{base64}")
  if (isEncryptedBarcode(text)) {
    return decryptBarcode(text)
  }

  // Path 3: binary-mode barcode decoded as ISO-8859-1 (no "enc:" prefix, no pipes)
  if (!text.includes('|')) {
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    const decrypted = await decryptBarcodeBytes(bytes)
    if (decrypted) return decrypted
  }

  // Path 4: plain unencrypted pipe-delimited content
  return text
}

// ---- Shared Barcode Rendering ----

/**
 * Render a Data Matrix barcode to a canvas element.
 * Accepts either an ASCII-safe string (plain or "enc:{base64}") or raw Uint8Array (binary mode).
 */
export function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  encodedData: string | Uint8Array,
  options?: { scale?: number; padding?: number; backgroundcolor?: string }
): void {
  const isBinary = encodedData instanceof Uint8Array
  bwipjs.toCanvas(canvas, {
    bcid: 'datamatrix',
    text: isBinary ? bytesToBinaryString(encodedData) : encodedData,
    scale: options?.scale ?? 2,
    padding: options?.padding ?? 3,
    ...(isBinary ? { binarytext: true } : {}),
    ...(options?.backgroundcolor ? { backgroundcolor: options.backgroundcolor } : {}),
  })
}
