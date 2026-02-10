// Utilities/GestureUtils.ts - Gesture constants, physics helpers, and unified drag patterns
// Used alongside @use-gesture/react + @react-spring/web for consistent touch handling

import type { UserDragConfig } from '@use-gesture/react'

//
// ═══════════════════════════════════════════════════════════════════
// UNIFIED DRAG PATTERN
// ═══════════════════════════════════════════════════════════════════
//
// All useDrag handlers in the app follow the same 4-phase flow:
//
//   1. GUARD — Early return if gesture should be ignored
//      (disabled, tap, wrong element, carousel conflict, etc.)
//
//   2. COMPUTE — Calculate position/offset from gesture input
//      (pixel → percentage, clamp to bounds, apply dampening)
//
//   3. ANIMATE — Update spring or position via react-spring api
//      (immediate: true during drag, animated spring on release)
//
//   4. CALLBACK — Fire navigation/action callback on gesture commit
//      (onSwipeBack, onClose, onReveal — always BEFORE animation starts)
//
// Each implementation adapts this flow to its axis and use case:
//
//   • useSwipeNavigation  — Horizontal, detection-only (no spring, CSS grid animates)
//   • useColumnCarousel   — Horizontal, spring-driven panel snapping
//   • BaseDrawer          — Vertical, spring-driven drawer dismiss
//   • SwipeableNoteItem   — Horizontal, spring-driven action reveal
//
// All implementations:
//   - Use HORIZONTAL_DRAG_CONFIG or VERTICAL_DRAG_CONFIG for useDrag options
//   - Reference GESTURE_THRESHOLDS for all threshold/dampening values
//   - Use SPRING_CONFIGS for all animated transitions
//   - Fire callbacks synchronously BEFORE animation starts
//   - Use a commitRef to prevent double-fire on rapid gestures
//
// ═══════════════════════════════════════════════════════════════════

/**
 * Shared constants for gesture detection thresholds.
 * Tuned for native-feeling touch interactions on mobile devices.
 *
 * Referenced by all 4 useDrag implementations — no inline threshold values.
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
  /** Dampening factor for drawer vertical drag (applied to movement) */
  DRAWER_DRAG_DAMPENING: 0.8,
  /** Minimum drawer position (%) below which drawer closes on release */
  DRAWER_CLOSE_THRESHOLD: 40,
  /** Swipe-to-reveal threshold (px) — minimum swipe to reveal actions */
  REVEAL_THRESHOLD: 60,
  /** Swipe-to-reveal: left action panel width (px) */
  REVEAL_ACTION_WIDTH_LEFT: 180,
  /** Swipe-to-reveal: right action panel width (px) */
  REVEAL_ACTION_WIDTH_RIGHT: 80,
  /** Swipe-to-reveal: overshoot dampening beyond action width */
  REVEAL_OVERSHOOT_DAMPENING: 0.3,
  /** Drawer minimum drag position (%) — cannot drag above this */
  DRAWER_MIN_POSITION: 20,
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

// ─── Standard useDrag Configuration ────────────────────────────────
//
// All useDrag handlers use these base configs to ensure consistency.
// Each config sets axis locking, tap filtering, and touch-only pointer mode.
//
// Usage: spread the base config and add `enabled` per-instance:
//   useDrag(handler, { ...HORIZONTAL_DRAG_CONFIG, enabled: someCondition })

/** Standard useDrag options for horizontal gestures (carousel, swipe-back, item reveal) */
export const HORIZONTAL_DRAG_CONFIG: Partial<UserDragConfig> = {
  axis: 'x',
  filterTaps: true,
  pointer: { touch: true },
  from: () => [0, 0] as [number, number],
}

/** Standard useDrag options for vertical gestures (drawer drag-to-close) */
export const VERTICAL_DRAG_CONFIG: Partial<UserDragConfig> = {
  axis: 'y',
  filterTaps: true,
  pointer: { touch: true },
}

// ─── Drag Commit Helpers ───────────────────────────────────────────

/**
 * Standard commit check for navigation gestures.
 * Tests whether a swipe-back should trigger based on distance OR velocity.
 *
 * Used by: useSwipeNavigation, useColumnCarousel
 */
export function shouldCommitSwipe(
  distance: number,
  velocity: number,
  direction: number,
  distanceThreshold: number,
  velocityThreshold: number = GESTURE_THRESHOLDS.FLING_VELOCITY,
): boolean {
  return distance > distanceThreshold || (velocity > velocityThreshold && direction > 0)
}

/**
 * Apply overshoot dampening for swipe-to-reveal gestures.
 * Applies rubber-band resistance when dragged beyond the action panel width.
 *
 * Used by: SwipeableNoteItem
 */
export function revealDampedOffset(
  offset: number,
  leftWidth: number = GESTURE_THRESHOLDS.REVEAL_ACTION_WIDTH_LEFT,
  rightWidth: number = GESTURE_THRESHOLDS.REVEAL_ACTION_WIDTH_RIGHT,
  dampening: number = GESTURE_THRESHOLDS.REVEAL_OVERSHOOT_DAMPENING,
): number {
  if (offset > leftWidth) {
    return leftWidth + (offset - leftWidth) * dampening
  }
  if (offset < -rightWidth) {
    const overshoot = Math.abs(offset) - rightWidth
    return -(rightWidth + overshoot * dampening)
  }
  return offset
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

// ─── Carousel helpers ──────────────────────────────────────────

/** Parallax fraction — how far behind-layers shift left (30% of screen) */
const PARALLAX_FRACTION = 0.3
/** Opacity of behind-layers in their parallax position */
const PARALLAX_OPACITY = 0.6

/**
 * Compute resting {x, opacity} for each carousel layer at a given depth.
 * - Layers behind current depth: shifted left with reduced opacity (parallax)
 * - Active layer: centered, full opacity
 * - Layers ahead: off-screen right, full opacity
 */
export function carouselPositions(
  depth: number,
  screenWidth: number,
  layerCount: number = 3,
): Array<{ x: number; opacity: number }> {
  return Array.from({ length: layerCount }, (_, i) => {
    if (i < depth) return { x: -screenWidth * PARALLAX_FRACTION, opacity: PARALLAX_OPACITY }
    if (i === depth) return { x: 0, opacity: 1 }
    return { x: screenWidth, opacity: 1 }
  })
}
