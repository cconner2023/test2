/**
 * Group messaging types.
 *
 * Used by groupService, useMessages, and group UI components.
 */

export interface GroupInfo {
  groupId: string
  name: string
  clinicId: string
  createdBy: string
  createdAt: string
  memberCount: number
  systemType?: 'calendar' | 'system' | 'oncall' | null
  /** Membership epoch — bumped server-side on every member removal/leave.
   *  Absent on pre-epoch rows → treated as 0. Drives lazy sender-key rotation. */
  keyEpoch?: number
}

/** Ciphertext marker written by groupNameCrypto.encryptGroupName. */
const ENC_PREFIX = 'genc:'

/**
 * Render-safe group name. A member who hasn't received the per-group name secret
 * yet decrypts to the raw `genc:` blob; show a neutral placeholder instead of
 * leaking ciphertext into the UI. The STORE keeps the raw value on purpose —
 * removeGroupMember's secret rotation checks the `genc:` prefix to decide whether
 * it may safely re-encrypt the name.
 */
export function displayGroupName(name: string | null | undefined): string {
  if (!name) return 'Group'
  return name.startsWith(ENC_PREFIX) ? 'Group' : name
}

export interface GroupMember {
  userId: string
  role: 'admin' | 'member'
  joinedAt: string
  firstName: string | null
  lastName: string | null
  rank: string | null
  avatarId: string | null
}
