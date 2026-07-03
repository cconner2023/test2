import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { isPinEnabled, isAppLockEnabled, isSessionUnlocked, setSessionUnlocked, clearSessionUnlocked, initPinService } from '../lib/pinService'
import { useInactivityTimer } from '../Hooks/useInactivityTimer'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { PinLockScreen } from './PinLockScreen'
import { PasswordLockScreen } from './PasswordLockScreen'
import { SetPasswordScreen } from './SetPasswordScreen'
import { SessionReauthScreen } from './SessionReauthScreen'
import { UserAcknowledgment, ACK_VERSION } from './UserAcknowledgment'
import { supabase } from '../lib/supabase'
import { LoginScreen } from './LoginScreen'
import { PostLoginLoader } from './PostLoginLoader'
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

  // Dismiss the HTML splash once auth settles — but only after the React layer
  // beneath it (app children / LoginScreen / PostLoginLoader) has actually
  // PAINTED. Firing on the `loading` flip alone runs post-commit but pre-paint,
  // so the splash could start fading over a still-settling frame — that's the
  // "app flashes in at the bottom" glitch. A double-rAF waits for one committed
  // paint of the new top layer, so the fade always reveals a stable frame.
  useEffect(() => {
    if (loading) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        (window as unknown as { dismissSplash?: () => void }).dismissSplash?.()
      })
    })
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2) }
  }, [loading])

  const shouldLoad = loading
  const sessionReady = useAuthStore(s => s.sessionReady)
  const [showPostLoginLoader, setShowPostLoginLoader] = useState(false)
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)
  const needsPasswordSetup = useAuthStore(s => s.needsPasswordSetup)
  const needsReauth = useAuthStore(s => s.needsReauth)
  const vaultKeyPromptNeeded = useAuthStore(s => s.vaultKeyPromptNeeded)
  const setVaultKeyPromptNeeded = useAuthStore(s => s.setVaultKeyPromptNeeded)
  const [isPinLocked, setIsPinLocked] = useState(() => isPinEnabled() && isAppLockEnabled() && !isSessionUnlocked())
  // Password lock overlay. 'inactivity' = idle timeout with no PIN; 'locked' =
  // App Lock (tab-switch / relaunch) with no PIN — both unlock with the password.
  const [pwLock, setPwLock] = useState<'inactivity' | 'locked' | null>(null)
  const [isInitialPasswordLocked, setIsInitialPasswordLocked] = useState(false)
  const [pinServiceReady, setPinServiceReady] = useState(false)
  // PHI-disclosure acknowledgment.
  // - Authenticated users: one-time ever, persisted server-side on the profile
  //   (ackVersionAccepted >= ACK_VERSION). Survives browser-storage eviction, so
  //   it never re-fires; a content change bumps ACK_VERSION to re-prompt once.
  // - Guests: shown every open (no account to persist to); ackDismissed only
  //   suppresses re-render within the current mount after they accept.
  const ackVersionAccepted = useAuthStore(s => s.profile?.ackVersionAccepted)
  const patchProfile = useAuthStore(s => s.patchProfile)
  const [ackDismissed, setAckDismissed] = useState(false)
  const needsAcknowledgment = isGuest
    ? !ackDismissed
    : !!user && sessionReady && (ackVersionAccepted ?? 0) < ACK_VERSION

  const handleAcceptAck = useCallback(() => {
    if (user && !isGuest) {
      // Server is the source of truth; patch in-memory (flips the gate
      // immediately) then fire-and-forget the persist.
      patchProfile({ ackVersionAccepted: ACK_VERSION })
      supabase.from('profiles').update({ ack_version_accepted: ACK_VERSION }).eq('id', user.id)
        .then(({ error }) => { if (error) console.warn('[LockGate] ack persist failed', error) })
    } else {
      setAckDismissed(true)
    }
  }, [user, isGuest, patchProfile])

  useEffect(() => {
    initPinService().then(() => {
      if (isPinEnabled() && isAppLockEnabled() && !isSessionUnlocked()) {
        setIsPinLocked(true)
      }
      setPinServiceReady(true)
    })
  }, [])

  // App Lock at relaunch with NO PIN: lock to the password screen. Runs once
  // after the PIN service hydrates and auth settles (needs an email to verify).
  // Gated on startedWithSession so a *fresh* interactive login isn't immediately
  // re-prompted for the password — only a returning/restored session re-locks.
  // (PIN users are handled by the isPinLocked initializer + pinService effect.)
  const initAppLockDone = useRef(false)
  const startedWithSession = useRef(!!useAuthStore.getState().localSession || !!useAuthStore.getState().user)
  useEffect(() => {
    if (initAppLockDone.current) return
    if (!pinServiceReady || shouldLoad) return
    if (isGuest || (!user && !localSession)) return
    initAppLockDone.current = true
    if (!startedWithSession.current) return
    if (!isAppLockEnabled() || isSessionUnlocked() || isPinEnabled()) return
    setPwLock('locked')
  }, [pinServiceReady, shouldLoad, isGuest, user, localSession])

  // Tab-switch lock (immediate): the instant the app is backgrounded, drop the
  // session-unlocked flag and raise the lock so the gate is already up on return.
  // App Lock is independent of PIN — PIN screen if one exists, else password.
  useEffect(() => {
    if (isGuest || (!user && !localSession)) return
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      if (!isAppLockEnabled()) return
      clearSessionUnlocked()
      if (isPinEnabled()) setIsPinLocked(true)
      else setPwLock('locked')
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [user, localSession, isGuest])

  // Initial open: require password for authenticated (non-guest) users without PIN
  // Must wait for pinServiceReady so isPinEnabled() reflects the actual stored state
  // Disabled for now — kept wired for future use
  // useEffect(() => {
  //   if (pinServiceReady && user && !isGuest && !isPinEnabled() && sessionStorage.getItem(INITIAL_PW_UNLOCKED_KEY) !== 'true') {
  //     setIsInitialPasswordLocked(true)
  //   }
  // }, [user, isGuest, pinServiceReady])

  const handlePinUnlock = useCallback(() => {
    setIsPinLocked(false)
    setPwLock(null)
  }, [])

  const handleInactivityTimeout = useCallback(() => {
    clearSessionUnlocked()
    if (isPinEnabled()) {
      setIsPinLocked(true)
    } else {
      setPwLock('inactivity')
    }
  }, [])

  useInactivityTimer({
    enabled: (!!user || !!localSession) && !isGuest && !isPinLocked && !pwLock && !isInitialPasswordLocked,
    onTimeout: handleInactivityTimeout,
  })

  // Show the post-login loader when authenticated but session init hasn't finished
  // (first-time login only — returning users have sessionReady=true at start)
  useEffect(() => {
    if (!shouldLoad && !sessionReady && (user || localSession) && !isGuest) {
      setShowPostLoginLoader(true)
    }
  }, [shouldLoad, sessionReady, user, localSession, isGuest])

  const handlePostLoginDone = useCallback(() => setShowPostLoginLoader(false), [])

  // Gate ordering (later = on top):
  // 1. children (app) — deferred until auth settles AND session ready
  //    └─ CallOverlay (z-100) lives here — covered by auth screens via DOM order, not z-index
  // 2. post-login loader (z-9998) — first-time login: covers app until Signal + profile resolve
  // 3. user acknowledgment (z-100) — PHI disclosure (server-persisted one-time for authed users, every open for guests)
  // 4. login screen (z-90) — when not authenticated
  // 5. session reauth (z-100) — dead Supabase session with valid localSession (iOS kill, token expiry)
  // 6. PIN lock (z-100)
  // 7. inactivity / initial password locks (z-100)
  // 8. password recovery / setup — always on top (z-100, last in DOM)
  const showLogin = !shouldLoad && !user && !localSession && !isGuest
  return (
    <>
      {!shouldLoad && sessionReady && children}
      {showPostLoginLoader && <PostLoginLoader ready={sessionReady} onDone={handlePostLoginDone} />}
      {needsAcknowledgment && !shouldLoad && !isPasswordRecovery && (
        <UserAcknowledgment onAccept={handleAcceptAck} />
      )}
      {showLogin && <LoginScreen />}
      {needsReauth && !shouldLoad && !user && localSession && (
        <SessionReauthScreen email={localSession.email} />
      )}
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
      {pwLock && !isPinLocked && !isInitialPasswordLocked && (user?.email || localSession?.email) && (
        <PasswordLockScreen
          onUnlock={() => { setSessionUnlocked(); setPwLock(null) }}
          email={(user?.email ?? localSession?.email)!}
          reason={pwLock}
        />
      )}
      {/* Vault re-auth: live session resumed but the password-derived wrapping key
          isn't cached and vault messages are waiting. Blocking re-entry (replaces the
          old non-blocking VaultUnlockBanner) — verify→derive→cache→drain happens inside
          PasswordLockScreen's reason="vault" path. */}
      {vaultKeyPromptNeeded && !shouldLoad && !isPinLocked && !pwLock && !isInitialPasswordLocked && !needsReauth && (user?.email || localSession?.email) && (
        <PasswordLockScreen onUnlock={() => setVaultKeyPromptNeeded(false)} email={(user?.email ?? localSession?.email)!} reason="vault" />
      )}
      {/* Password recovery no longer renders a blocking screen here — a recovery
          OTP is now a real login, and the reset is surfaced as the non-blocking
          PasswordResetOverlay (mounted in App.tsx). Setup (new account) stays a
          blocking gate. */}
      {needsPasswordSetup && !isPasswordRecovery && <SetPasswordScreen mode="setup" />}
    </>
  )
}
