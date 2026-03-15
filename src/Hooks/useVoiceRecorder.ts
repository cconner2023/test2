import { useState, useRef, useEffect, useCallback } from 'react'
import { startRecording as startRecordingUtil } from '../Utilities/voiceUtils'
import type { VoiceRecordingResult } from '../Utilities/voiceUtils'

export type { VoiceRecordingResult }

const MAX_DURATION_S = 120

export interface UseVoiceRecorderReturn {
  isRecording: boolean
  duration: number
  amplitude: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<VoiceRecordingResult | null>
  cancelRecording: () => void
}

type RecordingController = Awaited<ReturnType<typeof startRecordingUtil>>

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [amplitude, setAmplitude] = useState(0)

  const controllerRef = useRef<RecordingController | null>(null)
  const rafIdRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopRafLoop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }
  }, [])

  const clearMaxTimeout = useCallback(() => {
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
  }, [])

  const resetState = useCallback(() => {
    stopRafLoop()
    clearMaxTimeout()
    setIsRecording(false)
    setDuration(0)
    setAmplitude(0)
    controllerRef.current = null
  }, [stopRafLoop, clearMaxTimeout])

  const stopRecording = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    const controller = controllerRef.current
    if (!controller) return null

    stopRafLoop()
    clearMaxTimeout()
    const result = await controller.stop()
    setIsRecording(false)
    setDuration(0)
    setAmplitude(0)
    controllerRef.current = null
    return result
  }, [stopRafLoop, clearMaxTimeout])

  const startRafLoop = useCallback(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      setDuration(elapsed)
      const controller = controllerRef.current
      if (controller) {
        setAmplitude(controller.getAmplitude())
      }
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  const handleStartRecording = useCallback(async () => {
    if (controllerRef.current) return

    const controller = await startRecordingUtil()
    controllerRef.current = controller
    startTimeRef.current = Date.now()
    setIsRecording(true)
    setDuration(0)
    setAmplitude(0)
    startRafLoop()

    maxTimeoutRef.current = setTimeout(() => {
      stopRecording()
    }, MAX_DURATION_S * 1000)
  }, [startRafLoop, stopRecording])

  const cancelRecording = useCallback(() => {
    const controller = controllerRef.current
    if (controller) {
      controller.cancel()
    }
    resetState()
  }, [resetState])

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.cancel()
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current)
      }
    }
  }, [])

  return {
    isRecording,
    duration,
    amplitude,
    startRecording: handleStartRecording,
    stopRecording,
    cancelRecording,
  }
}
