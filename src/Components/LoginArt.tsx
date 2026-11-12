import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Decorative brand-pane art for the desktop login: a feedforward network drawn
 * over an abstract topographic map. Geometry is generated from a fixed seed at
 * module load, so it is identical on every render and costs nothing per frame.
 * Colours come from theme classes so it follows light/dark mode.
 */

const W = 400
const H = 400

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = [number, number]

/** Closed Catmull-Rom spline through pts, as cubic beziers. */
function closedSpline(pts: Pt[]): string {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

function buildContours(rand: () => number): string[] {
  const peaks = [
    { x: 110, y: 120, rings: 7, step: 16 },
    { x: 300, y: 270, rings: 8, step: 17 },
    { x: 320, y: 70, rings: 4, step: 14 },
  ]
  const paths: string[] = []
  for (const pk of peaks) {
    const p1 = rand() * Math.PI * 2, p2 = rand() * Math.PI * 2, p3 = rand() * Math.PI * 2
    for (let k = 1; k <= pk.rings; k++) {
      const r = pk.step * k
      // Wobble grows with radius so inner rings stay round and outer rings sprawl.
      const a = 0.06 + 0.025 * k
      const pts: Pt[] = []
      for (let i = 0; i < 40; i++) {
        const th = (i / 40) * Math.PI * 2
        const rr = r * (1 + a * Math.sin(2 * th + p1) + a * 0.6 * Math.sin(3 * th + p2) + a * 0.3 * Math.sin(5 * th + p3))
        pts.push([pk.x + rr * Math.cos(th), pk.y + rr * Math.sin(th) * 0.85])
      }
      paths.push(closedSpline(pts))
    }
  }
  return paths
}

interface Node { x: number; y: number; active: boolean }
interface Edge { a: Node; b: Node; active: boolean }

function buildNetwork(rand: () => number) {
  const layers = [3, 4, 3, 2]
  const x0 = 70, x1 = 330
  const nodes: Node[][] = layers.map((count, li) => {
    const x = x0 + ((x1 - x0) * li) / (layers.length - 1)
    // Uneven vertical gaps and loose x so the layers don't read as a grid.
    const gaps = Array.from({ length: count - 1 }, () => 45 + rand() * 55)
    const span = gaps.reduce((s, g) => s + g, 0)
    let y = H / 2 - span / 2 + (rand() - 0.5) * 40
    return Array.from({ length: count }, (_, i) => {
      if (i > 0) y += gaps[i - 1]
      return { x: x + (rand() - 0.5) * 50, y, active: false }
    })
  })
  // One highlighted path through the net reads as "signal" without labels.
  const pathIdx = [1, 2, 1, 0]
  pathIdx.forEach((ni, li) => { nodes[li][ni].active = true })

  // Sparse wiring: each node links to its two nearest in the next layer, which
  // keeps the map readable; the active path is always wired.
  const edges: Edge[] = []
  for (let li = 0; li < nodes.length - 1; li++) {
    const next = nodes[li + 1]
    for (const a of nodes[li]) {
      const near = [...next].sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y)).slice(0, 2)
      const pathNext = next[pathIdx[li + 1]]
      if (a.active && !near.includes(pathNext)) near.push(pathNext)
      for (const b of near) edges.push({ a, b, active: a.active && b.active })
    }
  }
  return { nodes: nodes.flat(), edges }
}

const rand = mulberry32(0x5eed)
const CONTOURS = buildContours(rand)
const NET = buildNetwork(rand)
const GRID = Array.from({ length: 7 }, (_, i) => 50 * (i + 1))

// Network positions normalised to its own bounding box (0..1 both axes), so the
// layer can stretch to fill whatever pane it lands in without scaling the nodes.
const NET_BOX = (() => {
  const xs = NET.nodes.map(n => n.x), ys = NET.nodes.map(n => n.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
})()
const norm = (n: Node): Pt => [(n.x - NET_BOX.x) / NET_BOX.w, (n.y - NET_BOX.y) / NET_BOX.h]

/** Fraction of the pane the network spans, per axis. */
const SPAN_X = 0.8
const SPAN_Y = 0.7

function useSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export function LoginArt({ className = '' }: { className?: string }) {
  // Two layers: the map stretches to cover the pane (slice); the network is laid
  // out in measured pixels so it spans the pane while nodes keep a fixed size.
  const [netRef, { w, h }] = useSize<HTMLDivElement>()
  const px = (n: Node): Pt => {
    const [x, y] = norm(n)
    return [w * ((1 - SPAN_X) / 2 + x * SPAN_X), h * ((1 - SPAN_Y) / 2 + y * SPAN_Y)]
  }
  return (
    <div className={className} aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="stroke-themeblue3">
          {GRID.map(v => (
            <g key={v} strokeOpacity={0.08} strokeWidth={1}>
              <line x1={v} y1={0} x2={v} y2={H} vectorEffect="non-scaling-stroke" />
              <line x1={0} y1={v} x2={W} y2={v} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {CONTOURS.map((d, i) => (
            <path key={i} d={d} strokeOpacity={0.16} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path
            d="M-10,330 C60,300 90,250 150,240 S240,210 260,150 S330,60 410,40"
            strokeOpacity={0.22} strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>

      <div ref={netRef} className="absolute inset-0">
        {w > 0 && (
          <svg className="absolute inset-0 w-full h-full" width={w} height={h} fill="none" xmlns="http://www.w3.org/2000/svg">
            <g className="stroke-themeblue3">
              {NET.edges.map((e, i) => {
                const [ax, ay] = px(e.a), [bx, by] = px(e.b)
                return <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
                  strokeOpacity={e.active ? 0.85 : 0.12} strokeWidth={e.active ? 1.5 : 1} />
              })}
            </g>
            <g>
              {NET.nodes.map((n, i) => {
                const [cx, cy] = px(n)
                return <circle key={i} cx={cx} cy={cy} r={4.5} strokeWidth={1}
                  strokeOpacity={n.active ? 1 : 0.4}
                  className={n.active
                    ? 'fill-themeblue3 stroke-themeblue3'
                    : 'fill-themewhite2 dark:fill-themewhite stroke-themeblue3'} />
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}
