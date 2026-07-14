import type { LocalPropertyItem, LocalPropertyLocation, ItemType, UnitOfIssue } from '../Types/PropertyTypes'
import type { OrderLine } from './propertyShortage'
import { isLinContainer, isZoneShadow } from './propertyAuthorized'

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
  'Item Type', 'Unit of Issue', 'Pack Size', 'Expiration Date',
] as const

/** ISO calendar date (YYYY-MM-DD) — the shape DatePickerInput emits and expiry_date stores. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function exportPropertyCSV(
  items: LocalPropertyItem[],
  locations: LocalPropertyLocation[],
): void {
  const locationMap = new Map<string, string>()
  for (const loc of locations) locationMap.set(loc.id, loc.name)

  // A component parented under a LIN carries its LIN on the container, not on itself — resolve
  // the EFFECTIVE LIN from the parent so the export round-trips (re-import re-associates by LIN).
  const linByContainerId = new Map<string, string>()
  for (const it of items) if (isLinContainer(it) && it.lin) linByContainerId.set(it.id, it.lin)

  // LIN containers + zone-shadows are STRUCTURAL rows (auto-derived from the LIN column / zones),
  // not CSV line-items — emit them and a re-import would spawn junk duplicates. Skip them.
  const rows = items
    .filter((item) => !isLinContainer(item) && !isZoneShadow(item))
    .map((item) => {
      const effectiveLin =
        item.lin ?? (item.parent_item_id ? linByContainerId.get(item.parent_item_id) ?? '' : '')
      return [
        escapeCSVField(item.name),
        escapeCSVField(item.nomenclature ?? ''),
        escapeCSVField(item.nsn ?? ''),
        escapeCSVField(effectiveLin),
        String(item.quantity),
        item.quantity_authorized == null ? '' : String(item.quantity_authorized),
        escapeCSVField(item.serial_number ?? ''),
        escapeCSVField(item.location_id ? locationMap.get(item.location_id) ?? '' : ''),
        item.item_type ?? 'DI',
        item.unit_of_issue ?? '',
        item.pack_size == null ? '' : String(item.pack_size),
        escapeCSVField(item.expiry_date ?? ''),
      ]
    })

  const csv = [CSV_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  downloadCSVString(csv, `property-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

// ── Template ────────────────────────────────────────────────

export function downloadCSVTemplate(): void {
  downloadCSVString(CSV_HEADERS.join(',') + '\r\n', 'property-import-template.csv')
}

// ── Parse / Import ──────────────────────────────────────────

export interface ParsedRow {
  /** Bulk-EDIT only — the id of the existing item this row edits. Set when the grid is seeded
   *  from existing items (zone "Edit items"). A row with an itemId is matched by id (NOT content),
   *  so renaming/re-keying it updates that exact item in place instead of forking a duplicate;
   *  it also never drives the de-authorize sweep. Undefined for CSV import + bulk-add (create). */
  itemId?: string
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
  /** Expiry date, ISO YYYY-MM-DD. '' = column blank / not tracked. */
  expiryDate: string
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
  expiryDate: ['expiration date', 'expiry date', 'expiration', 'expiry', 'exp', 'exp date'],
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
    expiryDate: colIndex('expiryDate'),
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

    const rawQty = cell(fields, idx.quantity)
    // Blank quantity: an authorized (BOM) line defaults to 0 on hand — authorized-but-unreceived
    // is a real state that surfaces as short. A plain stock line with no quantity defaults to 1.
    let quantity = quantityAuthorized != null ? 0 : 1
    if (rawQty !== '') {
      const parsed = parseInt(rawQty, 10)
      if (isNaN(parsed) || parsed < 0 || !Number.isInteger(Number(rawQty))) {
        errors.push(`Row ${lineNum}: Quantity must be a non-negative integer (got "${rawQty}")`)
        continue
      }
      quantity = parsed
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

    // Expiry is optional — a malformed date is non-blocking: warn and drop the value,
    // keep the row (a bad expiry shouldn't cost you the whole line-item).
    const rawExp = cell(fields, idx.expiryDate)
    let expiryDate = ''
    if (rawExp !== '') {
      if (ISO_DATE_RE.test(rawExp) && !Number.isNaN(Date.parse(rawExp))) {
        expiryDate = rawExp
      } else {
        errors.push(`Row ${lineNum}: Expiration Date must be YYYY-MM-DD (got "${rawExp}") — left blank`)
      }
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
      expiryDate,
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
// Aligned with the DECOUPLED (LIN + NSN) model shared by propertyAuthorized / propertyShortage
// (see lineKeyOf): an upload matches and aggregates by the composite (assigned-LIN SCOPE + NSN
// IDENTITY), NOT by a global NSN pool. Three rules keep it non-destructive:
//
//   1. ROLE SPLIT — an AUTHORIZED row (Quantity Authorized set) only ever matches an existing
//      authorization-tracked line; a STOCK row (blank Authorized) only ever matches loose,
//      non-tracked stock. So a BOM re-upload can NEVER clobber the physical stock filling a
//      target (and vice-versa) — the corruption the old global-NSN matcher allowed.
//   2. SERIAL rows are DISTINCT — matched 1:1 by serial only (never collapse into a pool).
//   3. Rows with no match CREATE. Every created row carrying a LIN is parented under that LIN's
//      container (auto-created when missing — see ReconcilePlan.linContainers) so its on-hand
//      aggregates into the hand-receipt line exactly as the folds compute it.
//
// On a merge, present `quantity` reconciles per mergeMode ('set' = snapshot/idempotent, 'add' =
// received/accumulates); a STOCK row never rewrites authorization. Authorization-tracked lines
// the BOM omits are DE-AUTHORIZED (quantity_authorized → null, kept on hand, never deleted) —
// but ONLY within the LINs the upload actually addresses (scoped, not clinic-wide) and only when
// the upload carries authorized rows at all (a pure stock/receipt sheet never de-auths).

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
  /** Distinct LINs (original case) that CREATE rows will hang under but which have no existing
   *  container. The drawer creates a LIN container for each first, then parents the new items to
   *  them so on-hand aggregates into the line (the decoupled LIN + NSN model). */
  linContainers: string[]
  creates: ParsedRow[]
  merges: MergeUpdate[]
  deauthorizes: Deauthorize[]
  /** Bulk-EDIT rows (each carries an itemId) — id-keyed in-place updates. applyImport resolves
   *  each row's location/LIN and updates only the fields that actually changed. */
  updates: ParsedRow[]
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

/** Composite-key IDENTITY half — NSN when present, else name. Mirrors lineKeyOf. */
function identOf(nsn: string | null | undefined, name: string): string {
  const n = norm(nsn)
  return n ? 'nsn:' + n : 'name:' + norm(name)
}

export function reconcileImport(
  rows: ParsedRow[],
  existing: LocalPropertyItem[],
  opts: { mergeMode: MergeMode } = { mergeMode: 'set' },
): ReconcilePlan {
  // Turned-in / deleted rows have left the book — exclude them (matches the folds' `live`).
  const live = existing.filter((it) => !it.deleted_at && !it.turned_in_at)

  // LIN containers, and the container-id → LIN lookup used to resolve an item's SCOPE. A component
  // parented under a container inherits the container's LIN, so both key by that LIN string —
  // making a CSV row (which only knows the LIN string) comparable to container-parented stock.
  const containerByLin = new Map<string, string>()
  const linByContainerId = new Map<string, string>()
  for (const it of live) {
    if (!isLinContainer(it)) continue
    const l = norm(it.lin)
    if (!l) continue
    containerByLin.set(l, it.id)
    linByContainerId.set(it.id, l)
  }

  // SCOPE half of the composite key: the LIN the item/row is assigned under (parent LIN → own LIN
  // → top). A non-LIN parent (e.g. a named SKO) falls back to the parent id.
  const itemScope = (it: LocalPropertyItem): string => {
    if (it.parent_item_id) {
      const pl = linByContainerId.get(it.parent_item_id)
      return pl ? 'lin:' + pl : 'p:' + it.parent_item_id
    }
    const l = norm(it.lin)
    return l ? 'lin:' + l : 'top'
  }
  const rowScope = (row: ParsedRow): string => (norm(row.lin) ? 'lin:' + norm(row.lin) : 'top')

  // Match pools. Structural rows (LIN containers, zone-shadows) are NEVER matched — they're
  // headers / zone identities, not line-items, so an upload can't clobber them.
  const bySerial = new Map<string, LocalPropertyItem[]>() // distinct: serial → items
  const tracked = new Map<string, LocalPropertyItem[]>()  // authorized lines: key → items
  const loose = new Map<string, LocalPropertyItem[]>()    // untracked stock: key → items
  for (const it of live) {
    if (isLinContainer(it) || isZoneShadow(it)) continue
    if (it.is_serialized || norm(it.serial_number)) {
      pushKey(bySerial, norm(it.serial_number), it)
      continue
    }
    const k = itemScope(it) + '||' + identOf(it.nsn, it.name)
    if (it.quantity_authorized != null) pushKey(tracked, k, it)
    else pushKey(loose, k, it)
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
  const updates: ParsedRow[] = []

  // EDIT rows are id-keyed: reserve their items up front so no content row can match them and
  // the de-authorize sweep skips them (they're being explicitly maintained, not omitted).
  for (const row of rows) if (row.itemId) consumed.add(row.itemId)

  for (const row of rows) {
    // Bulk-EDIT: matched by id, not content — an in-place field update, never a create/merge.
    if (row.itemId) {
      updates.push(row)
      continue
    }
    const serial = norm(row.serialNumber)
    const key = rowScope(row) + '||' + identOf(row.nsn, row.name)
    // ROLE SPLIT: an authorized row consults only tracked lines; a stock row only loose stock.
    const match = serial
      ? takeFirst(bySerial, serial)
      : row.quantityAuthorized != null
        ? takeFirst(tracked, key)
        : takeFirst(loose, key)

    if (!match) {
      creates.push(row)
      continue
    }

    consumed.add(match.id)
    const oldQty = match.quantity
    const newQty = opts.mergeMode === 'add' ? oldQty + row.quantity : row.quantity
    const oldAuth = match.quantity_authorized ?? null
    // A stock row (blank Authorized) must never clear an existing authorization by omission; only
    // an authorized row rewrites it.
    const newAuth = row.quantityAuthorized != null ? row.quantityAuthorized : oldAuth
    const qtyChanged = newQty !== oldQty
    const authChanged = oldAuth !== newAuth
    if (qtyChanged || authChanged) {
      merges.push({ itemId: match.id, name: match.name, oldQty, newQty, oldAuth, newAuth, qtyChanged, authChanged })
    }
  }

  // A LIN container is needed for every LIN a CREATE row hangs under that doesn't already have one.
  const linContainers: string[] = []
  const seenLin = new Set<string>()
  for (const row of creates) {
    const l = norm(row.lin)
    if (!l || containerByLin.has(l) || seenLin.has(l)) continue
    seenLin.add(l)
    linContainers.push(row.lin.trim())
  }

  // De-authorize BOM-omitted lines — SCOPED to the LINs this upload addresses, and only when the
  // upload carries authorized rows (a pure stock/receipt sheet never touches the BOM). Serialized
  // authorizations are matched 1:1 and never swept by a fungible BOM upload.
  // Only CONTENT rows (a BOM sheet) drive de-auth — an edit row is a targeted in-place update,
  // not a declaration of the whole receipt, so it must never sweep sibling lines out of the BOM.
  const authScopes = new Set<string>()
  for (const row of rows) if (!row.itemId && row.quantityAuthorized != null) authScopes.add(rowScope(row))
  const deauthorizes: Deauthorize[] = []
  if (authScopes.size > 0) {
    for (const it of live) {
      if (isLinContainer(it) || isZoneShadow(it)) continue
      if (it.is_serialized || norm(it.serial_number)) continue
      if (it.quantity_authorized != null && !consumed.has(it.id) && authScopes.has(itemScope(it))) {
        deauthorizes.push({ itemId: it.id, name: it.name, onHand: it.quantity })
      }
    }
  }

  return { linContainers, creates, merges, deauthorizes, updates }
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
