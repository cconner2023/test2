import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
}))

vi.mock('../offlineDb', () => ({
  getDb: vi.fn().mockResolvedValue({
    get: mocks.get,
    put: mocks.put,
    getAll: mocks.getAll,
    transaction: () => ({
      objectStore: () => ({ openCursor: vi.fn().mockResolvedValue(null), delete: vi.fn() }),
      done: Promise.resolve(),
    }),
  }),
}))

const mockGet = mocks.get

import {
  getTileFromCache,
  getTileSource,
  TILE_SOURCES,
  registerTileSource,
  countTilesForBbox,
} from '../mapTileService'

describe('mapTileService — TileSource registry', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mocks.put.mockClear()
  })

  it('exposes osm as the default source', () => {
    const src = getTileSource()
    expect(src.id).toBe('osm')
    expect(src.url(13, 1, 2)).toMatch(/openstreetmap\.org\/13\/1\/2\.png$/)
  })

  it('falls back to default for unknown source ids', () => {
    expect(getTileSource('nonexistent').id).toBe('osm')
  })

  it('registerTileSource adds a runtime source', () => {
    registerTileSource({
      id: 'test-src',
      name: 'Test',
      url: (z, x, y) => `https://example.test/${z}/${x}/${y}`,
      attribution: 'test',
      minZoom: 0,
      maxZoom: 18,
      cacheZoomMin: 10,
      cacheZoomMax: 12,
      policy: { allowBulkCache: false },
    })
    expect(TILE_SOURCES['test-src'].name).toBe('Test')
  })
})

describe('getTileFromCache — legacy key fallback', () => {
  beforeEach(() => mockGet.mockReset())

  it('reads new-shape key first', async () => {
    mockGet.mockResolvedValueOnce({ data: new Blob(['new']) })
    const blob = await getTileFromCache('overlayA', 13, 1, 2, 'osm')
    expect(blob).not.toBeNull()
    expect(mockGet).toHaveBeenCalledWith('cachedTiles', 'overlayA/osm/13/1/2')
  })

  it('falls back to legacy key when new shape is missing AND source is osm', async () => {
    mockGet.mockResolvedValueOnce(undefined) // new shape miss
    mockGet.mockResolvedValueOnce({ data: new Blob(['legacy']) })
    const blob = await getTileFromCache('overlayA', 13, 1, 2, 'osm')
    expect(blob).not.toBeNull()
    expect(mockGet).toHaveBeenNthCalledWith(2, 'cachedTiles', 'overlayA/13/1/2')
  })

  it('does NOT fall back to legacy key for non-osm sources', async () => {
    mockGet.mockResolvedValueOnce(undefined)
    const blob = await getTileFromCache('overlayA', 13, 1, 2, 'esri-imagery')
    expect(blob).toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})

describe('countTilesForBbox', () => {
  it('uses the source\'s cacheZoom range', () => {
    // OSM defaults: cacheZoomMin 8, cacheZoomMax 13 — a tiny bbox should
    // still produce >= 1 tile per zoom level (6 levels, so >= 6).
    const n = countTilesForBbox([-77.05, 38.89, -77.04, 38.90], 'osm')
    expect(n).toBeGreaterThanOrEqual(6)
  })
})
