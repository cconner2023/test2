/**
 * Pan/zoom gesture hook for the property canvas.
 * Uses @react-spring/web for spring-animated transforms and
 * @use-gesture/react for unified drag + pinch + wheel input.
 */
import { useRef, useCallback } from 'react'
import { useSpring } from '@react-spring/web'
import { useGesture } from '@use-gesture/react'
import { SPRING_CONFIGS, clamp, isInteractiveTarget } from '../Utilities/GestureUtils'

/** Target for programmatic zoom animations */
export interface ZoomTarget {
  x: number
  y: number
  scale: number
}

/** Current camera state */
export interface CameraState {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 50
const WHEEL_ZOOM_FACTOR = 0.002

interface UseCanvasGestureOptions {
  /** Called when the camera changes (for LOD recalculation) */
  onCameraChange?: (camera: CameraState) => void
  /** Container element ref for coordinate calculations */
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useCanvasGesture({ onCameraChange, containerRef }: UseCanvasGestureOptions) {
  // Store current camera in a ref for synchronous reads
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 })
  const animatingRef = useRef(false)

  const [spring, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    config: SPRING_CONFIGS.canvas,
    onChange: ({ value }) => {
      cameraRef.current = { x: value.x, y: value.y, scale: value.scale }
      onCameraChange?.(cameraRef.current)
    },
  }))

  /** Synchronous camera read */
  const getCamera = useCallback((): CameraState => cameraRef.current, [])

  /** Animate to a specific zoom target */
  const zoomToRect = useCallback((target: ZoomTarget) => {
    animatingRef.current = true
    api.start({
      x: target.x,
      y: target.y,
      scale: target.scale,
      config: SPRING_CONFIGS.canvas,
      onRest: () => { animatingRef.current = false },
    })
  }, [api])

  /** Chain zoom-out → zoom-in for shared-parent navigation */
  const animateSequence = useCallback(async (targets: ZoomTarget[]) => {
    animatingRef.current = true
    for (const target of targets) {
      await new Promise<void>((resolve) => {
        api.start({
          x: target.x,
          y: target.y,
          scale: target.scale,
          config: SPRING_CONFIGS.canvas,
          onRest: () => resolve(),
        })
      })
    }
    animatingRef.current = false
  }, [api])

  /** Reset camera to origin */
  const resetCamera = useCallback(() => {
    api.start({ x: 0, y: 0, scale: 1, config: SPRING_CONFIGS.canvas })
  }, [api])

  // Gesture binding
  const bind = useGesture(
    {
      onDrag: ({ offset: [ox, oy], event, first, memo }) => {
        if (animatingRef.current) return memo
        // Skip if interacting with buttons/inputs
        if (first && isInteractiveTarget(event.target as HTMLElement)) {
          return 'skip'
        }
        if (memo === 'skip') return memo

        api.start({ x: ox, y: oy, immediate: true })
        return memo
      },
      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        if (animatingRef.current) return
        event?.preventDefault?.()

        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const cx = ox - rect.left
        const cy = oy - rect.top

        // Zoom toward the pinch center
        const cam = cameraRef.current
        const newScale = clamp(scale, MIN_SCALE, MAX_SCALE)
        const scaleRatio = newScale / cam.scale
        const newX = cx - (cx - cam.x) * scaleRatio
        const newY = cy - (cy - cam.y) * scaleRatio

        api.start({ x: newX, y: newY, scale: newScale, immediate: true })
      },
      onWheel: ({ event, delta: [, dy] }) => {
        if (animatingRef.current) return
        event.preventDefault()

        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top

        const cam = cameraRef.current
        const zoomDelta = -dy * WHEEL_ZOOM_FACTOR
        const newScale = clamp(cam.scale * (1 + zoomDelta), MIN_SCALE, MAX_SCALE)
        const scaleRatio = newScale / cam.scale
        const newX = cx - (cx - cam.x) * scaleRatio
        const newY = cy - (cy - cam.y) * scaleRatio

        api.start({ x: newX, y: newY, scale: newScale, immediate: true })
      },
    },
    {
      drag: {
        from: () => [cameraRef.current.x, cameraRef.current.y],
        filterTaps: true,
        pointer: { touch: true },
      },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        from: () => [cameraRef.current.scale, 0],
      },
      wheel: {
        eventOptions: { passive: false },
      },
    },
  )

  return {
    spring,
    bind,
    getCamera,
    zoomToRect,
    animateSequence,
    resetCamera,
    isAnimating: () => animatingRef.current,
  }
}
