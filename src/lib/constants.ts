export const SYNC = {
  MAX_RETRIES: 5,
  BATCH_SIZE: 20,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
  PERIODIC_CHECK_MS: 30000,
} as const

export const SECURITY = {
  MIN_PASSWORD_LENGTH: 12,
  SALT_BYTES: 16,
  PIN_MAX_ATTEMPTS: 3,
  LOCKOUT_BASE_SECONDS: 30,
  LOCKOUT_MAX_SECONDS: 300,
} as const

/** Validate password meets complexity requirements.
 *  Returns null if valid, or an error message string. */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < SECURITY.MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${SECURITY.MIN_PASSWORD_LENGTH} characters`
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character'
  }
  return null
}

export const STORAGE = {
  DB_VERSION: 3,
  SYNC_CLEANUP_DAYS: 7,
} as const

export const SIGNAL = {
  /** Number of one-time pre-keys to generate per batch. */
  PREKEY_BATCH_SIZE: 100,
  /** Signed pre-key rotation interval (days). */
  SIGNED_PREKEY_ROTATION_DAYS: 7,
  /** ECDH / ECDSA curve for all Signal Protocol key operations. */
  CURVE: 'P-256',
  /** Max messages to skip in a chain for out-of-order delivery.
   *  Prevents DoS via malicious headers with huge message numbers. */
  MAX_SKIP: 256,
  /** Maximum number of devices a single user can register. */
  MAX_DEVICES_PER_USER: 10,
  /** Devices with no activity for this many days may be pruned. */
  STALE_DEVICE_DAYS: 90,
  /** Signed pre-keys older than this (days) are pruned on init. */
  SIGNED_PREKEY_MAX_AGE_DAYS: 30,
  /** Max messages to include in a server-side backup. */
  BACKUP_MAX_MESSAGES: 5000,
  /** Max compressed backup size in bytes before halving message count. */
  BACKUP_MAX_BYTES: 5_000_000,
  /** Debounce interval (ms) before creating a backup after message save. */
  BACKUP_DEBOUNCE_MS: 30_000,
  /** PBKDF2 iteration count for backup encryption key derivation. */
  BACKUP_PBKDF2_ITERATIONS: 600_000,
} as const
