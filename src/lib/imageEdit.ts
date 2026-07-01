/**
 * imageEdit — pure crop primitive for the chat "review before send" editor
 * (see Components/ImageEditor.tsx). Takes the decoded source canvas + a
 * normalised crop rectangle and produces a JPEG File ready for the existing
 * sendImage pipeline (which resizes/thumbnails it further). All 2D-canvas, no
 * heavy CV — same PWA / iOS-Safari floor as lib/docScan (whose fileToCanvas
 * decode we reuse rather than duplicate).
 */
import { fileToCanvas, type RasterImage } from './docScan'

export { fileToCanvas }
export type { RasterImage }

/** A crop selection in normalised source space (0..1 across width/height). */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Give the output a .jpg name derived from the picked file (fallback 'photo'). */
function jpgName(name?: string): string {
  const base = (name ?? 'photo').replace(/\.[^./\\]+$/, '').trim() || 'photo'
  return `${base}.jpg`
}

/**
 * Render the crop rectangle out of the source canvas into a fresh JPEG File.
 * The long edge is capped at `maxLong` (the send pipeline downscales again, so
 * this just keeps the intermediate cheap); an empty/degenerate rect falls back
 * to the whole image so a send never produces a blank frame.
 */
export function cropToFile(
  src: RasterImage,
  rect: CropRect,
  opts: { name?: string; maxLong?: number; quality?: number } = {},
): File {
  const { name, maxLong = 2000, quality = 0.9 } = opts

  let sx = Math.round(clamp01(rect.x) * src.width)
  let sy = Math.round(clamp01(rect.y) * src.height)
  let cw = Math.round(clamp01(rect.w) * src.width)
  let ch = Math.round(clamp01(rect.h) * src.height)
  // Clamp the window inside the image; fall back to full frame if degenerate.
  cw = Math.min(cw, src.width - sx)
  ch = Math.min(ch, src.height - sy)
  if (cw < 2 || ch < 2) {
    sx = 0; sy = 0; cw = src.width; ch = src.height
  }

  const long = Math.max(cw, ch)
  const scale = long > maxLong ? maxLong / long : 1
  const outW = Math.max(1, Math.round(cw * scale))
  const outH = Math.max(1, Math.round(ch * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(src.canvas, sx, sy, cw, ch, 0, 0, outW, outH)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const bytes = dataUrlToBytes(dataUrl)
  return new File([bytes], jpgName(name), { type: 'image/jpeg' })
}
