/**
 * Reject if `p` hasn't settled within `ms`. For awaits behind a user tap that
 * WebKit can leave pending forever (stale IndexedDB connections, lie-fi fetches)
 * — the tap fails instead of freezing the surface.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
