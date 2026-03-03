import type { LocalPropertyItem, LocalPropertyLocation } from '../Types/PropertyTypes'

// ── CSV Escaping ────────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── Export ───────────────────────────────────────────────────

const CSV_HEADERS = ['Item Name', 'Nomenclature', 'NSN', 'LIN', 'Quantity', 'Location'] as const

export function exportPropertyCSV(
  items: LocalPropertyItem[],
  locations: LocalPropertyLocation[],
): void {
  const locationMap = new Map<string, string>()
  for (const loc of locations) locationMap.set(loc.id, loc.name)

  const rows = items.map((item) => [
    escapeCSVField(item.name),
    escapeCSVField(item.nomenclature ?? ''),
    escapeCSVField(item.nsn ?? ''),
    escapeCSVField(item.lin ?? ''),
    String(item.quantity),
    escapeCSVField(item.location_id ? locationMap.get(item.location_id) ?? '' : ''),
  ])

  const csv = [CSV_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  downloadCSVString(csv, `property-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

// ── Template ────────────────────────────────────────────────

export function downloadCSVTemplate(): void {
  downloadCSVString(CSV_HEADERS.join(',') + '\r\n', 'property-import-template.csv')
}

// ── Parse / Import ──────────────────────────────────────────

export interface ParsedRow {
  name: string
  nomenclature: string
  nsn: string
  lin: string
  quantity: number
  location: string
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: string[]
}

export function parsePropertyCSV(file: File): Promise<ParseResult> {
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

function parseCSVText(text: string): ParseResult {
  const lines = splitCSVLines(text)
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] }

  // Skip header row (first line)
  const dataLines = lines.slice(1)
  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2 // 1-indexed, header is line 1
    const fields = parseCSVRow(dataLines[i])

    // Skip fully empty rows
    if (fields.every((f) => f.trim() === '')) continue

    const name = fields[0]?.trim() ?? ''
    if (!name) {
      errors.push(`Row ${lineNum}: Item Name is required`)
      continue
    }

    const rawQty = fields[4]?.trim() ?? ''
    let quantity = 1
    if (rawQty !== '') {
      const parsed = parseInt(rawQty, 10)
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(Number(rawQty))) {
        errors.push(`Row ${lineNum}: Quantity must be a positive integer (got "${rawQty}")`)
        continue
      }
      quantity = parsed
    }

    rows.push({
      name,
      nomenclature: fields[1]?.trim() ?? '',
      nsn: fields[2]?.trim() ?? '',
      lin: fields[3]?.trim() ?? '',
      quantity,
      location: fields[5]?.trim() ?? '',
    })
  }

  return { rows, errors }
}

/** Split text into logical CSV lines (respecting quoted newlines) */
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
      if (ch === '\r' && text[i + 1] === '\n') i++ // skip \r\n pair
      if (current.trim() !== '') lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() !== '') lines.push(current)
  return lines
}

/** Parse a single CSV row into fields, handling quoted values */
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
          i++ // skip escaped quote
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

// ── Download helper ─────────────────────────────────────────

function downloadCSVString(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
