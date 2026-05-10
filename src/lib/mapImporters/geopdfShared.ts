/**
 * Shared types for the geo-PDF importer (Phase 3.2a).
 *
 * v1 scope: user supplies the geographic bounds manually. The PDF page is
 * rasterized into a single source canvas (in PDF page space), then sliced
 * into Web-Mercator XYZ tiles by linearly interpolating across `bounds`.
 *
 * Linear interpolation in lat/lng is correct for Web-Mercator-projected
 * source PDFs and "good enough" at AO scales for UTM-projected sources.
 * True reprojection (UTM → WebMerc) is a Phase 3.2c follow-up if needed.
 *
 * LGI auto-detection (Adobe geospatial PDF dict) is Phase 3.2b — until
 * then the manual-bounds form is the only ingestion path.
 */

export interface GeoPdfImportOptions {
  bounds: [number, number, number, number]  // [west, south, east, north]
  /** Page number to import (1-indexed). Defaults to 1. */
  pageNumber?: number
  /** Source render scale — multiplier on the PDF page's natural size. Higher = sharper tiles + more memory. */
  renderScale?: number
  /** Hard cap on output zoom levels. */
  maxZoomCap?: number
}

export type GeoPdfWorkerMessage =
  | { kind: 'meta'; minZoom: number; maxZoom: number; sourceWidth: number; sourceHeight: number; tileCount: number }
  | { kind: 'tile'; z: number; x: number; y: number; data: Uint8Array }
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'done'; sizeBytes: number }
  | { kind: 'error'; message: string }
