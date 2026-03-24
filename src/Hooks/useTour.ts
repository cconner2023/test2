import { useState, useCallback, useRef, useEffect } from 'react'
import { allTours, DEFAULT_STEP_DURATION, type TourDefinition, type TourStep } from '../Data/tourDefinitions'
import { useAuth } from './useAuth'

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tour_progress'

interface TourProgress {
  completedTours: string[]
  skippedTours: string[]
  lastStepIndex: Record<string, number>
}

function loadProgress(): TourProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { completedTours: [], skippedTours: [], lastStepIndex: {} }
}

function saveProgress(p: TourProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch { /* ignore */ }
}

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

/** Wait for a data-tour element to appear in the DOM. Abort-aware. */
function waitForTarget(target: string, signal: AbortSignal, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('', 'AbortError')); return }

    const el = document.querySelector(`[data-tour="${target}"]`)
    if (el) { resolve(); return }

    let settled = false
    const cleanup = () => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }

    const onAbort = () => { cleanup(); reject(new DOMException('', 'AbortError')) }
    signal.addEventListener('abort', onAbort, { once: true })

    const observer = new MutationObserver(() => {
      if (document.querySelector(`[data-tour="${target}"]`)) {
        cleanup()
        resolve()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const timer = setTimeout(() => {
      cleanup()
      resolve() // resolve even on timeout — tooltip just won't highlight
    }, timeout)
  })
}

/** Wait one animation frame — enough for the browser to paint after DOM mutation. */
function waitForPaint(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('', 'AbortError')); return }
    const onAbort = () => reject(new DOMException('', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    requestAnimationFrame(() => {
      signal.removeEventListener('abort', onAbort)
      if (signal.aborted) { reject(new DOMException('', 'AbortError')); return }
      resolve()
    })
  })
}

// ─── Action Orchestrator Type ────────────────────────────────────────────────

export type TourActionHandler = (action: string) => void | Promise<void>

// ─── Hook ────────────────────────────────────────────────────────────────────
//
// Architecture: single async loop per tour run.
//
// Each step follows a strict sequence:
//   1. Navigate — execute beforeStep action
//   2. Settle   — wait for target element in DOM, then wait for it to stop moving
//   3. Guide    — show tooltip, count down (or wait for user tap at pause points)
//   4. After    — execute afterStep action
//
// The loop owns the lifecycle. React state is display-only.
// No timer-restart effects. No isPlaying gymnastics.

export function useTour(onAction?: TourActionHandler, isMobile = true) {
  const { isSupervisorRole, isProviderRole, isDevRole } = useAuth()

  const [progress, setProgress] = useState<TourProgress>(loadProgress)
  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  // Refs for async flow control — immune to stale closures
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolverRef = useRef<(() => void) | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const pausedRef = useRef(false)
  const pendingNextRef = useRef(false)
  /** Filtered steps for the active tour (excludes mobileOnly/desktopOnly mismatches) */
  const filteredStepsRef = useRef<TourStep[]>([])

  // ── Derived state ──────────────────────────────────────────────────────

  const availableTours = allTours.filter(t => {
    if (t.devOnly && !isDevRole) return false
    if (t.tier === 'supervisor' && !isSupervisorRole) return false
    if (t.tier === 'provider' && !isProviderRole) return false
    return true
  })

  const activeTour = activeTourId
    ? allTours.find(t => t.id === activeTourId) ?? null
    : null

  const filteredSteps = filteredStepsRef.current
  const activeStep: TourStep | null = filteredSteps[currentStep] ?? null
  const totalSteps = filteredSteps.length
  const stepDuration = activeStep?.duration ?? DEFAULT_STEP_DURATION
  const isPausePoint = activeStep?.pausePoint ?? false

  // ── Persist progress ───────────────────────────────────────────────────

  const updateProgress = useCallback((fn: (p: TourProgress) => TourProgress) => {
    setProgress(prev => {
      const next = fn(prev)
      saveProgress(next)
      return next
    })
  }, [])

  // ── Low-level helpers ──────────────────────────────────────────────────

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Sync paused ref with isPlaying state
  useEffect(() => { pausedRef.current = !isPlaying }, [isPlaying])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Tour runner ────────────────────────────────────────────────────────

  const startTour = useCallback(async (tourId: string, fromStep = 0) => {
    const tour = allTours.find(t => t.id === tourId)
    if (!tour) return

    // Filter steps based on mobile/desktop
    const mobile = isMobileRef.current
    const steps = tour.steps.filter(s => {
      if (s.mobileOnly && !mobile) return false
      if (s.desktopOnly && mobile) return false
      return true
    })
    filteredStepsRef.current = steps

    // Claim this run — increment before abort so the old finally skips cleanup
    const generation = ++generationRef.current
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    setActiveTourId(tourId)
    setCurrentStep(fromStep)
    setElapsed(0)
    setIsPlaying(true)
    pausedRef.current = false
    pendingNextRef.current = false

    // ── Async primitives (scoped to this run's signal) ───────────────

    /** Wait until user taps Next. Rejects on abort. */
    const awaitNext = (): Promise<void> => new Promise((resolve, reject) => {
      let settled = false
      const onAbort = () => {
        if (settled) return
        settled = true
        reject(new DOMException('', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      resolverRef.current = () => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', onAbort)
        resolve()
      }
    })

    /** Count down `duration` ms, updating elapsed for the progress bar.
     *  Resolves on timer completion or early via manual Next. Rejects on abort. */
    const countDown = (duration: number): Promise<void> => new Promise((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        signal.removeEventListener('abort', onAbort)
        resolverRef.current = null
        fn()
      }

      const onAbort = () => settle(() => reject(new DOMException('', 'AbortError')))
      signal.addEventListener('abort', onAbort, { once: true })

      // Manual Next resolves early
      resolverRef.current = () => settle(resolve)

      setElapsed(0)
      let accumulated = 0
      const tick = 50
      timerRef.current = setInterval(() => {
        if (pausedRef.current) return
        accumulated += tick
        setElapsed(accumulated)
        if (accumulated >= duration) settle(resolve)
      }, tick)
    })

    // ── Main loop ────────────────────────────────────────────────────

    const hasScene = !!tour.scene

    try {
      for (let i = fromStep; i < steps.length; i++) {
        if (signal.aborted) throw new DOMException('', 'AbortError')
        const step = steps[i]

        if (hasScene) {
          // Scene tour: update step first — the scene renders the mock elements
          setCurrentStep(i)
          setElapsed(0)
          await waitForPaint(signal)
        } else {
          // Live tour: navigate first, then wait for target in real DOM
          if (step.beforeStep) await onActionRef.current?.(step.beforeStep)
          await waitForTarget(step.target, signal)
          if (step.delay) {
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => reject(new DOMException('', 'AbortError'))
              signal.addEventListener('abort', onAbort, { once: true })
              setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, step.delay)
            })
          }
          await waitForPaint(signal)
          setCurrentStep(i)
          setElapsed(0)
        }

        // Guide — show tooltip, run timer or wait for user
        if (pendingNextRef.current) {
          pendingNextRef.current = false
        } else if (step.pausePoint) {
          await awaitNext()
        } else {
          await countDown(step.duration ?? DEFAULT_STEP_DURATION)
        }

        // After (live tours only — scene tours don't need actions)
        if (!hasScene && step.afterStep) await onActionRef.current?.(step.afterStep)
      }

      // Tour completed normally
      if (generationRef.current === generation) {
        updateProgress(p => ({
          ...p,
          completedTours: [...new Set([...p.completedTours, tourId])],
          lastStepIndex: { ...p.lastStepIndex, [tourId]: 0 },
        }))
      }
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') throw e
    } finally {
      // Only the most recent run cleans up UI state
      if (generationRef.current === generation) {
        setActiveTourId(null)
        setCurrentStep(0)
        setElapsed(0)
        setIsPlaying(true)
        pausedRef.current = false
        resolverRef.current = null
        pendingNextRef.current = false
        filteredStepsRef.current = []
        clearTimer()
      }
    }
  }, [clearTimer, updateProgress])

  // ── User actions ───────────────────────────────────────────────────────

  const nextStep = useCallback(() => {
    clearTimer()
    setIsPlaying(true)
    pausedRef.current = false
    if (resolverRef.current) {
      resolverRef.current()
      resolverRef.current = null
    } else {
      // No promise listening yet (still in navigate/settle) — buffer the tap
      pendingNextRef.current = true
    }
  }, [clearTimer])

  const prevStep = useCallback(() => {
    if (!activeTourId || currentStep <= 0) return
    startTour(activeTourId, currentStep - 1)
  }, [activeTourId, currentStep, startTour])

  const skipTour = useCallback(() => {
    if (!activeTourId) return
    updateProgress(p => ({
      ...p,
      skippedTours: [...new Set([...p.skippedTours, activeTourId])],
      lastStepIndex: { ...p.lastStepIndex, [activeTourId]: currentStep },
    }))
    abortRef.current?.abort()
  }, [activeTourId, currentStep, updateProgress])

  const endTour = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  const isCompleted = useCallback((tourId: string) => {
    return progress.completedTours.includes(tourId)
  }, [progress.completedTours])

  const resetAllTours = useCallback(() => {
    const empty: TourProgress = { completedTours: [], skippedTours: [], lastStepIndex: {} }
    setProgress(empty)
    saveProgress(empty)
  }, [])

  const hasSeenFirstLaunch = progress.completedTours.length > 0 || progress.skippedTours.length > 0

  return {
    // State
    activeTour,
    activeStep,
    currentStep,
    totalSteps,
    isActive: !!activeTour,
    isPlaying,
    isPausePoint,
    elapsed,
    stepDuration,
    progressPercent: stepDuration > 0 ? Math.min(elapsed / stepDuration, 1) : 0,

    // Actions
    startTour,
    nextStep,
    prevStep,
    skipTour,
    endTour,
    togglePlay,
    resetAllTours,

    // Query
    isCompleted,
    availableTours,
    hasSeenFirstLaunch,
  }
}
