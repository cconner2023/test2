/**
 * Canonical MGRS formatter — single source of truth for how the US Army's
 * Military Grid Reference System is rendered across Beacon (map readouts,
 * MEDEVAC LINE 1, SITREP LOCATION, strip-map legs, presence labels).
 *
 * Canonical Army-readable form: `GZD SQ EEEEE NNNNN` (spaces between fields),
 * e.g. `18S UJ 23371 06519`. The `mgrs` library accepts spaces in input, so
 * storing the spaced form round-trips cleanly through `toPoint()`.
 *
 * Precision digits (each side of the easting/northing):
 *   1 = 10 km, 2 = 1 km, 3 = 100 m, 4 = 10 m, 5 = 1 m
 * Default 5 (1 m) matches GPS-derived precision; ground-element readback
 * traditionally uses 4 (10 m, 8-digit grid).
 */

import { forward } from 'mgrs'

/** Strip whitespace and uppercase — safe to feed to the `mgrs` library or to compare. */
export function normalizeMgrs(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/**
 * Split an MGRS string into its four canonical parts. Accepts compact
 * (`18SUJ2337106519`) or spaced (`18S UJ 23371 06519`) input. Returns null
 * if the string doesn't match the MGRS grammar.
 */
export function parseMgrsParts(input: string): {
  gzd: string        // e.g. "18S" (1–2 digit zone + 1 letter band)
  square: string     // e.g. "UJ"  (2 letters)
  easting: string    // 1–5 digits
  northing: string   // 1–5 digits (same length as easting)
} | null {
  const s = normalizeMgrs(input)
  const m = /^([0-9]{1,2}[C-X])([A-Z]{2})(\d*)$/.exec(s)
  if (!m) return null
  const [, gzd, square, digits] = m
  if (digits.length % 2 !== 0) return null
  const half = digits.length / 2
  return {
    gzd,
    square,
    easting: digits.slice(0, half),
    northing: digits.slice(half),
  }
}

/**
 * Render an MGRS string in canonical Army readback form with spaces between
 * each field. Returns the input unchanged if it can't be parsed (preserves
 * "—" placeholders and partial user input).
 */
export function formatMgrs(input: string): string {
  if (!input) return input
  const parts = parseMgrsParts(input)
  if (!parts) return input
  if (!parts.easting) return `${parts.gzd} ${parts.square}`
  return `${parts.gzd} ${parts.square} ${parts.easting} ${parts.northing}`
}

/** Convert lat/lng to canonical spaced MGRS. Returns empty string on failure. */
export function latLngToMgrs(lat: number, lng: number, precision = 5): string {
  try {
    return formatMgrs(forward([lng, lat], precision))
  } catch {
    return ''
  }
}

/**
 * Just the orientation anchor (GZD + 100 km square), e.g. `18S UJ`. Used by
 * the map corner badge so the numeric edge labels can be reconstructed into
 * a full grid.
 */
export function mgrsSquareLabel(lat: number, lng: number): string {
  try {
    const parts = parseMgrsParts(forward([lng, lat], 1))
    return parts ? `${parts.gzd} ${parts.square}` : ''
  } catch {
    return ''
  }
}
