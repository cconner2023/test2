const pad2 = (n: number) => String(n).padStart(2, '0')

export const MONTHS_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function toLocalISOString(date: Date): string {
  return `${toDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "0630" → "06:30" — military to datetime-local time string */
export function militaryToHHMM(mil: string): string {
  return `${mil.slice(0, 2)}:${mil.slice(2)}`
}

/** "06:30" → "0630" — datetime-local time to military display */
export function hhmmToMilitary(hhmm: string): string {
  return hhmm.replace(':', '')
}

/**
 * The one date format the property surfaces use — DTG-style 28JUL26 — so a roster
 * card, a record's information rows and a pane header all read the same. Accepts
 * both full ISO timestamps (audit occurredAt) and date-only payload strings
 * (expiry_date / exp_date / returned_at); the latter parse at LOCAL midnight, so
 * the shown day can't drift a day earlier in negative-offset timezones. An
 * unparseable value comes back untouched rather than as "NaNNaN".
 */
export function formatDtg(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (!Number.isFinite(d.getTime())) return iso
  return `${pad2(d.getDate())}${MONTHS_UPPER[d.getMonth()]}${pad2(d.getFullYear() % 100)}`
}

/** Military date-time group in local time, e.g. 210010JUN26 (DDHHMM + MON + YY). */
export function formatDtgTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${MONTHS_UPPER[d.getMonth()]}${pad2(d.getFullYear() % 100)}`
}
