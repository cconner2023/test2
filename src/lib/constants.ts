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
} as const
