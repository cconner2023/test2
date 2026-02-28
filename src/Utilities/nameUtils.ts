export function getInitials(firstName?: string | null, lastName?: string | null): string {
  return ((firstName?.charAt(0) ?? '') + (lastName?.charAt(0) ?? '')).toUpperCase() || '?'
}
