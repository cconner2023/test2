/**
 * Opaque property-item label tag codec.
 *
 * A printed Data Matrix encodes only `BCN-ITEM:<uuid>` — the item's opaque id.
 * No name / NSN / serial on the wire-equivalent (the printed symbol), so a
 * scanned label resolves to a row by id alone and carries no PHI/operational
 * detail itself. Shared by the label generator (encode) and the scanner (parse).
 */

const PREFIX = 'BCN-ITEM:'

/** Encode an item id into its opaque Data Matrix payload. */
export function encodeItemTag(itemId: string): string {
  return `${PREFIX}${itemId}`
}

/**
 * Parse a scanned Data Matrix payload back to an item id.
 * Returns the id when the payload is one of our item tags, else null.
 */
export function parseItemTag(text: string | null | undefined): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  const id = trimmed.slice(PREFIX.length).trim()
  return id.length > 0 ? id : null
}
