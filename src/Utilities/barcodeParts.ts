/**
 * Multi-symbol Data Matrix — splits one encrypted envelope (IV + ciphertext +
 * GCM tag) across up to 25 symbols so long notes print as a scannable series.
 *
 * Split happens AFTER encryption: a single symbol is meaningless on its own, and
 * the GCM tag authenticates the reassembled envelope — a missing, foreign or
 * corrupted part fails decrypt instead of yielding a garbled note.
 *
 * Every part carries a 7-byte header, so any symbol scanned first reveals the
 * total; scan order is irrelevant and no end marker is needed.
 *
 *   [0] MAGIC — 0xD1 encrypted envelope v1, 0xD2 plaintext (UTF-8) v1
 *   [1..3] set id — envelope: its first 3 bytes (random IV); plaintext: FNV-1a hash
 *   [4] index (0-based)
 *   [5] total (2..25)
 *   [6] CRC-8 of bytes 0..5
 *
 * Single-symbol (legacy) envelopes have no header. Their first byte is random IV,
 * so a legacy symbol can rarely parse as a part — callers probe a direct decrypt
 * of the first part's raw bytes before trusting it (see useBarcodeImport).
 *
 * Plaintext (no encryption key / guest) long payloads split the same way under
 * 0xD2 — a header-less plaintext symbol is printable ASCII, so it never parses.
 *
 * The app-side "enc:" string is never split — copy/paste text stays one string.
 */

export const PART_MAGIC = 0xD1
export const PART_MAGIC_PLAIN = 0xD2
export const PART_HEADER_BYTES = 7
/** Envelopes at or below this print as one legacy (header-less) symbol. */
export const PART_SINGLE_MAX = 600
/** Target payload per symbol — mid-size symbols scan far more reliably than 144×144. */
export const PART_TARGET_BYTES = 500
/** Largest binary-mode Data Matrix (1555B) minus the header. */
export const PART_DATA_MAX = 1555 - PART_HEADER_BYTES
/** Fills the DD689 bottom-half 5×5 grid. */
export const MAX_PARTS = 25

export interface BarcodePart {
  setId: number
  index: number
  total: number
  /** Payload is plaintext UTF-8 rather than an encrypted envelope */
  plain: boolean
  data: Uint8Array
}

/**
 * The payload bytes of a scanned symbol when it was binary-mode — BYTE_SEGMENTS
 * when the reader gave them, else the ISO-8859-1 text. Null for text-mode symbols
 * ("enc:" strings and printable plaintext).
 */
export function scannedSymbolBytes(text: string, rawBytes?: Uint8Array | null): Uint8Array | null {
  if (rawBytes && rawBytes.length > 0) return rawBytes
  if (!text || text.startsWith('enc:') || /^[\x20-\x7E\r\n]*$/.test(text)) return null
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xFF
  return bytes
}

function crc8(bytes: Uint8Array): number {
  let crc = 0
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let b = 0; b < 8; b++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF
  }
  return crc
}

function fnv24(bytes: Uint8Array): number {
  let h = 0x811C9DC5
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0
  return h & 0xFFFFFF
}

function splitWithHeader(payload: Uint8Array, magic: number, setId: number): Uint8Array[] {
  const total = Math.min(MAX_PARTS, Math.ceil(payload.length / PART_TARGET_BYTES))
  const size = Math.ceil(payload.length / total)
  if (size > PART_DATA_MAX) throw new Error('Note too large to print as barcodes')

  const parts: Uint8Array[] = []
  for (let index = 0; index < total; index++) {
    const data = payload.subarray(index * size, Math.min(payload.length, (index + 1) * size))
    const out = new Uint8Array(PART_HEADER_BYTES + data.length)
    out[0] = magic
    out[1] = (setId >> 16) & 0xFF
    out[2] = (setId >> 8) & 0xFF
    out[3] = setId & 0xFF
    out[4] = index
    out[5] = total
    out[6] = crc8(out.subarray(0, 6))
    out.set(data, PART_HEADER_BYTES)
    parts.push(out)
  }
  return parts
}

/**
 * Split an encrypted envelope into per-symbol byte payloads.
 * Returns `[envelope]` unchanged (no header) when it fits one legacy symbol.
 * Throws if the envelope exceeds 25 maximum-size symbols.
 */
export function splitEnvelope(envelope: Uint8Array): Uint8Array[] {
  if (envelope.length <= PART_SINGLE_MAX) return [envelope]
  return splitWithHeader(envelope, PART_MAGIC, (envelope[0] << 16) | (envelope[1] << 8) | envelope[2])
}

/**
 * Split long plaintext into per-symbol byte payloads (0xD2 parts).
 * Returns null when it fits one legacy text-mode symbol — print it as-is.
 */
export function splitPlaintext(text: string): Uint8Array[] | null {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= PART_SINGLE_MAX) return null
  return splitWithHeader(bytes, PART_MAGIC_PLAIN, fnv24(bytes))
}

/** Parse a scanned symbol's bytes as a multi-symbol part; null if it isn't one. */
export function parseBarcodePart(bytes: Uint8Array | null | undefined): BarcodePart | null {
  if (!bytes || bytes.length <= PART_HEADER_BYTES) return null
  if (bytes[0] !== PART_MAGIC && bytes[0] !== PART_MAGIC_PLAIN) return null
  if (crc8(bytes.subarray(0, 6)) !== bytes[6]) return null
  const index = bytes[4]
  const total = bytes[5]
  if (total < 2 || total > MAX_PARTS || index >= total) return null
  return {
    setId: (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    index,
    total,
    plain: bytes[0] === PART_MAGIC_PLAIN,
    data: bytes.slice(PART_HEADER_BYTES),
  }
}

export type CollectStatus = 'new' | 'duplicate' | 'other-set'

/** Accumulates parts of one set, in any order. In-memory only. */
export class BarcodePartCollector {
  private _setId: number | null = null
  private _total = 0
  private _plain = false
  private parts = new Map<number, Uint8Array>()

  /** Adds a part. A part from a different set is rejected ('other-set') — call reset() to switch. */
  add(part: BarcodePart): CollectStatus {
    if (this._setId === null) {
      this._setId = part.setId
      this._total = part.total
      this._plain = part.plain
    } else if (part.setId !== this._setId || part.total !== this._total || part.plain !== this._plain) {
      return 'other-set'
    }
    if (this.parts.has(part.index)) return 'duplicate'
    this.parts.set(part.index, part.data)
    return 'new'
  }

  /** Set in progress (null when empty). */
  get setId(): number | null { return this._setId }
  get total(): number { return this._total }
  /** The set carries plaintext UTF-8 (decode with TextDecoder) rather than an envelope. */
  get plain(): boolean { return this._plain }
  get count(): number { return this.parts.size }
  get isEmpty(): boolean { return this.parts.size === 0 }
  get isComplete(): boolean { return this._total > 0 && this.parts.size === this._total }
  /** Received indexes, ascending. */
  get received(): number[] { return [...this.parts.keys()].sort((a, b) => a - b) }

  /** Reassembled envelope; throws if incomplete. */
  assemble(): Uint8Array {
    if (!this.isComplete) throw new Error('Barcode set incomplete')
    let len = 0
    for (const d of this.parts.values()) len += d.length
    const out = new Uint8Array(len)
    let offset = 0
    for (let i = 0; i < this._total; i++) {
      const d = this.parts.get(i)!
      out.set(d, offset)
      offset += d.length
    }
    return out
  }

  reset(): void {
    this._setId = null
    this._total = 0
    this._plain = false
    this.parts.clear()
  }
}
