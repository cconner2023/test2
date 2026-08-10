/**
 * Assignable role vocabularies.
 *
 * Two lists, and the difference is an authorization fact rather than a UI
 * preference: `set_user_roles` is dev-only, so a supervisor cannot grant any
 * role — and must never be offered 'dev' even optimistically. Widening
 * SUPERVISOR_ASSIGNABLE_ROLES would misrepresent what the server will accept.
 *
 * The full list mirrors the `user_role` DB enum (see database.types.generated).
 */

/** What the dev console can assign. */
export const ASSIGNABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const
export type AssignableRole = typeof ASSIGNABLE_ROLES[number]

/** What a supervisor surface may show. Excludes 'dev' by design. */
export const SUPERVISOR_ASSIGNABLE_ROLES = ['medic', 'supervisor', 'provider'] as const
export type SupervisorAssignableRole = typeof SUPERVISOR_ASSIGNABLE_ROLES[number]

export const roleLabel = (role: string): string => role.charAt(0).toUpperCase() + role.slice(1)

/** Role list as picker options. */
export const roleOptions = (roles: readonly string[]): { value: string; label: string }[] =>
  roles.map(role => ({ value: role, label: roleLabel(role) }))
