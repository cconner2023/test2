import { useState, useEffect, useRef } from 'react'
import { checkLockout } from '../lib/pinService'

/**
 * Shared hook for PIN lockout countdown timer.
 * Used by PinLockScreen and PinSetupPanel to avoid duplicating
 * the setInterval-based countdown logic.
 */
export function usePinLockoutTimer() {
  const [lockout, setLockout] = useState(checkLockout())
  const [error, setError] = useState('')
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!lockout.isLockedOut || lockout.isPermanentlyLocked) {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      return
    }

    lockoutTimerRef.current = setInterval(() => {
      const state = checkLockout()
      setLockout(state)
      if (!state.isLockedOut) {
        setError('')
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      }
    }, 1000)

    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [lockout.isLockedOut, lockout.isPermanentlyLocked])

  return { lockout, setLockout, error, setError }
}
