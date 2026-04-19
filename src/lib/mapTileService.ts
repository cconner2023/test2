import { getDb, type TileMetadata } from './offlineDb'

export type { TileMetadata }

const ZOOM_MIN = 8
const ZOOM_MAX = 13
const BUFFER_DEG = 0.05   // ~5.5 km at mid-latitudes
const CONCURRENCY = 4
const SUBDOMAINS = ['a', 'b', 'c'] as const

// ---- Tile math ----

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom),
  )
}

function osmUrl(z: number, x: number, y: number): string {
  const sub = SUBDOMAINS[(x + y) % SUBDOMAINS.length]
  return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`
}

// ---- Bbox ----

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

export function countTilesForBbox(bbox: [number, number, number, number]): number {
  const [west, south, east, north] = bbox
  let count = 0
  for (let zoom = ZOOM_MIN; zoom <= ZOOM_MAX; zoom++) {
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
): Generator<{ z: number; x: number; y: number }> {
  const [west, south, east, north] = bbox
  for (let zoom = ZOOM_MIN; zoom <= ZOOM_MAX; zoom++) {
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

// ---- Fetch ----

async function fetchTileBlob(z: number, x: number, y: number): Promise<Blob | null> {
  try {
    const res = await fetch(osmUrl(z, x, y))
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

// ---- Cache read ----

export async function getTileFromCache(
  overlayId: string,
  z: number,
  x: number,
  y: number,
): Promise<Blob | null> {
  try {
    const db = await getDb()
    const entry = await db.get('cachedTiles', `${overlayId}/${z}/${x}/${y}`)
    return entry?.data ?? null
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

// ---- Download ----

export async function downloadTilesForOverlay(
  overlayId: string,
  features: Array<{ geometry: [number, number][] }>,
  onProgress: (done: number, total: number) => void,
): Promise<TileMetadata | null> {
  const bbox = computeOverlayBbox(features)
  if (!bbox) return null

  const tiles = [...enumerateTiles(bbox)]
  const total = tiles.length
  let done = 0
  let sizeBytes = 0

  const db = await getDb()
  const queue = [...tiles]

  const worker = async () => {
    while (queue.length > 0) {
      const tile = queue.shift()
      if (!tile) break
      const blob = await fetchTileBlob(tile.z, tile.x, tile.y)
      if (blob) {
        await db.put('cachedTiles', { key: `${overlayId}/${tile.z}/${tile.x}/${tile.y}`, data: blob })
        sizeBytes += blob.size
      }
      done++
      onProgress(done, total)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const meta: TileMetadata = {
    overlayId,
    bbox,
    tileCount: total,
    sizeBytes,
    cachedAt: new Date().toISOString(),
    zoomMin: ZOOM_MIN,
    zoomMax: ZOOM_MAX,
  }
  await db.put('tileMetadata', meta)
  return meta
}

// ---- Evict ----

export async function evictOverlayTiles(overlayId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['cachedTiles', 'tileMetadata'], 'readwrite')
  const tilesStore = tx.objectStore('cachedTiles')

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

// ---- Helpers ----

export function formatTileBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
