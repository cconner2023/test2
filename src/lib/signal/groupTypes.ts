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

export interface GroupMember {
  userId: string
  role: 'admin' | 'member'
  joinedAt: string
  firstName: string | null
  lastName: string | null
  rank: string | null
  avatarId: string | null
}
