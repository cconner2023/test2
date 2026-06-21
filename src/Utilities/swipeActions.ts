/**
 * Chat-message swipe bindings — the per-user preference that maps each swipe
 * direction on a message bubble to an action. Cross-device user setting; rides
 * the profiles row exactly like `theme` (see useAuthStore PROFILE_SELECT +
 * useUserProfile.syncProfileField).
 *
 * Direction naming follows the gesture, not the finger:
 *   - ltr ("swipe right", dx > 0): finger travels left → right.
 *   - rtl ("swipe left",  dx < 0): finger travels right → left.
 *
 * Bindings: the immediate-fire actions (reply / forward / delete) run the moment
 * the swipe passes threshold; `menu` lifts the bubble into the context menu (the
 * iOS clone/row) instead of firing; `off` disables that direction.
 */

export type SwipeBinding = 'reply' | 'forward' | 'delete' | 'menu' | 'off'

/** The subset that fires an action immediately (vs `menu`/`off`). */
export type SwipeAction = 'reply' | 'forward' | 'delete'

export interface SwipeActions {
  /** "Swipe right" (dx > 0). */
  ltr: SwipeBinding
  /** "Swipe left" (dx < 0). */
  rtl: SwipeBinding
}

/**
 * Defaults: swipe-right replies, swipe-left forwards. Kept to the simple
 * immediate-fire actions — the settings picker only exposes reply / forward /
 * off, though the model still honours legacy `delete` / `menu` bindings that a
 * user persisted before the picker was simplified.
 */
export const DEFAULT_SWIPE_ACTIONS: SwipeActions = { ltr: 'reply', rtl: 'forward' }

const VALID: ReadonlySet<SwipeBinding> = new Set(['reply', 'forward', 'delete', 'menu', 'off'])

function coerce(value: unknown, fallback: SwipeBinding): SwipeBinding {
  return typeof value === 'string' && VALID.has(value as SwipeBinding) ? (value as SwipeBinding) : fallback
}

/** Fill in defaults + drop any stale/invalid stored values. */
export function resolveSwipeActions(stored?: SwipeActions | null): SwipeActions {
  return {
    ltr: coerce(stored?.ltr, DEFAULT_SWIPE_ACTIONS.ltr),
    rtl: coerce(stored?.rtl, DEFAULT_SWIPE_ACTIONS.rtl),
  }
}
