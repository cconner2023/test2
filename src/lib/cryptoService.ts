/**
 * Shared clinic encryption service for PHI/PII at rest.
 *
 * Uses Web Crypto API (AES-256-GCM) with shared clinic-level keys.
 * Each clinic has a single encryption key stored in Supabase
 * (clinics.encryption_key), accessible to all clinic members via RLS.
 * Keys are cached locally in IndexedDB for offline operation.
 *
 * Design principles:
 * - Guest users bypass encryption entirely (no PHI to protect)
 * - Encryption is idempotent: already-encrypted fields (enc.v1: prefix)
 *   are not re-encrypted, allowing reconciliation to store server
 *   ciphertext without double-encryption
 * - Decryption gracefully handles plaintext (legacy pre-encryption data)
 * - All members of a clinic share the same encryption key
 * - Clinic notes fetched from the server can be decrypted by any clinic member
 * - Keys are cached in IndexedDB for offline access after initial fetch
 * - If the clinic key is unavailable (offline + never cached), encryption
 *   is skipped gracefully; notes are stored plaintext until the key
 *   is fetched on next online session
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import type { LocalNote } from './offlineDb'

const logger = createLogger('CryptoService')

// ---- Constants ----

/** Prefix marking a field value as encrypted. Enables idempotent
 *  encrypt (skip if prefixed) and graceful decrypt (skip if not). */
const ENCRYPTED_PREFIX = 'enc.v1:'

/** Fields containing PHI/PII that get encrypted for authenticated users.
 *  Non-identifying fields (id, user_id, timestamps, disposition_type,
 *  symptom_icon, _sync_status, etc.) stay plaintext for indexing. */
const SENSITIVE_FIELDS: ReadonlyArray<keyof LocalNote> = [
  'display_name',   // PII — identifies the provider
  'rank',           // PII — military rank
  'uic',            // PII — Unit Identification Code
  'hpi_encoded',    // PHI — clinical narrative
  'preview_text',   // PHI — contains HPI excerpt
  'clinic_name',    // Could identify unit/location
] as const

// ---- Key Store (separate IDB database) ----

interface KeyStoreDB extends DBSchema {
  keys: {
    key: string       // "clinic:<clinicId>"
    value: CryptoKey   // AES-256-GCM, non-extractable
  }
}

const KEY_DB_NAME = 'packagebackend-keystore'
const KEY_DB_VERSION = 1

let keyDbInstance: IDBPDatabase<KeyStoreDB> | null = null

async function getKeyDb(): Promise<IDBPDatabase<KeyStoreDB>> {
  if (keyDbInstance) return keyDbInstance

  keyDbInstance = await openDB<KeyStoreDB>(KEY_DB_NAME, KEY_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys')
      }
    },
  })

  return keyDbInstance
}

// ---- In-Memory Key Cache ----

const keyCache = new Map<string, CryptoKey>()

function storeKey(clinicId: string): string {
  return `clinic:${clinicId}`
}

// ---- Base64 Helpers ----

/** Encode a Uint8Array to base64 string. Avoids spread operator
 *  to prevent stack overflow on large payloads. */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Decode a base64 string to Uint8Array. */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ---- Key Management ----

/** Import raw key bytes as a non-extractable AES-256-GCM CryptoKey.
 *  After import the raw bytes are discarded; the browser's crypto
 *  subsystem holds the key material and JS can only use the handle. */
async function importKey(rawKeyBase64: string): Promise<CryptoKey> {
  const keyBytes = base64ToUint8(rawKeyBase64)
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — key material stays in browser crypto subsystem
    ['encrypt', 'decrypt']
  )
}

/** Generate a new 256-bit random key and return as base64.
 *  Used when creating a new clinic — the base64 string is stored
 *  in the clinics.encryption_key column on Supabase. */
export function generateClinicKeyBase64(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  return uint8ToBase64(keyBytes)
}

/** Load a clinic key from the local IDB key store (offline cache). */
async function loadKeyFromStore(clinicId: string): Promise<CryptoKey | null> {
  try {
    const db = await getKeyDb()
    const key = await db.get('keys', storeKey(clinicId))
    return key ?? null
  } catch (err) {
    logger.warn('Failed to load clinic key from store:', err)
    return null
  }
}

/** Save a clinic key to the local IDB key store for offline access. */
async function saveKeyToStore(clinicId: string, key: CryptoKey): Promise<void> {
  const db = await getKeyDb()
  await db.put('keys', key, storeKey(clinicId))
}

/** Fetch a clinic's raw encryption key from Supabase. */
async function fetchClinicKeyFromServer(clinicId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('encryption_key')
      .eq('id', clinicId)
      .single()

    if (error || !data?.encryption_key) {
      logger.warn(`Failed to fetch encryption key for clinic ${clinicId}:`, error?.message)
      return null
    }

    return data.encryption_key as string
  } catch (err) {
    logger.warn('Failed to fetch clinic encryption key:', err)
    return null
  }
}

/**
 * Get the encryption key for a clinic.
 * Checks: memory cache → IDB key store → Supabase (in that order).
 * Returns null if the key cannot be obtained (offline + never cached).
 */
async function getClinicKey(clinicId: string): Promise<CryptoKey | null> {
  // 1. Check memory cache (fastest)
  const cached = keyCache.get(clinicId)
  if (cached) return cached

  // 2. Check IDB key store (works offline)
  const stored = await loadKeyFromStore(clinicId)
  if (stored) {
    keyCache.set(clinicId, stored)
    return stored
  }

  // 3. Fetch from Supabase (requires network)
  const rawKeyBase64 = await fetchClinicKeyFromServer(clinicId)
  if (!rawKeyBase64) return null

  // 4. Import as non-extractable CryptoKey
  const cryptoKey = await importKey(rawKeyBase64)

  // 5. Cache in memory + IDB for future use
  keyCache.set(clinicId, cryptoKey)
  await saveKeyToStore(clinicId, cryptoKey)

  return cryptoKey
}

/**
 * Prefetch and cache the clinic key for offline readiness.
 * Call this during app initialization when the user's clinic is known.
 */
export async function prefetchClinicKey(clinicId: string): Promise<void> {
  const key = await getClinicKey(clinicId)
  if (key) {
    logger.info('Clinic encryption key cached for offline use')
  } else {
    logger.warn('Could not prefetch clinic encryption key')
  }
}

/**
 * Prefetch keys for multiple clinics (own clinic + child clinics).
 * Fetches in parallel for speed.
 */
export async function prefetchClinicKeys(clinicIds: string[]): Promise<void> {
  await Promise.all(clinicIds.map((id) => getClinicKey(id)))
}

// ---- Determine Encryption Clinic ----

/**
 * Get the effective clinic ID for encryption/decryption of a note.
 * Uses clinic_id if set, otherwise falls back to visible_clinic_ids[0]
 * (the importer's clinic for imported notes).
 */
function getEffectiveClinicId(
  note: { clinic_id?: string | null; visible_clinic_ids?: string[] }
): string | null {
  return note.clinic_id || note.visible_clinic_ids?.[0] || null
}

// ---- Field-Level Encrypt/Decrypt ----

/** Check if a string value is already encrypted. */
function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}

/** Encrypt a single string field. Returns `enc.v1:<base64(IV + ciphertext)>`. */
async function encryptField(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  // Concatenate IV (12 bytes) + ciphertext for self-contained storage
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(cipherBuffer), iv.length)

  return ENCRYPTED_PREFIX + uint8ToBase64(combined)
}

/** Decrypt a single field. Handles both encrypted (enc.v1: prefix)
 *  and plaintext (legacy) values gracefully. */
async function decryptField(key: CryptoKey, value: string): Promise<string> {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value // Plaintext (pre-encryption era), return as-is
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const combined = base64ToUint8(payload)

  // First 12 bytes are the IV, rest is ciphertext
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(plainBuffer)
}

// ---- Note-Level Encrypt/Decrypt ----

/**
 * Encrypt sensitive fields of a note before storing in IndexedDB.
 *
 * Idempotent: fields already carrying the enc.v1: prefix are skipped,
 * so server-reconciled notes (already ciphertext) pass through safely.
 * Guest notes and notes without a clinic context are returned unchanged.
 */
export async function encryptNote(note: LocalNote): Promise<LocalNote> {
  if (note.user_id === 'guest') return note

  const clinicId = getEffectiveClinicId(note)
  if (!clinicId) {
    logger.debug('No clinic context for note, skipping encryption')
    return note
  }

  const key = await getClinicKey(clinicId)
  if (!key) {
    logger.warn('Clinic key not available, skipping encryption')
    return note
  }

  const encrypted = { ...note }

  for (const field of SENSITIVE_FIELDS) {
    const value = encrypted[field]
    if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
      encrypted[field] = await encryptField(key, value) as never
    }
  }

  return encrypted
}

/**
 * Decrypt sensitive fields of a note after reading from IndexedDB.
 *
 * Handles both encrypted fields (enc.v1: prefix) and legacy plaintext
 * gracefully. If the clinic key is unavailable, returns the note as-is
 * with a warning.
 */
export async function decryptNote(note: LocalNote): Promise<LocalNote> {
  if (note.user_id === 'guest') return note

  // Check if any field is actually encrypted before loading the key
  const hasEncryptedFields = SENSITIVE_FIELDS.some((field) => {
    const val = note[field]
    return typeof val === 'string' && isEncrypted(val)
  })
  if (!hasEncryptedFields) return note

  const clinicId = getEffectiveClinicId(note)
  if (!clinicId) {
    logger.warn('Cannot decrypt note: no clinic context')
    return note
  }

  const key = await getClinicKey(clinicId)
  if (!key) {
    logger.warn('Cannot decrypt note: clinic key not available')
    return note
  }

  const decrypted = { ...note }

  for (const field of SENSITIVE_FIELDS) {
    const value = decrypted[field]
    if (typeof value === 'string' && value.length > 0) {
      try {
        decrypted[field] = await decryptField(key, value) as never
      } catch (err) {
        // Field may be corrupted or from a different key — leave as-is
        logger.warn(`Failed to decrypt field "${field}" on note ${note.id}:`, err)
      }
    }
  }

  return decrypted
}

/**
 * Decrypt multiple notes in parallel for batch reads.
 */
export async function decryptNotes(notes: LocalNote[]): Promise<LocalNote[]> {
  return Promise.all(notes.map(decryptNote))
}

/**
 * Decrypt sensitive fields on a raw server note row.
 *
 * Used for:
 * - Clinic notes fetched via RPC (fetchClinicNotesFromServer)
 * - Realtime payloads from Supabase Realtime
 *
 * Works with any object shape that has the standard note field names.
 * Returns a new object with decrypted fields.
 */
export async function decryptServerNoteRow<T extends Record<string, unknown>>(
  row: T,
  clinicIdHint?: string | null
): Promise<T> {
  const effectiveClinicId =
    clinicIdHint ||
    (row.clinic_id as string | null) ||
    ((row.visible_clinic_ids as string[] | undefined)?.[0]) ||
    null

  if (!effectiveClinicId) return row

  // Quick check: any fields actually encrypted?
  const hasEncrypted = SENSITIVE_FIELDS.some((f) => {
    const v = row[f as string]
    return typeof v === 'string' && isEncrypted(v)
  })
  if (!hasEncrypted) return row

  const key = await getClinicKey(effectiveClinicId)
  if (!key) return row

  const decrypted = { ...row }
  for (const field of SENSITIVE_FIELDS) {
    const value = decrypted[field as string]
    if (typeof value === 'string' && value.length > 0) {
      try {
        ;(decrypted as Record<string, unknown>)[field as string] =
          await decryptField(key, value)
      } catch (err) {
        logger.warn(`Failed to decrypt server note field "${field}":`, err)
      }
    }
  }

  return decrypted
}

// ---- Clinic Table Field Encryption ----
// Used for encrypting fields on the clinics table itself (e.g., location).
// These use the raw key base64 string directly because during create/list
// operations we have the raw key from the Supabase row but may not have
// cached the CryptoKey yet.

/**
 * Encrypt a single field value using a raw key (base64-encoded).
 * Used when creating a clinic (key generated but not yet cached).
 * Returns the value unchanged if null/empty.
 */
export async function encryptWithRawKey(
  rawKeyBase64: string,
  plaintext: string | null
): Promise<string | null> {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext
  const key = await importKey(rawKeyBase64)
  return encryptField(key, plaintext)
}

/**
 * Decrypt a single field value using a raw key (base64-encoded).
 * Used when listing clinics (raw key available on the row).
 * Handles plaintext gracefully (returns as-is if no enc.v1: prefix).
 */
export async function decryptWithRawKey(
  rawKeyBase64: string,
  ciphertext: string | null
): Promise<string | null> {
  if (!ciphertext) return ciphertext
  if (!isEncrypted(ciphertext)) return ciphertext
  const key = await importKey(rawKeyBase64)
  return decryptField(key, ciphertext)
}

/**
 * Encrypt a field value using a cached clinic key (by clinic ID).
 * Used when updating a clinic (key already fetched).
 */
export async function encryptClinicField(
  clinicId: string,
  plaintext: string | null
): Promise<string | null> {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext
  const key = await getClinicKey(clinicId)
  if (!key) {
    logger.warn('Cannot encrypt clinic field: key not available')
    return plaintext
  }
  return encryptField(key, plaintext)
}

// ---- Key Store Cleanup ----

/**
 * Clear the crypto key store. Called on intentional sign-out
 * alongside clearAllUserData() to ensure no key material persists
 * after the user leaves the device.
 */
export async function clearKeyStore(): Promise<void> {
  try {
    keyCache.clear()
    const db = await getKeyDb()
    const tx = db.transaction('keys', 'readwrite')
    await tx.objectStore('keys').clear()
    await tx.done
    logger.info('Cleared crypto key store')
  } catch (err) {
    logger.warn('Failed to clear crypto key store:', err)
  }
}

// ---- Key Rotation Scaffolding ----

export async function rotateClinicKey(
  clinicId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const oldRawKey = await fetchClinicKeyFromServer(clinicId)
    if (!oldRawKey) {
      return { success: false, error: 'Could not fetch current clinic key' }
    }

    const newRawKeyBase64 = generateClinicKeyBase64()

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ encryption_key: newRawKeyBase64 })
      .eq('id', clinicId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    const newCryptoKey = await importKey(newRawKeyBase64)
    keyCache.set(clinicId, newCryptoKey)
    await saveKeyToStore(clinicId, newCryptoKey)

    logger.info(`Rotated encryption key for clinic ${clinicId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Key rotation failed:', message)
    return { success: false, error: message }
  }
}

export async function reencryptNote(
  note: { hpi_encoded: string },
  oldKeyBase64: string,
  newKeyBase64: string
): Promise<string> {
  const oldKey = await importKey(oldKeyBase64)
  const plaintext = await decryptField(oldKey, note.hpi_encoded)
  const newKey = await importKey(newKeyBase64)
  return encryptField(newKey, plaintext)
}
