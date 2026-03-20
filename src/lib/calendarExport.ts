/**
 * Client-side .ics (iCalendar RFC 5545) export for calendar events.
 *
 * OPSEC: sensitive fields are stripped on export — only schedule metadata
 * suitable for a personal phone calendar is included.
 *
 * Stripped fields: property_item_ids, clinic_id, assigned_to, opord_notes, created_by
 */

import type { CalendarEvent, EventStatus } from '../Types/CalendarTypes'

// ---- Helpers ----

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function toIcsDate(iso: string): string {
  // Convert ISO datetime to iCal YYYYMMDDTHHMMSSZ
  const cleaned = iso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(' ', 'T')
  // Ensure seconds are present: YYYYMMDDTHHmm → YYYYMMDDTHHmmSS
  if (/T\d{4}$/.test(cleaned)) return cleaned + '00'
  return cleaned
}

function toIcsDateOnly(iso: string): string {
  // All-day events use DATE value type: YYYYMMDD
  return iso.slice(0, 10).replace(/-/g, '')
}

function statusToIcs(status: EventStatus): string {
  switch (status) {
    case 'confirmed':
    case 'in_progress': return 'CONFIRMED'
    case 'cancelled': return 'CANCELLED'
    default: return 'TENTATIVE'
  }
}

function foldLine(line: string): string {
  // RFC 5545: lines longer than 75 octets must be folded
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75))
    remaining = ' ' + remaining.slice(75)
  }
  parts.push(remaining)
  return parts.join('\r\n')
}

function buildVEvent(event: CalendarEvent): string {
  const lines: string[] = ['BEGIN:VEVENT']

  lines.push(`UID:${escapeIcs(event.id)}@adtmc`)

  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDateOnly(event.start_time)}`)
    lines.push(`DTEND;VALUE=DATE:${toIcsDateOnly(event.end_time)}`)
  } else {
    lines.push(`DTSTART:${toIcsDate(event.start_time)}`)
    lines.push(`DTEND:${toIcsDate(event.end_time)}`)
  }

  lines.push(`SUMMARY:${escapeIcs(event.title)}`)

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`)
  }

  lines.push(`STATUS:${statusToIcs(event.status)}`)

  if (event.created_at) {
    lines.push(`CREATED:${toIcsDate(event.created_at)}`)
  }

  if (event.updated_at) {
    lines.push(`LAST-MODIFIED:${toIcsDate(event.updated_at)}`)
  }

  lines.push('END:VEVENT')

  return lines.map(foldLine).join('\r\n')
}

function wrapCalendar(vevents: string[]): string {
  const parts = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ADTMC//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ]
  return parts.join('\r\n')
}

// ---- Public API ----

export interface IcsExportOptions {
  /** Filter by date range (ISO date strings, inclusive). */
  dateRange?: { start: string; end: string }
}

/**
 * Generate an RFC 5545 .ics string from a list of calendar events.
 * Sensitive operational fields are stripped automatically.
 */
export function generateIcs(events: CalendarEvent[], options?: IcsExportOptions): string {
  let filtered = events

  if (options?.dateRange) {
    const { start, end } = options.dateRange
    filtered = events.filter(e => {
      const eStart = e.start_time.slice(0, 10)
      const eEnd = e.end_time.slice(0, 10)
      return eEnd >= start && eStart <= end
    })
  }

  const vevents = filtered.map(buildVEvent)
  return wrapCalendar(vevents)
}

/**
 * Generate an RFC 5545 .ics string for a single event.
 */
export function generateSingleEventIcs(event: CalendarEvent): string {
  return wrapCalendar([buildVEvent(event)])
}

/**
 * Share or download calendar events as a .ics file.
 * Uses Web Share API on capable devices, falls back to file download.
 */
export async function shareCalendar(events: CalendarEvent[], options?: IcsExportOptions): Promise<void> {
  const icsContent = generateIcs(events, options)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const filename = 'calendar-export.ics'

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })
  ) {
    const file = new File([blob], filename, { type: blob.type })
    await navigator.share({ files: [file], title: 'Calendar Export' })
    return
  }

  // Fallback: trigger browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Share or download a single event as a .ics file.
 */
export async function shareSingleEvent(event: CalendarEvent): Promise<void> {
  const icsContent = generateSingleEventIcs(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const filename = `${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })
  ) {
    const file = new File([blob], filename, { type: blob.type })
    await navigator.share({ files: [file], title: event.title })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
