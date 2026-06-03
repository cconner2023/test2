import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic, AvatarBlob, VoicemailGreeting } from '../Types/SupervisorTestTypes'

const logger = createLogger('PeerLookup')

/**
 * Resolve a single user's public profile by their user id (the "user code" /
 * user QR payload is the bare profiles.id UUID — see ProfilePage Share ID QR).
 *
 * Goes through `fetch_profiles_by_ids`, the SAME global, authenticated-only
 * resolver MessagesContext uses to hydrate inbound senders. It is NOT clinic-
 * scoped — that is the whole point: starting a conversation by code/QR must
 * reach users OUTSIDE the caller's affiliated clusters.
 *
 * Do NOT use supervisor_get_member_profile here: it raises 'insufficient role'
 * for non-supervisors and 'clinic mismatch' for any target outside the caller's
 * auth_clinic_ids() reach — which silently broke every cross-cluster code/QR add.
 */
export async function fetchProfileById(id: string): Promise<ClinicMedic | null> {
  try {
    const { data, error } = await supabase.rpc('fetch_profiles_by_ids', { user_ids: [id] })
    if (error || !data || data.length === 0) return null
    const p = data[0] as {
      id: string
      first_name: string | null
      last_name: string | null
      middle_initial: string | null
      rank: string | null
      credential: string | null
      avatar_id: string | null
      clinic_id: string | null
      clinic_name: string | null
      voicemail_greeting: VoicemailGreeting | null
      avatar_blob: AvatarBlob | null
    }
    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      middleInitial: p.middle_initial,
      rank: p.rank,
      credential: p.credential,
      avatarId: p.avatar_id ?? null,
      avatarBlob: p.avatar_blob ?? null,
      clinicId: p.clinic_id ?? undefined,
      clinicName: p.clinic_name ?? undefined,
      voicemailGreeting: p.voicemail_greeting ?? null,
    }
  } catch (e) {
    logger.warn('fetchProfileById error:', e instanceof Error ? e.message : e)
    return null
  }
}
