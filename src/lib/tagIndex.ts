/**
 * Tag Index — pre-processes LocationTags into fast lookup structures.
 * Pure functions, no React dependencies.
 */
import type { LocationTag, ZoneRect } from '../Types/PropertyTypes'

export interface TagIndex {
  /** All tags by their own id */
  byId: Map<string, LocationTag>
  /** Tags grouped by target_id (the location/item they point to) */
  byTarget: Map<string, LocationTag[]>
  /** Tags grouped by location_id (the canvas they live on) */
  byCanvas: Map<string, LocationTag[]>
  /** Children location tags of a given target_id (location zones that live ON a canvas = location) */
  childrenOf: Map<string, LocationTag[]>
  /** Parent location_id for a given target_id */
  parentOf: Map<string, string>
}

/**
 * Build a TagIndex from a flat map of location_id → LocationTag[].
 * The map comes from fetchAllLocationTags.
 */
export function buildTagIndex(tagMap: Map<string, LocationTag[]>): TagIndex {
  const byId = new Map<string, LocationTag>()
  const byTarget = new Map<string, LocationTag[]>()
  const byCanvas = new Map<string, LocationTag[]>()
  const childrenOf = new Map<string, LocationTag[]>()
  const parentOf = new Map<string, string>()

  for (const [locationId, tags] of tagMap) {
    byCanvas.set(locationId, tags)
    for (const tag of tags) {
      byId.set(tag.id, tag)

      // byTarget
      const targetList = byTarget.get(tag.target_id) ?? []
      targetList.push(tag)
      byTarget.set(tag.target_id, targetList)

      // childrenOf: location_id's children are the tags on that canvas
      if (tag.target_type === 'location') {
        const children = childrenOf.get(locationId) ?? []
        children.push(tag)
        childrenOf.set(locationId, children)

        // parentOf: target_id's parent is the canvas (location_id) it sits on
        parentOf.set(tag.target_id, locationId)
      }
    }
  }

  return { byId, byTarget, byCanvas, childrenOf, parentOf }
}

/**
 * Walk the parent chain from targetId to root.
 * Returns [root, ..., parent, targetId].
 */
export function getAncestorPath(index: TagIndex, targetId: string): string[] {
  const path: string[] = []
  let current: string | undefined = targetId
  while (current) {
    path.unshift(current)
    current = index.parentOf.get(current)
  }
  return path
}

/**
 * Find the lowest common ancestor of two target IDs.
 * Returns null if they share no common ancestor.
 */
export function findLCA(index: TagIndex, idA: string, idB: string): string | null {
  const pathA = getAncestorPath(index, idA)
  const pathB = getAncestorPath(index, idB)

  let lca: string | null = null
  const minLen = Math.min(pathA.length, pathB.length)
  for (let i = 0; i < minLen; i++) {
    if (pathA[i] === pathB[i]) {
      lca = pathA[i]
    } else {
      break
    }
  }
  return lca
}

/**
 * Trace the outer contour of the union of axis-aligned rectangles.
 * Returns an SVG path `d` attribute in 0..1 coordinate space.
 * Uses a grid-based approach: collect unique x/y coords → mark filled cells → trace boundary.
 */
export function traceCompositeOutline(rects: ZoneRect[]): string {
  if (rects.length === 0) return ''

  // Collect unique x and y coordinates
  const xSet = new Set<number>()
  const ySet = new Set<number>()
  for (const r of rects) {
    xSet.add(r.x); xSet.add(r.x + r.w)
    ySet.add(r.y); ySet.add(r.y + r.h)
  }
  const xs = [...xSet].sort((a, b) => a - b)
  const ys = [...ySet].sort((a, b) => a - b)

  const cols = xs.length - 1
  const rows = ys.length - 1
  if (cols <= 0 || rows <= 0) return ''

  // Mark which grid cells fall inside any rect
  const filled: boolean[][] = Array.from({ length: cols }, () => Array(rows).fill(false))
  for (const r of rects) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cx = (xs[i] + xs[i + 1]) / 2
        const cy = (ys[j] + ys[j + 1]) / 2
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
          filled[i][j] = true
        }
      }
    }
  }

  // Collect directed boundary edges (clockwise winding)
  type Edge = [number, number, number, number] // x1, y1, x2, y2
  const edges: Edge[] = []

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (!filled[i][j]) continue
      if (j === 0 || !filled[i][j - 1])         edges.push([xs[i], ys[j], xs[i + 1], ys[j]])       // top
      if (j === rows - 1 || !filled[i][j + 1])   edges.push([xs[i + 1], ys[j + 1], xs[i], ys[j + 1]]) // bottom
      if (i === 0 || !filled[i - 1][j])           edges.push([xs[i], ys[j + 1], xs[i], ys[j]])       // left
      if (i === cols - 1 || !filled[i + 1][j])    edges.push([xs[i + 1], ys[j], xs[i + 1], ys[j + 1]]) // right
    }
  }

  if (edges.length === 0) return ''

  // Chain edges into closed polygon(s)
  const key = (x: number, y: number) => `${x.toFixed(10)},${y.toFixed(10)}`
  const startMap = new Map<string, number[]>()
  edges.forEach(([x1, y1], idx) => {
    const k = key(x1, y1)
    const list = startMap.get(k) ?? []
    list.push(idx)
    startMap.set(k, list)
  })

  const used = new Set<number>()
  const paths: string[] = []

  for (let s = 0; s < edges.length; s++) {
    if (used.has(s)) continue

    const pts: [number, number][] = []
    let cur = s

    while (!used.has(cur)) {
      used.add(cur)
      const [x1, y1, x2, y2] = edges[cur]
      pts.push([x1, y1])

      const candidates = startMap.get(key(x2, y2)) ?? []
      const next = candidates.find((idx) => !used.has(idx))
      if (next === undefined) break
      cur = next
    }

    if (pts.length >= 3) {
      paths.push(
        pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z',
      )
    }
  }

  return paths.join(' ')
}
