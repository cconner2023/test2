import { supabase } from './supabase'
import { hashWithSalt, verifyHash, isLegacyHash } from './cryptoUtils'
import { secureSet, secureGet, secureRemove } from './secureStorage'

const STORAGE_KEYS = {
  hash: 'adtmc_pin_hash',
  salt: 'adtmc_pin_salt',
  unlocked: 'adtmc_pin_unlocked',
  failures: 'adtmc_pin_failures',
  lockoutUntil: 'adtmc_pin_lockout_until',
  permanentLock: 'adtmc_pin_permanent_lock',
  inactivityTimeout: 'adtmc_inactivity_timeout_ms',
  appLockEnabled: 'adtmc_app_lock_enabled',
} as const

let _pinHash: string | null = null
let _pinSalt: string | null = null
let _pinHydrated = false

// In-memory lockout state backed by secureStorage (tamper-resistant)
let _permanentLock = false
let _failures = 0
let _lockoutHydrated = false

async function hydratePinCache(): Promise<void> {
  if (_pinHydrated) return
  _pinHash = await secureGet(STORAGE_KEYS.hash)
  _pinSalt = await secureGet(STORAGE_KEYS.salt)
  _pinHydrated = true
}

/** Hydrate lockout state from secureStorage + localStorage into memory. */
async function hydrateLockoutCache(): Promise<void> {
  if (_lockoutHydrated) return
  try {
    const lockVal = await secureGet(STORAGE_KEYS.permanentLock)
    _permanentLock = lockVal === 'true'
    const failVal = await secureGet(STORAGE_KEYS.failures)
    _failures = failVal ? parseInt(failVal, 10) || 0 : 0
  } catch { /* secure storage unavailable, assume clean state */ }
  // Migrate legacy localStorage values to secureStorage (one-time)
  try {
    const legacyLock = localStorage.getItem(STORAGE_KEYS.permanentLock)
    if (legacyLock === 'true' && !_permanentLock) {
      _permanentLock = true
      secureSet(STORAGE_KEYS.permanentLock, 'true').catch(() => {})
    }
    const legacyFail = localStorage.getItem(STORAGE_KEYS.failures)
    if (legacyFail && _failures === 0) {
      _failures = parseInt(legacyFail, 10) || 0
      if (_failures > 0) secureSet(STORAGE_KEYS.failures, String(_failures)).catch(() => {})
    }
    // Clean up legacy entries
    localStorage.removeItem(STORAGE_KEYS.permanentLock)
    localStorage.removeItem(STORAGE_KEYS.failures)
  } catch { /* ignore */ }
  _lockoutHydrated = true
}

// --- App Lock ---

/** True when the app should auto-lock on background/inactivity (independent of PIN existence). */
export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.appLockEnabled) === 'true'
  } catch {
    return false
  }
}

export function setAppLockEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEYS.appLockEnabled, 'true')
    } else {
      localStorage.removeItem(STORAGE_KEYS.appLockEnabled)
    }
  } catch {
    // fail silently
  }
}

// --- Inactivity timeout config ---

const DEFAULT_INACTIVITY_MS = 0

export function getInactivityTimeoutMs(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.inactivityTimeout)
    if (stored === null) return DEFAULT_INACTIVITY_MS
    const ms = parseInt(stored, 10)
    return isNaN(ms) ? DEFAULT_INACTIVITY_MS : ms
  } catch {
    return DEFAULT_INACTIVITY_MS
  }
}

export function setInactivityTimeoutMs(ms: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.inactivityTimeout, String(ms))
  } catch {
    // fail silently
  }
}

// --- Hashing ---

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  return hashWithSalt(pin)
}

export async function verifyPin(pin: string): Promise<boolean> {
  await hydratePinCache()
  if (!_pinHash || !_pinSalt) return false
  const match = await verifyHash(pin, _pinHash, _pinSalt)
  // Transparently upgrade legacy SHA-256 hashes to PBKDF2 on successful verify
  if (match && isLegacyHash(_pinHash)) {
    savePin(pin).catch(() => {})
  }
  return match
}

// --- Storage ---

export async function savePin(pin: string): Promise<void> {
  try {
    const { hash, salt } = await hashWithSalt(pin)
    await secureSet(STORAGE_KEYS.hash, hash)
    await secureSet(STORAGE_KEYS.salt, salt)
    _pinHash = hash
    _pinSalt = salt
    _pinHydrated = true
  } catch {
    // Storage full or unavailable
  }
}

export function isPinEnabled(): boolean {
  return !!_pinHash && !!_pinSalt
}

export function removePin(): void {
  try {
    secureRemove(STORAGE_KEYS.hash).catch(() => {})
    secureRemove(STORAGE_KEYS.salt).catch(() => {})
    _pinHash = null
    _pinSalt = null
    _pinHydrated = true
    sessionStorage.removeItem(STORAGE_KEYS.unlocked)
    resetLockout()
    clearPinPermanentLock()
    setAppLockEnabled(false)
  } catch {
    // fail silently
  }
}

export function getStoredPin(): { hash: string; salt: string } | null {
  if (_pinHash && _pinSalt) return { hash: _pinHash, salt: _pinSalt }
  return null
}

// --- Session unlock ---

export function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.unlocked) === 'true'
  } catch {
    return false
  }
}

export function setSessionUnlocked(): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.unlocked, 'true')
  } catch {
    // fail silently
  }
}

export function clearSessionUnlocked(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.unlocked)
  } catch {
    // fail silently
  }
}

// --- Permanent lock (3 failed attempts across reloads) ---
// In-memory flag backed by secureStorage — cannot be cleared via DevTools.

export function isPinPermanentlyLocked(): boolean {
  return _permanentLock
}

export function clearPinPermanentLock(): void {
  _permanentLock = false
  _failures = 0
  secureRemove(STORAGE_KEYS.permanentLock).catch(() => {})
  secureRemove(STORAGE_KEYS.failures).catch(() => {})
  try {
    localStorage.removeItem(STORAGE_KEYS.lockoutUntil)
    // Clean up any legacy entries
    localStorage.removeItem(STORAGE_KEYS.permanentLock)
    localStorage.removeItem(STORAGE_KEYS.failures)
  } catch {
    // fail silently
  }
}

// --- Lockout ---

interface LockoutState {
  isLockedOut: boolean
  remainingSeconds: number
  isPermanentlyLocked?: boolean
}

export function checkLockout(): LockoutState {
  try {
    if (_permanentLock) {
      return { isLockedOut: true, remainingSeconds: 0, isPermanentlyLocked: true }
    }
    // Cooldown stored in localStorage for cross-tab visibility
    const until = localStorage.getItem(STORAGE_KEYS.lockoutUntil)
    if (!until) return { isLockedOut: false, remainingSeconds: 0 }
    const remaining = Math.ceil((parseInt(until, 10) - Date.now()) / 1000)
    if (remaining <= 0) {
      localStorage.removeItem(STORAGE_KEYS.lockoutUntil)
      return { isLockedOut: false, remainingSeconds: 0 }
    }
    return { isLockedOut: true, remainingSeconds: remaining }
  } catch {
    return { isLockedOut: false, remainingSeconds: 0 }
  }
}

const LOCKOUT_TIERS = [30, 60, 120, 240, 300]

export function recordFailedAttempt(): LockoutState {
  try {
    _failures++
    // Persist to secureStorage (fire-and-forget, tamper-resistant)
    secureSet(STORAGE_KEYS.failures, String(_failures)).catch(() => {})

    if (_failures >= 3) {
      _permanentLock = true
      secureSet(STORAGE_KEYS.permanentLock, 'true').catch(() => {})
      return { isLockedOut: true, remainingSeconds: 0, isPermanentlyLocked: true }
    }

    const tierIndex = Math.min(_failures - 1, LOCKOUT_TIERS.length - 1)
    const cooldown = LOCKOUT_TIERS[tierIndex]
    const until = Date.now() + cooldown * 1000
    // Cooldown in localStorage for cross-tab enforcement
    localStorage.setItem(STORAGE_KEYS.lockoutUntil, String(until))
    return { isLockedOut: true, remainingSeconds: cooldown }
  } catch {
    return { isLockedOut: false, remainingSeconds: 0 }
  }
}

export function resetLockout(): void {
  _failures = 0
  secureRemove(STORAGE_KEYS.failures).catch(() => {})
  try {
    localStorage.removeItem(STORAGE_KEYS.lockoutUntil)
    // Clean up legacy entries
    localStorage.removeItem(STORAGE_KEYS.failures)
  } catch {
    // fail silently
  }
}

// --- Cloud sync (best-effort, fire-and-forget) ---

export async function syncPinToCloud(hash: string, salt: string): Promise<void> {
  try {
    await supabase.rpc('update_own_security_settings', {
      p_pin_hash: hash,
      p_pin_salt: salt,
    })
  } catch {
    // best-effort
  }
}

export async function clearPinFromCloud(): Promise<void> {
  try {
    await supabase.rpc('clear_own_pin')
  } catch {
    // best-effort
  }
}

export async function hydrateFromCloud(hash: string, salt: string): Promise<void> {
  try {
    await secureSet(STORAGE_KEYS.hash, hash)
    await secureSet(STORAGE_KEYS.salt, salt)
    _pinHash = hash
    _pinSalt = salt
    _pinHydrated = true
  } catch {
    // secure storage unavailable
  }
}

export async function initPinService(): Promise<void> {
  await hydratePinCache()
  await hydrateLockoutCache()
  // Migration: existing users with a PIN had implicit app lock — preserve that behavior.
  try {
    if (_pinHash && _pinSalt && localStorage.getItem(STORAGE_KEYS.appLockEnabled) === null) {
      localStorage.setItem(STORAGE_KEYS.appLockEnabled, 'true')
    }
  } catch { /* ignore */ }
}
