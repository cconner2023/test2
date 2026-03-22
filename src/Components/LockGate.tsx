import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { isPinEnabled, isSessionUnlocked, clearSessionUnlocked, initPinService } from '../lib/pinService'
import { useInactivityTimer } from '../Hooks/useInactivityTimer'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { PinLockScreen } from './PinLockScreen'
import { PasswordLockScreen } from './PasswordLockScreen'
import { SetPasswordScreen } from './SetPasswordScreen'
import { UserAcknowledgment, hasAcceptedAcknowledgment, recordAcknowledgment } from './UserAcknowledgment'
import { LoginScreen } from './LoginScreen'
const INITIAL_PW_UNLOCKED_KEY = 'adtmc_initial_pw_unlocked'

/** Maximum time (ms) to wait for Supabase INITIAL_SESSION before releasing
 *  the loading gate. Prevents an infinite loading screen on mobile PWA if
 *  the auth event never fires (e.g. corrupted session, network stall). */
const AUTH_TIMEOUT_MS = 3000

export function LockGate({ children }: { children: ReactNode }) {
  const { user, isGuest, localSession } = useAuth()
  const loading = useAuthStore(s => s.loading)
  // Safety net: if Supabase auth never fires INITIAL_SESSION, force-release
  // the loading gate so the app doesn't stay stuck on the loading screen.
  useEffect(() => {
    const id = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        console.warn('[LockGate] Auth did not resolve within timeout, releasing loading gate')
        useAuthStore.setState({ loading: false })
      }
    }, AUTH_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [])

  // Dismiss the HTML splash once auth settles
  useEffect(() => {
    if (!loading) {
      (window as unknown as { dismissSplash?: () => void }).dismissSplash?.()
    }
  }, [loading])

  const shouldLoad = loading
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)
  const needsPasswordSetup = useAuthStore(s => s.needsPasswordSetup)
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && !isSessionUnlocked())
  const [isInactivityLocked, setIsInactivityLocked] = useState(false)
  const [isInitialPasswordLocked, setIsInitialPasswordLocked] = useState(false)
  const [pinServiceReady, setPinServiceReady] = useState(false)
  // Check both sessionStorage and localStorage on init so returning authenticated
  // users who already accepted this version skip the gate immediately.
  const [needsAcknowledgment, setNeedsAcknowledgment] = useState(() => !hasAcceptedAcknowledgment(true))

  // Once auth settles: if an authenticated user already accepted (even just in
  // sessionStorage from before login), promote to localStorage and dismiss.
  useEffect(() => {
    if (loading) return
    if (user && !isGuest && hasAcceptedAcknowledgment(true)) {
      recordAcknowledgment(true) // ensure persisted
      setNeedsAcknowledgment(false)
    }
  }, [loading, user, isGuest])

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
    enabled: (!!user || !!localSession) && !isGuest && !isPinLocked && !isInactivityLocked && !isInitialPasswordLocked,
    onTimeout: handleInactivityTimeout,
  })

  // Gate ordering (later = on top):
  // 1. children (app) — deferred until auth settles; HTML splash covers loading
  // 2. user acknowledgment (z-100) — PHI disclosure (persistent for authed users, per-session for guests)
  // 3. login screen (z-90) — when not authenticated
  // 4. PIN lock (z-100)
  // 5. inactivity / initial password locks (z-100)
  // 6. password recovery / setup — always on top
  const showLogin = !shouldLoad && !user && !localSession && !isGuest
  return (
    <>
      {!shouldLoad && children}
      {needsAcknowledgment && !shouldLoad && (
        <UserAcknowledgment
          onAccept={() => setNeedsAcknowledgment(false)}
          persistent={!!user && !isGuest}
        />
      )}
      {showLogin && <LoginScreen />}
      {isPinLocked && <PinLockScreen onUnlock={handlePinUnlock} />}
      {isInitialPasswordLocked && !isPinLocked && (user?.email || localSession?.email) && (
        <PasswordLockScreen
          onUnlock={() => {
            sessionStorage.setItem(INITIAL_PW_UNLOCKED_KEY, 'true')
            setIsInitialPasswordLocked(false)
          }}
          email={(user?.email ?? localSession?.email)!}
          reason="initial"
        />
      )}
      {isInactivityLocked && !isPinLocked && !isInitialPasswordLocked && (user?.email || localSession?.email) && (
        <PasswordLockScreen onUnlock={() => setIsInactivityLocked(false)} email={(user?.email ?? localSession?.email)!} reason="inactivity" />
      )}
      {isPasswordRecovery && <SetPasswordScreen mode="recovery" />}
      {needsPasswordSetup && !isPasswordRecovery && <SetPasswordScreen mode="setup" />}
    </>
  )
}
