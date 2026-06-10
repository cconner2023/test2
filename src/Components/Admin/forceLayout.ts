/**
 * forceLayout.ts
 *
 * Deterministic force-relaxed placement for the Admin Map's node web. Replaces
 * the old rigid radial ring: children of the focused node repel each other, a
 * weak gravity keeps the cloud compact, and a hub repulsion at the origin
 * clears a centre well so the focus node sits clean in the middle. The result
 * is the organic "Obsidian graph" look without a 3D camera or WebGL.
 *
 * PURE + SEEDED BY INDEX — no RNG (Math.random is intentionally avoided so the
 * same ring always settles identically across rerenders and the layout is
 * stable while the user pans/zooms). The simulation runs to a fixed iteration
 * count inside a useMemo, then freezes; there is no continuous rAF loop, so it
 * costs nothing after the first settle — battery-safe on iOS Safari.
 */

export interface Pt { x: number; y: number }

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * Relax `count` nodes into an organic cloud around a hub at the origin.
 * `spread` scales the whole layout (bigger rings for fewer, denser nodes read
 * better when each node is large). Returns virtual-space coords centred on 0,0
 * — the caller fits them to the canvas with a pan/zoom transform.
 */
export function relaxRing(count: number, spread = 1): Pt[] {
    if (count <= 0) return []
    const base = 96 * spread
    // Golden-angle spiral seed → already well-distributed before relaxation.
    const pts: Pt[] = Array.from({ length: count }, (_, i) => {
        const r = base * Math.sqrt(i + 1)
        const a = i * GOLDEN
        return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    })
    if (count === 1) return [{ x: base * 1.7, y: 0 }]

    const kRep = 30000 * spread * spread   // pairwise node repulsion
    const kHub = 60000 * spread * spread   // origin repulsion → centre well
    const kGrav = 0.016                    // pull toward origin (keeps it compact)
    const minHub = 140 * spread            // hard floor: never overlap the hub
    const step = 0.9
    const damp = 0.82
    const iterations = count > 40 ? 220 : 160

    const vel: Pt[] = pts.map(() => ({ x: 0, y: 0 }))

    for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < count; i++) {
            const pi = pts[i]
            let fx = 0, fy = 0
            for (let j = 0; j < count; j++) {
                if (i === j) continue
                const dx = pi.x - pts[j].x
                const dy = pi.y - pts[j].y
                const d2 = dx * dx + dy * dy || 0.01
                const d = Math.sqrt(d2)
                const f = kRep / d2
                fx += (dx / d) * f
                fy += (dy / d) * f
            }
            // Hub repulsion clears a ring so the focus node is never crowded.
            const hd2 = pi.x * pi.x + pi.y * pi.y || 0.01
            const hd = Math.sqrt(hd2)
            fx += (pi.x / hd) * (kHub / hd2)
            fy += (pi.y / hd) * (kHub / hd2)
            // Gravity toward origin.
            fx -= pi.x * kGrav
            fy -= pi.y * kGrav

            vel[i].x = (vel[i].x + fx * step) * damp
            vel[i].y = (vel[i].y + fy * step) * damp
        }
        for (let i = 0; i < count; i++) {
            pts[i].x += vel[i].x
            pts[i].y += vel[i].y
            const hd = Math.hypot(pts[i].x, pts[i].y)
            if (hd < minHub) {
                const s = minHub / (hd || 0.01)
                pts[i].x *= s
                pts[i].y *= s
            }
        }
    }
    return pts
}

/** Axis-aligned bounds of a point set including the hub at the origin. */
export function boundsOf(pts: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = 0, minY = 0, maxX = 0, maxY = 0
    for (const p of pts) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
    }
    return { minX, minY, maxX, maxY }
}
