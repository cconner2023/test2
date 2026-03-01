import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { isPinEnabled, isSessionUnlocked, clearSessionUnlocked, initPinService } from '../lib/pinService'
import { useInactivityTimer } from '../Hooks/useInactivityTimer'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { PinLockScreen } from './PinLockScreen'
import { PasswordLockScreen } from './PasswordLockScreen'
import { SetPasswordScreen } from './SetPasswordScreen'
import { UserAcknowledgment, hasAcceptedAcknowledgment } from './UserAcknowledgment'

const INITIAL_PW_UNLOCKED_KEY = 'adtmc_initial_pw_unlocked'

/** Full-screen loading overlay matching the HTML splash style */
function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-themewhite dark:bg-[rgba(25,35,45,1)]">
      <svg className="w-16 h-16 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(20,20)">
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-[rgba(0,66,92,1)]" />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-[rgba(0,66,92,1)]" transform="rotate(60)" />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-[rgba(0,66,92,1)]" transform="rotate(120)" />
        </g>
      </svg>
      <div className="mt-4 font-semibold text-lg tracking-[2px] text-[rgba(0,66,92,1)] dark:text-[rgba(129,161,181,1)]">
        ADTMC
      </div>
    </div>
  )
}

export function LockGate({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth()
  const loading = useAuthStore(s => s.loading)
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && !isSessionUnlocked())
  const [isInactivityLocked, setIsInactivityLocked] = useState(false)
  const [isInitialPasswordLocked, setIsInitialPasswordLocked] = useState(false)
  const [pinServiceReady, setPinServiceReady] = useState(false)
  const [needsAcknowledgment, setNeedsAcknowledgment] = useState(false)

  // Show acknowledgment for authenticated (non-guest) users who haven't accepted yet
  useEffect(() => {
    if (user && !isGuest && !hasAcceptedAcknowledgment()) {
      setNeedsAcknowledgment(true)
    } else {
      setNeedsAcknowledgment(false)
    }
  }, [user, isGuest])

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

  // Gate ordering (later = on top):
  // 1. children (app)
  // 2. loading screen — base gate while auth initializes
  // 3. PIN lock
  // 4. inactivity / initial password locks
  // 5. user acknowledgment (guarded by !isPasswordRecovery so it doesn't stack)
  // 6. password recovery — always on top
  return (
    <>
      {children}
      {loading && <LoadingScreen />}
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
      {needsAcknowledgment && !isPasswordRecovery && !isPinLocked && !isInitialPasswordLocked && !isInactivityLocked && (
        <UserAcknowledgment onAccept={() => setNeedsAcknowledgment(false)} />
      )}
      {isPasswordRecovery && <SetPasswordScreen />}
    </>
  )
}
