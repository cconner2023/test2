// Utilities/noteDecode.ts
// Detect a shared Beacon encoded note embedded in chat text. Mirrors
// dateDetect.ts: a cheap, sync scan over already-decrypted LOCAL plaintext that
// drives a "decode" affordance. The actual decode (decrypt + parse) happens on
// tap in DecodedNotePreview — this only recognises the token and extracts it.
//
// Recognised prefixes (the "enc:" family of share payloads):
//   enc:<base64>   — AES-GCM encrypted barcode (clinical note / TC3 / etc.)
//   9L:<…>         — 9-Line MEDEVAC compact
//   TC3|<…>        — TC3 casualty card
//   <SYMPTOM>|<…>  — plain (unencrypted) ADTMC note, e.g. "A1|…"
//   PRV|<…>        — plain provider note
// No wire/PHI exposure: encrypted payloads stay ciphertext on the wire; the
// preview only ever decrypts on-device, exactly like the barcode import flow.

export interface EncodedNoteHit {
  /** The extracted encoded token, ready to hand to the decode pipeline. */
  token: string
}

/**
 * Scan message text for a shareable encoded note. Returns the extracted token,
 * or null when nothing recognisable is present (no icon should float).
 */
export function detectEncodedNote(text: string): EncodedNoteHit | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  // Encrypted barcode — may sit inline in a sentence. Payload is base64, so it
  // never contains whitespace; the length floor avoids matching a bare "enc:".
  const enc = /enc:[A-Za-z0-9+/=_-]{16,}/.exec(trimmed)
  if (enc) return { token: enc[0] }

  // The remaining forms are whole-message shares with an explicit leading
  // prefix — match against the first line only.
  const firstLine = trimmed.split(/\r?\n/)[0].trim()
  if (firstLine.startsWith('9L:')) return { token: firstLine }
  if (firstLine.startsWith('TC3|')) return { token: firstLine }
  if (/^(PRV|[A-Z]\d{1,2})\|/.test(firstLine)) return { token: firstLine }

  return null
}
