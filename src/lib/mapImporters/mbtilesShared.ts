/**
 * Shared types + tile-coordinate math for the MBTiles importer.
 *
 * MBTiles spec: https://github.com/mapbox/mbtiles-spec
 * Key gotcha: MBTiles row indices use TMS y-axis (origin = bottom-left).
 * Beacon's tile cache and Leaflet both use XYZ y-axis (origin = top-left).
 * On import, every row gets `y_xyz = (1 << z) - 1 - y_tms` applied.
 */

export interface MBTilesMeta {
  name: string
  /** 'png' | 'jpg' | 'jpeg' | 'webp' (lowercased). */
  format: string
  bounds?: [number, number, number, number]  // [west, south, east, north]
  center?: [number, number]                  // [lat, lng]
  minzoom?: number
  maxzoom?: number
  attribution?: string
  description?: string
  /** Any other rows from the metadata table — useful for debugging. */
  raw: Record<string, string>
}

/** Convert TMS y to XYZ y for the given zoom. */
export function tmsYToXyzY(z: number, tmsY: number): number {
  return (1 << z) - 1 - tmsY
}

/** Convert XYZ y to TMS y for the given zoom (the inverse — needed when
 *  querying the SQLite tiles view by Z/X/Y). */
export function xyzYToTmsY(z: number, xyzY: number): number {
  return (1 << z) - 1 - xyzY
}

export function mimeForFormat(format: string): string {
  const f = format.toLowerCase()
  if (f === 'jpg' || f === 'jpeg') return 'image/jpeg'
  if (f === 'webp') return 'image/webp'
  if (f === 'pbf') return 'application/x-protobuf'  // vector tile — unsupported in v1
  return 'image/png'
}

export interface ImportProgress {
  done: number
  total: number
  /** Per-tile sample size for periodic UI ETA estimates — not load-bearing. */
  bytesWritten?: number
}

/** Worker → main message shapes. */
export type MbtilesWorkerMessage =
  | { kind: 'meta'; meta: MBTilesMeta; tileCount: number }
  | { kind: 'tile'; z: number; x: number; y: number; data: Uint8Array }
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'done'; sizeBytes: number }
  | { kind: 'error'; message: string }
