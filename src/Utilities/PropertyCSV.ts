import type { LocalPropertyItem, LocalPropertyLocation } from '../Types/PropertyTypes'

// ── CSV Escaping ────────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── Export ───────────────────────────────────────────────────

const CSV_HEADERS = [
  'Item Name', 'Nomenclature', 'NSN', 'LIN',
  'Quantity', 'Quantity Authorized', 'Serial Number', 'Location',
] as const

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
    item.quantity_authorized == null ? '' : String(item.quantity_authorized),
    escapeCSVField(item.serial_number ?? ''),
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
  /** Authorized (BOM) qty for this line. null = column blank / not tracked. */
  quantityAuthorized: number | null
  serialNumber: string
  location: string
}

/** Logical column → accepted header names (lowercased, trimmed). The parser maps by
 *  header NAME, not position, so legacy 6-column exports (no Quantity Authorized /
 *  Serial Number) still import unchanged and column order is irrelevant. */
const COLUMN_ALIASES: Record<keyof ParsedRow, string[]> = {
  name: ['item name', 'name'],
  nomenclature: ['nomenclature'],
  nsn: ['nsn'],
  lin: ['lin'],
  quantity: ['quantity', 'qty', 'quantity on hand', 'on hand'],
  quantityAuthorized: ['quantity authorized', 'qty authorized', 'authorized', 'auth'],
  serialNumber: ['serial number', 'serial', 'serial no'],
  location: ['location'],
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

  // Build a header-name → column-index map from the first line, so column order
  // is irrelevant and legacy files (missing the newer columns) still import.
  const headerFields = parseCSVRow(lines[0]).map((h) => h.trim().toLowerCase())
  const colIndex = (key: keyof ParsedRow): number => {
    for (const alias of COLUMN_ALIASES[key]) {
      const idx = headerFields.indexOf(alias)
      if (idx !== -1) return idx
    }
    return -1
  }
  const idx = {
    name: colIndex('name'),
    nomenclature: colIndex('nomenclature'),
    nsn: colIndex('nsn'),
    lin: colIndex('lin'),
    quantity: colIndex('quantity'),
    quantityAuthorized: colIndex('quantityAuthorized'),
    serialNumber: colIndex('serialNumber'),
    location: colIndex('location'),
  }

  const dataLines = lines.slice(1)
  const rows: ParsedRow[] = []
  const errors: string[] = []

  if (idx.name === -1) {
    return { rows: [], errors: ['CSV is missing an "Item Name" column'] }
  }

  const cell = (fields: string[], i: number): string => (i === -1 ? '' : fields[i]?.trim() ?? '')

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2 // 1-indexed, header is line 1
    const fields = parseCSVRow(dataLines[i])

    // Skip fully empty rows
    if (fields.every((f) => f.trim() === '')) continue

    const name = cell(fields, idx.name)
    if (!name) {
      errors.push(`Row ${lineNum}: Item Name is required`)
      continue
    }

    const rawQty = cell(fields, idx.quantity)
    let quantity = 1
    if (rawQty !== '') {
      const parsed = parseInt(rawQty, 10)
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(Number(rawQty))) {
        errors.push(`Row ${lineNum}: Quantity must be a positive integer (got "${rawQty}")`)
        continue
      }
      quantity = parsed
    }

    const rawAuth = cell(fields, idx.quantityAuthorized)
    let quantityAuthorized: number | null = null
    if (rawAuth !== '') {
      const parsed = parseInt(rawAuth, 10)
      if (isNaN(parsed) || parsed < 0 || !Number.isInteger(Number(rawAuth))) {
        errors.push(`Row ${lineNum}: Quantity Authorized must be a non-negative integer (got "${rawAuth}")`)
        continue
      }
      quantityAuthorized = parsed
    }

    rows.push({
      name,
      nomenclature: cell(fields, idx.nomenclature),
      nsn: cell(fields, idx.nsn),
      lin: cell(fields, idx.lin),
      quantity,
      quantityAuthorized,
      serialNumber: cell(fields, idx.serialNumber),
      location: cell(fields, idx.location),
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

// ── Non-destructive reconcile (re-import / baseline upload) ──
//
// The importer must NEVER duplicate the book on a re-upload, and must NEVER touch
// present stock when it adjusts the authorization layer. A reconcile matches each CSV
// row into the existing tree by key precedence (serial → NSN → LIN → name, lowercased)
// and produces three buckets:
//   - creates:   rows with no existing match → new item (present qty + authorized).
//   - authUpdates: matched rows whose authorized qty differs → updateItem(quantity_authorized)
//     ONLY. Present quantity, holder, location, serial are left untouched.
//   - deauthorizes: authorization-tracked items NOT present in the upload → set
//     quantity_authorized = null (still on hand as excess; NEVER deleted).
// Matches are consumed so two CSV lines sharing an NSN map to two different existing rows.

/** An authorized-qty change on an already-tracked item. */
export interface AuthUpdate {
  itemId: string
  name: string
  oldAuth: number | null
  newAuth: number | null
}

/** An item dropped from the BOM — de-authorized but kept on hand. */
export interface Deauthorize {
  itemId: string
  name: string
  onHand: number
}

export interface ReconcilePlan {
  creates: ParsedRow[]
  authUpdates: AuthUpdate[]
  deauthorizes: Deauthorize[]
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function pushKey(map: Map<string, LocalPropertyItem[]>, key: string, item: LocalPropertyItem): void {
  if (!key) return
  const arr = map.get(key)
  if (arr) arr.push(item)
  else map.set(key, [item])
}

export function reconcileImport(
  rows: ParsedRow[],
  existing: LocalPropertyItem[],
): ReconcilePlan {
  const live = existing.filter((it) => !it.deleted_at)

  const bySerial = new Map<string, LocalPropertyItem[]>()
  const byNsn = new Map<string, LocalPropertyItem[]>()
  const byLin = new Map<string, LocalPropertyItem[]>()
  const byName = new Map<string, LocalPropertyItem[]>()
  for (const it of live) {
    pushKey(bySerial, norm(it.serial_number), it)
    pushKey(byNsn, norm(it.nsn), it)
    pushKey(byLin, norm(it.lin), it)
    pushKey(byName, norm(it.name), it)
  }

  const consumed = new Set<string>()
  const takeFirst = (map: Map<string, LocalPropertyItem[]>, key: string): LocalPropertyItem | null => {
    if (!key) return null
    const arr = map.get(key)
    if (!arr) return null
    for (const it of arr) if (!consumed.has(it.id)) return it
    return null
  }

  const creates: ParsedRow[] = []
  const authUpdates: AuthUpdate[] = []

  for (const row of rows) {
    const match =
      takeFirst(bySerial, norm(row.serialNumber)) ??
      takeFirst(byNsn, norm(row.nsn)) ??
      takeFirst(byLin, norm(row.lin)) ??
      takeFirst(byName, norm(row.name))

    if (!match) {
      creates.push(row)
      continue
    }

    consumed.add(match.id)
    const oldAuth = match.quantity_authorized ?? null
    if (oldAuth !== row.quantityAuthorized) {
      authUpdates.push({ itemId: match.id, name: match.name, oldAuth, newAuth: row.quantityAuthorized })
    }
    // Matched with no auth change → nothing to write; present stock left untouched.
  }

  // Authorization-tracked items absent from the upload are de-authorized, not deleted.
  const deauthorizes: Deauthorize[] = []
  for (const it of live) {
    if (it.quantity_authorized != null && !consumed.has(it.id)) {
      deauthorizes.push({ itemId: it.id, name: it.name, onHand: it.quantity })
    }
  }

  return { creates, authUpdates, deauthorizes }
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
