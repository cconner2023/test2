import { useState, useCallback, useEffect } from 'react'
import { TourSpotlight } from './TourSpotlight'
import { TourTooltip } from './TourTooltip'
import type { TourStep } from '../../Data/tourDefinitions'

interface TourOverlayProps {
  activeStep: TourStep
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  isPausePoint: boolean
  progressPercent: number
  hidden?: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onTogglePlay: () => void
}

export function TourOverlay({
  activeStep,
  currentStep,
  totalSteps,
  isPlaying,
  isPausePoint,
  progressPercent,
  hidden = false,
  onNext,
  onPrev,
  onSkip,
  onTogglePlay,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const handleTargetRect = useCallback((rect: DOMRect | null) => {
    setTargetRect(rect)
  }, [])

  // Dismiss on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft' && currentStep > 0) onPrev()
      if (e.key === ' ') { e.preventDefault(); onTogglePlay() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onSkip, onNext, onPrev, onTogglePlay, currentStep])

  return (
    <>
      {/* Clickable backdrop — tapping dark area advances */}
      <div
        className="fixed inset-0 z-[9997]"
        onClick={onNext}
      />

      <div className={`transition-opacity duration-200 ease-out ${hidden ? 'opacity-0' : 'opacity-100'}`}>
        <TourSpotlight
          target={activeStep.target}
          onTargetRect={handleTargetRect}
        />

        <TourTooltip
          text={activeStep.text}
          placement={activeStep.placement}
          targetRect={targetRect}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isPlaying={isPlaying}
          isPausePoint={isPausePoint}
          progressPercent={progressPercent}
          isLastStep={currentStep === totalSteps - 1}
          onNext={onNext}
          onPrev={onPrev}
          onSkip={onSkip}
          onTogglePlay={onTogglePlay}
        />
      </div>
    </>
  )
}
