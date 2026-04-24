/**
 * Order-insensitive equality for string arrays used as sets
 * (e.g. UICs, role lists, id collections). Cheap — avoids the
 * JSON.stringify-sort antipattern and correctly treats
 * ['a','b'] and ['b','a'] as equal.
 */
export function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  if (a.length === 0) return true
  const set = new Set(a)
  for (const v of b) {
    if (!set.has(v)) return false
  }
  return true
}
