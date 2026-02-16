import { useCallback, useRef, useEffect, useState } from 'react'
import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import {
  GESTURE_THRESHOLDS,
  SPRING_CONFIGS,
  clamp,
} from '../Utilities/GestureUtils'

interface UseColumnCarouselOptions {
  /** Whether drag gestures are enabled (e.g., only on mobile) */
  enabled: boolean
  /** Current panel index (0 = main, 1 = subcategory, 2 = symptom-info on desktop) */
  panelIndex: number
  /** Total number of panels */
  panelCount: number
  /** Whether the carousel container is currently visible (has non-zero width).
   *  When transitioning from hidden to visible, the carousel snaps immediately
   *  to the correct panel to prevent flashing the wrong panel during CSS grid expansion. */
  isVisible?: boolean
  /** Opaque key — when it changes, the carousel re-syncs to the current panelIndex
   *  even if panelIndex itself didn't change. Handles cases like algorithm-to-algorithm
   *  navigation on desktop where panelIndex stays at 2 but the spring may be stale. */
  syncKey?: string | number
  /** Callback when swipe-back completes (panel decreases) */
  onSwipeBack?: () => void
  /** Callback when swipe-forward completes (panel increases) */
  onSwipeForward?: () => void
}

export function useColumnCarousel({
  enabled,
  panelIndex,
  panelCount,
  isVisible,
  syncKey,
  onSwipeBack,
  onSwipeForward,
}: UseColumnCarouselOptions) {
  const [isSwiping, setIsSwiping] = useState(false)
  const panelRef = useRef(panelIndex)
  panelRef.current = panelIndex
  const prevPanelRef = useRef(panelIndex)
  const prevPercentRef = useRef(100 / panelCount)

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

  // Refs for sync effect — prevents effect from re-running when callback identities
  // change due to parent re-renders (e.g., drawer open/close on desktop).
  const animateRef = useRef(animateToPanel)
  animateRef.current = animateToPanel
  const snapRef = useRef(snapToPanel)
  snapRef.current = snapToPanel

  // Sync spring when panel index changes externally, when breakpoint crossing
  // changes panelPercent, or when syncKey changes (content changed without panel change).
  // Callback refs prevent unnecessary effect re-runs that could cause spring glitches.
  const prevSyncKeyRef = useRef(syncKey)
  useEffect(() => {
    if (isSwiping) return
    const prev = prevPanelRef.current
    const prevPercent = prevPercentRef.current
    const prevKey = prevSyncKeyRef.current
    prevPanelRef.current = panelIndex
    prevPercentRef.current = panelPercent
    prevSyncKeyRef.current = syncKey

    if (prevPercent !== panelPercent) {
      // Breakpoint crossing: snap immediately to correct position
      snapRef.current(panelIndex)
    } else if (prev !== panelIndex) {
      // Snap immediately for large jumps (e.g., restoring a saved note: panel 0→2).
      // Animate for single-step navigation (normal user browsing).
      if (Math.abs(prev - panelIndex) > 1) {
        snapRef.current(panelIndex)
      } else {
        animateRef.current(panelIndex)
      }
    } else if (prevKey !== syncKey) {
      // Content changed without panel change (e.g., algorithm→algorithm on desktop).
      // Re-snap to ensure spring is at the correct position.
      snapRef.current(panelIndex)
    }
  }, [panelIndex, panelPercent, isSwiping, syncKey])

  // Snap immediately to correct panel when becoming visible.
  // Prevents flash of wrong panel during CSS grid expansion from 0fr.
  const wasVisibleRef = useRef(isVisible ?? true)
  useEffect(() => {
    const wasVisible = wasVisibleRef.current
    const nowVisible = isVisible ?? true
    wasVisibleRef.current = nowVisible

    if (!wasVisible && nowVisible) {
      snapToPanel(panelIndex)
    }
  }, [isVisible, panelIndex, snapToPanel])

  // Drag gesture handler
  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap, event }) => {
      if (!enabled || tap) return

      const panel = panelRef.current
      // Get container width from the event target's parent
      const target = event?.currentTarget as HTMLElement | null
      const containerWidth = target?.offsetWidth || window.innerWidth

      // Convert pixel drag to percentage of container
      const dragPercent = (mx / containerWidth) * 100
      const currentBase = -panel * panelPercent

      if (active) {
        setIsSwiping(true)

        // Clamp drag: don't allow going past first or last panel
        const rawX = currentBase + dragPercent
        const minX = -(panelCount - 1) * panelPercent
        const maxX = 0

        // Apply edge resistance
        let clampedX = rawX
        if (rawX > maxX) {
          clampedX = maxX + (rawX - maxX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
        } else if (rawX < minX) {
          clampedX = minX + (rawX - minX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
        }

        api.start({ x: clampedX, immediate: true })
      } else {
        setIsSwiping(false)

        // Determine if we should navigate
        const absDrag = Math.abs(mx)
        const fraction = absDrag / containerWidth
        const velocityThreshold = GESTURE_THRESHOLDS.FLING_VELOCITY

        const shouldNavigate =
          fraction > GESTURE_THRESHOLDS.PAGE_NAV_FRACTION ||
          (vx > velocityThreshold && absDrag > GESTURE_THRESHOLDS.MIN_DRAG_FOR_VELOCITY)

        if (shouldNavigate) {
          // Determine direction: dx > 0 = dragging right = go back
          const goingBack = dx > 0
          const targetPanel = goingBack
            ? Math.max(0, panel - 1)
            : Math.min(panelCount - 1, panel + 1)

          if (targetPanel !== panel) {
            const pct = 100 / panelCount
            api.start({
              x: -targetPanel * pct,
              immediate: false,
              config: SPRING_CONFIGS.fling,
              onRest: () => {
                if (goingBack) onSwipeBack?.()
                else onSwipeForward?.()
              },
            })
            return
          }
        }

        // Snap back to current panel
        api.start({
          x: currentBase,
          immediate: false,
          config: SPRING_CONFIGS.snap,
        })
      }
    },
    {
      enabled,
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
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
