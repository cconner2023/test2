// Utilities/GestureUtils.ts - Gesture constants and physics helpers
// Used alongside @use-gesture/react for consistent touch handling

/**
 * Shared constants for gesture detection thresholds.
 * Tuned for native-feeling touch interactions on mobile devices.
 */
export const GESTURE_THRESHOLDS = {
  /** Minimum movement (px) before committing to a direction */
  DIRECTION_LOCK: 8,
  /** Minimum velocity (px/ms) to trigger a fling gesture */
  FLING_VELOCITY: 0.3,
  /** Minimum velocity (px/ms) for drawer close fling */
  DRAWER_FLING_VELOCITY: 0.5,
  /** Default swipe-back threshold (px) */
  SWIPE_BACK_THRESHOLD: 80,
  /** Horizontal swipe threshold for note item reveal actions (px) */
  NOTE_SWIPE_THRESHOLD: 15,
  /** Dampening factor for drag resistance beyond threshold */
  OVERSHOOT_DAMPENING: 0.4,
  /** Dampening for page swipe drag */
  PAGE_DRAG_DAMPENING: 0.85,
  /** Edge resistance for first/last page */
  EDGE_RESISTANCE: 0.25,
  /** Minimum drag distance (px) before velocity can trigger page navigation */
  MIN_DRAG_FOR_VELOCITY: 50,
  /** Page navigation threshold as fraction of container width */
  PAGE_NAV_FRACTION: 0.2,
  /** Left-edge zone width (px) for swipe-back gesture activation */
  EDGE_ZONE: 40,
  /** Minimum horizontal drag (px) to trigger page-swipe navigation */
  PAGE_SWIPE_THRESHOLD: 40,
} as const

/**
 * Spring configurations for react-spring animations.
 * Tuned for responsive, native-feeling physics.
 */
export const SPRING_CONFIGS = {
  /** Default spring for snapping back to resting position */
  snap: { tension: 300, friction: 30 },
  /** Softer spring for completing a fling/dismiss gesture */
  fling: { tension: 200, friction: 25 },
  /** Spring for page swipe navigation */
  page: { tension: 280, friction: 26 },
  /** Stiff spring for quick resets */
  stiff: { tension: 400, friction: 35 },
  /** Bouncy spring for overswipe snap-back */
  bounce: { tension: 300, friction: 22 },
  /** Canvas pan/zoom — responsive with slight damping for map-like feel */
  canvas: { tension: 350, friction: 30 },
} as const

// ─── Shared touch-gesture direction-lock helpers ─────────────────

/** Mutable state for a direction-locked touch gesture. */
export type DragState = {
  startX: number;
  startY: number;
  lastX: number;
  /** null = undecided, true = horizontal, false = vertical */
  locked: boolean | null;
}

/**
 * Check if a touch target is an interactive element that should prevent gesture tracking.
 *
 * `[role="slider"]` and `[role="tablist"]` cover SliderRail: a horizontal rail drags
 * along the same axis as a drawer's swipe-to-dismiss, and the drag can begin on the
 * track's padding rather than on a stop button, so the track itself has to opt out.
 */
export function isInteractiveTarget(target: HTMLElement): boolean {
  return !!target.closest('button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"], [role="tablist"]');
}

/**
 * Gesture zones — subtrees that own their horizontal gestures, independent of the
 * page carousel. Mark with `data-gesture-zone` (a whole surface, e.g. the Mission
 * Board) or `data-swipe-row` (SwipeActionRow sets it itself).
 */
export const GESTURE_ZONE_SELECTOR = '[data-gesture-zone], [data-swipe-row]';

/** True when the touch starts in either screen-edge strip — those always belong to
 *  the page (left: menu / swipe-back, right: messages slide). */
export function isScreenEdge(x: number): boolean {
  return x < GESTURE_THRESHOLDS.EDGE_ZONE || x > window.innerWidth - GESTURE_THRESHOLDS.EDGE_ZONE;
}

/**
 * True when a page-level drag (column carousel, menu slide) must stand down because
 * the gesture began inside a gesture zone. Edge strips never count, so the menu and
 * messages edge-swipes still work over a zone.
 */
export function isGestureZoneStart(startX: number, startY: number): boolean {
  if (isScreenEdge(startX)) return false;
  // Hit-test the start point: @use-gesture captures the pointer, so the move
  // event's target is the capturing container, not the element under the finger.
  const el = document.elementFromPoint(startX, startY);
  return !!el?.closest(GESTURE_ZONE_SELECTOR);
}

/**
 * Apply direction-lock logic to a drag state based on current displacement.
 * Mutates `state.locked`. Returns true if the gesture is horizontal (continue tracking).
 */
export function applyDirectionLock(state: DragState, dx: number, dy: number): boolean {
  if (state.locked === null) {
    if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return false;
    state.locked = Math.abs(dx) > Math.abs(dy);
  }
  return !!state.locked;
}

// ─── Dampening / Physics ─────────────────────────────────────────

/**
 * Apply rubber-band dampening when offset exceeds a threshold.
 * Creates the iOS-style resistance feel at edges.
 */
export function dampedOffset(
  offset: number,
  threshold: number,
  dampening: number = GESTURE_THRESHOLDS.OVERSHOOT_DAMPENING
): number {
  if (Math.abs(offset) <= threshold) return offset
  const sign = offset > 0 ? 1 : -1
  const abs = Math.abs(offset)
  return sign * (threshold + (abs - threshold) * dampening)
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─── Parallax helpers ────────────────────────────────────────────

/**
 * Compute parallax offset for a background layer during swipe.
 * Creates a subtle "peek" effect like iOS navigation stacks.
 */
export function parallaxTransform(
  dragOffset: number,
  viewWidth: number,
  maxParallax: number = 80,
  baseOffset: number = -80
): { x: number; opacity: number } {
  const progress = clamp(dragOffset / viewWidth, 0, 1)
  return {
    x: baseOffset + progress * maxParallax,
    opacity: 0.6 + progress * 0.4,
  }
}
