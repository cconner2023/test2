import type { DispatchStatus } from '../../lib/dispatchFold'

/**
 * Non-blocking dispatch indicator dot for a vehicle row (tree / list / map).
 * Shown only when a vehicle's open dispatch is expiring-soon or expired — the
 * red-dot warn the user picked over the (now-removed) Truck marker. A plainly
 * active dispatch with time left renders NO dot (clean row). Returns null for
 * the 'active' status so callers can render it unconditionally.
 */
export function DispatchDot({ status, className = '' }: { status: DispatchStatus | undefined; className?: string }) {
  if (status !== 'expiring' && status !== 'expired') return null
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full bg-themered shrink-0 ${className}`}
      aria-label={status === 'expired' ? 'Dispatch expired' : 'Dispatch expiring'}
      title={status === 'expired' ? 'Dispatch expired' : 'Dispatch expiring'}
    />
  )
}
