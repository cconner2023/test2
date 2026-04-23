import type { EventCategory } from '../Types/CalendarTypes'

export interface ParsedCalendarRow {
  title: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  all_day: boolean
  location: string
  description: string
  category: EventCategory
}

export interface CalendarParseResult {
  rows: ParsedCalendarRow[]
  errors: string[]
}

const VALID_CATEGORIES: EventCategory[] = ['training', 'duty', 'range', 'appointment', 'mission', 'medevac', 'other']

const CSV_HEADERS = 'Title,Start Date,Start Time,End Date,End Time,All Day,Location,Description,Category'

// ── Date / Time normalizers ─────────────────────────────────

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

function normalizeTime(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // HH:MM (24h)
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }

  // H:MM AM/PM
  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const mins = ampm[2]
    const period = ampm[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${mins}`
  }

  return null
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const newH = (h + 1) % 24
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseTruthy(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return v === 'yes' || v === 'y' || v === '1' || v === 'true'
}

function parseCategory(raw: string): EventCategory {
  const v = raw.trim().toLowerCase() as EventCategory
  return VALID_CATEGORIES.includes(v) ? v : 'other'
}

// ── CSV parsing helpers (inline — mirrored from PropertyCSV.ts) ─

function splitCSVLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      if (current.trim() !== '') lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() !== '') lines.push(current)
  return lines
}

function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCSVString(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Public API ──────────────────────────────────────────────

export function downloadCalendarCSVTemplate(): void {
  const example = [
    CSV_HEADERS,
    escapeCSVField('Morning PT') + ',2026-05-01,06:00,2026-05-01,07:00,no,,Physical readiness training,training',
    escapeCSVField('Range Day') + ',2026-05-10,,,,yes,Range 4,,range',
  ].join('\r\n')
  downloadCSVString(example, 'calendar-import-template.csv')
}

export function parseCalendarCSV(file: File): Promise<CalendarParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      resolve(parseCSVText(text))
    }
    reader.onerror = () => {
      resolve({ rows: [], errors: ['Failed to read file'] })
    }
    reader.readAsText(file)
  })
}

function parseCSVText(text: string): CalendarParseResult {
  const lines = splitCSVLines(text)
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] }

  const dataLines = lines.slice(1)
  const rows: ParsedCalendarRow[] = []
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2
    const fields = parseCSVRow(dataLines[i])

    if (fields.every((f) => f.trim() === '')) continue

    const title = fields[0]?.trim() ?? ''
    if (!title) {
      errors.push(`Row ${lineNum}: Title is required`)
      continue
    }

    const rawStartDate = fields[1]?.trim() ?? ''
    const startDate = normalizeDate(rawStartDate)
    if (!startDate) {
      errors.push(`Row ${lineNum}: Invalid Start Date "${rawStartDate}" — use YYYY-MM-DD or MM/DD/YYYY`)
      continue
    }

    const rawAllDay = fields[5]?.trim() ?? ''
    const allDay = parseTruthy(rawAllDay)

    let startTime: string
    let endTime: string
    let endDate: string

    if (allDay) {
      startTime = '00:00'
      endTime = '23:59'
    } else {
      const rawStartTime = fields[2]?.trim() ?? ''
      const parsedStart = normalizeTime(rawStartTime)
      if (!parsedStart) {
        errors.push(`Row ${lineNum}: Invalid Start Time "${rawStartTime}" — use HH:MM (24h) or H:MM AM/PM`)
        continue
      }
      startTime = parsedStart

      const rawEndTime = fields[4]?.trim() ?? ''
      if (rawEndTime) {
        const parsedEnd = normalizeTime(rawEndTime)
        if (!parsedEnd) {
          errors.push(`Row ${lineNum}: Invalid End Time "${rawEndTime}" — use HH:MM (24h) or H:MM AM/PM`)
          continue
        }
        endTime = parsedEnd
      } else {
        endTime = addOneHour(startTime)
      }
    }

    const rawEndDate = fields[3]?.trim() ?? ''
    if (rawEndDate) {
      const parsedEnd = normalizeDate(rawEndDate)
      if (!parsedEnd) {
        errors.push(`Row ${lineNum}: Invalid End Date "${rawEndDate}" — use YYYY-MM-DD or MM/DD/YYYY`)
        continue
      }
      endDate = parsedEnd
    } else {
      endDate = startDate
    }

    rows.push({
      title,
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      all_day: allDay,
      location: fields[6]?.trim() ?? '',
      description: fields[7]?.trim() ?? '',
      category: parseCategory(fields[8]?.trim() ?? ''),
    })
  }

  return { rows, errors }
}
