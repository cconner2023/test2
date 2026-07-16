/**
 * docScan — pure (React-free) document-scan primitives for the in-browser
 * "Adobe Scan"-style capture flow (see Components/Property/DocScanner.tsx).
 *
 * Everything here runs on a 2D canvas so it works inside a pure PWA on iOS
 * Safari — NO native scanner, NO OpenCV/WASM (keeps the offline payload tiny).
 * The pipeline is: decode a captured photo → auto-detect the page quad (manual
 * fallback in the UI) → perspective de-skew via a triangle-mesh warp → enhance
 * (auto / colour / B&W document / greyscale) → assemble the pages into one
 * multi-page PDF, handed back as a File to the existing encrypted-attachment
 * upload pipeline unchanged.
 *
 * No PHI concerns here — these are equipment worksheets (5988E / dispatch forms).
 */

/** A point in normalised image space (0..1 across width/height). */
export interface Pt {
  x: number
  y: number
}

/** Page corners, always ordered top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt]

export type ScanFilter = 'auto' | 'color' | 'bw' | 'gray'

export interface RasterImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/**
 * Decode a captured/picked image File into a canvas, downscaling the long edge
 * to `maxDim` so a 12-MP phone photo doesn't blow out memory or the eventual
 * PDF size. Uses createImageBitmap when available (fast, off-main-thread decode
 * on modern iOS) and falls back to an <img> + object URL.
 */
export async function fileToCanvas(file: Blob, maxDim = 2400): Promise<RasterImage> {
  let srcW: number
  let srcH: number
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void

  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file)
    srcW = bmp.width
    srcH = bmp.height
    draw = (ctx, w, h) => { ctx.drawImage(bmp, 0, 0, w, h); bmp.close() }
  } else {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('image decode failed'))
        el.src = url
      })
      srcW = img.naturalWidth
      srcH = img.naturalHeight
      draw = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h)
    } finally {
      // Revoke after the draw call below has run synchronously.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx, w, h)
  return { canvas, width: w, height: h }
}

/** The default near-full-frame quad (a small inset) used when detection is weak. */
export function defaultQuad(inset = 0.06): Quad {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ]
}

/**
 * Heuristic page-edge auto-detect — NO heavy CV. Downscales to a working width,
 * builds a Sobel gradient-magnitude map, and reads the projection profiles
 * (summed gradient per column / per row): a sheet against a contrasting surface
 * produces strong gradient ridges at its four borders. We scan inward from each
 * edge to the first ridge that clears a noise-floor threshold. It returns an
 * axis-aligned quad (rotation/skew is corrected by the user dragging corners —
 * the "manual fallback") and falls back to `defaultQuad` when the signal is too
 * weak to trust.
 */
export function detectDocumentQuad(img: RasterImage): Quad {
  const W = 320
  const H = Math.max(1, Math.round((img.height / img.width) * W))
  const small = document.createElement('canvas')
  small.width = W
  small.height = H
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(img.canvas, 0, 0, W, H)
  const { data } = sctx.getImageData(0, 0, W, H)

  // Greyscale (luma).
  const gray = new Float32Array(W * H)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // Sobel magnitude → projection profiles.
  const col = new Float32Array(W)
  const row = new Float32Array(H)
  const at = (x: number, y: number) => gray[y * W + x]
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        at(x + 1, y - 1) - 2 * at(x + 1, y) - at(x + 1, y + 1)
      const gy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        at(x - 1, y + 1) - 2 * at(x, y + 1) - at(x + 1, y + 1)
      const mag = Math.abs(gx) + Math.abs(gy)
      col[x] += mag
      row[y] += mag
    }
  }

  const edge = (profile: Float32Array, n: number): [number, number] | null => {
    let max = 0
    let sum = 0
    for (let i = 0; i < n; i++) { if (profile[i] > max) max = profile[i]; sum += profile[i] }
    if (max <= 0) return null
    const mean = sum / n
    const thresh = mean + 0.45 * (max - mean)
    // Search inward from each side, but only in the outer 45% so we lock onto
    // the page border, not interior content (printed text ridges).
    const limit = Math.floor(n * 0.45)
    let lo = -1
    let hi = -1
    for (let i = 1; i < limit; i++) { if (profile[i] >= thresh) { lo = i; break } }
    for (let i = n - 2; i > n - 1 - limit; i--) { if (profile[i] >= thresh) { hi = i; break } }
    if (lo < 0 || hi < 0 || hi - lo < n * 0.3) return null
    return [lo, hi]
  }

  const cx = edge(col, W)
  const cy = edge(row, H)
  if (!cx || !cy) return defaultQuad()

  const x0 = cx[0] / W
  const x1 = cx[1] / W
  const y0 = cy[0] / H
  const y1 = cy[1] / H
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

// ── Geometry ────────────────────────────────────────────────────────────────

/** Solve a 3×3 linear system (Cramer's rule). Returns null if singular. */
function solve3(m: number[][], b: number[]): number[] | null {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  if (Math.abs(det) < 1e-9) return null
  const col = (c: number, v: number[]) => m.map((r, i) => r.map((x, j) => (j === c ? v[i] : x)))
  const d3 = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  return [d3(col(0, b)) / det, d3(col(1, b)) / det, d3(col(2, b)) / det]
}

/** Solve a general N×N linear system via Gaussian elimination with partial pivot. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-12) return null
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((r, i) => r[n] / r[i])
}

/** 3×3 homography (length-9, h[8]=1) mapping the `from` quad onto the `to` quad. */
function homography(from: Pt[], to: Pt[]): number[] | null {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v)
  }
  const h = solveLinear(A, b)
  return h ? [...h, 1] : null
}

function applyH(h: number[], x: number, y: number): Pt {
  const d = h[6] * x + h[7] * y + h[8]
  return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d }
}

/** Draw the source image through the affine that maps src-triangle → dst-triangle. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s: [Pt, Pt, Pt],
  d: [Pt, Pt, Pt],
) {
  // Affine a,b,c / d,e,f with dx = a*sx + b*sy + c, dy = d*sx + e*sy + f.
  const mat = [
    [s[0].x, s[0].y, 1],
    [s[1].x, s[1].y, 1],
    [s[2].x, s[2].y, 1],
  ]
  const ax = solve3(mat, [d[0].x, d[1].x, d[2].x])
  const ay = solve3(mat, [d[0].y, d[1].y, d[2].y])
  if (!ax || !ay) return

  ctx.save()
  // Inflate the clip triangle slightly toward... away from its centroid so
  // adjacent mesh cells overlap by a hair and don't leave hairline seams.
  const cxc = (d[0].x + d[1].x + d[2].x) / 3
  const cyc = (d[0].y + d[1].y + d[2].y) / 3
  const grow = 0.6
  const gp = (p: Pt): Pt => {
    const dx = p.x - cxc
    const dy = p.y - cyc
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * grow, y: p.y + (dy / len) * grow }
  }
  const g0 = gp(d[0]); const g1 = gp(d[1]); const g2 = gp(d[2])
  ctx.beginPath()
  ctx.moveTo(g0.x, g0.y)
  ctx.lineTo(g1.x, g1.y)
  ctx.lineTo(g2.x, g2.y)
  ctx.closePath()
  ctx.clip()
  // setTransform(m11=a, m12=d, m21=b, m22=e, dx=c, dy=f).
  ctx.setTransform(ax[0], ay[0], ax[1], ay[1], ax[2], ay[2])
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/**
 * Perspective de-skew: warp the (possibly skewed) source `quad` onto a flat
 * `outW`×`outH` rectangle. Canvas 2D has no native perspective transform, so we
 * tessellate the destination rectangle into an N×N grid, map each grid vertex
 * back to source space through the page homography, and texture each cell with
 * two affine triangles — a standard piecewise-affine approximation of the warp
 * that's smooth at this grid density and runs fine on iOS Safari.
 */
export function warpQuad(src: RasterImage, quad: Quad, outW: number, outH: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true

  const srcPx: Pt[] = quad.map((p) => ({ x: p.x * src.width, y: p.y * src.height }))
  const dstRect: Pt[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ]
  const h = homography(dstRect, srcPx)
  if (!h || h.some((v) => !Number.isFinite(v))) {
    // Degenerate quad (or a non-finite solve) — fall back to a straight stretch
    // rather than warping with NaN, which the canvas treats as an identity draw.
    ctx.drawImage(src.canvas, 0, 0, outW, outH)
    return out
  }

  const N = 22
  // Precompute source coords for every grid vertex.
  const grid: Pt[][] = []
  for (let gy = 0; gy <= N; gy++) {
    const rowPts: Pt[] = []
    for (let gx = 0; gx <= N; gx++) {
      const dx = (gx / N) * outW
      const dy = (gy / N) * outH
      rowPts.push(applyH(h, dx, dy))
    }
    grid.push(rowPts)
  }

  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const d00 = { x: (gx / N) * outW, y: (gy / N) * outH }
      const d10 = { x: ((gx + 1) / N) * outW, y: (gy / N) * outH }
      const d11 = { x: ((gx + 1) / N) * outW, y: ((gy + 1) / N) * outH }
      const d01 = { x: (gx / N) * outW, y: ((gy + 1) / N) * outH }
      const s00 = grid[gy][gx]
      const s10 = grid[gy][gx + 1]
      const s11 = grid[gy + 1][gx + 1]
      const s01 = grid[gy + 1][gx]
      drawTriangle(ctx, src.canvas, [s00, s10, s11], [d00, d10, d11])
      drawTriangle(ctx, src.canvas, [s00, s11, s01], [d00, d11, d01])
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return out
}

/** Pick a sensible output size for a warped page from the quad's edge lengths. */
export function outputSizeForQuad(src: RasterImage, quad: Quad, maxLong = 1800): { w: number; h: number } {
  const px = quad.map((p) => ({ x: p.x * src.width, y: p.y * src.height }))
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const w = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2
  const h = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2
  const long = Math.max(w, h)
  const scale = long > maxLong ? maxLong / long : 1
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

// ── Enhance filters ───────────────────────────────────────────────────────────

/** Apply an enhance filter to a canvas in place (operates on its full pixels). */
export function applyFilter(canvas: HTMLCanvasElement, filter: ScanFilter): void {
  if (filter === 'auto') return autoEnhance(canvas)
  if (filter === 'color') return colorBoost(canvas)
  if (filter === 'gray') return grayscale(canvas)
  return adaptiveThreshold(canvas)
}

function colorBoost(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data
  const contrast = 1.25
  const bright = 6
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp((d[i] - 128) * contrast + 128 + bright)
    d[i + 1] = clamp((d[i + 1] - 128) * contrast + 128 + bright)
    d[i + 2] = clamp((d[i + 2] - 128) * contrast + 128 + bright)
  }
  ctx.putImageData(id, 0, 0)
}

/** Per-channel auto contrast stretch (percentile clip) — the default "auto" look. */
function autoEnhance(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    hist[l]++
  }
  const total = d.length / 4
  const clipFrac = 0.01
  let lo = 0
  let hi = 255
  let acc = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * clipFrac) { lo = i; break } }
  acc = 0
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * clipFrac) { hi = i; break } }
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(((d[i] - lo) / range) * 255)
    d[i + 1] = clamp(((d[i + 1] - lo) / range) * 255)
    d[i + 2] = clamp(((d[i + 2] - lo) / range) * 255)
  }
  ctx.putImageData(id, 0, 0)
}

function grayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const l = clamp(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)
    d[i] = d[i + 1] = d[i + 2] = l
  }
  ctx.putImageData(id, 0, 0)
}

/**
 * Adaptive (local-mean) threshold — the signature "B&W document" scan look.
 * Computes a box mean per pixel via an integral image and thresholds each pixel
 * against its neighbourhood mean minus a small bias, so uneven lighting and
 * shadows don't black out half the page the way a global threshold would.
 */
function adaptiveThreshold(canvas: HTMLCanvasElement): void {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data

  const gray = new Float32Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114
  }
  // Integral image (w+1 × h+1) for O(1) box sums.
  const iw = w + 1
  const integral = new Float64Array(iw * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x]
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum
    }
  }
  const rad = Math.max(8, Math.round(Math.min(w, h) / 16))
  const bias = 8 // pixels darker than (localMean - bias) become ink.
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad)
    const y1 = Math.min(h - 1, y + rad)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad)
      const x1 = Math.min(w - 1, x + rad)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * iw + (x1 + 1)] -
        integral[y0 * iw + (x1 + 1)] -
        integral[(y1 + 1) * iw + x0] +
        integral[y0 * iw + x0]
      const mean = sum / area
      const v = gray[y * w + x] < mean - bias ? 0 : 255
      const p = (y * w + x) * 4
      d[p] = d[p + 1] = d[p + 2] = v
    }
  }
  ctx.putImageData(id, 0, 0)
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// ── PDF assembly ──────────────────────────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Build a filename-safe title (PDF basename), with a fallback. */
export function scanFileName(title: string): string {
  const safe = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60)
  return `${safe || 'scan'}.pdf`
}

/**
 * Normalise an attachment File to a PDF for storage/export. A file that is
 * already a PDF passes through untouched; an image is decoded and wrapped into a
 * single-page PDF (same embed pipeline as a scan) so every stored PMCS / dispatch
 * document is a PDF and always exports/opens as one — an image blob otherwise
 * won't open in a new tab reliably. Anything non-image, non-PDF is returned as-is.
 */
export async function ensurePdfFile(file: File, title?: string): Promise<File> {
  if (file.type === 'application/pdf') return file
  if (!file.type.startsWith('image/')) return file
  const img = await fileToCanvas(file)
  const jpeg = img.canvas.toDataURL('image/jpeg', 0.9)
  const base = (title ?? file.name).replace(/\.[^.]+$/, '')
  return assembleScanPdf([jpeg], base)
}

/**
 * Assemble the rendered pages (JPEG data URLs) into one multi-page PDF, returned
 * as a File ready for the encrypted-attachment pipeline. Each PDF page is sized
 * to its image's pixel dimensions (1px = 1pt) so nothing is distorted.
 */
export async function assembleScanPdf(pageJpegDataUrls: string[], title: string): Promise<File> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  for (const dataUrl of pageJpegDataUrls) {
    const bytes = dataUrlToBytes(dataUrl)
    const jpg = await pdf.embedJpg(bytes)
    const page = pdf.addPage([jpg.width, jpg.height])
    page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
  }
  const out = await pdf.save()
  // Copy into a fresh ArrayBuffer-backed view so the Blob/File types are happy.
  const buf = new Uint8Array(out.length)
  buf.set(out)
  return new File([buf], scanFileName(title), { type: 'application/pdf' })
}
