/**
 * Best-effort georeference parser for PDF files (Phase 3.2b).
 *
 * Scans the raw PDF bytes for two well-known georeference structures and
 * returns the implied [west, south, east, north] bbox if found:
 *
 *   1. PDF 1.7 / ISO 32000 Viewport-Measure with subtype GEO
 *      Looks for `/Subtype /GEO` near a `/GPTS [lat lng ...]` array.
 *      Modern Avenza-output, Esri ArcGIS Maps for Office, USGS US Topo.
 *
 *   2. Adobe geospatial extension `/LGIDict` with `/Registration`
 *      Each row is `[pdf_x pdf_y geo_lng geo_lat]`. The implied bbox is
 *      the min/max of the geo columns.
 *
 * NOT a full PDF parser: this works only when the dictionary is in an
 * uncompressed object body or in the trailer. Compressed object streams
 * (encountered in linearized / heavily-compressed PDFs) will fall through
 * to "no georef found", and the user types bounds manually. That covers
 * "most mil-issued geo-PDFs" — best-effort by design.
 */

export interface DetectedGeoRef {
  bounds: [number, number, number, number]   // [west, south, east, north]
  source: 'vp-measure-gpts' | 'lgi-registration'
}

/**
 * Scan PDF bytes for a georeference; return null if none found.
 */
export function detectGeoRef(bytes: Uint8Array): DetectedGeoRef | null {
  // PDFs are predominantly ASCII for object metadata. A latin-1 decode is
  // safe for the substrings we care about (numbers + names).
  const text = bytesToLatin1(bytes)

  return detectViewportMeasure(text) ?? detectLgiRegistration(text)
}

// ─────────────────────────── PDF 1.7 /VP /Measure /GPTS ───────────────────────────

/**
 * Locate `/Subtype /GEO ... /GPTS [ n n n n n n n n ]` inside the PDF body.
 * GPTS is an 8-number array — four (lat, lng) pairs naming the corners of
 * the LPTS (PDF-space) bounding box. We collapse to a min/max bbox.
 *
 * We accept either `/GPTS` ordering [lat lng lat lng …] (PDF 1.7 spec) or
 * the swapped variant a few exporters emit; if the first pair lies outside
 * ±90 lat / ±180 lng we try swapping.
 */
function detectViewportMeasure(text: string): DetectedGeoRef | null {
  const subtypeRe = /\/Subtype\s*\/GEO/g
  let match: RegExpExecArray | null
  while ((match = subtypeRe.exec(text)) !== null) {
    // Search the next 4KB for /GPTS.
    const window = text.slice(match.index, match.index + 4096)
    const gpts = window.match(/\/GPTS\s*\[\s*([-+0-9eE.\s]+?)\s*\]/)
    if (!gpts) continue
    const nums = gpts[1].trim().split(/\s+/).map(Number)
    if (nums.length < 8 || nums.some(n => !Number.isFinite(n))) continue

    const pairs: [number, number][] = []
    for (let i = 0; i < 8; i += 2) pairs.push([nums[i], nums[i + 1]])

    // PDF 1.7 spec orders GPTS as (lat, lng) but a few exporters emit
    // (lng, lat). Try the spec order first; if any value is out of
    // geographic range OR all "latitudes" exceed all "longitudes" in
    // absolute value (a strong swap tell), reinterpret with the columns
    // swapped.
    const interpret = (swap: boolean) => {
      let minLat = Infinity, maxLat = -Infinity
      let minLng = Infinity, maxLng = -Infinity
      for (const [a, b] of pairs) {
        const lat = swap ? b : a
        const lng = swap ? a : b
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      }
      if (!(maxLat > minLat) || !(maxLng > minLng)) return null
      return [minLng, minLat, maxLng, maxLat] as [number, number, number, number]
    }

    // Pick the interpretation whose "latitude" magnitudes are smaller —
    // the right one. Both can succeed range checks at low latitudes/lngs;
    // disambiguating by magnitude is the cleanest tiebreaker.
    const a = interpret(false)
    const b = interpret(true)
    let bbox: [number, number, number, number] | null = null
    if (a && b) {
      const aLatMag = Math.max(Math.abs(a[1]), Math.abs(a[3]))
      const bLatMag = Math.max(Math.abs(b[1]), Math.abs(b[3]))
      bbox = aLatMag <= bLatMag ? a : b
    } else {
      bbox = a ?? b
    }
    if (!bbox) continue
    const [minLng, minLat, maxLng, maxLat] = bbox

    return {
      bounds: [minLng, minLat, maxLng, maxLat],
      source: 'vp-measure-gpts',
    }
  }
  return null
}

// ─────────────────────────── Adobe /LGIDict /Registration ───────────────────────────

/**
 * Extract control points from `/LGIDict ... /Registration [[...] [...] ...]`.
 * Each inner array is typically 4 numbers: pdf_x pdf_y geo_lng geo_lat. Some
 * generators emit 6-tuples with the extra two as elevation or projected x/y;
 * we pick the LAST two as the geographic pair when the row has ≥4 entries.
 *
 * Implied bbox = min/max of the geographic pair across all rows.
 */
function detectLgiRegistration(text: string): DetectedGeoRef | null {
  const lgi = text.search(/\/LGIDict\b/)
  if (lgi < 0) return null
  const window = text.slice(lgi, lgi + 8192)

  // Match /Registration followed by an outer [ … ] of inner arrays.
  const reg = window.match(/\/Registration\s*\[\s*((?:\[[-+0-9eE.\s]+\]\s*)+)\]/)
  if (!reg) return null

  const innerRe = /\[\s*([-+0-9eE.\s]+?)\s*\]/g
  let inner: RegExpExecArray | null
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  let count = 0

  while ((inner = innerRe.exec(reg[1])) !== null) {
    const nums = inner[1].trim().split(/\s+/).map(Number)
    if (nums.length < 4 || nums.some(n => !Number.isFinite(n))) continue
    // Pick the last two as the geographic pair: pdf_x pdf_y ... geo_lng geo_lat
    const lng = nums[nums.length - 2]
    const lat = nums[nums.length - 1]
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    count++
  }

  if (count < 2 || !(maxLat > minLat) || !(maxLng > minLng)) return null

  return {
    bounds: [minLng, minLat, maxLng, maxLat],
    source: 'lgi-registration',
  }
}

// ─────────────────────────── helpers ───────────────────────────

function bytesToLatin1(bytes: Uint8Array): string {
  // The DOM's TextDecoder('latin1') is fine in worker + jsdom; in older
  // node test envs we fall back to a manual loop.
  if (typeof TextDecoder !== 'undefined') {
    try { return new TextDecoder('latin1').decode(bytes) }
    catch { /* fall through */ }
  }
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

/** Convenience for the UI flow — accept a File and return detection. */
export async function detectGeoRefFromFile(file: File): Promise<DetectedGeoRef | null> {
  const buf = await file.arrayBuffer()
  return detectGeoRef(new Uint8Array(buf))
}
