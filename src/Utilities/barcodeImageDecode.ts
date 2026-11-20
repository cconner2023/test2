import {
  MultiFormatReader, BinaryBitmap, HybridBinarizer, GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat, ResultMetadataType,
} from '@zxing/library'
import './zxingLatin1'
import { parseBarcodePart, scannedSymbolBytes } from './barcodeParts'

export interface ImageBarcodeResult {
  text: string
  byteSegments: Uint8Array | null
}

/**
 * Decode a barcode from an image file using ZXing.
 * Tries HybridBinarizer first, falls back to GlobalHistogramBinarizer.
 * Extracts raw BYTE_SEGMENTS for binary Data Matrix support.
 */
export async function decodeImageBarcode(file: File): Promise<ImageBarcodeResult> {
  const canvas = await fileToCanvas(file)
  return decodeCanvas(canvas, createReader())
}

/**
 * Decode every multi-symbol part in an image (a shared grid PNG, a DD689 page,
 * or a photo of a printed series). A multi-symbol image usually defeats a
 * whole-image decode, so a failure there is not fatal:
 *   1. whole image (single-symbol images and lucky multi-symbol ones)
 *   2. gutter segmentation — XY-cut on white rows/columns, decode each blob
 *   3. overlapping tile sweep at increasing density (skewed/rotated photos)
 * Returns distinct results for one set (first = a part of that set), or the
 * single non-series symbol found. Throws if no barcode is found at all.
 * `known` = parts of a set already collected (earlier image / camera): they
 * count toward completion, so a follow-up image of just the missing symbol
 * stops as soon as it is found.
 */
export async function decodeImageBarcodes(
  file: File,
  known?: { setId: number; indices: number[] } | null,
): Promise<ImageBarcodeResult[]> {
  const canvas = await fileToCanvas(file)
  const reader = createReader()

  let single: ImageBarcodeResult | null = null
  let setId: number | null = null
  let total = 0
  const results: ImageBarcodeResult[] = []
  const found = new Set<number>()
  const done = () => {
    if (setId === null) return false
    let n = found.size
    if (known && known.setId === setId) for (const i of known.indices) if (!found.has(i)) n++
    return n >= total
  }

  /** Record a decode; returns true when it was a new part of the chosen set. */
  const consider = (r: ImageBarcodeResult): void => {
    const p = parseBarcodePart(scannedSymbolBytes(r.text, r.byteSegments))
    if (!p) { single ??= r; return }
    if (setId === null) { setId = p.setId; total = p.total }
    if (p.setId !== setId || found.has(p.index)) return
    found.add(p.index)
    results.push(r)
  }
  const tryDecode = (c: HTMLCanvasElement) => {
    try { consider(decodeCanvas(c, reader)) } catch { /* no symbol here */ }
  }

  tryDecode(canvas)
  // A clean single (non-series) symbol decoded from the whole image — done.
  if (single && setId === null) return [single]

  const crop = document.createElement('canvas')
  const cctx = crop.getContext('2d')!
  const drawCrop = (x: number, y: number, w: number, h: number, pad: number) => {
    crop.width = w + pad * 2
    crop.height = h + pad * 2
    cctx.fillStyle = '#ffffff'
    cctx.fillRect(0, 0, crop.width, crop.height)
    cctx.drawImage(canvas, x, y, w, h, pad, pad, w, h)
  }

  // 2. Gutter segmentation
  if (!done()) {
    for (const b of segmentSymbols(canvas)) {
      if (done()) break
      drawCrop(b.x, b.y, b.w, b.h, Math.round(Math.max(b.w, b.h) * 0.1))
      tryDecode(crop)
    }
  }

  // 3. Tile sweep: d tiles per axis, each 2/(d+1) of the image with 50% overlap.
  // Up to d=7 so a 5×5 DD689 grid gets tiles about one cell wide. When the
  // gutter pass already found parts, the image is likely a partial set (the
  // missing symbol simply isn't there) — only a cheap coarse sweep then.
  const maxD = found.size > 1 ? 3 : 7
  for (let d = 2; d <= maxD && !done(); d++) {
    const tw = Math.round((canvas.width * 2) / (d + 1))
    const th = Math.round((canvas.height * 2) / (d + 1))
    const sx = canvas.width / (d + 1)
    const sy = canvas.height / (d + 1)
    for (let row = 0; row < d && !done(); row++) {
      for (let col = 0; col < d && !done(); col++) {
        drawCrop(Math.round(col * sx), Math.round(row * sy), tw, th, 0)
        tryDecode(crop)
      }
    }
    // No series anywhere after the first sweep, but a lone symbol turned up.
    if (setId === null && single) break
  }

  if (results.length) return results
  if (single) return [single]
  throw new Error('No barcode found')
}

interface Box { x: number; y: number; w: number; h: number }

/**
 * Find candidate symbol boxes by recursive XY-cut: split along rows/columns
 * that are (nearly) all white. Data Matrix finder bars mean no row/column
 * through a symbol is ever empty, so each leaf is one symbol (or a label).
 * Works on a downscaled grayscale copy; boxes are returned in full-res pixels.
 */
function segmentSymbols(canvas: HTMLCanvasElement): Box[] {
  const MAX_DIM = 1200
  const k = Math.min(1, MAX_DIM / Math.max(canvas.width, canvas.height))
  const W = Math.max(1, Math.round(canvas.width * k))
  const H = Math.max(1, Math.round(canvas.height * k))
  const small = document.createElement('canvas')
  small.width = W
  small.height = H
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(canvas, 0, 0, W, H)
  const px = sctx.getImageData(0, 0, W, H).data

  // Threshold midway between the 5th and 95th luminance percentiles.
  const lum = new Uint8Array(W * H)
  const hist = new Uint32Array(256)
  for (let i = 0; i < W * H; i++) {
    const v = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000
    lum[i] = v
    hist[lum[i]]++
  }
  const pct = (q: number) => {
    let acc = 0
    const target = W * H * q
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v }
    return 255
  }
  const lo = pct(0.05)
  const hi = pct(0.95)
  if (hi - lo < 40) return [] // no contrast — nothing to segment
  const thr = (lo + hi) / 2
  const dark = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) dark[i] = lum[i] < thr ? 1 : 0

  const MIN_SIDE = Math.max(16, Math.round(Math.min(W, H) * 0.03))
  const MIN_GAP = 3
  const leaves: Box[] = []

  /** Split [a,b) along an axis into non-empty runs separated by gaps ≥ MIN_GAP. */
  const runs = (counts: number[], tol: number): [number, number][] => {
    const out: [number, number][] = []
    let start = -1
    let gap = 0
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > tol) {
        if (start < 0) start = i
        gap = 0
      } else if (start >= 0 && ++gap >= MIN_GAP) {
        out.push([start, i - gap + 1])
        start = -1
        gap = 0
      }
    }
    if (start >= 0) out.push([start, counts.length - gap])
    return out
  }

  const cut = (b: Box, depth: number) => {
    if (leaves.length > 200 || depth > 12) return
    const rowCounts = new Array<number>(b.h).fill(0)
    const colCounts = new Array<number>(b.w).fill(0)
    for (let y = 0; y < b.h; y++) {
      const off = (b.y + y) * W + b.x
      for (let x = 0; x < b.w; x++) {
        if (dark[off + x]) { rowCounts[y]++; colCounts[x]++ }
      }
    }
    // Tolerate speckle: a gutter row/column may hold ~1% dark pixels.
    const rows = runs(rowCounts, Math.floor(b.w * 0.01))
    const cols = runs(colCounts, Math.floor(b.h * 0.01))
    if (rows.length <= 1 && cols.length <= 1) {
      // Leaf — tighten to its content and keep if symbol-sized and squarish.
      const y0 = rows[0]?.[0] ?? 0, y1 = rows[0]?.[1] ?? b.h
      const x0 = cols[0]?.[0] ?? 0, x1 = cols[0]?.[1] ?? b.w
      const w = x1 - x0, h = y1 - y0
      if (w >= MIN_SIDE && h >= MIN_SIDE && w / h < 3 && h / w < 3) {
        leaves.push({ x: b.x + x0, y: b.y + y0, w, h })
      }
      return
    }
    if (rows.length > 1) {
      for (const [a, z] of rows) cut({ x: b.x, y: b.y + a, w: b.w, h: z - a }, depth + 1)
    } else {
      for (const [a, z] of cols) cut({ x: b.x + a, y: b.y, w: z - a, h: b.h }, depth + 1)
    }
  }
  cut({ x: 0, y: 0, w: W, h: H }, 0)

  // Back to full-res pixels.
  return leaves.map(b => ({
    x: Math.floor(b.x / k), y: Math.floor(b.y / k),
    w: Math.ceil(b.w / k), h: Math.ceil(b.h / k),
  }))
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

function createReader(): MultiFormatReader {
  const hints = new Map<DecodeHintType, any>()
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE])
  const reader = new MultiFormatReader()
  reader.setHints(hints)
  return reader
}

function decodeCanvas(canvas: HTMLCanvasElement, reader: MultiFormatReader): ImageBarcodeResult {
  const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)

  let result
  try {
    result = reader.decode(new BinaryBitmap(new HybridBinarizer(luminanceSource)))
  } catch {
    result = reader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource)))
  }

  const text = result.getText()

  let byteSegments: Uint8Array | null = null
  const metadata = result.getResultMetadata()
  if (metadata) {
    const segments = metadata.get(ResultMetadataType.BYTE_SEGMENTS) as Uint8Array[] | undefined
    if (segments?.length) {
      const totalLen = segments.reduce((sum, s) => sum + s.length, 0)
      const merged = new Uint8Array(totalLen)
      let offset = 0
      for (const seg of segments) { merged.set(seg, offset); offset += seg.length }
      byteSegments = merged
    }
  }

  return { text, byteSegments }
}
