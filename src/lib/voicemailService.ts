/**
 * Voicemail greeting service.
 *
 * A user's custom greeting is the operational audio a caller hears when their
 * call goes unanswered. It is NOT a 1:1 message — anyone who can call the user
 * may hear it — so it can't ride the per-recipient Signal/attachment key path.
 * Instead it is AES-256-GCM encrypted with the app-wide barcode key
 * (getBarcodeKey), which every authenticated user already caches locally, and
 * stored on profiles.voicemail_greeting as { enc, mime, dur }.
 *
 * Operational vocabulary only — no PHI (same wire invariant as chat/voice notes).
 * Not security-critical (no src/lib/signal/* involvement).
 */

import { supabase } from './supabase'
import { getBarcodeKey } from './cryptoService'
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { bytesToBase64, base64ToBytes } from './base64Utils'
import { createLogger } from '../Utilities/Logger'
import type { VoiceRecordingResult } from '../Utilities/voiceUtils'
import type { VoicemailGreeting } from '../Types/SupervisorTestTypes'
import type { Json } from '../Types/database.types.generated'

const logger = createLogger('Voicemail')

/** Encrypt + persist the signed-in user's greeting. Returns false if the
 *  barcode key is unavailable (offline cold start) or the write fails. */
export async function saveOwnGreeting(recording: VoiceRecordingResult): Promise<boolean> {
  try {
    const key = await getBarcodeKey()
    if (!key) {
      logger.warn('No barcode key available — cannot save greeting')
      return false
    }
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false

    const plainBytes = new Uint8Array(await recording.blob.arrayBuffer())
    const combined = await aesGcmEncrypt(key, plainBytes)
    const greeting: VoicemailGreeting = {
      enc: bytesToBase64(combined),
      mime: recording.mime,
      dur: Math.round(recording.duration * 10) / 10,
    }

    const { error } = await supabase
      .from('profiles')
      .update({ voicemail_greeting: greeting as unknown as Json })
      .eq('id', userId)

    if (error) {
      logger.warn('Failed to save greeting:', error.message)
      return false
    }
    return true
  } catch (e) {
    logger.warn('saveOwnGreeting error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Clear the signed-in user's greeting. */
export async function deleteOwnGreeting(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false
    const { error } = await supabase
      .from('profiles')
      .update({ voicemail_greeting: null })
      .eq('id', userId)
    if (error) {
      logger.warn('Failed to delete greeting:', error.message)
      return false
    }
    return true
  } catch (e) {
    logger.warn('deleteOwnGreeting error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Read the signed-in user's own greeting metadata (for the settings UI). */
export async function getOwnGreeting(): Promise<VoicemailGreeting | null> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('voicemail_greeting')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return (data.voicemail_greeting as VoicemailGreeting | null) ?? null
  } catch {
    return null
  }
}

/** Fetch a peer's greeting (used at call time when not already cached in
 *  peerProfiles). Goes through the same SECURITY DEFINER RPC as name/avatar. */
export async function fetchPeerGreeting(peerId: string): Promise<VoicemailGreeting | null> {
  try {
    const { data, error } = await supabase.rpc('fetch_profiles_by_ids', { user_ids: [peerId] })
    if (error || !data || data.length === 0) return null
    const row = data[0] as { voicemail_greeting: VoicemailGreeting | null }
    return row.voicemail_greeting ?? null
  } catch (e) {
    logger.warn('fetchPeerGreeting error:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Decrypt a greeting into a playable object URL. Caller revokes the URL. */
export async function decryptGreetingToUrl(greeting: VoicemailGreeting): Promise<string | null> {
  try {
    const key = await getBarcodeKey()
    if (!key) return null
    const combined = base64ToBytes(greeting.enc)
    const plain = await aesGcmDecrypt(key, combined)
    const blob = new Blob([plain as BlobPart], { type: greeting.mime || 'audio/webm' })
    return URL.createObjectURL(blob)
  } catch (e) {
    logger.warn('decryptGreetingToUrl error:', e instanceof Error ? e.message : e)
    return null
  }
}
