/**
 * fingerprint.ts — pure image processing functions for visual item identification.
 * No React, no side-effects. All math runs synchronously on the main thread.
 */

import type { VisualFingerprint } from '../../Types/PropertyTypes'

// ─── Grayscale ────────────────────────────────────────────────────────────────

function toGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData
  const gray = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    const base = i * 4
    gray[i] = 0.299 * data[base] + 0.587 * data[base + 1] + 0.114 * data[base + 2]
  }
  return gray
}

// ─── Otsu threshold ───────────────────────────────────────────────────────────

function otsuThreshold(gray: Float32Array): number {
  // Build 256-bin histogram (values 0-255)
  const hist = new Float64Array(256)
  for (let i = 0; i < gray.length; i++) {
    hist[Math.round(gray[i])] += 1
  }
  const total = gray.length

  let sumAll = 0
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]

  let sumB = 0
  let wB = 0
  let maxVar = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break

    sumB += t * hist[t]
    const meanB = sumB / wB
    const meanF = (sumAll - sumB) / wF
    const diff = meanB - meanF
    const varBetween = wB * wF * diff * diff

    if (varBetween > maxVar) {
      maxVar = varBetween
      threshold = t
    }
  }

  return threshold
}

// ─── Bounding rect ────────────────────────────────────────────────────────────

interface BoundingRect {
  minX: number
  maxX: number
  minY: number
  maxY: number
  foregroundCount: number
}

function findBoundingRect(gray: Float32Array, width: number, height: number, threshold: number): BoundingRect {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  let foregroundCount = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < threshold) {
        foregroundCount++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (foregroundCount === 0) {
    return { minX: 0, maxX: width - 1, minY: 0, maxY: height - 1, foregroundCount: 0 }
  }

  return { minX, maxX, minY, maxY, foregroundCount }
}

// ─── Hu moments ───────────────────────────────────────────────────────────────

function computeHuMoments(gray: Float32Array, width: number, height: number, threshold: number): number[] {
  // Raw spatial moments
  let m00 = 0, m10 = 0, m01 = 0
  let m11 = 0, m20 = 0, m02 = 0
  let m21 = 0, m12 = 0, m30 = 0, m03 = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < threshold) {
        m00 += 1
        m10 += x
        m01 += y
        m11 += x * y
        m20 += x * x
        m02 += y * y
        m21 += x * x * y
        m12 += x * y * y
        m30 += x * x * x
        m03 += y * y * y
      }
    }
  }

  if (m00 === 0) return [0, 0, 0, 0, 0, 0, 0]

  const cx = m10 / m00
  const cy = m01 / m00

  // Central moments
  const mu20 = m20 - cx * m10
  const mu02 = m02 - cy * m01
  const mu11 = m11 - cx * m01
  const mu30 = m30 - 3 * cx * m20 + 2 * cx * cx * m10
  const mu03 = m03 - 3 * cy * m02 + 2 * cy * cy * m01
  const mu21 = m21 - 2 * cx * m11 - cy * m20 + 2 * cx * cx * m01
  const mu12 = m12 - 2 * cy * m11 - cx * m02 + 2 * cy * cy * m10

  // Normalised central moments: nu_pq = mu_pq / m00^(1 + (p+q)/2)
  const n = (p: number, q: number, mu: number) => mu / Math.pow(m00, 1 + (p + q) / 2)

  const nu20 = n(2, 0, mu20)
  const nu02 = n(0, 2, mu02)
  const nu11 = n(1, 1, mu11)
  const nu30 = n(3, 0, mu30)
  const nu03 = n(0, 3, mu03)
  const nu21 = n(2, 1, mu21)
  const nu12 = n(1, 2, mu12)

  // Standard 7 Hu invariant moments
  const h1 = nu20 + nu02
  const h2 = (nu20 - nu02) ** 2 + 4 * nu11 ** 2
  const h3 = (nu30 - 3 * nu12) ** 2 + (3 * nu21 - nu03) ** 2
  const h4 = (nu30 + nu12) ** 2 + (nu21 + nu03) ** 2
  const h5 =
    (nu30 - 3 * nu12) * (nu30 + nu12) * ((nu30 + nu12) ** 2 - 3 * (nu21 + nu03) ** 2) +
    (3 * nu21 - nu03) * (nu21 + nu03) * (3 * (nu30 + nu12) ** 2 - (nu21 + nu03) ** 2)
  const h6 =
    (nu20 - nu02) * ((nu30 + nu12) ** 2 - (nu21 + nu03) ** 2) +
    4 * nu11 * (nu30 + nu12) * (nu21 + nu03)
  const h7 =
    (3 * nu21 - nu03) * (nu30 + nu12) * ((nu30 + nu12) ** 2 - 3 * (nu21 + nu03) ** 2) -
    (nu30 - 3 * nu12) * (nu21 + nu03) * (3 * (nu30 + nu12) ** 2 - (nu21 + nu03) ** 2)

  return [h1, h2, h3, h4, h5, h6, h7]
}

// ─── Color histogram ──────────────────────────────────────────────────────────

function computeColorHist(imageData: ImageData): number[] {
  const { data } = imageData
  const hist = new Array<number>(24).fill(0)

  for (let i = 0; i < data.length; i += 4) {
    const rBin = Math.floor(data[i] / 32)       // 0..7
    const gBin = Math.floor(data[i + 1] / 32)   // 0..7
    const bBin = Math.floor(data[i + 2] / 32)   // 0..7
    hist[rBin] += 1
    hist[8 + gBin] += 1
    hist[16 + bBin] += 1
  }

  // L1 normalise
  const pixelCount = data.length / 4
  const channelPixels = pixelCount || 1
  for (let i = 0; i < 24; i++) {
    hist[i] = hist[i] / channelPixels
  }

  return hist
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives a VisualFingerprint from an ImageData frame and any decoded barcodes.
 * All computation is synchronous — suitable for main-thread use on small inventory.
 */
export function extractFingerprint(imageData: ImageData, barcodes: string[]): VisualFingerprint {
  const { width, height } = imageData
  const totalPixels = width * height

  const gray = toGrayscale(imageData)
  const threshold = otsuThreshold(gray)
  const bbox = findBoundingRect(gray, width, height, threshold)

  const boundingWidth = Math.max(1, bbox.maxX - bbox.minX + 1)
  const boundingHeight = Math.max(1, bbox.maxY - bbox.minY + 1)
  const aspect_ratio = Math.max(0.01, boundingWidth / boundingHeight)
  const area_norm = totalPixels > 0 ? bbox.foregroundCount / totalPixels : 0

  const hu_moments = computeHuMoments(gray, width, height, threshold)
  const color_hist = computeColorHist(imageData)

  const hasBarcodes = barcodes.length > 0
  // If barcodes present, visual features were also reliably computed → 'both'
  // No barcodes → 'visual'
  const enroll_method: VisualFingerprint['enroll_method'] = hasBarcodes ? 'both' : 'visual'

  return {
    barcodes,
    aspect_ratio,
    area_norm,
    hu_moments,
    color_hist,
    enrolled_at: new Date().toISOString(),
    enroll_method,
  }
}
