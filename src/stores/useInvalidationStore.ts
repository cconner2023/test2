/**
 * Zustand store for cross-component data invalidation.
 *
 * Follows the TanStack Query mental model: mutation sites call `invalidate()`
 * with one or more domain keys, and consumer components subscribe to the
 * generation counter for the domains they care about. When a generation
 * bumps, the consumer re-fetches.
 *
 * Usage — mutation site:
 *   import { invalidate } from '../stores/useInvalidationStore'
 *   await deleteUser(id)
 *   invalidate('users', 'requests')
 *
 * Usage — consumer component:
 *   const gen = useInvalidation('users', 'clinics')
 *   useEffect(() => { loadData() }, [gen])
 */

import { create } from 'zustand'

export type Domain =
  | 'users'
  | 'clinics'
  | 'requests'
  | 'properties'
  | 'calendar'
  | 'training'
  | 'messaging'

interface InvalidationState {
  generations: Record<Domain, number>
  invalidate: (...domains: Domain[]) => void
}

export const useInvalidationStore = create<InvalidationState>((set) => ({
  generations: {
    users: 0,
    clinics: 0,
    requests: 0,
    properties: 0,
    calendar: 0,
    training: 0,
    messaging: 0,
  },
  invalidate: (...domains) =>
    set((state) => {
      const next = { ...state.generations }
      for (const d of domains) next[d] = next[d] + 1
      return { generations: next }
    }),
}))

/** Shorthand for calling invalidate outside React (e.g. in service callbacks). */
export const invalidate = (...domains: Domain[]) =>
  useInvalidationStore.getState().invalidate(...domains)

/**
 * Subscribe to one or more domains. Returns a composite generation number
 * that changes whenever ANY of the watched domains is invalidated.
 * Drop into a useEffect dep array to trigger re-fetch.
 */
export function useInvalidation(...domains: Domain[]): number {
  return useInvalidationStore((s) => {
    let sum = 0
    for (const d of domains) sum += s.generations[d]
    return sum
  })
}
