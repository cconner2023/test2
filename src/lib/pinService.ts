import { supabase } from './supabase'
import { hashWithSalt, verifyHash } from './cryptoUtils'
import { secureSet, secureGet, secureRemove } from './secureStorage'

const STORAGE_KEYS = {
  hash: 'adtmc_pin_hash',
  salt: 'adtmc_pin_salt',
  unlocked: 'adtmc_pin_unlocked',
  failures: 'adtmc_pin_failures',
  lockoutUntil: 'adtmc_pin_lockout_until',
  permanentLock: 'adtmc_pin_permanent_lock',
  inactivityTimeout: 'adtmc_inactivity_timeout_ms',
} as const

let _pinHash: string | null = null
let _pinSalt: string | null = null
let _pinHydrated = false

async function hydratePinCache(): Promise<void> {
  if (_pinHydrated) return
  _pinHash = await secureGet(STORAGE_KEYS.hash)
  _pinSalt = await secureGet(STORAGE_KEYS.salt)
  _pinHydrated = true
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
  return verifyHash(pin, _pinHash, _pinSalt)
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

export function isPinPermanentlyLocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.permanentLock) === 'true'
  } catch {
    return false
  }
}

export function clearPinPermanentLock(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.permanentLock)
    localStorage.removeItem(STORAGE_KEYS.failures)
    sessionStorage.removeItem(STORAGE_KEYS.lockoutUntil)
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
    if (isPinPermanentlyLocked()) {
      return { isLockedOut: true, remainingSeconds: 0, isPermanentlyLocked: true }
    }
    const until = sessionStorage.getItem(STORAGE_KEYS.lockoutUntil)
    if (!until) return { isLockedOut: false, remainingSeconds: 0 }
    const remaining = Math.ceil((parseInt(until, 10) - Date.now()) / 1000)
    if (remaining <= 0) {
      sessionStorage.removeItem(STORAGE_KEYS.lockoutUntil)
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
    const failures = parseInt(localStorage.getItem(STORAGE_KEYS.failures) || '0', 10) + 1
    localStorage.setItem(STORAGE_KEYS.failures, String(failures))

    if (failures >= 3) {
      localStorage.setItem(STORAGE_KEYS.permanentLock, 'true')
      return { isLockedOut: true, remainingSeconds: 0, isPermanentlyLocked: true }
    }

    const tierIndex = Math.min(failures - 1, LOCKOUT_TIERS.length - 1)
    const cooldown = LOCKOUT_TIERS[tierIndex]
    const until = Date.now() + cooldown * 1000
    sessionStorage.setItem(STORAGE_KEYS.lockoutUntil, String(until))
    return { isLockedOut: true, remainingSeconds: cooldown }
  } catch {
    return { isLockedOut: false, remainingSeconds: 0 }
  }
}

export function resetLockout(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.failures)
    sessionStorage.removeItem(STORAGE_KEYS.lockoutUntil)
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
}
