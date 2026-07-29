const DTG_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

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
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}${DTG_MONTHS[d.getMonth()]}${String(d.getFullYear() % 100).padStart(2, '0')}`
}
