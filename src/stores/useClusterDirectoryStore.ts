/**
 * Zustand store for the caller's cluster directory (own + peer clusters with
 * nicknames). Drives nickname-vs-unit-name labelling — see Utilities/clusterLabel.ts.
 *
 * Self-hydrating: hydrates when a user signs in and whenever the 'clinics'
 * domain is invalidated; clears on sign-out. Persisted so labels survive
 * offline cold starts.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchClusterDirectory, type ClusterDirectoryEntry } from '../lib/clusterDirectoryService'
import { useAuthStore } from './useAuthStore'
import { useInvalidationStore } from './useInvalidationStore'

interface ClusterDirectoryState {
  /** Owner of the persisted entries — guards against a prior account's cache. */
  userId: string | null
  entries: Record<string, ClusterDirectoryEntry>
  hydrate: () => Promise<void>
  /** Optimistic local patch after a nickname edit. */
  patchNickname: (clinicId: string, nickname: string | null) => void
  clear: () => void
}

let inflight: Promise<void> | null = null

export const useClusterDirectoryStore = create<ClusterDirectoryState>()(
  persist(
    (set, get) => ({
      userId: null,
      entries: {},

      hydrate: () => {
        if (inflight) return inflight
        const userId = useAuthStore.getState().user?.id ?? null
        if (!userId) return Promise.resolve()
        if (get().userId !== userId) set({ userId, entries: {} })
        inflight = (async () => {
          const res = await fetchClusterDirectory()
          if (!res.ok) return
          // Sign-out / account switch raced the fetch — drop the result.
          if (useAuthStore.getState().user?.id !== userId) return
          const entries: Record<string, ClusterDirectoryEntry> = {}
          for (const e of res.data) entries[e.id] = e
          set({ userId, entries })
        })().finally(() => { inflight = null })
        return inflight
      },

      patchNickname: (clinicId, nickname) =>
        set((s) => {
          const cur = s.entries[clinicId]
          if (!cur) return s
          return { entries: { ...s.entries, [clinicId]: { ...cur, nickname } } }
        }),

      clear: () => set({ userId: null, entries: {} }),
    }),
    {
      name: 'cluster-directory',
      partialize: (s) => ({ userId: s.userId, entries: s.entries }),
    },
  ),
)

// ── Lifecycle wiring ────────────────────────────────────────────────────────
// Deferred a microtask so a circular import through useAuthStore (anything it
// pulls in that labels clusters) can't observe an uninitialised binding.
queueMicrotask(() => {
  let lastUserId: string | null = useAuthStore.getState().user?.id ?? null
  if (lastUserId) void useClusterDirectoryStore.getState().hydrate()

  useAuthStore.subscribe((s) => {
    const id = s.user?.id ?? null
    if (id === lastUserId) return
    lastUserId = id
    if (id) void useClusterDirectoryStore.getState().hydrate()
    else useClusterDirectoryStore.getState().clear()
  })

  let lastClinicsGen = useInvalidationStore.getState().generations.clinics
  useInvalidationStore.subscribe((s) => {
    if (s.generations.clinics === lastClinicsGen) return
    lastClinicsGen = s.generations.clinics
    void useClusterDirectoryStore.getState().hydrate()
  })
})
