import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Check, X } from 'lucide-react'

interface TourTooltipProps {
  text: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  targetRect: DOMRect | null
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  isPausePoint: boolean
  progressPercent: number
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onTogglePlay: () => void
}

const TOOLTIP_MAX_W = 280
const TOOLTIP_GAP = 12
const VIEWPORT_PAD = 12

/** Read CSS safe-area insets (--sat / --sab set in App.css, patched in main.tsx for iOS 15). */
function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement)
  return {
    top: parseFloat(style.getPropertyValue('--sat')) || 0,
    bottom: parseFloat(style.getPropertyValue('--sab')) || 0,
  }
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export function TourTooltip({
  text,
  placement,
  targetRect,
  currentStep,
  totalSteps,
  isPlaying,
  isPausePoint,
  progressPercent,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
  onTogglePlay,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [visible, setVisible] = useState(false)

  const reposition = useCallback(() => {
    if (!targetRect || !tooltipRef.current) return

    const tt = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = 0
    let left = 0
    let actual = placement

    const calc = (p: string) => {
      switch (p) {
        case 'bottom':
          top = targetRect.bottom + TOOLTIP_GAP
          left = targetRect.left + targetRect.width / 2 - tt.width / 2
          break
        case 'top':
          top = targetRect.top - TOOLTIP_GAP - tt.height
          left = targetRect.left + targetRect.width / 2 - tt.width / 2
          break
        case 'right':
          top = targetRect.top + targetRect.height / 2 - tt.height / 2
          left = targetRect.right + TOOLTIP_GAP
          break
        case 'left':
          top = targetRect.top + targetRect.height / 2 - tt.height / 2
          left = targetRect.left - TOOLTIP_GAP - tt.width
          break
      }
    }

    calc(placement)

    // Flip if overflowing (account for safe areas on top/bottom)
    const safeArea = getSafeAreaInsets()
    const safeTop = Math.max(VIEWPORT_PAD, safeArea.top + VIEWPORT_PAD)
    const safeBottom = Math.max(VIEWPORT_PAD, safeArea.bottom + VIEWPORT_PAD)
    if (placement === 'bottom' && top + tt.height > vh - safeBottom) {
      actual = 'top'; calc('top')
    } else if (placement === 'top' && top < safeTop) {
      actual = 'bottom'; calc('bottom')
    } else if (placement === 'right' && left + tt.width > vw - VIEWPORT_PAD) {
      actual = 'left'; calc('left')
    } else if (placement === 'left' && left < VIEWPORT_PAD) {
      actual = 'right'; calc('right')
    }

    // Clamp to viewport, respecting device safe areas (notch / home indicator)
    left = clamp(left, VIEWPORT_PAD, vw - tt.width - VIEWPORT_PAD)
    top = clamp(top, safeTop, vh - tt.height - safeBottom)

    setPos({ top, left })
  }, [targetRect, placement])

  // Position after DOM paint so we measure the real tooltip size
  useLayoutEffect(() => {
    reposition()
  }, [reposition, text, currentStep])

  // Second pass after fonts/layout settle
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      reposition()
      setVisible(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [reposition, text, currentStep])

  // Reset visibility on step change
  useEffect(() => {
    setVisible(false)
  }, [currentStep])

  if (!targetRect) return null

  return (
    <div
      ref={tooltipRef}
      className={`fixed z-[9999] transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
      style={{
        top: pos.top,
        left: pos.left,
        maxWidth: TOOLTIP_MAX_W,
        width: TOOLTIP_MAX_W,
      }}
      role="dialog"
      aria-label={`Tour step ${currentStep + 1} of ${totalSteps}`}
    >
      <div className="relative bg-themewhite rounded-xl shadow-lg border border-tertiary/10">
        {/* Progress bar (auto-play countdown) */}
        {!isPausePoint && isPlaying && (
          <div className="h-0.5 bg-tertiary/10 rounded-t-xl">
            <div
              className="h-full bg-themeblue3 rounded-t-xl transition-[width] duration-75 ease-linear"
              style={{ width: `${progressPercent * 100}%` }}
            />
          </div>
        )}

        {/* Close button — top right */}
        <button
          onClick={onSkip}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-tertiary hover:text-tertiary active:scale-95 transition-all"
          aria-label="Close tour"
        >
          <X size={14} />
        </button>

        {/* Content */}
        <div className="px-4 pt-3 pb-2 pr-8">
          <p className="text-sm text-primary leading-relaxed">{text}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left: play/pause + dots */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-tertiary active:scale-95 transition-all"
              aria-label={isPlaying ? 'Pause tour' : 'Play tour'}
            >
              {isPlaying && !isPausePoint ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'w-2 h-2 bg-themeblue3'
                      : i < currentStep
                        ? 'w-1.5 h-1.5 bg-themeblue3/40'
                        : 'w-1.5 h-1.5 bg-tertiary/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right: < > nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                currentStep > 0
                  ? 'text-tertiary hover:bg-tertiary/10'
                  : 'text-tertiary pointer-events-none'
              }`}
              aria-label="Previous step"
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={onNext}
              className="w-7 h-7 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all"
              aria-label={isLastStep ? 'Finish tour' : 'Next step'}
            >
              {isLastStep ? <Check size={15} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
