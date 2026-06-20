/**
 * useProfileRealtime — the single realtime subscription on the signed-in user's
 * own `profiles` row, and the one owner of live profile sync.
 *
 * Replaces the bespoke channel that used to live inside useProfileAvatar. That
 * hook is mounted in more than one place (App shell + MissionBoard), so it
 * opened two JOINs to the same `profile-avatar:${userId}` topic → Supabase's
 * "mismatch between server and client bindings for postgres changes" error.
 * Hoisting the subscription here makes it single-owner and lets every
 * profiles-row field sync live (avatar, name, roles, clinic reassignment),
 * not just the avatar.
 *
 * Egress discipline: an avatar change applies as a pure DELTA — the realtime row
 * carries avatar_id/avatar_blob inline, so patchProfile() updates the cache with
 * NO round-trip. A full refreshProfile() fires only when roles or clinic_id
 * change, because those need the embedded clinic name (a join) and the
 * profile_clinic_loans reconcile, neither of which is in the raw row. An
 * avatar-only update never triggers a fetch.
 *
 * NOTE: loans live in profile_clinic_loans, a separate table — changes there do
 * NOT fire this profiles-row subscription. Live loan propagation would need its
 * own subscription (out of scope here).
 */

import { useSupabaseSubscription } from './useSupabaseSubscription'
import { usePageVisibility } from './usePageVisibility'
import { useAuthStore } from '../stores/useAuthStore'
import { createLogger } from '../Utilities/Logger'
import type { AvatarBlob } from '../Types/SupervisorTestTypes'

const logger = createLogger('ProfileRealtime')

interface ProfileRealtimeRow extends Record<string, unknown> {
  avatar_id?: string | null
  avatar_blob?: AvatarBlob | null
  roles?: string[] | null
  clinic_id?: string | null
}

export function useProfileRealtime(userId?: string): void {
  const isPageVisible = usePageVisibility()

  useSupabaseSubscription<ProfileRealtimeRow>({
    // Pauses when backgrounded (battery) — mirrors the old avatar channel.
    shouldSubscribe: !!userId && isPageVisible,
    channelName: `profile:${userId ?? ''}`,
    postgresFilter: { table: 'profiles', filter: `id=eq.${userId ?? ''}`, event: 'UPDATE' },
    onPayload: (payload) => {
      if (payload.eventType !== 'UPDATE') return
      const row = payload.new
      const store = useAuthStore.getState()

      // Avatar: strict delta, no fetch.
      store.patchProfile({
        avatarId: row.avatar_id ?? null,
        avatarBlob: row.avatar_blob ?? null,
      })

      // Roles / clinic reassignment need the joined clinic name + loan reconcile
      // → full refresh. Never fires for an avatar-only change.
      const rolesChanged = JSON.stringify(row.roles ?? []) !== JSON.stringify(store.roles)
      const clinicChanged = (row.clinic_id ?? null) !== store.clinicId
      if (rolesChanged || clinicChanged) void store.refreshProfile()
    },
    logger,
  })
}
