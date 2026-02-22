import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { isPinEnabled, isSessionUnlocked, clearSessionUnlocked, initPinService } from '../lib/pinService'
import { useInactivityTimer } from '../Hooks/useInactivityTimer'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { PinLockScreen } from './PinLockScreen'
import { PasswordLockScreen } from './PasswordLockScreen'
import { SetPasswordScreen } from './SetPasswordScreen'

const INITIAL_PW_UNLOCKED_KEY = 'adtmc_initial_pw_unlocked'

export function LockGate({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth()
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && !isSessionUnlocked())
  const [isInactivityLocked, setIsInactivityLocked] = useState(false)
  const [isInitialPasswordLocked, setIsInitialPasswordLocked] = useState(false)
  const [pinServiceReady, setPinServiceReady] = useState(false)

  useEffect(() => {
    initPinService().then(() => {
      if (isPinEnabled() && !isSessionUnlocked()) {
        setIsPinLocked(true)
      }
      setPinServiceReady(true)
    })
  }, [])

  // Initial open: require password for authenticated (non-guest) users without PIN
  // Must wait for pinServiceReady so isPinEnabled() reflects the actual stored state
  // Disabled for now — kept wired for future use
  // useEffect(() => {
  //   if (pinServiceReady && user && !isGuest && !isPinEnabled() && sessionStorage.getItem(INITIAL_PW_UNLOCKED_KEY) !== 'true') {
  //     setIsInitialPasswordLocked(true)
  //   }
  // }, [user, isGuest, pinServiceReady])

  // Re-lock when app goes to background (tab switch, app switch on mobile)
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden' && isPinEnabled() && !isPinLocked) {
        clearSessionUnlocked()
        setIsPinLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [isPinLocked])

  const handlePinUnlock = useCallback(() => {
    setIsPinLocked(false)
    setIsInactivityLocked(false)
  }, [])

  const handleInactivityTimeout = useCallback(() => {
    if (isPinEnabled()) {
      clearSessionUnlocked()
      setIsPinLocked(true)
    } else {
      setIsInactivityLocked(true)
    }
  }, [])

  useInactivityTimer({
    enabled: !!user && !isGuest && !isPinLocked && !isInactivityLocked && !isInitialPasswordLocked,
    onTimeout: handleInactivityTimeout,
  })

  return (
    <>
      {children}
      {isPinLocked && <PinLockScreen onUnlock={handlePinUnlock} />}
      {isInitialPasswordLocked && !isPinLocked && user?.email && (
        <PasswordLockScreen
          onUnlock={() => {
            sessionStorage.setItem(INITIAL_PW_UNLOCKED_KEY, 'true')
            setIsInitialPasswordLocked(false)
          }}
          email={user.email}
          reason="initial"
        />
      )}
      {isInactivityLocked && !isPinLocked && !isInitialPasswordLocked && user?.email && (
        <PasswordLockScreen onUnlock={() => setIsInactivityLocked(false)} email={user.email} reason="inactivity" />
      )}
      {useAuthStore((s) => s.isPasswordRecovery) && <SetPasswordScreen />}
    </>
  )
}
