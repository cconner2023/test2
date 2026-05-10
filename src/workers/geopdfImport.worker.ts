/// <reference lib="webworker" />
/**
 * Geo-PDF rasterization worker (Phase 3.2a).
 *
 * Pipeline:
 *   1. Receive PDF ArrayBuffer + user-supplied bounds + zoom range.
 *   2. Render the requested page to an OffscreenCanvas at renderScale.
 *   3. For each zoom in [minZoom..maxZoom], compute the XYZ tile range
 *      covering the bbox; for each tile, linearly map the tile's
 *      lat/lng corners to source-canvas pixel coords and drawImage that
 *      sub-rect into a 256×256 OffscreenCanvas, encode PNG, post back.
 *
 * v1 limitation (documented in palace drawer): linear interpolation in
 * lat/lng. Exact for Web-Mercator-projected sources; small drift at AO
 * scales for UTM. True reprojection is a follow-up.
 */

import * as pdfjsLib from 'pdfjs-dist'
import {
  bboxToTileRange,
  lngToTileX,
  latToTileY,
  pickMaxZoom,
  tileToLngLat,
} from '../lib/mapImporters/tileMath'
import type { GeoPdfImportOptions, GeoPdfWorkerMessage } from '../lib/mapImporters/geopdfShared'

declare const self: DedicatedWorkerGlobalScope

// Resolve pdf.js's worker via a URL relative to the bundled mjs.
;(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface InitMessage {
  file: ArrayBuffer
  options: GeoPdfImportOptions
}

self.addEventListener('message', async (event: MessageEvent<InitMessage>) => {
  const post = (msg: GeoPdfWorkerMessage) => self.postMessage(msg)
  try {
    const { file, options } = event.data
    const { bounds, pageNumber = 1, renderScale = 2, maxZoomCap = 14 } = options

    const pdf = await pdfjsLib.getDocument({ data: file }).promise
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      post({ kind: 'error', message: `Page ${pageNumber} out of range (PDF has ${pdf.numPages})` })
      return
    }
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: renderScale })
    const sourceWidth = Math.ceil(viewport.width)
    const sourceHeight = Math.ceil(viewport.height)

    // Hard sanity cap to avoid OOM on absurd PDFs.
    if (sourceWidth * sourceHeight > 64 * 1024 * 1024) {
      post({ kind: 'error', message: 'PDF render output exceeds memory limit (try a lower renderScale)' })
      return
    }

    const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight)
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) {
      post({ kind: 'error', message: 'Could not allocate source canvas' })
      return
    }
    await page.render({ canvasContext: sourceCtx as unknown as CanvasRenderingContext2D, viewport, canvas: sourceCanvas as unknown as HTMLCanvasElement }).promise

    // Choose maxZoom such that no tile pixel upscales beyond source resolution.
    const maxZoom = Math.min(maxZoomCap, pickMaxZoom(bounds, sourceWidth, sourceHeight, maxZoomCap))
    // Two zoom levels below maxZoom keeps overview tiles useful at low pan-out.
    const minZoom = Math.max(0, maxZoom - 4)

    // Pre-count for progress reporting.
    let totalTiles = 0
    for (let z = minZoom; z <= maxZoom; z++) {
      const r = bboxToTileRange(bounds, z)
      totalTiles += (r.xMax - r.xMin + 1) * (r.yMax - r.yMin + 1)
    }
    post({ kind: 'meta', minZoom, maxZoom, sourceWidth, sourceHeight, tileCount: totalTiles })

    const tileCanvas = new OffscreenCanvas(256, 256)
    const tileCtx = tileCanvas.getContext('2d')
    if (!tileCtx) {
      post({ kind: 'error', message: 'Could not allocate tile canvas' })
      return
    }

    const [west, south, east, north] = bounds
    const lngSpan = east - west
    const latSpan = north - south

    let done = 0
    let bytes = 0

    for (let z = minZoom; z <= maxZoom; z++) {
      const range = bboxToTileRange(bounds, z)
      for (let tx = range.xMin; tx <= range.xMax; tx++) {
        for (let ty = range.yMin; ty <= range.yMax; ty++) {
          // Tile corners in lat/lng.
          const tlCorner = tileToLngLat(z, tx, ty)
          const brCorner = tileToLngLat(z, tx + 1, ty + 1)
          // Linear-in-lat/lng map onto source canvas pixels (v1 simplification).
          const srcX = ((tlCorner.lng - west) / lngSpan) * sourceWidth
          const srcY = ((north - tlCorner.lat) / latSpan) * sourceHeight
          const srcW = ((brCorner.lng - tlCorner.lng) / lngSpan) * sourceWidth
          const srcH = ((tlCorner.lat - brCorner.lat) / latSpan) * sourceHeight

          tileCtx.clearRect(0, 0, 256, 256)
          // drawImage clamps to source bounds; out-of-frame portions render
          // transparent which is the desired behavior for tiles past the
          // PDF's edge (they'll show as gaps instead of garbage).
          tileCtx.drawImage(
            sourceCanvas,
            srcX, srcY, srcW, srcH,
            0, 0, 256, 256,
          )
          const blob = await tileCanvas.convertToBlob({ type: 'image/png' })
          const buf = await blob.arrayBuffer()
          bytes += buf.byteLength
          post({ kind: 'tile', z, x: tx, y: ty, data: new Uint8Array(buf) })
          done++
          if (done % 20 === 0 || done === totalTiles) post({ kind: 'progress', done, total: totalTiles })
        }
      }
    }

    // void the helper imports the typechecker can otherwise flag as unused
    void lngToTileX
    void latToTileY

    post({ kind: 'done', sizeBytes: bytes })
  } catch (e) {
    post({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
  }
})
