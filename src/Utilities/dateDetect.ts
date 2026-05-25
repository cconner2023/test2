import * as chrono from 'chrono-node'

export interface DetectedDate {
  /** Resolved datetime. */
  date: Date
  /** The matched substring (e.g. "tomorrow at 0900"). */
  text: string
  /** True when the match pinned a specific clock time (not just a day). */
  hasTime: boolean
}

/**
 * Scan message text for a schedulable date/time. Returns the first confident
 * match, or null. Runs entirely on already-decrypted local text — no wire/PHI
 * exposure. `forwardDate` biases bare weekday/month names to the upcoming
 * occurrence, which is what a medic scheduling off a chat almost always means.
 *
 * A guard drops low-signal matches (a lone time-of-day or a bare year) so we
 * don't float an "add event" icon on every message that happens to contain a
 * number.
 */
export function detectFirstDate(text: string, ref: Date = new Date()): DetectedDate | null {
  if (!text || text.trim().length < 3) return null

  const results = chrono.parse(text, ref, { forwardDate: true })
  for (const r of results) {
    const hasDay =
      r.start.isCertain('day') || r.start.isCertain('weekday') || r.start.isCertain('month')
    // Require an actual calendar anchor — a standalone clock time ("at 9")
    // or a bare year is not enough signal to suggest an event.
    if (!hasDay) continue
    return { date: r.date(), text: r.text, hasTime: r.start.isCertain('hour') }
  }
  return null
}
