/**
 * Region hit-zone rectangles positioned over the burn diagram SVG.
 * All values are percentages (0–100) of SVG viewBox dimensions (1040×909).
 * Posterior (back) body on left, anterior (front) body on right.
 */

export interface RegionRect {
    id: string
    x: number  // % from left
    y: number  // % from top
    w: number  // % width
    h: number  // % height
    shape?: 'oval'
    angle?: number  // degrees rotation around center
}

// ── Posterior (left body, centered ~x=237) ──────────────────────────────────

export const POSTERIOR_RECTS: RegionRect[] = [
    { id: 'head-back', x: 18, y: 1.5, w: 9, h: 13, shape: 'oval' },
    { id: 'upper-back', x: 15, y: 17, w: 15, h: 18.6 },
    { id: 'lower-back', x: 15, y: 34, w: 15, h: 12 },
    { id: 'l-arm-back', x: 8.1, y: 20, w: 5.8, h: 30, angle: 12 },
    { id: 'r-arm-back', x: 31, y: 20, w: 5.8, h: 30, angle: -12 },
    { id: 'l-hand-back', x: 3, y: 52, w: 6, h: 8 },
    { id: 'r-hand-back', x: 37, y: 52, w: 5, h: 8 },
    { id: 'l-buttock', x: 14.5, y: 45, w: 7.5, h: 11 },
    { id: 'r-buttock', x: 23, y: 45, w: 7.5, h: 11 },
    { id: 'l-leg-back', x: 14.5, y: 54, w: 7, h: 41 },
    { id: 'r-leg-back', x: 24, y: 54, w: 7, h: 41 },
]

// ── Anterior (right body, centered ~x=790) ─────────────────────────────────
// Derived from posterior rects shifted ~53.5% right, with front-specific overrides.

const ANT_OFFSET = 53.5

/** Map posterior id → anterior id */
const ID_MAP: Record<string, string> = {
    'head-back': 'head-front',
    'upper-back': 'chest',
    'lower-back': 'abdomen',
    'l-arm-back': 'l-arm-front',
    'r-arm-back': 'r-arm-front',
    'l-hand-back': 'l-hand-front',
    'r-hand-back': 'r-hand-front',
    'l-leg-back': 'l-leg-front',
    'r-leg-back': 'r-leg-front',
}

/** Posterior-only regions excluded from anterior derivation */
const POSTERIOR_ONLY = new Set(['l-buttock', 'r-buttock'])

export const ANTERIOR_RECTS: RegionRect[] = [
    ...POSTERIOR_RECTS
        .filter(r => !POSTERIOR_ONLY.has(r.id))
        .map(r => ({
            ...r,
            id: ID_MAP[r.id] ?? r.id,
            x: r.x + ANT_OFFSET,
        })),
    { id: 'genitalia', x: 18 + ANT_OFFSET, y: 49, w: 10, h: 6 },
]

export const ALL_RECTS = [...POSTERIOR_RECTS, ...ANTERIOR_RECTS]
