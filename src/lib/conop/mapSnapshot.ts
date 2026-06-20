/**
 * CONOP map snapshot — pure canvas composite of an event's linked geometry.
 *
 * Renders themed basemap tiles + overlay features (routes/areas/waypoints) +
 * labels into a single PNG, with NO Leaflet instance, NO html2canvas, and NO
 * new dependency. Fully offline: tiles come from the per-overlay IDB cache
 * (getTileFromCache), with an OSM-only network fetch fallback. Every drawn
 * pixel originates from a same-origin blob / data URL, so the output canvas is
 * never tainted and toBlob('image/png') always succeeds.
 *
 * Basemap is recolored to the active theme via the shared recolorPixels (same
 * math as ThemedTileLayer) so the export matches the in-app look.
 *
 * Reuses: computeOverlayBbox + getTileFromCache + getTileSource (mapTileService),
 * recolorPixels + TileTheme (ThemedTileLayer), waypointIconSvg (WaypointIcon),
 * resolveColor (MapOverlayTypes). Projection helpers are exported for tests.
 */

import { getTileSource, getTileFromCache, getTileMeta, computeOverlayBbox } from '../mapTileService'
import type { TileTheme } from '../../Components/MapOverlay/ThemedTileLayer'
import { waypointIconSvg } from '../../Components/MapOverlay/WaypointIcon'
import { resolveColor, type OverlayFeature } from '../../Types/MapOverlayTypes'

// recolorPixels lives in ThemedTileLayer, which imports leaflet. Pull it in
// dynamically at render time so this module's pure projection helpers stay
// importable (and unit-testable) without dragging leaflet into the test env.
type RecolorFn = (data: Uint8ClampedArray, theme: TileTheme) => void

const TILE_PX = 256

// ─────────────────────────── projection (Web Mercator, world pixels) ───────────────────────────

/** Fractional world-pixel X for a longitude at zoom z (256px tiles). */
export function lngToWorldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z) * TILE_PX
}

/** Fractional world-pixel Y for a latitude at zoom z (256px tiles). */
export function latToWorldY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  const n = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2
  return n * Math.pow(2, z) * TILE_PX
}

/**
 * Largest zoom (≤ maxZoom) at which the bbox's pixel span fits within w×h.
 * bbox = [west, south, east, north]. A tiny bbox (single waypoint) saturates
 * to maxZoom → "zoom to the feature"; a wide overlay backs off → "zoom to the
 * overlay extent".
 */
export function fitZoom(
  bbox: [number, number, number, number],
  w: number,
  h: number,
  maxZoom: number,
  minZoom = 0,
): number {
  const [west, south, east, north] = bbox
  for (let z = maxZoom; z >= minZoom; z--) {
    const spanX = lngToWorldX(east, z) - lngToWorldX(west, z)
    const spanY = latToWorldY(south, z) - latToWorldY(north, z)
    if (spanX <= w && spanY <= h) return z
  }
  return minZoom
}

/** Expand a bbox outward by a fraction of its own span (breathing room). */
export function padBbox(
  bbox: [number, number, number, number],
  frac: number,
): [number, number, number, number] {
  const [west, south, east, north] = bbox
  const dx = (east - west) * frac
  const dy = (north - south) * frac
  return [
    Math.max(-180, west - dx),
    Math.max(-85, south - dy),
    Math.min(180, east + dx),
    Math.min(85, north + dy),
  ]
}

// ─────────────────────────── snapshot ───────────────────────────

export interface ConopSnapshotOptions {
  features: OverlayFeature[]
  /** Overlay whose cached tiles back the offline render. */
  overlayId?: string
  /** Tile source the overlay's tiles were cached under (defaults to OSM). */
  basemapId?: string
  /** Active theme palette — basemap is recolored to match (getTileTheme). */
  theme: TileTheme
  width: number
  height: number
  /** Extra bbox padding as a fraction of span. Default 0.15. */
  padFrac?: number
}

export interface ConopSnapshotResult {
  pngBytes: Uint8Array
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Resolve a tile to a same-origin object URL (cache first, OSM network fallback). */
async function resolveTileUrl(
  source: ReturnType<typeof getTileSource>,
  overlayId: string | undefined,
  basemapId: string | undefined,
  z: number,
  x: number,
  y: number,
): Promise<{ url: string; revoke: boolean } | null> {
  if (overlayId) {
    const cached = await getTileFromCache(overlayId, z, x, y, basemapId)
    if (cached) return { url: URL.createObjectURL(cached), revoke: true }
  }
  // Network fallback only for CORS-enabled street tiles (OSM sends ACAO:*).
  // Imagery/topo omit ACAO → fetch would CORS-fail, so we skip and leave the
  // tile as theme-background fill (matches ThemedTileLayer's blank behavior).
  if (source.category === 'street') {
    try {
      const res = await fetch(source.url(z, x, y))
      if (res.ok) return { url: URL.createObjectURL(await res.blob()), revoke: true }
    } catch {
      /* offline / blocked — fall through to background fill */
    }
  }
  return null
}

/** Draw one tile (recolored to theme) at its world-pixel offset. */
async function drawTile(
  ctx: CanvasRenderingContext2D,
  source: ReturnType<typeof getTileSource>,
  overlayId: string | undefined,
  basemapId: string | undefined,
  theme: TileTheme,
  recolor: RecolorFn,
  z: number,
  x: number,
  y: number,
  destX: number,
  destY: number,
): Promise<void> {
  const resolved = await resolveTileUrl(source, overlayId, basemapId, z, x, y)
  if (!resolved) return
  try {
    const img = await loadImage(resolved.url)
    // Recolor on a per-tile scratch canvas (same approach as ThemedTileLayer),
    // then blit the themed tile into the main canvas.
    const scratch = document.createElement('canvas')
    scratch.width = TILE_PX
    scratch.height = TILE_PX
    const sctx = scratch.getContext('2d')
    if (!sctx) return
    sctx.drawImage(img, 0, 0, TILE_PX, TILE_PX)
    try {
      const data = sctx.getImageData(0, 0, TILE_PX, TILE_PX)
      recolor(data.data, theme)
      sctx.putImageData(data, 0, 0)
    } catch {
      /* unexpected taint — blit the un-recolored tile rather than nothing */
    }
    ctx.drawImage(scratch, destX, destY)
  } finally {
    if (resolved.revoke) URL.revokeObjectURL(resolved.url)
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, cx: number, topY: number): void {
  if (!text) return
  const fontPx = 13
  ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`
  const padX = 6
  const padY = 3
  const w = ctx.measureText(text).width + padX * 2
  const h = fontPx + padY * 2
  const x = cx - w / 2
  const y = topY - h
  // Rounded backing rect — mirrors the .leaflet-tooltip-tactical look.
  const r = 4
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, cx, y + h / 2 + 0.5)
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Snapshot canvas produced no PNG blob'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

/**
 * Render the linked geometry to a themed PNG. Returns null when there is no
 * drawable geometry (caller hides the export affordance in that case).
 */
export async function renderConopMapSnapshot(
  opts: ConopSnapshotOptions,
): Promise<ConopSnapshotResult | null> {
  const { features, overlayId, basemapId, theme, width, height, padFrac = 0.15 } = opts

  const drawable = features.filter((f) => f.geometry && f.geometry.length > 0)
  const rawBbox = computeOverlayBbox(drawable)
  if (!rawBbox) return null
  const bbox = padBbox(rawBbox, padFrac)

  // Align source + zoom to what the overlay's tiles were ACTUALLY bulk-cached
  // under. Without this we default to OSM and a fit zoom up to 17 — but tiles are
  // cached only at zoom 8–13/14 and possibly under a non-OSM source (imagery /
  // topo). The mismatch is a total cache miss, and since the network fallback is
  // street-only (imagery/topo would CORS-taint the export canvas) the basemap
  // renders blank — "just the marker." Reading TileMetadata realigns both.
  let effectiveBasemap = basemapId
  let cacheZoomCap = 17
  if (overlayId) {
    const meta = await getTileMeta(overlayId)
    if (meta) {
      if (!effectiveBasemap && meta.sourceId) effectiveBasemap = meta.sourceId
      if (typeof meta.zoomMax === 'number') cacheZoomCap = Math.min(cacheZoomCap, meta.zoomMax)
    }
  }

  const source = getTileSource(effectiveBasemap)
  // Cap below the source max so a single linked waypoint shows neighborhood
  // context instead of over-zooming to a 2-block view, and never exceed the
  // cached zoom range. A whole-overlay bbox backs off further via fitZoom.
  const maxZoom = Math.min(source.maxZoom, cacheZoomCap)
  const z = fitZoom(bbox, width, height, maxZoom, source.minZoom)
  const { recolorPixels } = await import('../../Components/MapOverlay/ThemedTileLayer')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Background fill (theme-consistent) so missing tiles never read as holes.
  const [br, bg, bb] = theme.background
  ctx.fillStyle = `rgb(${br},${bg},${bb})`
  ctx.fillRect(0, 0, width, height)

  // Center the bbox in the canvas → world-pixel origin of the top-left corner.
  const cxWorld = (lngToWorldX(bbox[0], z) + lngToWorldX(bbox[2], z)) / 2
  const cyWorld = (latToWorldY(bbox[3], z) + latToWorldY(bbox[1], z)) / 2
  const originX = cxWorld - width / 2
  const originY = cyWorld - height / 2

  const toPx = (lat: number, lng: number): [number, number] => [
    lngToWorldX(lng, z) - originX,
    latToWorldY(lat, z) - originY,
  ]

  // Tiles covering the viewport.
  const tileXMin = Math.floor(originX / TILE_PX)
  const tileXMax = Math.floor((originX + width) / TILE_PX)
  const tileYMin = Math.floor(originY / TILE_PX)
  const tileYMax = Math.floor((originY + height) / TILE_PX)
  const nTiles = Math.pow(2, z)

  const tileJobs: Promise<void>[] = []
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      if (tx < 0 || ty < 0 || tx >= nTiles || ty >= nTiles) continue
      const destX = tx * TILE_PX - originX
      const destY = ty * TILE_PX - originY
      tileJobs.push(drawTile(ctx, source, overlayId, effectiveBasemap, theme, recolorPixels, z, tx, ty, destX, destY))
    }
  }
  await Promise.all(tileJobs)

  // Areas (filled) first, then routes (stroked) — so lines sit over fills.
  for (const f of drawable) {
    if (f.type !== 'area' || f.geometry.length < 3) continue
    const color = resolveColor(f.style?.color ?? 'var(--color-themeblue2)')
    ctx.beginPath()
    f.geometry.forEach(([lat, lng], i) => {
      const [px, py] = toPx(lat, lng)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.lineWidth = (f.style?.weight ?? 2) + 0.5
    ctx.strokeStyle = color
    ctx.stroke()
  }

  for (const f of drawable) {
    if (f.type !== 'route' || f.geometry.length < 2) continue
    const color = resolveColor(f.style?.color ?? 'var(--color-themeblue2)')
    ctx.beginPath()
    f.geometry.forEach(([lat, lng], i) => {
      const [px, py] = toPx(lat, lng)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.lineWidth = (f.style?.weight ?? 2.5) + 0.5
    ctx.strokeStyle = color
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Waypoint glyphs (rasterized from the same SVG the map uses).
  const GLYPH = 26
  for (const f of drawable) {
    if (f.type !== 'waypoint' || f.geometry.length === 0) continue
    const [lat, lng] = f.geometry[0]
    const [px, py] = toPx(lat, lng)
    const color = resolveColor(f.style?.color ?? 'var(--color-themeblue2)')
    const svg = waypointIconSvg(f.waypoint_type, color, GLYPH, false, !!f.tc3_card_id)
    try {
      const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))
      ctx.drawImage(img, px - GLYPH / 2, py - GLYPH / 2, GLYPH, GLYPH)
    } catch {
      /* skip a glyph that fails to rasterize rather than abort the snapshot */
    }
  }

  // Labels on top of everything.
  for (const f of drawable) {
    if (!f.label) continue
    if (f.type === 'waypoint' && f.geometry.length > 0) {
      const [px, py] = toPx(f.geometry[0][0], f.geometry[0][1])
      drawLabel(ctx, f.label, px, py - GLYPH / 2 - 2)
    } else if ((f.type === 'route' || f.type === 'area') && f.geometry.length > 0) {
      // Centroid of the vertices.
      let sx = 0
      let sy = 0
      for (const [lat, lng] of f.geometry) {
        const [px, py] = toPx(lat, lng)
        sx += px
        sy += py
      }
      const cx = sx / f.geometry.length
      const cy = sy / f.geometry.length
      drawLabel(ctx, f.label, cx, cy)
    }
  }

  const pngBytes = await canvasToPng(canvas)
  return { pngBytes, width, height }
}
