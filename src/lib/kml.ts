/**
 * KML 2.2 parser + serializer for Beacon OverlayFeatures.
 *
 * Mappings:
 *   <Placemark><Point>          ↔ type='waypoint'
 *   <Placemark><LineString>     ↔ type='route'
 *   <Placemark><Polygon>        ↔ type='area' (outer LinearRing only)
 *
 * KML colors are AABBGGRR (alpha + reverse-RGB hex). We translate to/from
 * `#RRGGBB` hex on the boundary. CSS-var color tokens (the in-memory default
 * shape: `var(--color-themeblue2)`) cannot be expressed in KML, so on export
 * we resolve them to a fallback hex; on import a parsed hex flows in as-is.
 *
 * Round-trip preservation: id and waypoint glyph live in <ExtendedData>
 * under the `beacon:` prefix.
 */

import type { OverlayFeature, FeatureType, WaypointType } from '../Types/MapOverlayTypes'
import { DEFAULT_FEATURE_STYLE } from '../Types/MapOverlayTypes'

const FALLBACK_HEX = '#3b82f6'

// ─────────────────────────── PARSE ───────────────────────────

export interface ParseResult {
  features: OverlayFeature[]
  suggestedName: string | null
}

export function parseKML(xml: string, overlayId: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid KML: XML parse error')
  }
  const root = doc.documentElement
  if (root.localName !== 'kml') {
    throw new Error(`Invalid KML: root element is <${root.localName}>, expected <kml>`)
  }

  const styleMap = collectStyles(root)
  const features: OverlayFeature[] = []
  const now = new Date().toISOString()

  for (const placemark of Array.from(root.getElementsByTagName('Placemark'))) {
    const name = textChild(placemark, 'name') ?? ''
    const desc = textChild(placemark, 'description') ?? undefined
    const styleHex = resolveStyleColor(placemark, styleMap)
    const id = extData(placemark, 'beacon:id') ?? crypto.randomUUID()
    const tc3CardId = extData(placemark, 'beacon:tc3CardId') ?? undefined
    const glyphRaw = extData(placemark, 'beacon:glyph')
    const ALL_GLYPHS: string[] = [
      'circle', 'cross', 'triangle',
      'friendly', 'enemy', 'neutral',
      'lz', 'pz', 'dz',
      'ccp', 'axp', 'obj', 'rally',
      'hazard', 'target', 'supply', 'vehicle', 'medic', 'comms',
      'casualty',
    ]
    const glyph = glyphRaw && ALL_GLYPHS.includes(glyphRaw) ? (glyphRaw as WaypointType) : undefined

    const point = firstChild(placemark, 'Point')
    if (point) {
      const ll = parseCoordinates(textChild(point, 'coordinates'))
      if (ll.length > 0) {
        features.push({
          id,
          overlay_id: overlayId,
          type: 'waypoint',
          geometry: [ll[0]],
          label: name,
          style: { ...DEFAULT_FEATURE_STYLE, color: styleHex ?? DEFAULT_FEATURE_STYLE.color },
          waypoint_type: glyph,
          notes: desc,
          tc3_card_id: tc3CardId,
          created_at: now,
          updated_at: now,
        })
      }
      continue
    }

    const line = firstChild(placemark, 'LineString')
    if (line) {
      const pts = parseCoordinates(textChild(line, 'coordinates'))
      if (pts.length > 0) {
        features.push({
          id,
          overlay_id: overlayId,
          type: 'route',
          geometry: pts,
          label: name,
          style: { ...DEFAULT_FEATURE_STYLE, color: styleHex ?? DEFAULT_FEATURE_STYLE.color },
          notes: desc,
          created_at: now,
          updated_at: now,
        })
      }
      continue
    }

    const polygon = firstChild(placemark, 'Polygon')
    if (polygon) {
      const outer = polygon.getElementsByTagName('outerBoundaryIs')[0]
      const ring = outer?.getElementsByTagName('LinearRing')[0]
      const pts = parseCoordinates(textChild(ring ?? null, 'coordinates'))
      // KML rings repeat the first point at the end — drop it for our area model.
      if (pts.length >= 2) {
        const [fLat, fLng] = pts[0]
        const [lLat, lLng] = pts[pts.length - 1]
        if (fLat === lLat && fLng === lLng) pts.pop()
      }
      if (pts.length >= 3) {
        features.push({
          id,
          overlay_id: overlayId,
          type: 'area' as FeatureType,
          geometry: pts,
          label: name,
          style: { ...DEFAULT_FEATURE_STYLE, color: styleHex ?? DEFAULT_FEATURE_STYLE.color },
          notes: desc,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }

  const suggestedName =
    textChild(root.getElementsByTagName('Document')[0] ?? null, 'name') ??
    textChild(root.getElementsByTagName('Folder')[0] ?? null, 'name') ?? null

  return { features, suggestedName }
}

// ─────────────────────────── SERIALIZE ───────────────────────────

export function serializeKML(features: OverlayFeature[], overlayName: string): string {
  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8"?>')
  out.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  out.push('<Document>')
  out.push(`  <name>${esc(overlayName)}</name>`)

  // One inline Style per feature (simpler than de-duping a style table for
  // an export that's rarely re-edited externally).
  for (const f of features) {
    const styleId = `s_${f.id.replace(/[^a-zA-Z0-9]/g, '')}`
    out.push(`  <Style id="${styleId}">`)
    const kmlColor = hexToKmlColor(resolveExportableHex(f.style.color))
    out.push(`    <LineStyle><color>${kmlColor}</color><width>${f.style.weight ?? 3}</width></LineStyle>`)
    out.push(`    <PolyStyle><color>${kmlColorWithAlpha(kmlColor, 0x40)}</color></PolyStyle>`)
    out.push(`    <IconStyle><color>${kmlColor}</color></IconStyle>`)
    out.push(`  </Style>`)

    out.push(`  <Placemark>`)
    if (f.label) out.push(`    <name>${esc(f.label)}</name>`)
    if (f.notes) out.push(`    <description>${esc(f.notes)}</description>`)
    out.push(`    <styleUrl>#${styleId}</styleUrl>`)
    out.push(`    <ExtendedData>`)
    out.push(`      <Data name="beacon:id"><value>${esc(f.id)}</value></Data>`)
    if (f.waypoint_type) {
      out.push(`      <Data name="beacon:glyph"><value>${esc(f.waypoint_type)}</value></Data>`)
    }
    if (f.tc3_card_id) {
      out.push(`      <Data name="beacon:tc3CardId"><value>${esc(f.tc3_card_id)}</value></Data>`)
    }
    out.push(`    </ExtendedData>`)

    if (f.type === 'waypoint' && f.geometry.length > 0) {
      const [lat, lng] = f.geometry[0]
      out.push(`    <Point><coordinates>${lng},${lat},0</coordinates></Point>`)
    } else if (f.type === 'route' && f.geometry.length > 0) {
      const coords = f.geometry.map(([lat, lng]) => `${lng},${lat},0`).join(' ')
      out.push(`    <LineString><coordinates>${coords}</coordinates></LineString>`)
    } else if (f.type === 'area' && f.geometry.length >= 3) {
      const ring = [...f.geometry, f.geometry[0]]
        .map(([lat, lng]) => `${lng},${lat},0`)
        .join(' ')
      out.push(`    <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)
    }
    out.push(`  </Placemark>`)
  }

  out.push('</Document>')
  out.push('</kml>')
  return out.join('\n')
}

// ─────────────────────────── HELPERS ───────────────────────────

function firstChild(el: Element, tag: string): Element | null {
  return Array.from(el.children).find(c => c.localName === tag) ?? null
}

function textChild(el: Element | null, tag: string): string | null {
  if (!el) return null
  const child = Array.from(el.children).find(c => c.localName === tag)
  return child?.textContent?.trim() || null
}

function parseCoordinates(text: string | null): [number, number][] {
  if (!text) return []
  return text
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(triplet => {
      // KML order: lon,lat[,alt]
      const [lng, lat] = triplet.split(',').map(parseFloat)
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null
    })
    .filter((p): p is [number, number] => p != null)
}

function extData(placemark: Element, key: string): string | null {
  const ext = firstChild(placemark, 'ExtendedData')
  if (!ext) return null
  for (const data of Array.from(ext.getElementsByTagName('Data'))) {
    if (data.getAttribute('name') === key) {
      return textChild(data, 'value') ?? data.textContent?.trim() ?? null
    }
  }
  return null
}

function collectStyles(root: Element): Map<string, string> {
  const map = new Map<string, string>()
  for (const style of Array.from(root.getElementsByTagName('Style'))) {
    const id = style.getAttribute('id')
    if (!id) continue
    const lineColor = textChild(firstChild(style, 'LineStyle'), 'color')
    const iconColor = textChild(firstChild(style, 'IconStyle'), 'color')
    const kml = lineColor ?? iconColor
    if (kml) map.set(id, kmlColorToHex(kml))
  }
  return map
}

function resolveStyleColor(placemark: Element, styles: Map<string, string>): string | null {
  const ref = textChild(placemark, 'styleUrl')
  if (ref?.startsWith('#')) {
    const found = styles.get(ref.slice(1))
    if (found) return found
  }
  // Inline <Style>
  const inline = firstChild(placemark, 'Style')
  if (inline) {
    const c = textChild(firstChild(inline, 'LineStyle'), 'color') ?? textChild(firstChild(inline, 'IconStyle'), 'color')
    if (c) return kmlColorToHex(c)
  }
  return null
}

function kmlColorToHex(kml: string): string {
  const c = kml.replace(/^#/, '').padStart(8, '0').toLowerCase()
  if (c.length !== 8) return FALLBACK_HEX
  // KML: AABBGGRR → #RRGGBB
  const r = c.slice(6, 8)
  const g = c.slice(4, 6)
  const b = c.slice(2, 4)
  return `#${r}${g}${b}`
}

function hexToKmlColor(hex: string, alpha = 0xff): string {
  const c = hex.replace(/^#/, '').toLowerCase()
  if (c.length !== 6) return 'ff0000ff'
  const r = c.slice(0, 2)
  const g = c.slice(2, 4)
  const b = c.slice(4, 6)
  return `${alpha.toString(16).padStart(2, '0')}${b}${g}${r}`
}

function kmlColorWithAlpha(kmlColor: string, alpha: number): string {
  return `${alpha.toString(16).padStart(2, '0')}${kmlColor.slice(2)}`
}

/**
 * KML can't express CSS variables. When an in-memory feature still carries a
 * `var(--…)` color token (theme-aware default), substitute a stable hex.
 * Pre-existing #rrggbb / rgba colors flow through unchanged.
 */
function resolveExportableHex(color: string): string {
  if (color.startsWith('#') && color.length === 7) return color
  if (color.startsWith('var(') && typeof window !== 'undefined') {
    try {
      const match = color.match(/var\(([^),]+)/)
      if (match) {
        const resolved = getComputedStyle(document.documentElement)
          .getPropertyValue(match[1].trim())
          .trim()
        if (resolved.startsWith('#') && resolved.length === 7) return resolved
        // rgb(r, g, b) — convert
        const m = resolved.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (m) {
          const r = parseInt(m[1]).toString(16).padStart(2, '0')
          const g = parseInt(m[2]).toString(16).padStart(2, '0')
          const b = parseInt(m[3]).toString(16).padStart(2, '0')
          return `#${r}${g}${b}`
        }
      }
    } catch { /* fall through to fallback */ }
  }
  return FALLBACK_HEX
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
