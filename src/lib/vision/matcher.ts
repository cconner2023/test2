/**
 * matcher.ts — pure fingerprint comparison and match routing.
 * No React, no side-effects. All scoring is deterministic.
 */

import type { VisualFingerprint } from '../../Types/PropertyTypes'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  itemId: string
  score: number
  matchedBarcode?: string
}

export type MatchResult =
  | { kind: 'confirmed'; candidate: MatchCandidate }
  | { kind: 'ambiguous'; candidates: MatchCandidate[] }
  | { kind: 'no_match' }

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

function histogramIntersection(a: number[], b: number[]): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    sum += Math.min(a[i], b[i])
  }
  return sum
}

function barcodeIntersect(a: string[], b: string[]): string | undefined {
  for (const code of a) {
    if (b.includes(code)) return code
  }
  return undefined
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scores how well two fingerprints match on a 0..1 scale.
 *
 * Default weights (barcode-present case):
 *   barcode intersection  0.65
 *   Hu moment cosine      0.20
 *   aspect ratio          0.08
 *   color histogram       0.07
 *
 * When both fingerprints have no barcodes the barcode weight (0.65) is
 * redistributed proportionally to the remaining three signals.
 */
export function scoreFingerprints(a: VisualFingerprint, b: VisualFingerprint): number {
  const BARCODE_W = 0.65
  const HU_W      = 0.20
  const ASPECT_W  = 0.08
  const COLOR_W   = 0.07

  const bothLackBarcodes = a.barcodes.length === 0 && b.barcodes.length === 0
  const remainingTotal = HU_W + ASPECT_W + COLOR_W  // 0.35

  // Weights after optional redistribution
  let wBarcode: number
  let wHu: number
  let wAspect: number
  let wColor: number

  if (bothLackBarcodes) {
    wBarcode = 0
    wHu     = HU_W      / remainingTotal
    wAspect = ASPECT_W  / remainingTotal
    wColor  = COLOR_W   / remainingTotal
  } else {
    wBarcode = BARCODE_W
    wHu      = HU_W
    wAspect  = ASPECT_W
    wColor   = COLOR_W
  }

  // Barcode component
  let barcodeScore = 0
  if (!bothLackBarcodes) {
    const matched = barcodeIntersect(a.barcodes, b.barcodes)
    barcodeScore = matched !== undefined ? 1.0 : 0.0
    // If both have barcodes but no match → barcodeScore stays 0 (correct)
  }

  // Hu moment cosine similarity
  const huScore = Math.max(0, cosineSimilarity(a.hu_moments, b.hu_moments))

  // Aspect ratio similarity: 1 - min(|a-b|/b, 1), guard div0
  const aspectDenom = Math.max(b.aspect_ratio, 0.01)
  const aspectScore = 1 - Math.min(Math.abs(a.aspect_ratio - b.aspect_ratio) / aspectDenom, 1)

  // Color histogram intersection (already L1-normalised, so sum of mins ∈ [0,1])
  const colorScore = histogramIntersection(a.color_hist, b.color_hist)

  return wBarcode * barcodeScore + wHu * huScore + wAspect * aspectScore + wColor * colorScore
}

/**
 * Scores query against every item fingerprint and returns all candidates
 * sorted descending by score.
 */
export function rankCandidates(
  query: VisualFingerprint,
  items: Array<{ id: string; fingerprint: VisualFingerprint }>,
): MatchCandidate[] {
  return items
    .map(item => {
      const score = scoreFingerprints(query, item.fingerprint)
      const matchedBarcode = barcodeIntersect(query.barcodes, item.fingerprint.barcodes)
      const candidate: MatchCandidate = { itemId: item.id, score }
      if (matchedBarcode !== undefined) candidate.matchedBarcode = matchedBarcode
      return candidate
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Routes a ranked candidate list into a typed MatchResult.
 *
 * Thresholds:
 *   score < 0.50                          → no_match
 *   score >= 0.85 AND gap to #2 >= 0.15   → confirmed
 *   otherwise                             → ambiguous (top 3)
 */
export function routeMatch(candidates: MatchCandidate[]): MatchResult {
  if (candidates.length === 0 || candidates[0].score < 0.50) {
    return { kind: 'no_match' }
  }

  const top = candidates[0]
  const second = candidates[1]

  if (top.score >= 0.85 && (second === undefined || second.score <= top.score - 0.15)) {
    return { kind: 'confirmed', candidate: top }
  }

  return { kind: 'ambiguous', candidates: candidates.slice(0, 3) }
}

/**
 * Full pipeline: filter out items without a fingerprint, rank, then route.
 */
export function matchScan(
  query: VisualFingerprint,
  items: Array<{ id: string; fingerprint: VisualFingerprint | null }>,
): MatchResult {
  const eligible = items
    .filter((item): item is { id: string; fingerprint: VisualFingerprint } =>
      item.fingerprint !== null,
    )

  const ranked = rankCandidates(query, eligible)
  return routeMatch(ranked)
}
