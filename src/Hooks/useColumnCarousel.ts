import { useCallback, useRef, useEffect, useState } from 'react'
import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import {
  GESTURE_THRESHOLDS,
  SPRING_CONFIGS,
  HORIZONTAL_DRAG_CONFIG,
} from '../Utilities/GestureUtils'

interface UseColumnCarouselOptions {
  /** Whether drag gestures are enabled (e.g., only on mobile) */
  enabled: boolean
  /** Current panel index (0 = main, 1 = subcategory, 2 = symptom-info on desktop) */
  panelIndex: number
  /** Total number of panels */
  panelCount: number
  /** Whether the carousel container is currently visible (not hidden by grid 0fr).
   *  When transitioning from hidden → visible, the spring snaps to the correct
   *  panel position to prevent drift caused by zero-width container rendering. */
  isVisible?: boolean
  /** Callback when swipe-back completes (panel decreases) */
  onSwipeBack?: () => void
  /** Callback when swipe-forward completes (panel increases) */
  onSwipeForward?: () => void
}

export function useColumnCarousel({
  enabled,
  panelIndex,
  panelCount,
  isVisible = true,
  onSwipeBack,
  onSwipeForward,
}: UseColumnCarouselOptions) {
  const [isSwiping, setIsSwiping] = useState(false)
  const panelRef = useRef(panelIndex)
  panelRef.current = panelIndex
  const prevPanelRef = useRef(panelIndex)
  // Track whether we've committed to a navigation callback during this gesture
  // Prevents double-fire if onRest fires after navigation state already updated
  const navigationCommittedRef = useRef(false)

  // Percentage per panel: 100% / panelCount
  const panelPercent = 100 / panelCount

  // Spring for translateX in percentage
  const [style, api] = useSpring(() => ({
    x: -panelIndex * panelPercent,
    config: SPRING_CONFIGS.page,
  }))

  /** Animate to a specific panel */
  const animateToPanel = useCallback((target: number, onComplete?: () => void) => {
    const pct = 100 / panelCount
    api.start({
      x: -target * pct,
      immediate: false,
      config: SPRING_CONFIGS.page,
      onRest: () => onComplete?.(),
    })
  }, [api, panelCount])

  /** Snap immediately to a panel (no animation) */
  const snapToPanel = useCallback((target: number) => {
    const pct = 100 / panelCount
    api.start({
      x: -target * pct,
      immediate: true,
    })
  }, [api, panelCount])

  // Track previous visibility to detect hidden → visible transitions
  const prevVisibleRef = useRef(isVisible)

  // Sync spring when panel index changes externally, or when the carousel
  // transitions from hidden to visible. When Column A is hidden (grid 0fr),
  // react-spring resolves percentage-based transforms to 0px in a zero-width
  // container, causing the spring value to drift. On visibility restore we
  // snap immediately to the correct panel to prevent desync.
  useEffect(() => {
    if (isSwiping) return
    const wasVisible = prevVisibleRef.current
    prevVisibleRef.current = isVisible
    const prev = prevPanelRef.current
    prevPanelRef.current = panelIndex

    if (!wasVisible && isVisible) {
      // Container just became visible — snap immediately to correct position
      // to fix any spring drift that occurred while hidden
      snapToPanel(panelIndex)
    } else if (prev !== panelIndex) {
      animateToPanel(panelIndex)
    }
  }, [panelIndex, isVisible, isSwiping, animateToPanel, snapToPanel])

  // Drag gesture handler — follows unified 4-phase pattern:
  // GUARD → COMPUTE → ANIMATE → CALLBACK
  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap, event }) => {
      // 1. GUARD
      if (!enabled || tap) return

      const panel = panelRef.current
      const target = event?.currentTarget as HTMLElement | null
      const containerWidth = target?.offsetWidth || window.innerWidth

      // 2. COMPUTE — convert pixel drag to percentage of container
      const dragPercent = (mx / containerWidth) * 100
      const currentBase = -panel * panelPercent

      if (active) {
        setIsSwiping(true)
        navigationCommittedRef.current = false

        // Clamp drag: don't allow going past first or last panel
        const rawX = currentBase + dragPercent
        const minX = -(panelCount - 1) * panelPercent
        const maxX = 0

        // Apply edge resistance from shared constants
        let clampedX = rawX
        if (rawX > maxX) {
          clampedX = maxX + (rawX - maxX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
        } else if (rawX < minX) {
          clampedX = minX + (rawX - minX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
        }

        // 3. ANIMATE — immediate position update during drag
        api.start({ x: clampedX, immediate: true })
      } else {
        setIsSwiping(false)

        // 2. COMPUTE — determine if gesture meets navigation threshold
        const absDrag = Math.abs(mx)
        const fraction = absDrag / containerWidth

        const shouldNavigate =
          fraction > GESTURE_THRESHOLDS.PAGE_NAV_FRACTION ||
          (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && absDrag > GESTURE_THRESHOLDS.MIN_DRAG_FOR_VELOCITY)

        if (shouldNavigate) {
          const goingBack = dx > 0
          const targetPanel = goingBack
            ? Math.max(0, panel - 1)
            : Math.min(panelCount - 1, panel + 1)

          if (targetPanel !== panel) {
            // 4. CALLBACK — fire BEFORE animation starts
            navigationCommittedRef.current = true
            if (goingBack) onSwipeBack?.()
            else onSwipeForward?.()

            // 3. ANIMATE — spring to target panel
            const pct = 100 / panelCount
            api.start({
              x: -targetPanel * pct,
              immediate: false,
              config: SPRING_CONFIGS.fling,
            })
            return
          }
        }

        // 3. ANIMATE — snap back to current panel
        api.start({
          x: currentBase,
          immediate: false,
          config: SPRING_CONFIGS.snap,
        })
      }
    },
    {
      ...HORIZONTAL_DRAG_CONFIG,
      enabled,
    }
  )

  return {
    /** Spring style: { x } in percentage — use with translateX */
    style,
    /** Touch/drag handlers — spread onto the carousel container */
    dragHandlers: enabled ? bind() : {},
    /** Whether the user is actively dragging */
    isSwiping,
    /** Programmatically animate to a panel */
    animateToPanel,
    /** Programmatically snap to a panel (no animation) */
    snapToPanel,
  }
}
