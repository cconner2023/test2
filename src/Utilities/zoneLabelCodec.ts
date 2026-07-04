/**
 * Opaque property-ZONE label tag codec — the zone sibling of itemLabelCodec.
 *
 * A printed Data Matrix encodes only `BCN-ZONE:<uuid>` — the zone's opaque id.
 * No name on the printed symbol, so a scanned zone label resolves to a zone by
 * id alone and carries no operational detail itself. Shared by the label
 * generator (encode) and the scanner (parse). Distinct prefix from BCN-ITEM so
 * one scanner disambiguates item vs zone deterministically.
 */

const PREFIX = 'BCN-ZONE:'

/** Encode a zone (property_location) id into its opaque Data Matrix payload. */
export function encodeZoneTag(zoneId: string): string {
  return `${PREFIX}${zoneId}`
}

/**
 * Parse a scanned Data Matrix payload back to a zone id.
 * Returns the id when the payload is one of our zone tags, else null.
 */
export function parseZoneTag(text: string | null | undefined): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  const id = trimmed.slice(PREFIX.length).trim()
  return id.length > 0 ? id : null
}
