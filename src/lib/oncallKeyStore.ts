/**
 * Device-local persistence for the wrapped on-call voicemail PRIVATE key.
 *
 * The clinic voicemail keypair is generated in the supervisor's browser; the
 * private half is wrapped to each cluster member's Signal vault identity and
 * delivered as an `oncall-key-wrap` SYSTEM message. We persist the (still-sealed)
 * envelope here keyed by clinic_id, and unwrap it lazily at voicemail play-time
 * (see src/lib/signal/oncallKeyWrap.ts). The stored blob is ciphertext sealed to
 * this device's vault identity, so localStorage is safe — NOT plaintext key
 * material. Not in `src/lib/signal/*`: this is pure persistence, no crypto.
 *
 * One credential (hence one voicemail key) per clinic is the current invariant,
 * so clinic_id is a sufficient lookup key.
 */

const KEY_PREFIX = 'oncall_vmkey_'

export function saveWrappedVoicemailKey(clinicId: string, sealedEnvelope: unknown): void {
  try {
    localStorage.setItem(KEY_PREFIX + clinicId, JSON.stringify(sealedEnvelope))
  } catch {
    /* storage full / unavailable — voicemail playback will degrade, non-fatal */
  }
}

export function getWrappedVoicemailKey(clinicId: string): unknown | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + clinicId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
