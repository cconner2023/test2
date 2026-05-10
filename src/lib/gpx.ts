/**
 * GPX 1.1 parser + serializer for Beacon OverlayFeatures.
 *
 * Mappings:
 *   <wpt>                ↔ type='waypoint' (single-point geometry)
 *   <rte><rtept/>...     ↔ type='route'
 *   <trk><trkseg><trkpt/>...> ↔ type='route' (one segment per track; multi-segment
 *                              tracks flatten into a single polyline at parse time)
 *   GPX has no native polygon. type='area' serializes as a closed <trk> tagged
 *   with a `beacon:area` extension; on import we restore the area shape when
 *   the extension is present.
 *
 * Round-trip preservation: id, label, color, waypoint glyph are stored as
 * beacon-prefixed elements inside <extensions>. Importers from other tools
 * silently ignore the extensions; Beacon round-trips them losslessly.
 */

import type { OverlayFeature, FeatureType, WaypointType, FeatureStyle } from '../Types/MapOverlayTypes'
import { DEFAULT_FEATURE_STYLE } from '../Types/MapOverlayTypes'

const NS_BEACON = 'https://beacon.app/gpx/1'

// ─────────────────────────── PARSE ───────────────────────────

export interface ParseResult {
  features: OverlayFeature[]
  /** Filename-derived suggested overlay name (from <metadata><name>) */
  suggestedName: string | null
}

export function parseGPX(xml: string, overlayId: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX: XML parse error')
  }
  const root = doc.documentElement
  if (root.localName !== 'gpx') {
    throw new Error(`Invalid GPX: root element is <${root.localName}>, expected <gpx>`)
  }

  const features: OverlayFeature[] = []
  const now = new Date().toISOString()

  // Waypoints
  for (const wpt of Array.from(root.getElementsByTagName('wpt'))) {
    const lat = numAttr(wpt, 'lat')
    const lon = numAttr(wpt, 'lon')
    if (lat == null || lon == null) continue
    const tc3 = extChild(wpt, 'tc3CardId')
    features.push({
      id: extId(wpt) ?? crypto.randomUUID(),
      overlay_id: overlayId,
      type: 'waypoint',
      geometry: [[lat, lon]],
      label: textChild(wpt, 'name') ?? '',
      style: { ...DEFAULT_FEATURE_STYLE, color: extColor(wpt) ?? DEFAULT_FEATURE_STYLE.color },
      waypoint_type: extWaypointType(wpt) ?? glyphFromSym(textChild(wpt, 'sym')),
      notes: textChild(wpt, 'desc') ?? undefined,
      mgrs: undefined,
      tc3_card_id: tc3 ?? undefined,
      created_at: now,
      updated_at: now,
    })
  }

  // Routes
  for (const rte of Array.from(root.getElementsByTagName('rte'))) {
    const pts = Array.from(rte.getElementsByTagName('rtept'))
      .map(p => latLngOf(p))
      .filter((p): p is [number, number] => p != null)
    if (pts.length === 0) continue
    features.push({
      id: extId(rte) ?? crypto.randomUUID(),
      overlay_id: overlayId,
      type: 'route',
      geometry: pts,
      label: textChild(rte, 'name') ?? '',
      style: { ...DEFAULT_FEATURE_STYLE, color: extColor(rte) ?? DEFAULT_FEATURE_STYLE.color },
      created_at: now,
      updated_at: now,
    })
  }

  // Tracks → routes (or areas if tagged)
  for (const trk of Array.from(root.getElementsByTagName('trk'))) {
    const segs = Array.from(trk.getElementsByTagName('trkseg'))
    const pts: [number, number][] = []
    for (const seg of segs) {
      for (const p of Array.from(seg.getElementsByTagName('trkpt'))) {
        const ll = latLngOf(p)
        if (ll) pts.push(ll)
      }
    }
    if (pts.length === 0) continue
    const isArea = extFlag(trk, 'area')
    const type: FeatureType = isArea ? 'area' : 'route'
    // Areas are stored as closed polylines at write — drop the redundant tail
    // point on import so the in-memory geometry matches our area conventions.
    if (isArea && pts.length >= 2) {
      const [fLat, fLng] = pts[0]
      const [lLat, lLng] = pts[pts.length - 1]
      if (fLat === lLat && fLng === lLng) pts.pop()
    }
    features.push({
      id: extId(trk) ?? crypto.randomUUID(),
      overlay_id: overlayId,
      type,
      geometry: pts,
      label: textChild(trk, 'name') ?? '',
      style: { ...DEFAULT_FEATURE_STYLE, color: extColor(trk) ?? DEFAULT_FEATURE_STYLE.color },
      created_at: now,
      updated_at: now,
    })
  }

  const suggestedName = textChild(root.querySelector('metadata'), 'name') ?? null

  return { features, suggestedName }
}

// ─────────────────────────── SERIALIZE ───────────────────────────

export function serializeGPX(features: OverlayFeature[], overlayName: string): string {
  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8"?>')
  out.push(`<gpx version="1.1" creator="Beacon" xmlns="http://www.topografix.com/GPX/1/1" xmlns:beacon="${NS_BEACON}">`)
  out.push(`  <metadata><name>${esc(overlayName)}</name></metadata>`)

  for (const f of features) {
    if (f.type === 'waypoint' && f.geometry.length > 0) {
      const [lat, lng] = f.geometry[0]
      out.push(`  <wpt lat="${lat}" lon="${lng}">`)
      if (f.label) out.push(`    <name>${esc(f.label)}</name>`)
      if (f.notes) out.push(`    <desc>${esc(f.notes)}</desc>`)
      out.push(`    <sym>${esc(symFromGlyph(f.waypoint_type))}</sym>`)
      out.push(`    <extensions>`)
      out.push(`      <beacon:id>${esc(f.id)}</beacon:id>`)
      out.push(`      <beacon:color>${esc(f.style.color)}</beacon:color>`)
      if (f.waypoint_type) out.push(`      <beacon:glyph>${esc(f.waypoint_type)}</beacon:glyph>`)
      if (f.tc3_card_id) out.push(`      <beacon:tc3CardId>${esc(f.tc3_card_id)}</beacon:tc3CardId>`)
      out.push(`    </extensions>`)
      out.push(`  </wpt>`)
    } else if (f.type === 'route' && f.geometry.length > 0) {
      out.push(`  <rte>`)
      if (f.label) out.push(`    <name>${esc(f.label)}</name>`)
      out.push(`    <extensions>`)
      out.push(`      <beacon:id>${esc(f.id)}</beacon:id>`)
      out.push(`      <beacon:color>${esc(f.style.color)}</beacon:color>`)
      out.push(`    </extensions>`)
      for (const [lat, lng] of f.geometry) {
        out.push(`    <rtept lat="${lat}" lon="${lng}"/>`)
      }
      out.push(`  </rte>`)
    } else if (f.type === 'area' && f.geometry.length >= 3) {
      // Areas serialize as a closed track tagged with beacon:area=true.
      out.push(`  <trk>`)
      if (f.label) out.push(`    <name>${esc(f.label)}</name>`)
      out.push(`    <extensions>`)
      out.push(`      <beacon:id>${esc(f.id)}</beacon:id>`)
      out.push(`      <beacon:color>${esc(f.style.color)}</beacon:color>`)
      out.push(`      <beacon:area>true</beacon:area>`)
      out.push(`    </extensions>`)
      out.push(`    <trkseg>`)
      for (const [lat, lng] of f.geometry) {
        out.push(`      <trkpt lat="${lat}" lon="${lng}"/>`)
      }
      // Close the ring
      const [lat0, lng0] = f.geometry[0]
      out.push(`      <trkpt lat="${lat0}" lon="${lng0}"/>`)
      out.push(`    </trkseg>`)
      out.push(`  </trk>`)
    }
  }

  out.push(`</gpx>`)
  return out.join('\n')
}

// ─────────────────────────── HELPERS ───────────────────────────

function numAttr(el: Element, name: string): number | null {
  const v = el.getAttribute(name)
  if (v == null) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function latLngOf(el: Element): [number, number] | null {
  const lat = numAttr(el, 'lat')
  const lon = numAttr(el, 'lon')
  return lat != null && lon != null ? [lat, lon] : null
}

function textChild(el: Element | null, tag: string): string | null {
  if (!el) return null
  const child = Array.from(el.children).find(c => c.localName === tag)
  return child?.textContent?.trim() || null
}

function extChild(el: Element, localName: string): string | null {
  const ext = Array.from(el.children).find(c => c.localName === 'extensions')
  if (!ext) return null
  const node = Array.from(ext.children).find(c => c.localName === localName)
  return node?.textContent?.trim() || null
}

function extId(el: Element): string | null { return extChild(el, 'id') }
function extColor(el: Element): string | null { return extChild(el, 'color') }
const ALL_GLYPHS: WaypointType[] = [
  'circle', 'cross', 'triangle',
  'friendly', 'enemy', 'neutral',
  'lz', 'pz', 'dz',
  'ccp', 'axp', 'obj', 'rally',
  'hazard', 'target', 'supply', 'vehicle', 'medic', 'comms',
  'casualty',
]

function extWaypointType(el: Element): WaypointType | null {
  const v = extChild(el, 'glyph')
  return v && (ALL_GLYPHS as string[]).includes(v) ? (v as WaypointType) : null
}
function extFlag(el: Element, name: string): boolean {
  return extChild(el, name)?.toLowerCase() === 'true'
}

function symFromGlyph(g: WaypointType | undefined): string {
  if (g === 'cross') return 'Cross'
  if (g === 'triangle') return 'Triangle'
  return 'Waypoint'
}

function glyphFromSym(sym: string | null): WaypointType | undefined {
  if (!sym) return undefined
  const s = sym.toLowerCase()
  if (s.includes('cross') || s.includes('flag')) return 'cross'
  if (s.includes('triangle') || s.includes('summit')) return 'triangle'
  return 'circle'
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Re-export for tests / future consumers
export type { FeatureStyle }
