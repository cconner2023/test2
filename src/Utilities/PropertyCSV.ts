import type { LocalPropertyItem, LocalPropertyLocation, ItemType, UnitOfIssue } from '../Types/PropertyTypes'
import type { OrderLine } from './propertyShortage'

const ITEM_TYPES: ItemType[] = ['CI', 'DI', 'SI']
const UNITS_OF_ISSUE: UnitOfIssue[] = ['EA', 'SET', 'PR', 'BOT', 'PK', 'TUB']

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
  'Item Type', 'Unit of Issue', 'Pack Size',
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
    item.item_type ?? 'DI',
    item.unit_of_issue ?? '',
    item.pack_size == null ? '' : String(item.pack_size),
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
  /** Accountability class. null = column blank → createItem defaults to 'DI'. */
  itemType: ItemType | null
  /** Unit of issue. null = column blank. */
  unitOfIssue: UnitOfIssue | null
  /** Base units per issue unit. null = column blank → 1. */
  packSize: number | null
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
  itemType: ['item type', 'type', 'class'],
  unitOfIssue: ['unit of issue', 'ui', 'unit', 'u/i'],
  packSize: ['pack size', 'pack', 'issue qty', 'pack qty', 'per issue'],
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
    itemType: colIndex('itemType'),
    unitOfIssue: colIndex('unitOfIssue'),
    packSize: colIndex('packSize'),
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

    const rawType = cell(fields, idx.itemType).toUpperCase()
    let itemType: ItemType | null = null
    if (rawType !== '') {
      if (!(ITEM_TYPES as string[]).includes(rawType)) {
        errors.push(`Row ${lineNum}: Item Type must be one of CI, DI, SI (got "${rawType}")`)
        continue
      }
      itemType = rawType as ItemType
    }

    const rawUnit = cell(fields, idx.unitOfIssue).toUpperCase()
    let unitOfIssue: UnitOfIssue | null = null
    if (rawUnit !== '') {
      if (!(UNITS_OF_ISSUE as string[]).includes(rawUnit)) {
        errors.push(`Row ${lineNum}: Unit of Issue must be one of ${UNITS_OF_ISSUE.join(', ')} (got "${rawUnit}")`)
        continue
      }
      unitOfIssue = rawUnit as UnitOfIssue
    }

    const rawPack = cell(fields, idx.packSize)
    let packSize: number | null = null
    if (rawPack !== '') {
      const parsed = parseInt(rawPack, 10)
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(Number(rawPack))) {
        errors.push(`Row ${lineNum}: Pack Size must be a positive integer (got "${rawPack}")`)
        continue
      }
      packSize = parsed
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
      itemType,
      unitOfIssue,
      packSize,
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

// ── Reconcile (additive-or-merge import) ────────────────────
//
// An upload NEVER duplicates the book: each row either ADDS a new item or MERGES into an
// existing one. Matching:
//   - A row WITH a serial number is DISTINCT — matched by serial only (50 serialized items
//     never collapse into one NSN pool). No serial match → create.
//   - A row WITHOUT a serial is FUNGIBLE — matched into the bulk pool by NSN → LIN → name.
//     Serial-bearing / serialized existing items are excluded from that pool.
//   - No match → create (additive).
// Matches are consumed so two CSV rows sharing an NSN map to two different existing items.
//
// On a merge, present `quantity` is reconciled per mergeMode:
//   - 'set' — present qty becomes the CSV value (inventory snapshot; re-upload idempotent).
//   - 'add' — CSV qty is added to what's on hand (received shipment; re-upload accumulates).
// Authorized qty always tracks the CSV row. Authorization-tracked items absent from the
// upload are DE-AUTHORIZED (quantity_authorized → null, kept on hand), never deleted, and
// their present stock is never touched.

/** How a merge reconciles present quantity. */
export type MergeMode = 'set' | 'add'

/** A merge into an existing item — present qty and/or authorized qty change. */
export interface MergeUpdate {
  itemId: string
  name: string
  oldQty: number
  newQty: number
  oldAuth: number | null
  newAuth: number | null
  qtyChanged: boolean
  authChanged: boolean
}

/** An item dropped from the BOM — de-authorized but kept on hand. */
export interface Deauthorize {
  itemId: string
  name: string
  onHand: number
}

export interface ReconcilePlan {
  creates: ParsedRow[]
  merges: MergeUpdate[]
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
  opts: { mergeMode: MergeMode } = { mergeMode: 'set' },
): ReconcilePlan {
  const live = existing.filter((it) => !it.deleted_at)

  // Distinct (serial-bearing/serialized) items are matchable ONLY by serial; fungible
  // items populate the NSN/LIN/name bulk pool.
  const bySerial = new Map<string, LocalPropertyItem[]>()
  const byNsn = new Map<string, LocalPropertyItem[]>()
  const byLin = new Map<string, LocalPropertyItem[]>()
  const byName = new Map<string, LocalPropertyItem[]>()
  for (const it of live) {
    const isDistinct = it.is_serialized || !!norm(it.serial_number)
    if (isDistinct) {
      pushKey(bySerial, norm(it.serial_number), it)
    } else {
      pushKey(byNsn, norm(it.nsn), it)
      pushKey(byLin, norm(it.lin), it)
      pushKey(byName, norm(it.name), it)
    }
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
  const merges: MergeUpdate[] = []

  for (const row of rows) {
    const match = norm(row.serialNumber)
      ? takeFirst(bySerial, norm(row.serialNumber))
      : takeFirst(byNsn, norm(row.nsn)) ??
        takeFirst(byLin, norm(row.lin)) ??
        takeFirst(byName, norm(row.name))

    if (!match) {
      creates.push(row)
      continue
    }

    consumed.add(match.id)
    const oldQty = match.quantity
    const newQty = opts.mergeMode === 'add' ? oldQty + row.quantity : row.quantity
    const oldAuth = match.quantity_authorized ?? null
    const newAuth = row.quantityAuthorized
    const qtyChanged = newQty !== oldQty
    const authChanged = oldAuth !== newAuth
    if (qtyChanged || authChanged) {
      merges.push({ itemId: match.id, name: match.name, oldQty, newQty, oldAuth, newAuth, qtyChanged, authChanged })
    }
  }

  // Authorization-tracked items absent from the upload are de-authorized, not deleted.
  const deauthorizes: Deauthorize[] = []
  for (const it of live) {
    if (it.quantity_authorized != null && !consumed.has(it.id)) {
      deauthorizes.push({ itemId: it.id, name: it.name, onHand: it.quantity })
    }
  }

  return { creates, merges, deauthorizes }
}

// ── Shortage order-list export ──────────────────────────────

/** Export the cluster requisition list (aggregate-by-NSN shortfalls) as a CSV — the
 *  actionable "what to order" sheet. Mirrors exportPropertyCSV's download path. */
export function exportShortageCSV(orders: OrderLine[]): void {
  const headers = ['NSN', 'LIN', 'Name', 'Authorized', 'On Hand', 'Order'] as const
  const rows = orders.map((o) => [
    escapeCSVField(o.nsn ?? ''),
    escapeCSVField(o.lin ?? ''),
    escapeCSVField(o.name),
    String(o.authorized),
    String(o.onHand),
    String(o.order),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  downloadCSVString(csv, `shortage-order-${new Date().toISOString().slice(0, 10)}.csv`)
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
