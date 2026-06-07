/**
 * Client-side .ics (iCalendar RFC 5545) export for calendar events.
 *
 * OPSEC: sensitive fields are stripped on export — only schedule metadata
 * suitable for a personal phone calendar is included.
 *
 * Stripped fields: property_item_ids, clinic_id, assigned_to, opord_notes, created_by
 */

import type { CalendarEvent, EventStatus } from '../Types/CalendarTypes'
import { PROVIDER_HUDDLE_TASK_ID, eventFallsOnDate, toDateKey } from '../Types/CalendarTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { ClinicHuddleTask } from './supervisorService'
import { getDisplayName } from '../Utilities/nameUtils'

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
    case 'in_progress':
    case 'completed': return 'CONFIRMED'
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

// ---- Troops-to-task CSV export ----
//
// Person × Day matrix that mirrors the on-screen Troops-to-Task view, so
// leadership can paste assignments into their own T2T tracker without redoing
// the work by hand. Unlike the .ics export this INTENTIONALLY includes
// personnel assignments — it is a local file (download / Web Share), never a
// message on the wire, and the assignment grid is the entire point.

function csvCell(value: string): string {
  // Quote any field containing a delimiter, quote, or newline; double inner quotes.
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** "0700" — 24h HHMM in local time, matching the T2T timeline labels. */
function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
}

/** Compact event label for a personnel cell: "Sick Call 0700-1200" (or "Title (all day)"). */
function eventCellLabel(event: CalendarEvent): string {
  if (event.all_day) return `${event.title} (all day)`
  return `${event.title} ${hhmm(event.start_time)}-${hhmm(event.end_time)}`
}

export interface T2TCsvOptions {
  /** Personnel rows, in display order. */
  medics: ClinicMedic[]
  /** Supervisor-defined huddle stations, in sort order. One task row each. */
  huddleTasks: ClinicHuddleTask[]
  /** Restrict columns to this inclusive ISO date range; otherwise every day with an event. */
  dateRange?: { start: string; end: string }
}

/**
 * Build a Troops-to-Task CSV: a person/station × day matrix.
 *
 * Columns are the days that actually carry an event (within dateRange if given),
 * keeping the sheet tight. Personnel rows list each medic's non-huddle events;
 * a TASKS section lists the provider row + one row per huddle station with the
 * people assigned that day. Mirrors TroopsToTaskView's banding.
 */
export function generateTroopsToTaskCsv(events: CalendarEvent[], options: T2TCsvOptions): string {
  const { medics, huddleTasks, dateRange } = options

  const inRange = (e: CalendarEvent): boolean => {
    if (!dateRange) return true
    return e.end_time.slice(0, 10) >= dateRange.start && e.start_time.slice(0, 10) <= dateRange.end
  }
  const scoped = events.filter(inRange)

  // Column day keys — every day touched by an event, sorted ascending.
  const dayKeySet = new Set<string>()
  for (const e of scoped) {
    let cursor = new Date(`${e.start_time.slice(0, 10)}T00:00:00`)
    const end = new Date(`${e.end_time.slice(0, 10)}T00:00:00`)
    while (cursor <= end) {
      const key = toDateKey(cursor)
      if (!dateRange || (key >= dateRange.start && key <= dateRange.end)) dayKeySet.add(key)
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  const dayKeys = [...dayKeySet].sort()
  const dayLabels = dayKeys.map(k => new Date(`${k}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'numeric', day: 'numeric',
  }))

  const isHuddle = (e: CalendarEvent): boolean => e.category === 'huddle' || e.category === 'templated'
  const medicById = new Map(medics.map(m => [m.id, m]))
  const assigneeNames = (e: CalendarEvent): string =>
    e.assigned_to.map(id => medicById.get(id)).filter((m): m is ClinicMedic => !!m).map(getDisplayName).join(' + ')
      || 'unassigned'

  const rows: string[][] = []
  rows.push(['Name', 'Role', ...dayLabels])

  // ── Personnel section — non-huddle events per medic ──
  for (const medic of medics) {
    const role = medic.credential ?? ((medic.roles ?? []).includes('provider') ? 'Provider' : '')
    const cells = dayKeys.map(key =>
      scoped
        .filter(e => !isHuddle(e) && e.assigned_to.includes(medic.id) && eventFallsOnDate(e, key))
        .map(eventCellLabel)
        .join(' | '),
    )
    rows.push([getDisplayName(medic), role, ...cells])
  }

  // Unassigned non-huddle events.
  const unassignedCells = dayKeys.map(key =>
    scoped
      .filter(e => !isHuddle(e) && e.assigned_to.length === 0 && eventFallsOnDate(e, key))
      .map(eventCellLabel)
      .join(' | '),
  )
  if (unassignedCells.some(c => c)) rows.push(['UNASSIGNED', '', ...unassignedCells])

  // ── Tasks section — huddle band: provider row + one row per station ──
  rows.push([])
  rows.push(['--- TASKS ---'])

  const providerCells = dayKeys.map(key =>
    scoped
      .filter(e => isHuddle(e) && e.huddle_task_id === PROVIDER_HUDDLE_TASK_ID && eventFallsOnDate(e, key))
      .map(assigneeNames)
      .join(' | '),
  )
  rows.push(['Provider', '', ...providerCells])

  for (const task of huddleTasks) {
    const cells = dayKeys.map(key =>
      scoped
        .filter(e => isHuddle(e) && e.huddle_task_id === task.id && eventFallsOnDate(e, key))
        .map(assigneeNames)
        .join(' | '),
    )
    rows.push([task.name, '', ...cells])
  }

  return rows.map(cols => cols.map(csvCell).join(',')).join('\r\n')
}

/**
 * Share or download the Troops-to-Task matrix as a .csv file.
 * Uses Web Share API on capable devices, falls back to file download.
 */
export async function shareTroopsToTaskCsv(events: CalendarEvent[], options: T2TCsvOptions): Promise<void> {
  const csv = generateTroopsToTaskCsv(events, options)
  // BOM so Excel reads UTF-8 names correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const filename = 'troops-to-task.csv'

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })
  ) {
    const file = new File([blob], filename, { type: blob.type })
    await navigator.share({ files: [file], title: 'Troops-to-Task' })
    return
  }

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
