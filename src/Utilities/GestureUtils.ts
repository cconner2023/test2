// Utilities/GestureUtils.ts - Centralized gesture detection and physics utilities
// Used by useSwipeNavigation, BaseDrawer, and WriteNotePage for consistent touch handling

/**
 * Shared constants for gesture detection thresholds.
 * Tuned for native-feeling touch interactions on mobile devices.
 */
export const GESTURE_THRESHOLDS = {
  /** Minimum movement (px) before committing to a direction */
  DIRECTION_LOCK: 8,
  /** Higher threshold when touch starts on interactive elements (buttons, inputs) */
  INTERACTIVE_DIRECTION_LOCK: 40,
  /** Minimum velocity (px/ms) to trigger a fling gesture */
  FLING_VELOCITY: 0.3,
  /** Minimum velocity (px/ms) for drawer close fling */
  DRAWER_FLING_VELOCITY: 0.5,
  /** Default swipe-back threshold (px) */
  SWIPE_BACK_THRESHOLD: 60,
  /** Dampening factor for drag resistance beyond threshold */
  OVERSHOOT_DAMPENING: 0.4,
  /** Dampening for page swipe drag */
  PAGE_DRAG_DAMPENING: 0.85,
  /** Edge resistance for first/last page */
  EDGE_RESISTANCE: 0.25,
  /** Minimum drag distance (px) before velocity can trigger page navigation */
  MIN_DRAG_FOR_VELOCITY: 30,
  /** Page navigation threshold as fraction of container width */
  PAGE_NAV_FRACTION: 0.2,
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
} as const

// ─── Direction Detection ─────────────────────────────────────────

export type GestureDirection = 'horizontal' | 'vertical' | 'none'

/**
 * Determines the gesture direction from accumulated delta.
 * Returns 'none' if movement hasn't exceeded the threshold yet.
 */
export function detectDirection(
  deltaX: number,
  deltaY: number,
  threshold: number = GESTURE_THRESHOLDS.DIRECTION_LOCK
): GestureDirection {
  const absDx = Math.abs(deltaX)
  const absDy = Math.abs(deltaY)

  if (absDx < threshold && absDy < threshold) return 'none'

  // Require clear dominance to lock direction
  return absDx > absDy ? 'horizontal' : 'vertical'
}

/**
 * Checks if a touch target is an interactive element (button, input, etc.)
 * that should have a higher swipe threshold to avoid accidental gestures.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  return !!target.closest(
    'button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"]'
  )
}

// ─── Velocity Tracking ───────────────────────────────────────────

export interface VelocityTracker {
  lastPosition: number
  lastTime: number
  velocity: number
}

/** Create a fresh velocity tracker */
export function createVelocityTracker(initialPosition: number = 0): VelocityTracker {
  return {
    lastPosition: initialPosition,
    lastTime: performance.now(),
    velocity: 0,
  }
}

/**
 * Update the velocity tracker with a new sample.
 * Uses simple finite-difference velocity: (position - lastPosition) / dt
 */
export function updateVelocity(tracker: VelocityTracker, position: number): number {
  const now = performance.now()
  const dt = now - tracker.lastTime
  if (dt > 0) {
    tracker.velocity = (position - tracker.lastPosition) / dt
  }
  tracker.lastPosition = position
  tracker.lastTime = now
  return tracker.velocity
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

/**
 * Determine if a swipe gesture should trigger navigation based on
 * distance and velocity thresholds.
 */
export function shouldNavigate(
  distance: number,
  velocity: number,
  distanceThreshold: number,
  velocityThreshold: number = GESTURE_THRESHOLDS.FLING_VELOCITY
): boolean {
  return Math.abs(distance) > distanceThreshold || Math.abs(velocity) > velocityThreshold
}

// ─── Touch State Management ──────────────────────────────────────

export interface TouchState {
  startX: number
  startY: number
  startTime: number
  direction: GestureDirection
  hasMoved: boolean
  isInteractive: boolean
  velocityX: VelocityTracker
  velocityY: VelocityTracker
}

/** Initialize touch state from a touch event */
export function createTouchState(touch: Touch, target: EventTarget | null): TouchState {
  return {
    startX: touch.clientX,
    startY: touch.clientY,
    startTime: performance.now(),
    direction: 'none',
    hasMoved: false,
    isInteractive: isInteractiveTarget(target),
    velocityX: createVelocityTracker(touch.clientX),
    velocityY: createVelocityTracker(touch.clientY),
  }
}

/**
 * Process a touch move and return the resolved direction plus deltas.
 * Mutates the touchState in-place for performance (avoids GC pressure during gestures).
 */
export function processTouchMove(
  touchState: TouchState,
  touch: Touch
): { deltaX: number; deltaY: number; direction: GestureDirection; velocityX: number; velocityY: number } {
  const deltaX = touch.clientX - touchState.startX
  const deltaY = touch.clientY - touchState.startY

  // Update velocity trackers
  const vx = updateVelocity(touchState.velocityX, touch.clientX)
  const vy = updateVelocity(touchState.velocityY, touch.clientY)

  // Lock direction on first significant movement
  if (touchState.direction === 'none') {
    const threshold = touchState.isInteractive
      ? GESTURE_THRESHOLDS.INTERACTIVE_DIRECTION_LOCK
      : GESTURE_THRESHOLDS.DIRECTION_LOCK
    touchState.direction = detectDirection(deltaX, deltaY, threshold)
  }

  if (touchState.direction !== 'none') {
    touchState.hasMoved = true
  }

  return { deltaX, deltaY, direction: touchState.direction, velocityX: vx, velocityY: vy }
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
