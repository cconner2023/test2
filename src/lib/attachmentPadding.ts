/**
 * Size-bucket padding for message-scoped attachment plaintext (R2 m/ and v/).
 *
 * Layout: [u32 BE realLen][bytes][zeros], total rounded up to
 * max(541, floor(1.05^ceil(log_1.05(len)))), Signal's scheme. Applied inside the
 * GCM plaintext, so the stored size leaks only a coarse bucket.
 *
 * Lives outside src/lib/signal so the anonymous public pages (on-call voicemail
 * recorder) can pad without pulling the Signal bundle in.
 */

export function paddedLength(len: number): number {
  return Math.max(541, Math.floor(1.05 ** Math.ceil(Math.log(len) / Math.log(1.05))))
}

export function padAttachment(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(paddedLength(bytes.byteLength + 4))
  new DataView(out.buffer).setUint32(0, bytes.byteLength, false)
  out.set(bytes, 4)
  return out
}

export function unpadAttachment(bytes: Uint8Array): Uint8Array {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false)
  if (len > bytes.byteLength - 4) throw new Error('Bad attachment padding')
  return bytes.slice(4, 4 + len)
}

/** Object keys whose plaintext is padded. Both sides decide by prefix; refs carry no flag. */
export const isPaddedKey = (key: string) => key.startsWith('m/') || key.startsWith('v/')
