/**
 * Region hit-zone rectangles positioned over the burn diagram image.
 * All values are percentages (0–100) of image width/height.
 * Image: 465×478, posterior (back) on left, anterior (front) on right.
 *
 * Fine-tune x, y, w, h to align with the body regions in the image.
 */

export interface RegionRect {
    id: string
    x: number  // % from left
    y: number  // % from top
    w: number  // % width
    h: number  // % height
}

// ── Posterior (left body) ──────────────────────────────────────────────────

export const POSTERIOR_RECTS: RegionRect[] = [
    { id: 'head-back',   x: 14, y: 3,  w: 14, h: 12 },
    { id: 'upper-back',  x: 10, y: 18, w: 22, h: 17 },
    { id: 'lower-back',  x: 10, y: 35, w: 22, h: 17 },
    { id: 'l-arm-back',  x: 2,  y: 18, w: 8,  h: 32 },
    { id: 'r-arm-back',  x: 32, y: 18, w: 8,  h: 32 },
    { id: 'l-leg-back',  x: 10, y: 55, w: 11, h: 38 },
    { id: 'r-leg-back',  x: 21, y: 55, w: 11, h: 38 },
]

// ── Anterior (right body) ─────────────────────────────────────────────────

export const ANTERIOR_RECTS: RegionRect[] = [
    { id: 'head-front',  x: 62, y: 3,  w: 14, h: 12 },
    { id: 'chest',       x: 58, y: 18, w: 22, h: 15 },
    { id: 'abdomen',     x: 58, y: 33, w: 22, h: 14 },
    { id: 'l-arm-front', x: 50, y: 18, w: 8,  h: 32 },
    { id: 'r-arm-front', x: 80, y: 18, w: 8,  h: 32 },
    { id: 'genitalia',   x: 62, y: 47, w: 14, h: 6 },
    { id: 'l-leg-front', x: 58, y: 55, w: 11, h: 38 },
    { id: 'r-leg-front', x: 69, y: 55, w: 11, h: 38 },
]

export const ALL_RECTS = [...POSTERIOR_RECTS, ...ANTERIOR_RECTS]
