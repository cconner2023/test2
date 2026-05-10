import { getDb, type TileMetadata } from './offlineDb'

export type { TileMetadata }

const BUFFER_DEG = 0.05   // ~5.5 km at mid-latitudes
const CONCURRENCY = 4

// ─────────────────────────── TILE SOURCE REGISTRY ───────────────────────────

export interface TileSourcePolicy {
  /** Whether bulk pre-caching to IDB is allowed. OSM forbids heavy bulk
   *  scraping; user-initiated per-overlay downloads stay within fair use. */
  allowBulkCache: boolean
  /** Soft delay between sequential network fetches (ms). Honored by
   *  downloadTilesForOverlay. Optional. */
  rateLimitMs?: number
}

export type TileSourceCategory = 'street' | 'imagery' | 'topo'

export interface TileSource {
  /** Stable identifier — used in cache keys and TileMetadata. Never rename. */
  id: string
  /** Human-readable name shown in the basemap selector. */
  name: string
  /** Builds the network URL for an XYZ tile. */
  url: (z: number, x: number, y: number) => string
  /**
   * Optional blob resolver — when present, the renderer prefers this over
   * the network URL. Used by Phase 3 imported basemaps (MBTiles / geo-PDF
   * / GeoTIFF) whose tiles live in IDB rather than at a remote origin.
   * Returns null when the requested tile isn't present in storage.
   */
  getBlob?: (z: number, x: number, y: number) => Promise<Blob | null>
  /** Attribution string surfaced near the map. */
  attribution: string
  minZoom: number
  maxZoom: number
  /** Zoom range used when bulk-caching for an overlay. */
  cacheZoomMin: number
  cacheZoomMax: number
  policy: TileSourcePolicy
  /**
   * Category drives downstream rendering decisions. Notably, the themed
   * canvas recoloring only applies to `street` — imagery / topo are kept
   * pixel-accurate so satellite scenes and shaded relief survive.
   */
  category: TileSourceCategory
  /** Short description shown beneath the entry in the basemap selector. */
  description?: string
  /**
   * True for runtime-registered imported basemaps (MBTiles / geo-PDF /
   * GeoTIFF) so the UI can surface a Delete affordance and the bulk-cache
   * download flow can skip them (their tiles already live in IDB).
   */
  imported?: boolean
}

const OSM_SUBDOMAINS = ['a', 'b', 'c'] as const
const OPENTOPO_SUBDOMAINS = ['a', 'b', 'c'] as const

export const TILE_SOURCES: Record<string, TileSource> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: (z, x, y) => {
      const sub = OSM_SUBDOMAINS[Math.abs(x + y) % OSM_SUBDOMAINS.length]
      return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`
    },
    attribution: '© OpenStreetMap contributors',
    minZoom: 0,
    maxZoom: 19,
    cacheZoomMin: 8,
    cacheZoomMax: 13,
    policy: { allowBulkCache: true, rateLimitMs: 0 },
    category: 'street',
    description: 'Default street map — themed to match the app.',
  },
  'esri-imagery': {
    id: 'esri-imagery',
    name: 'Satellite (Esri)',
    // ArcGIS tile services use {z}/{row=y}/{col=x} order — note the swap.
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    minZoom: 0,
    maxZoom: 19,
    cacheZoomMin: 8,
    cacheZoomMax: 14,
    policy: { allowBulkCache: true, rateLimitMs: 50 },
    category: 'imagery',
    description: 'Aerial / satellite imagery worldwide.',
  },
  'opentopo': {
    id: 'opentopo',
    name: 'OpenTopoMap',
    url: (z, x, y) => {
      const sub = OPENTOPO_SUBDOMAINS[Math.abs(x + y) % OPENTOPO_SUBDOMAINS.length]
      return `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`
    },
    attribution: 'Map: © OpenTopoMap (CC-BY-SA), Data: © OpenStreetMap contributors, SRTM',
    minZoom: 0,
    maxZoom: 17,
    cacheZoomMin: 8,
    cacheZoomMax: 13,
    // OpenTopoMap forbids bulk pre-caching at scale on their public servers.
    // We keep tiles fetched live (and per-tile cached by the browser layer),
    // but disable the user-initiated overlay bulk download for this source.
    policy: { allowBulkCache: false },
    category: 'topo',
    description: 'Topographic with contours and shaded relief. Live-only — no offline bulk cache.',
  },
  'usgs-topo': {
    id: 'usgs-topo',
    name: 'USGS Topo',
    url: (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`,
    attribution: 'USGS The National Map: National Boundaries Dataset, 3DEP, GNIS, NHD',
    minZoom: 0,
    maxZoom: 16,
    cacheZoomMin: 8,
    cacheZoomMax: 13,
    policy: { allowBulkCache: true, rateLimitMs: 50 },
    category: 'topo',
    description: 'USGS topographic — best inside the United States.',
  },
}

export const DEFAULT_SOURCE_ID = 'osm'

export function getTileSource(sourceId: string = DEFAULT_SOURCE_ID): TileSource {
  return TILE_SOURCES[sourceId] ?? TILE_SOURCES[DEFAULT_SOURCE_ID]
}

/** Register a tile source at runtime (used by future Phase 3 importers
 *  that mount user-provided MBTiles / geo-PDFs as new sources). */
export function registerTileSource(source: TileSource): void {
  TILE_SOURCES[source.id] = source
}

// ─────────────────────────── TILE MATH ───────────────────────────

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom),
  )
}

// ─────────────────────────── BBOX ───────────────────────────

export function computeOverlayBbox(
  features: Array<{ geometry: [number, number][] }>,
): [number, number, number, number] | null {
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  let hasPoints = false

  for (const f of features) {
    for (const [lat, lng] of f.geometry) {
      hasPoints = true
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }

  if (!hasPoints) return null

  return [
    Math.max(-180, minLng - BUFFER_DEG),
    Math.max(-90,  minLat - BUFFER_DEG),
    Math.min(180,  maxLng + BUFFER_DEG),
    Math.min(90,   maxLat + BUFFER_DEG),
  ]
}

export function countTilesForBbox(
  bbox: [number, number, number, number],
  sourceId: string = DEFAULT_SOURCE_ID,
): number {
  const src = getTileSource(sourceId)
  const [west, south, east, north] = bbox
  let count = 0
  for (let zoom = src.cacheZoomMin; zoom <= src.cacheZoomMax; zoom++) {
    const xMin = lngToTileX(west, zoom)
    const xMax = lngToTileX(east, zoom)
    const yMin = latToTileY(north, zoom)
    const yMax = latToTileY(south, zoom)
    count += (xMax - xMin + 1) * (yMax - yMin + 1)
  }
  return count
}

function* enumerateTiles(
  bbox: [number, number, number, number],
  source: TileSource,
): Generator<{ z: number; x: number; y: number }> {
  const [west, south, east, north] = bbox
  for (let zoom = source.cacheZoomMin; zoom <= source.cacheZoomMax; zoom++) {
    const xMin = lngToTileX(west, zoom)
    const xMax = lngToTileX(east, zoom)
    const yMin = latToTileY(north, zoom)
    const yMax = latToTileY(south, zoom)
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        yield { z: zoom, x, y }
      }
    }
  }
}

// ─────────────────────────── CACHE KEYS ───────────────────────────

/** Current (multi-source) cache key shape. */
function cacheKey(overlayId: string, sourceId: string, z: number, x: number, y: number): string {
  return `${overlayId}/${sourceId}/${z}/${x}/${y}`
}

/** Pre-Phase-2 cache key — only valid for the implicit OSM source. */
function legacyCacheKey(overlayId: string, z: number, x: number, y: number): string {
  return `${overlayId}/${z}/${x}/${y}`
}

// ─────────────────────────── FETCH ───────────────────────────

async function fetchTileBlob(source: TileSource, z: number, x: number, y: number): Promise<Blob | null> {
  try {
    const res = await fetch(source.url(z, x, y))
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

// ─────────────────────────── CACHE READ ───────────────────────────

export async function getTileFromCache(
  overlayId: string,
  z: number,
  x: number,
  y: number,
  sourceId: string = DEFAULT_SOURCE_ID,
): Promise<Blob | null> {
  try {
    const db = await getDb()
    const entry = await db.get('cachedTiles', cacheKey(overlayId, sourceId, z, x, y))
    if (entry?.data) return entry.data
    // Legacy fallback — pre-Phase-2 keys had no sourceId segment and were
    // implicitly OSM. Read-only fallback so existing offline caches keep
    // working until they're evicted/re-downloaded.
    if (sourceId === DEFAULT_SOURCE_ID) {
      const legacy = await db.get('cachedTiles', legacyCacheKey(overlayId, z, x, y))
      return legacy?.data ?? null
    }
    return null
  } catch {
    return null
  }
}

export async function getTileMeta(overlayId: string): Promise<TileMetadata | null> {
  try {
    const db = await getDb()
    return (await db.get('tileMetadata', overlayId)) ?? null
  } catch {
    return null
  }
}

export async function getAllTileMeta(): Promise<Map<string, TileMetadata>> {
  try {
    const db = await getDb()
    const all = await db.getAll('tileMetadata')
    return new Map(all.map((m) => [m.overlayId, m]))
  } catch {
    return new Map()
  }
}

// ─────────────────────────── DOWNLOAD ───────────────────────────

export async function downloadTilesForOverlay(
  overlayId: string,
  features: Array<{ geometry: [number, number][] }>,
  onProgress: (done: number, total: number) => void,
  sourceId: string = DEFAULT_SOURCE_ID,
): Promise<TileMetadata | null> {
  const source = getTileSource(sourceId)
  if (!source.policy.allowBulkCache) return null

  const bbox = computeOverlayBbox(features)
  if (!bbox) return null

  const tiles = [...enumerateTiles(bbox, source)]
  const total = tiles.length
  let done = 0
  let sizeBytes = 0

  const db = await getDb()
  const queue = [...tiles]
  const rateLimitMs = source.policy.rateLimitMs ?? 0

  const worker = async () => {
    while (queue.length > 0) {
      const tile = queue.shift()
      if (!tile) break
      const blob = await fetchTileBlob(source, tile.z, tile.x, tile.y)
      if (blob) {
        await db.put('cachedTiles', {
          key: cacheKey(overlayId, source.id, tile.z, tile.x, tile.y),
          data: blob,
        })
        sizeBytes += blob.size
      }
      done++
      onProgress(done, total)
      if (rateLimitMs > 0) await new Promise(r => setTimeout(r, rateLimitMs))
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const meta: TileMetadata = {
    overlayId,
    bbox,
    tileCount: total,
    sizeBytes,
    cachedAt: new Date().toISOString(),
    zoomMin: source.cacheZoomMin,
    zoomMax: source.cacheZoomMax,
    sourceId: source.id,
  }
  await db.put('tileMetadata', meta)
  return meta
}

// ─────────────────────────── EVICT ───────────────────────────

export async function evictOverlayTiles(overlayId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['cachedTiles', 'tileMetadata'], 'readwrite')
  const tilesStore = tx.objectStore('cachedTiles')

  // Match both new (`overlayId/sourceId/...`) and legacy (`overlayId/...`)
  // key shapes — they share the `overlayId/` prefix.
  let cursor = await tilesStore.openCursor()
  while (cursor) {
    if ((cursor.key as string).startsWith(`${overlayId}/`)) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }

  await tx.objectStore('tileMetadata').delete(overlayId)
  await tx.done
}

// ─────────────────────────── HELPERS ───────────────────────────

export function formatTileBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
