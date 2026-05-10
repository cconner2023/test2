/**
 * XYZ tile math — used by both the geo-PDF importer (rasterizes a PDF into
 * tiles for a known bbox) and any future raster importer.
 *
 * All coordinates are XYZ (y=0 at top). Web Mercator (EPSG:3857) projection.
 */

export function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom),
  )
}

/** Inverse — top-left corner of an XYZ tile in lat/lng. */
export function tileToLngLat(z: number, x: number, y: number): { lat: number; lng: number } {
  const n = Math.pow(2, z)
  const lng = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  const lat = (latRad * 180) / Math.PI
  return { lat, lng }
}

export interface TileRange {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** Inclusive XYZ tile range covering a [west, south, east, north] bbox at zoom. */
export function bboxToTileRange(
  bbox: [number, number, number, number],
  zoom: number,
): TileRange {
  const [west, south, east, north] = bbox
  return {
    xMin: lngToTileX(west, zoom),
    xMax: lngToTileX(east, zoom),
    // North is the smaller y in XYZ; south is the larger.
    yMin: latToTileY(north, zoom),
    yMax: latToTileY(south, zoom),
  }
}

export function tileCount(range: TileRange): number {
  return (range.xMax - range.xMin + 1) * (range.yMax - range.yMin + 1)
}

/**
 * Choose a sensible maxZoom for an imported raster of given source pixel
 * dimensions covering `bbox`. The heuristic targets ~1 source pixel per
 * tile pixel (no upscaling): pick the largest zoom Z such that the tile
 * grid covering bbox at Z requires no more pixels than the source provides.
 *
 * Caller still clamps to a hard upper bound (typical: z14) to avoid
 * pathological imports of single-tile-but-huge-resolution PDFs.
 */
export function pickMaxZoom(
  bbox: [number, number, number, number],
  sourceWidthPx: number,
  sourceHeightPx: number,
  hardCap = 16,
): number {
  let best = 0
  for (let z = 0; z <= hardCap; z++) {
    const range = bboxToTileRange(bbox, z)
    const tilePixelsX = (range.xMax - range.xMin + 1) * 256
    const tilePixelsY = (range.yMax - range.yMin + 1) * 256
    if (tilePixelsX <= sourceWidthPx && tilePixelsY <= sourceHeightPx) best = z
    else break
  }
  return best
}
