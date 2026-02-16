// PIN Lock Service — device-level security gate
// Uses Web Crypto API for SHA-256 hashing (no external deps)
// Stores hash+salt in localStorage, unlock flag in sessionStorage

const STORAGE_KEYS = {
  hash: 'adtmc_pin_hash',
  salt: 'adtmc_pin_salt',
  unlocked: 'adtmc_pin_unlocked',
  failures: 'adtmc_pin_failures',
  lockoutUntil: 'adtmc_pin_lockout_until',
} as const

// --- Hashing ---

export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const data = new Uint8Array([...salt, ...encoder.encode(pin)])
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getStoredPin()
  if (!stored) return false
  const saltArray = new Uint8Array(stored.salt.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const hash = await hashPin(pin, saltArray)
  return hash === stored.hash
}

// --- Storage ---

export async function savePin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash = await hashPin(pin, salt)
  try {
    localStorage.setItem(STORAGE_KEYS.hash, hash)
    localStorage.setItem(STORAGE_KEYS.salt, saltHex)
  } catch {
    // Storage full or unavailable — fail silently matching existing patterns
  }
}

export function isPinEnabled(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEYS.hash) && !!localStorage.getItem(STORAGE_KEYS.salt)
  } catch {
    return false
  }
}

export function removePin(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.hash)
    localStorage.removeItem(STORAGE_KEYS.salt)
    sessionStorage.removeItem(STORAGE_KEYS.unlocked)
    resetLockout()
  } catch {
    // fail silently
  }
}

export function getStoredPin(): { hash: string; salt: string } | null {
  try {
    const hash = localStorage.getItem(STORAGE_KEYS.hash)
    const salt = localStorage.getItem(STORAGE_KEYS.salt)
    if (hash && salt) return { hash, salt }
    return null
  } catch {
    return null
  }
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

// --- Lockout ---

interface LockoutState {
  isLockedOut: boolean
  remainingSeconds: number
}

export function checkLockout(): LockoutState {
  try {
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

export function recordFailedAttempt(): LockoutState {
  try {
    const failures = parseInt(sessionStorage.getItem(STORAGE_KEYS.failures) || '0', 10) + 1
    sessionStorage.setItem(STORAGE_KEYS.failures, String(failures))

    if (failures >= 5) {
      // Escalating cooldown: 30s at 5 failures, doubles each 5, caps at 300s
      const tier = Math.floor((failures - 5) / 5)
      const cooldown = Math.min(30 * Math.pow(2, tier), 300)
      const until = Date.now() + cooldown * 1000
      sessionStorage.setItem(STORAGE_KEYS.lockoutUntil, String(until))
      return { isLockedOut: true, remainingSeconds: cooldown }
    }
    return { isLockedOut: false, remainingSeconds: 0 }
  } catch {
    return { isLockedOut: false, remainingSeconds: 0 }
  }
}

export function resetLockout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.failures)
    sessionStorage.removeItem(STORAGE_KEYS.lockoutUntil)
  } catch {
    // fail silently
  }
}
