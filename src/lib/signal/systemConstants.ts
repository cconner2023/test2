/**
 * System identity constants — dependency-free on purpose.
 *
 * systemIdentity.ts imports the messaging store, and the store needs these at
 * creation time. Keeping them here (re-exported by systemIdentity) means no
 * import order can hit them uninitialized through that cycle.
 */

import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

/** Sentinel pseudo-user UUID for the shared "System" entity. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'

/** Singleton device id for system's Signal key bundle. */
export const SYSTEM_DEVICE_ID = 'primary'

/** Synthetic peer profile so SYSTEM resolves to "System" in name/avatar lookups. */
export const SYSTEM_PEER_PROFILE: ClinicMedic = {
  id: SYSTEM_USER_ID,
  firstName: 'System',
  lastName: null,
  middleInitial: null,
  rank: null,
  credential: null,
  avatarId: null,
}
