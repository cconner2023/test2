import { useState, useRef, useEffect } from 'react'
import { Camera, X, CheckCircle2 } from 'lucide-react'
import { openCamera, closeCamera, captureFrame } from '../../lib/vision/camera'
import { extractFingerprint } from '../../lib/vision/fingerprint'
import type { VisualFingerprint } from '../../Types/PropertyTypes'

interface EnrollScanStepProps {
  itemId: string
  itemName: string
  onEnrolled: (fingerprint: VisualFingerprint) => void
  onSkip: () => void
}

type EnrollPhase = 'initial' | 'camera' | 'processing' | 'done'

export function EnrollScanStep({ itemName, onEnrolled, onSkip }: EnrollScanStepProps) {
  const [phase, setPhase] = useState<EnrollPhase>('initial')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fingerprintRef = useRef<VisualFingerprint | null>(null)

  // Auto-call onEnrolled once done phase is reached
  useEffect(() => {
    if (phase === 'done' && fingerprintRef.current) {
      const timer = setTimeout(() => {
        onEnrolled(fingerprintRef.current!)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [phase, onEnrolled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) closeCamera(streamRef.current)
    }
  }, [])

  async function handleScanNow() {
    try {
      const stream = await openCamera()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('camera')
    } catch {
      // Camera denied or unavailable — stay on initial
    }
  }

  async function handleCapture() {
    if (!videoRef.current) return
    setPhase('processing')

    const imageData = captureFrame(videoRef.current)

    if (streamRef.current) closeCamera(streamRef.current)
    streamRef.current = null

    const fingerprint = extractFingerprint(imageData, [])
    fingerprintRef.current = fingerprint
    setPhase('done')
  }

  function handleCancel() {
    if (streamRef.current) {
      closeCamera(streamRef.current)
      streamRef.current = null
    }
    setPhase('initial')
  }

  if (phase === 'initial') {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-6">
        <div className="w-14 h-14 rounded-full bg-themeblue3/10 flex items-center justify-center">
          <Camera size={28} className="text-themeblue2" />
        </div>

        <div className="text-center">
          <p className="font-bold text-primary text-sm">{itemName}</p>
          <p className="text-[10pt] text-secondary mt-1">Scan item to enable visual ID</p>
        </div>

        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={handleScanNow}
            className="w-full py-3 rounded-full bg-themeblue3 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
          >
            Scan Now
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3 rounded-full text-secondary font-medium text-sm active:scale-95 transition-all"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'camera') {
    return (
      <div className="relative flex flex-col items-center">
        <div className="relative w-full" style={{ aspectRatio: '1' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-2xl bg-black"
            playsInline
            muted
          />

          {/* Cancel button */}
          <button
            onClick={handleCancel}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center active:scale-95 transition-all"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Capture button */}
        <div className="flex justify-center mt-4 pb-2">
          <button
            onClick={handleCapture}
            className="w-16 h-16 rounded-full bg-themeblue3 flex items-center justify-center shadow-lg active:scale-95 transition-all"
          >
            <Camera size={24} className="text-white" />
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <svg
          className="w-8 h-8 animate-spin text-themeblue2"
          style={{ animationDuration: '1s' }}
          viewBox="0 0 40 40"
          fill="none"
        >
          <g transform="translate(20,20)">
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(60)" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(120)" />
          </g>
        </svg>
        <p className="text-sm text-secondary">Analyzing...</p>
      </div>
    )
  }

  // done
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8">
      <CheckCircle2 size={40} className="text-themegreen" />
      <p className="text-sm font-semibold text-primary">Visual ID enrolled</p>
    </div>
  )
}
