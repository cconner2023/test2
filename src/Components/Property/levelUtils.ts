/**
 * Pure helpers for full-size "level" sub-zones (building floors).
 *
 * A level (kind='level') occupies its parent's whole footprint via a full-extent
 * 0..1 zone tag. Sibling levels stack on the same footprint; only the ACTIVE level
 * for a container renders — the others (and their whole subtrees) are suppressed,
 * giving a Genshin-style floor switcher. All derivation here is geometry-free:
 * it works off the parent_id tree + kind + ordinal only.
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
 * Resolve the active level id for a container: the stored choice if still valid,
 * else the ground floor (ordinal === 1) if present, else the lowest ordinal.
 */
export function resolveActiveLevel(
  levels: LocalPropertyLocation[],
  activeMap: Record<string, string>,
  containerId: string,
): string | null {
  if (levels.length === 0) return null
  const stored = activeMap[containerId]
  if (stored && levels.some((l) => l.id === stored)) return stored
  const ground = levels.find((l) => (l.ordinal ?? 0) === 1)
  return (ground ?? levels[0]).id
}

/**
 * Nearest ancestor-or-self of `startId` (walking parent_id) that has ≥1 level child.
 * Falls back to the root canvas. Returns null when no level container is in scope —
 * keeps the floor switcher pinned to the building while you drill through its floors.
 */
export function findLevelContainer(
  startId: string | null,
  locations: LocalPropertyLocation[],
  rootLocationId: string | null,
): string | null {
  const hasLevels = (id: string) =>
    locations.some((l) => l.parent_id === id && l.kind === 'level')

  let cur: string | null = startId ?? rootLocationId
  let guard = 0
  while (cur && guard++ < 64) {
    if (hasLevels(cur)) return cur
    const loc = locations.find((l) => l.id === cur)
    cur = loc?.parent_id ?? null
  }
  if (rootLocationId && hasLevels(rootLocationId)) return rootLocationId
  return null
}

/**
 * The set of location ids whose tags must be hidden: every inactive level plus its
 * entire subtree, across all level-containers. Map tags are filtered by both their
 * target_id and their canvas (location_id) against this set.
 */
export function collectSuppressedIds(
  locations: LocalPropertyLocation[],
  activeMap: Record<string, string>,
  rootLocationId: string | null,
): Set<string> {
  const suppressed = new Set<string>()
  if (!rootLocationId) return suppressed

  // Group level locations by their container (parent_id).
  const byContainer = new Map<string, LocalPropertyLocation[]>()
  for (const l of locations) {
    if (l.kind !== 'level' || !l.parent_id) continue
    const arr = byContainer.get(l.parent_id) ?? []
    arr.push(l)
    byContainer.set(l.parent_id, arr)
  }

  for (const [containerId, levels] of byContainer) {
    const sorted = [...levels].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
    const active = resolveActiveLevel(sorted, activeMap, containerId)
    for (const lvl of sorted) {
      if (lvl.id === active) continue
      suppressed.add(lvl.id)
      for (const d of descendantIds(lvl.id, locations)) suppressed.add(d)
    }
  }
  return suppressed
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
