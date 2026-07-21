/**
 * Group-refresh bus — decouples the Signal decrypt path from group hydration.
 *
 * The per-group name secret rides sender-key distributions (control-plane rows
 * decrypted in useSignalMessages). Adopting a secret only writes IDB; the group
 * name already in the store is still ciphertext, because names are decrypted
 * once at fetch time in fetchMyGroups. This bus lets the decrypt path ask
 * useMessages to re-run refreshGroups so the name resolves without a reload.
 *
 * Plain in-memory pub/sub — imports nothing from `src/lib/signal/*`.
 * Mirrors the callSignalBus pattern.
 */

type Listener = (groupId: string) => void

const listeners = new Set<Listener>()

/** Subscribe to group-refresh requests. Returns an unsubscribe function. */
export function onGroupRefresh(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Ask subscribers to re-hydrate groups (e.g. after adopting a name secret). */
export function emitGroupRefresh(groupId: string): void {
  for (const l of [...listeners]) {
    try {
      l(groupId)
    } catch {
      // a listener throwing must not break delivery to the others
    }
  }
}
