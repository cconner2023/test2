/**
 * Region hit-zone rectangles positioned over the TC3 body diagram SVG.
 * All values are percentages (0–100) of SVG viewBox dimensions (600×512).
 * Posterior (back) body on left, anterior (front) body on right.
 *
 * Reuses the same RegionRect interface as the burn diagram.
 */

import type { RegionRect } from '../BurnDiagram/burnRegionRects'

// ── Posterior (left body, centered ~x=20.7%) ──────────────────────────────────

export const POSTERIOR_RECTS: RegionRect[] = [
    { id: 'head-back', x: 16, y: 4.5, w: 8.5, h: 6.5, shape: 'oval' },
    { id: 'neck-back', x: 17.8, y: 10.5, w: 5.5, h: 3.5, shape: 'oval' },
    { id: 'back-upper', x: 13, y: 15.5, w: 15, h: 15 },
    { id: 'back-lower', x: 13, y: 30, w: 15, h: 9 },
    { id: 'upper-arm-left-back', x: 7, y: 16.5, w: 5, h: 16, angle: 12 },
    { id: 'upper-arm-right-back', x: 29, y: 16.5, w: 5, h: 16, angle: -12 },
    { id: 'forearm-left-back', x: 4, y: 31, w: 4.5, h: 18, angle: 8 },
    { id: 'forearm-right-back', x: 32.5, y: 31, w: 4.5, h: 18, angle: -8 },
    { id: 'hand-left-back', x: 1.5, y: 48, w: 5, h: 7 },
    { id: 'hand-right-back', x: 34, y: 48, w: 5, h: 7 },
    { id: 'upper-leg-left-back', x: 11, y: 39, w: 8, h: 24 },
    { id: 'upper-leg-right-back', x: 22, y: 39, w: 8, h: 24 },
    { id: 'lower-leg-left-back', x: 12, y: 62, w: 7, h: 24 },
    { id: 'lower-leg-right-back', x: 22, y: 62, w: 7, h: 24 },
    { id: 'foot-left-back', x: 12, y: 85, w: 7, h: 10 },
    { id: 'foot-right-back', x: 22, y: 85, w: 7, h: 10 },
]

// ── Anterior (right body, centered ~x=80%) ─────────────────────────────────

const ANT_OFFSET = 59.5

export const ANTERIOR_RECTS: RegionRect[] = [
    { id: 'head-front', x: 16 + ANT_OFFSET, y: 4.5, w: 8.5, h: 6.5, shape: 'oval' },
    { id: 'neck-front', x: 17.8 + ANT_OFFSET, y: 10.5, w: 5.5, h: 3.5, shape: 'oval' },
    { id: 'chest-left', x: 20.5 + ANT_OFFSET, y: 15.5, w: 7.5, h: 15 },
    { id: 'chest-right', x: 13 + ANT_OFFSET, y: 15.5, w: 7.5, h: 15 },
    { id: 'abdomen', x: 13 + ANT_OFFSET, y: 30, w: 15, h: 9 },
    { id: 'upper-arm-left-front', x: 7 + ANT_OFFSET, y: 16.5, w: 5, h: 16, angle: 12 },
    { id: 'upper-arm-right-front', x: 29 + ANT_OFFSET, y: 16.5, w: 5, h: 16, angle: -12 },
    { id: 'forearm-left-front', x: 4 + ANT_OFFSET, y: 31, w: 4.5, h: 18, angle: 8 },
    { id: 'forearm-right-front', x: 32.5 + ANT_OFFSET, y: 31, w: 4.5, h: 18, angle: -8 },
    { id: 'hand-left-front', x: 1.5 + ANT_OFFSET, y: 48, w: 5, h: 7 },
    { id: 'hand-right-front', x: 34 + ANT_OFFSET, y: 48, w: 5, h: 7 },
    { id: 'genitalia', x: 16 + ANT_OFFSET, y: 37, w: 9, h: 5 },
    { id: 'upper-leg-left-front', x: 11 + ANT_OFFSET, y: 39, w: 8, h: 24 },
    { id: 'upper-leg-right-front', x: 22 + ANT_OFFSET, y: 39, w: 8, h: 24 },
    { id: 'lower-leg-left-front', x: 12 + ANT_OFFSET, y: 62, w: 7, h: 24 },
    { id: 'lower-leg-right-front', x: 22 + ANT_OFFSET, y: 62, w: 7, h: 24 },
    { id: 'foot-left-front', x: 12 + ANT_OFFSET, y: 85, w: 7, h: 10 },
    { id: 'foot-right-front', x: 22 + ANT_OFFSET, y: 85, w: 7, h: 10 },
]

export const ALL_TC3_RECTS = [...POSTERIOR_RECTS, ...ANTERIOR_RECTS]
