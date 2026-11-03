import { useSyncExternalStore } from 'react'

/**
 * Tracking Board card swipe bindings — the Messaging swipe model applied to BRN
 * cards. Same direction naming (ltr = "swipe right", rtl = "swipe left").
 *
 *   open    — open the BRN page (same as tap)
 *   move    — lift the card into a "Move to" station picker
 *   delete  — remove the BRN from the board (ConfirmDialog first)
 *   off     — direction disabled
 *
 * Stale stored values (the old advance/back/menu, and the removed forward) coerce back to defaults.
 *
 * SKELETON persistence: per-device localStorage. When the board goes live this
 * should ride the profiles row like messaging's swipe_actions (cross-device).
 */

export type TrackingSwipeBinding = 'open' | 'move' | 'delete' | 'off'

export interface TrackingSwipeActions {
  ltr: TrackingSwipeBinding
  rtl: TrackingSwipeBinding
}

export const TRACKING_SWIPE_POOL: readonly TrackingSwipeBinding[] = ['open', 'move', 'delete', 'off']
export const DEFAULT_TRACKING_SWIPE: TrackingSwipeActions = { ltr: 'move', rtl: 'delete' }

const KEY = 'tracking-swipe-actions'
const VALID: ReadonlySet<string> = new Set(TRACKING_SWIPE_POOL)
const listeners = new Set<() => void>()

function coerce(v: unknown, fallback: TrackingSwipeBinding): TrackingSwipeBinding {
  return typeof v === 'string' && VALID.has(v) ? (v as TrackingSwipeBinding) : fallback
}

function read(): TrackingSwipeActions {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      ltr: coerce(parsed?.ltr, DEFAULT_TRACKING_SWIPE.ltr),
      rtl: coerce(parsed?.rtl, DEFAULT_TRACKING_SWIPE.rtl),
    }
  } catch {
    return DEFAULT_TRACKING_SWIPE
  }
}

// Cached snapshot — useSyncExternalStore needs a stable reference between changes.
let snapshot: TrackingSwipeActions = read()

export function setTrackingSwipeActions(next: TrackingSwipeActions) {
  snapshot = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode — in-memory only */ }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useTrackingSwipeActions(): TrackingSwipeActions {
  return useSyncExternalStore(subscribe, () => snapshot)
}
