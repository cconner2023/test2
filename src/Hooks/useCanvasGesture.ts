import { useCallback, useRef } from 'react'
import { useSpring } from '@react-spring/web'
import { useGesture } from '@use-gesture/react'
import { SPRING_CONFIGS, clamp } from '../Utilities/GestureUtils'

interface UseCanvasGestureOptions {
  /** Whether gestures are enabled (disable during draw mode, etc.) */
  enabled?: boolean
  /** Minimum scale value */
  minScale?: number
  /** Maximum scale value */
  maxScale?: number
  /** Start at this transform instead of (0,0,1). Used for background canvas layers. */
  initialTransform?: { x: number; y: number; scale: number }
}

const DEFAULT_MIN_SCALE = 1
const DEFAULT_MAX_SCALE = 10
/** How far past the edge the user can drag (fraction of viewport) */
const OVERSHOOT_FRACTION = 0.15

/**
 * Canvas pan/zoom gesture hook using CSS transforms.
 *
 * Manages spring-animated `translate3d(x, y, 0) scale(s)` on a canvas element.
 * Supports drag-to-pan, pinch-to-zoom, and Ctrl+wheel zoom.
 *
 * Pattern follows useColumnCarousel.ts — returns { style, bind, zoom, ... }.
 */
export function useCanvasGesture({
  enabled = true,
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
  initialTransform,
}: UseCanvasGestureOptions = {}) {
  const viewportRef = useRef<HTMLDivElement>(null)

  const [style, api] = useSpring(() => ({
    x: initialTransform?.x ?? 0,
    y: initialTransform?.y ?? 0,
    scale: initialTransform?.scale ?? 1,
    config: SPRING_CONFIGS.canvas,
    immediate: !!initialTransform,
  }))

  // Track the resting (committed) values so drag/pinch can accumulate
  const restRef = useRef(initialTransform ?? { x: 0, y: 0, scale: 1 })

  /** Compute pan bounds for a given scale, allowing OVERSHOOT_FRACTION past edges */
  const getBounds = useCallback((scale: number) => {
    const vp = viewportRef.current
    if (!vp) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    const vpW = vp.clientWidth
    const vpH = vp.clientHeight
    const contentW = vpW * scale
    const contentH = vpH * scale
    const overX = vpW * OVERSHOOT_FRACTION
    const overY = vpH * OVERSHOOT_FRACTION
    // At scale=1 the content exactly fills the viewport, so max pan is 0 + overshoot.
    // At scale>1 the content overflows, so we allow panning to see edges + overshoot.
    const minX = -(contentW - vpW) - overX
    const maxX = overX
    const minY = -(contentH - vpH) - overY
    const maxY = overY
    return { minX, maxX, minY, maxY }
  }, [])

  /** Clamp pan values to bounds */
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const { minX, maxX, minY, maxY } = getBounds(scale)
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) }
  }, [getBounds])

  /** Snap pan within tight bounds (no overshoot) for resting position */
  const getRestBounds = useCallback((scale: number) => {
    const vp = viewportRef.current
    if (!vp) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    const vpW = vp.clientWidth
    const vpH = vp.clientHeight
    const contentW = vpW * scale
    const contentH = vpH * scale
    const minX = Math.min(0, -(contentW - vpW))
    const maxX = Math.max(0, 0)
    const minY = Math.min(0, -(contentH - vpH))
    const maxY = Math.max(0, 0)
    return { minX, maxX, minY, maxY }
  }, [])

  const clampRestPan = useCallback((x: number, y: number, scale: number) => {
    const { minX, maxX, minY, maxY } = getRestBounds(scale)
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) }
  }, [getRestBounds])

  const bind = useGesture(
    {
      onDrag: ({ active, movement: [mx, my], event, tap, first, memo }) => {
        if (tap) return
        // Skip if starting on [data-no-pan] elements (edit-mode handles, inputs)
        if (first) {
          const target = event?.target as HTMLElement | null
          if (target?.closest('[data-no-pan], input, textarea, button')) return 'skip'
        }
        if (memo === 'skip') return 'skip'

        const rest = restRef.current
        const newX = rest.x + mx
        const newY = rest.y + my

        if (active) {
          const clamped = clampPan(newX, newY, rest.scale)
          api.start({ x: clamped.x, y: clamped.y, immediate: true })
        } else {
          // Snap within rest bounds on release
          const clamped = clampRestPan(newX, newY, rest.scale)
          restRef.current = { ...rest, x: clamped.x, y: clamped.y }
          api.start({ x: clamped.x, y: clamped.y, config: SPRING_CONFIGS.canvas })
        }
        return memo
      },

      onPinch: ({ active, offset: [s], origin: [ox, oy], memo, first }) => {
        const vp = viewportRef.current
        if (!vp) return memo

        const newScale = clamp(s, minScale, maxScale)

        if (first) {
          // Capture focal point relative to viewport
          const rect = vp.getBoundingClientRect()
          const fx = ox - rect.left
          const fy = oy - rect.top
          memo = { fx, fy, startX: restRef.current.x, startY: restRef.current.y, startScale: restRef.current.scale }
        }

        if (memo) {
          // Adjust pan so the focal point stays stationary
          const { fx, fy, startX, startY, startScale } = memo as { fx: number; fy: number; startX: number; startY: number; startScale: number }
          const ratio = newScale / startScale
          const newX = fx - (fx - startX) * ratio
          const newY = fy - (fy - startY) * ratio

          if (active) {
            const clamped = clampPan(newX, newY, newScale)
            api.start({ x: clamped.x, y: clamped.y, scale: newScale, immediate: true })
          } else {
            const clamped = clampRestPan(newX, newY, newScale)
            restRef.current = { x: clamped.x, y: clamped.y, scale: newScale }
            api.start({ x: clamped.x, y: clamped.y, scale: newScale, config: SPRING_CONFIGS.canvas })
          }
        }
        return memo
      },

      onWheel: ({ event, active }) => {
        // Only handle Ctrl+wheel (standard map zoom convention)
        if (!event?.ctrlKey) return
        event.preventDefault()

        const vp = viewportRef.current
        if (!vp) return

        const rest = restRef.current
        const delta = -event.deltaY * 0.01
        const newScale = clamp(rest.scale + delta, minScale, maxScale)

        // Focal point = cursor position relative to viewport
        const rect = vp.getBoundingClientRect()
        const fx = event.clientX - rect.left
        const fy = event.clientY - rect.top

        const ratio = newScale / rest.scale
        const newX = fx - (fx - rest.x) * ratio
        const newY = fy - (fy - rest.y) * ratio

        const clamped = clampRestPan(newX, newY, newScale)
        restRef.current = { x: clamped.x, y: clamped.y, scale: newScale }
        api.start({
          x: clamped.x,
          y: clamped.y,
          scale: newScale,
          immediate: active,
          config: SPRING_CONFIGS.canvas,
        })
      },
    },
    {
      enabled,
      drag: {
        filterTaps: true,
        pointer: { touch: true },
        from: () => [0, 0],
      },
      pinch: {
        scaleBounds: { min: minScale, max: maxScale },
        from: () => [restRef.current.scale, 0],
      },
      wheel: {
        eventOptions: { passive: false },
      },
    },
  )

  /** Zoom in/out by a fixed step, centered on viewport */
  const zoomStep = useCallback((direction: 'in' | 'out') => {
    const vp = viewportRef.current
    if (!vp) return
    const rest = restRef.current
    const step = direction === 'in' ? 0.5 : -0.5
    const newScale = clamp(rest.scale + step, minScale, maxScale)

    // Keep viewport center stationary
    const cx = vp.clientWidth / 2
    const cy = vp.clientHeight / 2
    const ratio = newScale / rest.scale
    const newX = cx - (cx - rest.x) * ratio
    const newY = cy - (cy - rest.y) * ratio

    const clamped = clampRestPan(newX, newY, newScale)
    restRef.current = { x: clamped.x, y: clamped.y, scale: newScale }
    api.start({ x: clamped.x, y: clamped.y, scale: newScale, config: SPRING_CONFIGS.canvas })
  }, [api, minScale, maxScale, clampRestPan])

  /** Animate to frame a specific rect (normalized 0-1 coordinates) within the viewport.
   *  Positions the zone 10px from top-left, scaled to fill ~90% of viewport. */
  const onRestGuardRef = useRef(false)
  const zoomToRect = useCallback((rect: { x: number; y: number; w: number; h: number }, onRest?: () => void) => {
    const vp = viewportRef.current
    if (!vp) return
    const vpW = vp.clientWidth
    const vpH = vp.clientHeight

    // Compute scale so the rect fills ~90% of viewport
    const scaleX = 0.9 / rect.w
    const scaleY = 0.9 / rect.h
    const newScale = clamp(Math.min(scaleX, scaleY), minScale, maxScale)

    // Position so rect's top-left sits at (10px, 10px) in the viewport
    const newX = 10 - rect.x * vpW * newScale
    const newY = 10 - rect.y * vpH * newScale

    restRef.current = { x: newX, y: newY, scale: newScale }
    // Guard onRest — react-spring fires it per animated key (x, y, scale)
    onRestGuardRef.current = false
    api.start({
      x: newX,
      y: newY,
      scale: newScale,
      config: SPRING_CONFIGS.canvas,
      onRest: onRest ? () => {
        if (!onRestGuardRef.current) {
          onRestGuardRef.current = true
          onRest()
        }
      } : undefined,
    })
  }, [api, minScale, maxScale])

  /** Reset to default view (scale=1, pan=0,0) */
  const resetView = useCallback((immediate = false) => {
    restRef.current = { x: 0, y: 0, scale: 1 }
    api.start({ x: 0, y: 0, scale: 1, immediate, config: SPRING_CONFIGS.canvas })
  }, [api])

  /** Get the current scale value (for UI like zoom buttons) */
  const getScale = useCallback(() => restRef.current.scale, [])

  return {
    /** Spring style — apply to the inner animated.div: transform: translate3d + scale */
    style,
    /** Gesture handlers — spread onto the viewport container */
    bind,
    /** Ref for the viewport container (overflow-hidden element) */
    viewportRef,
    /** Zoom in/out by a step */
    zoomStep,
    /** Animate to frame a normalized rect */
    zoomToRect,
    /** Reset to default view */
    resetView,
    /** Get current scale */
    getScale,
    /** Direct access to spring API for advanced control */
    api,
    /** Access to rest position ref */
    restRef,
  }
}
