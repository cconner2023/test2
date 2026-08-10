import { useCallback, useMemo, useRef, useState } from 'react'
import { sameStringSet } from '../Utilities/arrayEquals'

/**
 * Order-insensitive equality for the value shapes an edit form actually holds:
 * primitives, id arrays (roles, UICs), and id sets (loan clusters). Anything
 * else falls back to reference equality, which is the honest answer — a form
 * field holding a nested object should be flattened, not deep-compared.
 *
 * Arrays defer to sameStringSet so "is this list changed" means the same thing
 * here as everywhere else in the app — these fields are sets that happen to be
 * stored as arrays, and ['a','b'] must not read as an edit of ['b','a'].
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return sameStringSet(a.map(String), b.map(String))
  }
  return false
}

export interface EntityForm<T extends Record<string, unknown>> {
  /** Current editable values. */
  values: T
  /** The values as last seeded or committed — what `dirty` compares against. */
  baseline: T
  /** Accepts a value or an updater, like useState's setter — a field holding a
   *  list often appends rather than replaces. */
  set: <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => void
  /** A STABLE setter for one field, safe to pass straight to an input's
   *  onChange without remounting it each render. */
  bind: <K extends keyof T>(key: K) => (value: T[K]) => void
  /** Seed values AND baseline — use when (re)opening the form on a record. */
  reset: (next: T) => void
  /** Merge into BOTH values and baseline. For a field hydrated asynchronously
   *  after the form opened: it must land as clean state, not read as an edit the
   *  user made. Merges functionally, so it can't clobber a concurrent seed. */
  hydrate: (partial: Partial<T>) => void
  /** Rebaseline to the current values — use after a successful save, so the
   *  form reads clean without discarding what the user just committed. */
  commit: () => void
  /** Any field differs from baseline. */
  dirty: boolean
  /** One field differs from baseline. Replaces the hand-kept "has the user
   *  touched this yet" refs used to decide whether late-arriving server data
   *  may still overwrite a field. */
  isDirty: (key: keyof T) => boolean
}

/**
 * Edit-form state as ONE object with a baseline, instead of a `useState` per
 * field plus a hand-written comparison to detect unsaved changes.
 *
 * The pattern it replaces (AdminUserDetail had twelve of them): a dozen loose
 * `useState`s, a dozen-line seed block on edit-open, and a dozen-term dirty
 * comparison whose dependency array had to list every field — where forgetting
 * one silently breaks the discard-changes guard rather than failing loudly.
 *
 * `initial` is read once, on mount. Reseed with `reset()` when the edited
 * record changes.
 */
export function useEntityForm<T extends Record<string, unknown>>(initial: T): EntityForm<T> {
  const [values, setValues] = useState<T>(initial)
  const [baseline, setBaseline] = useState<T>(initial)

  // Values are needed by commit() without making it change identity per render.
  const valuesRef = useRef(values)
  valuesRef.current = values

  const set = useCallback(<K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => {
    setValues(prev => {
      const next = typeof value === 'function'
        ? (value as (p: T[K]) => T[K])(prev[key])
        : value
      return sameValue(prev[key], next) ? prev : { ...prev, [key]: next }
    })
  }, [])

  // One stable setter per field, created on first use and reused thereafter.
  const bindCache = useRef(new Map<keyof T, (value: unknown) => void>())
  const bind = useCallback(<K extends keyof T>(key: K) => {
    const cache = bindCache.current
    let fn = cache.get(key)
    if (!fn) {
      fn = (value: unknown) => set(key, value as T[K])
      cache.set(key, fn)
    }
    return fn as (value: T[K]) => void
  }, [set])

  const reset = useCallback((next: T) => {
    setValues(next)
    setBaseline(next)
  }, [])

  const hydrate = useCallback((partial: Partial<T>) => {
    setValues(prev => ({ ...prev, ...partial }))
    setBaseline(prev => ({ ...prev, ...partial }))
  }, [])

  const commit = useCallback(() => {
    setBaseline(valuesRef.current)
  }, [])

  const dirty = useMemo(
    () => (Object.keys(values) as Array<keyof T>).some(k => !sameValue(values[k], baseline[k])),
    [values, baseline],
  )

  const isDirty = useCallback(
    (key: keyof T) => !sameValue(valuesRef.current[key], baseline[key]),
    [baseline],
  )

  return { values, baseline, set, bind, reset, hydrate, commit, dirty, isDirty }
}
