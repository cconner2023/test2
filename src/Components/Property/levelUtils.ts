/**
 * Pure helpers for full-size "level" sub-zones (upper building floors).
 *
 * MODEL: the container zone IS floor 1 (the base / ground / basement). A level
 * (kind='level') is an ADDITIONAL floor stacked ON TOP of it — stored as a full-extent
 * 0..1 zone tag on the container's canvas. At rest every level is suppressed, so the
 * container zone shows as itself (floor 1). Selecting the container EXPLODES it: the
 * levels fan up-and-right out of the base (see computeExplodeOffsets), all visible at
 * once as a shelf of drawers; tapping one drills into that floor (it then renders alone,
 * full-extent, over the base). All derivation here is geometry-free — parent_id tree +
 * kind + ordinal only.
 */
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'

/** The level children of `containerId`, sorted by ordinal ascending (ground → top). */
export function getLevels(
  locations: LocalPropertyLocation[],
  containerId: string,
): LocalPropertyLocation[] {
  return locations
    .filter((l) => l.parent_id === containerId && l.kind === 'level')
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
}

/** All descendant location ids under `parentId` (exclusive of parentId). */
function descendantIds(parentId: string, locations: LocalPropertyLocation[]): string[] {
  const out: string[] = []
  const children = locations.filter((l) => l.parent_id === parentId)
  for (const c of children) {
    out.push(c.id, ...descendantIds(c.id, locations))
  }
  return out
}

/**
 * The set of location ids whose tags must be hidden, so the container zone reads as
 * floor 1 and upper floors only appear when you explode or enter them. Map tags are
 * filtered by both their target_id and their canvas (location_id) against this set.
 *
 * Per container:
 *  - EXPLODED (containerId === explodeContainerId): keep every floor TILE (they fan out),
 *    but show CONTENTS only for the surfaced floor — other floors read as closed tiles.
 *  - DRILLED IN: the one level on the current selection's ancestry stays; the rest hide.
 *  - AT REST: suppress ALL levels — the container zone itself shows (it IS floor 1).
 */
export function collectSuppressedIds(
  locations: LocalPropertyLocation[],
  rootLocationId: string | null,
  explodeContainerId: string | null,
  selectedZoneId: string | null,
  surfacedLevelId: string | null,
): Set<string> {
  const suppressed = new Set<string>()
  if (!rootLocationId) return suppressed

  // Levels on the current selection's ancestry — the floor(s) you've drilled into.
  const pathLevels = new Set<string>()
  let cur: string | null = selectedZoneId
  let guard = 0
  while (cur && guard++ < 64) {
    const loc = locations.find((l) => l.id === cur)
    if (!loc) break
    if (loc.kind === 'level') pathLevels.add(loc.id)
    cur = loc.parent_id ?? null
  }

  // Group level locations by their container (parent_id).
  const byContainer = new Map<string, LocalPropertyLocation[]>()
  for (const l of locations) {
    if (l.kind !== 'level' || !l.parent_id) continue
    const arr = byContainer.get(l.parent_id) ?? []
    arr.push(l)
    byContainer.set(l.parent_id, arr)
  }

  for (const [containerId, levels] of byContainer) {
    if (containerId === explodeContainerId) {
      // Keep every floor TILE; hide the CONTENTS of every floor except the surfaced one,
      // so unfocused floors stay as clean closed drawers in the fan.
      for (const lvl of levels) {
        if (lvl.id === surfacedLevelId) continue
        for (const d of descendantIds(lvl.id, locations)) suppressed.add(d)
      }
      continue
    }
    // Otherwise keep only the floor you're inside (on the selection path); hide the rest.
    // No drilled floor → hide them all so the container zone (floor 1) shows.
    const active = levels.find((l) => pathLevels.has(l.id))?.id ?? null
    for (const lvl of levels) {
      if (lvl.id === active) continue
      suppressed.add(lvl.id)
      for (const d of descendantIds(lvl.id, locations)) suppressed.add(d)
    }
  }
  return suppressed
}

/** A fanned floor rect, in the container's canvas-relative (0..1) space. May extend
 *  past 0..1 (floors fan OUT of the footprint) — the caller frames the union. */
export interface ExplodeRect {
  x: number
  y: number
  width: number
  height: number
  /** Paint order — larger draws later (on top). Higher floors sit on top. */
  z: number
}

/** How far each successive floor drifts off the base, as a fraction of the footprint. */
const EXPLODE_STEP_X = 0.24
const EXPLODE_STEP_Y = 0.24

/**
 * Fan a container's upper floors OUT of its footprint for the exploded-shelf view. The
 * container zone itself is floor 1 (drawn at its own full footprint, not returned here);
 * each level stacks ON TOP, offset up-and-right by an incremental step and kept the SAME
 * size as the footprint, so it overlaps and CLIPS the floor below (tiles render opaque —
 * this is occlusion, not transparency). Higher floors paint on top and expose the lower
 * floor's down-left corner as a tap target. Rects intentionally spill past 0..1; the
 * caller unions them with the base to frame the whole fan. Keyed by level id.
 *
 * Paint order is a STRICT staircase (z = j, higher floor on top). The selected floor is
 * deliberately NOT lifted above its neighbours: lifting it to the top of the stack covered
 * the down-left peek of every floor above it, so surfacing a lower floor made the upper
 * floors visually vanish. Keeping the natural order means every floor always keeps its
 * peek/tap corner; the surfaced floor is instead marked by its selection ring/tint (in
 * LocationTagPhoto) and reachable at any time from the floor-switcher rail.
 */
export function computeExplodeOffsets(
  levels: LocalPropertyLocation[],
): Map<string, ExplodeRect> {
  const map = new Map<string, ExplodeRect>()
  const sorted = [...levels].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))

  sorted.forEach((lvl, j) => {
    const step = j + 1 // floor 1 is the container zone; the first level sits one step up
    map.set(lvl.id, {
      x: step * EXPLODE_STEP_X, // right
      y: -step * EXPLODE_STEP_Y, // up
      width: 1,
      height: 1,
      z: j, // higher floor → later → painted on top; strict staircase, no surfaced-lift
    })
  })
  return map
}

/** Short stack label for a floor: 3 → "3F", -1 → "B1", 0 → first letter of name. */
export function levelShortLabel(loc: LocalPropertyLocation): string {
  const ord = loc.ordinal ?? 0
  if (ord > 0) return `${ord}F`
  if (ord < 0) return `B${-ord}`
  return (loc.name || '?').trim().charAt(0).toUpperCase() || '?'
}

/** Next ordinal for a new floor added to a container (one above the current top). */
export function nextFloorOrdinal(levels: LocalPropertyLocation[]): number {
  if (levels.length === 0) return 1
  const max = Math.max(...levels.map((l) => l.ordinal ?? 0))
  return max + 1
}

/** True for a structural zone that could become a building (gets an "add floor" affordance). */
export function isStructuralZone(loc: LocalPropertyLocation | undefined): loc is LocalPropertyLocation {
  return !!loc && loc.name !== ROOT_LOCATION_NAME && !loc.holder_user_id && loc.kind !== 'level'
}
