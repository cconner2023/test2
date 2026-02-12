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
} as const

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
