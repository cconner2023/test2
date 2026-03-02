import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { isPinEnabled, isSessionUnlocked, clearSessionUnlocked, initPinService } from '../lib/pinService'
import { useInactivityTimer } from '../Hooks/useInactivityTimer'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { PinLockScreen } from './PinLockScreen'
import { PasswordLockScreen } from './PasswordLockScreen'
import { SetPasswordScreen } from './SetPasswordScreen'
import { UserAcknowledgment, hasAcceptedAcknowledgment } from './UserAcknowledgment'
import { LoginScreen } from './LoginScreen'

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

/** Minimum time (ms) to hold the loading screen so the service worker can
 *  detect silent updates and reload before any content flashes. */
const SW_SETTLE_MS = 3000

export function LockGate({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth()
  const loading = useAuthStore(s => s.loading)
  const [swHold, setSwHold] = useState(true)

  // Release the hold after the settle window
  useEffect(() => {
    const id = setTimeout(() => setSwHold(false), SW_SETTLE_MS)
    return () => clearTimeout(id)
  }, [])

  const shouldLoad = loading || swHold
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)
  const needsPasswordSetup = useAuthStore(s => s.needsPasswordSetup)
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && !isSessionUnlocked())
  const [isInactivityLocked, setIsInactivityLocked] = useState(false)
  const [isInitialPasswordLocked, setIsInitialPasswordLocked] = useState(false)
  const [pinServiceReady, setPinServiceReady] = useState(false)
  const [needsAcknowledgment, setNeedsAcknowledgment] = useState(() => !hasAcceptedAcknowledgment())

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
  // 2. loading screen (z-100) — while auth + SW settle
  // 3. user acknowledgment (z-100) — PHI disclosure, every session
  // 4. login screen (z-90) — when not authenticated
  // 5. PIN lock (z-100)
  // 6. inactivity / initial password locks (z-100)
  // 7. password recovery / setup — always on top
  const showLogin = !shouldLoad && !user && !isGuest
  return (
    <>
      {children}
      {shouldLoad && <LoadingScreen />}
      {needsAcknowledgment && !shouldLoad && (
        <UserAcknowledgment onAccept={() => setNeedsAcknowledgment(false)} />
      )}
      {showLogin && <LoginScreen />}
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
      {isPasswordRecovery && <SetPasswordScreen mode="recovery" />}
      {needsPasswordSetup && !isPasswordRecovery && <SetPasswordScreen mode="setup" />}
    </>
  )
}
