/**
 * CSV import/export for app content — the human-authorable counterpart to the
 * frozen `.json` bundle (objectBundle.ts). Mirrors PropertyCSV.ts: flat header +
 * rows, a downloadable starter template, and a forgiving parser.
 *
 * THREE kinds (selected by NoteBlocksCSVKind), two write destinations:
 *   - 'templates'        TextExpander[]        → note-blocks bundle → ingest
 *   - 'orderSets'        PlanOrderSet[] + tags  → note-blocks bundle → ingest
 *   - 'providerTemplates ProviderNoteTemplate[] → profile (personal only)
 * This module owns ONLY parse/serialize; the write (+ dedup + scope) lives in
 * useNoteBlocksCsvImport. Output previews are a single unified row shape so the
 * import drawer can render any kind without branching.
 *
 * THE "NATIVE-LANGUAGE READ" (Text Template Body cell): plain text mapping onto
 * TemplateNode[]:
 *   [Field]                → fill-in variable        (StepNode)
 *   [Field: a | b | c]     → dropdown, 1st = default (ChoiceNode); *b* marks default
 *   [?Field: a | b | c]    → no-insert choice: routes a linked branch but its value
 *                            is NOT typed into the note (ChoiceNode.noInsert)
 *   IF Field = value:      → conditional block, indented body lines (linked branch)
 *   IF [Field: a | b] = b: → inline gate (defines the choice inline; not inserted)
 *
 * PORTABLE REFERENCES: provider templates name their plan order set (not its id)
 * and their PE blocks by label. Ids are resolved against the importer's own world
 * at parse time (see CsvParseCtx).
 *
 * NO PHI: app content is operational text only — the same reason it may travel as
 * a frozen value / plaintext file at all.
 */

import type { TextExpander, PlanOrderSet, PlanOrderTags, PlanBlockKey, ProviderNoteTemplate } from '../Data/User'
import { PLAN_ORDER_CATEGORIES } from '../Data/User'
import type { TemplateNode, ChoiceNode, BranchNode } from '../Data/TemplateTypes'
import { getChoiceLabels } from './templateEngine'
import { MASTER_BLOCKS } from '../Data/PhysicalExamData'
import type { NoteBlocksData } from '../lib/objectBundle'

export type NoteBlocksCSVKind = 'templates' | 'orderSets' | 'providerTemplates'

/** Name→id lookups the parser uses to resolve portable references. */
export interface CsvParseCtx {
  /** Plan order set name (lowercased) → id, for provider templates. */
  orderSetIdByName?: Map<string, string>
}

// ── Low-level CSV (shares the shape of PropertyCSV's helpers) ────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Split text into logical CSV rows, respecting quoted newlines. */
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

/** Parse one CSV row into fields, unwrapping quotes + doubled quotes. */
function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current); current = '' }
      else current += ch
    }
  }
  fields.push(current)
  return fields
}

function downloadCSVString(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function splitList(cell: string): string[] {
  return cell.split(/[;\n]/).map(t => t.trim()).filter(Boolean)
}

function buildRow(fields: string[], headerCount: number): string {
  const padded = [...fields]
  while (padded.length < headerCount) padded.push('')
  return padded.map(escapeCSVField).join(',')
}

// ── Template body markup ←→ TemplateNode[] ───────────────────────────────────

const IF_RE = /^IF\s+(.+?)\s*=\s*(.+?)\s*:\s*$/i

interface IfMatch {
  field: string
  value: string
  inlineOptions?: string[]
}

function matchIf(line: string): IfMatch | null {
  const m = line.match(IF_RE)
  if (!m) return null
  const field = m[1].trim()
  const value = m[2].trim()
  const inline = field.match(/^\[([^\]]+)\]$/)
  if (inline) {
    const { label, options } = parseChoiceMarker(inline[1])
    if (options) return { field: label, value, inlineOptions: options }
    return { field: label, value }
  }
  return { field, value }
}

function parseChoiceMarker(inner: string): { label: string; options?: string[]; defaultValue?: string; noInsert?: boolean } {
  const colon = inner.indexOf(':')
  // A leading '?' on the label marks a no-insert choice: it routes a linked
  // branch but its value is never typed into the note (e.g. [?System: ENT | MSK]).
  const stripQ = (s: string): { label: string; noInsert: boolean } => {
    const t = s.trim()
    return t.startsWith('?') ? { label: t.slice(1).trim(), noInsert: true } : { label: t, noInsert: false }
  }
  if (colon === -1) {
    const { label } = stripQ(inner)
    return { label }
  }
  const { label, noInsert } = stripQ(inner.slice(0, colon))
  const rawOpts = inner.slice(colon + 1).split('|').map(o => o.trim()).filter(Boolean)
  if (!rawOpts.length) return { label, noInsert }
  let defaultValue: string | undefined
  const options = rawOpts.map(o => {
    const starred = o.match(/^\*(.+)\*$/)
    if (starred) { defaultValue = starred[1].trim(); return starred[1].trim() }
    return o
  })
  return { label, options, defaultValue: defaultValue ?? options[0], noInsert }
}

function parseInline(text: string): TemplateNode[] {
  if (!text) return []
  const nodes: TemplateNode[] = []
  for (const part of text.split(/(\[[^\]]+\])/)) {
    if (!part) continue
    const marker = part.match(/^\[([^\]]+)\]$/)
    if (marker) {
      const { label, options, defaultValue, noInsert } = parseChoiceMarker(marker[1])
      if (options && options.length) {
        const node: ChoiceNode = { type: 'choice', label, options }
        if (defaultValue) node.defaultValue = defaultValue
        if (noInsert) node.noInsert = true
        nodes.push(node)
      } else {
        nodes.push({ type: 'step', label })
      }
    } else {
      nodes.push({ type: 'text', content: part })
    }
  }
  return nodes
}

function leadingWS(line: string): number {
  const m = line.match(/^[ \t]*/)
  return m ? m[0].length : 0
}

function dedent(lines: string[]): string[] {
  const indents = lines.filter(l => l.trim() !== '').map(leadingWS)
  const min = indents.length ? Math.min(...indents) : 0
  return lines.map(l => l.slice(min))
}

function parseLines(lines: string[]): TemplateNode[] {
  const nodes: TemplateNode[] = []
  let buf: string[] = []
  const flush = () => {
    if (!buf.length) return
    nodes.push(...parseInline(buf.join('\n')))
    buf = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const isIfHere = leadingWS(line) === 0 && matchIf(line)
    if (!isIfHere) { buf.push(line); i++; continue }

    flush()
    const first = matchIf(line)!
    const triggerField = first.field
    const branches: Record<string, TemplateNode[]> = {}
    let inlineOptions: string[] | undefined = first.inlineOptions

    while (i < lines.length) {
      if (leadingWS(lines[i]) !== 0) break
      const m = matchIf(lines[i])
      if (!m || m.field !== triggerField) break
      if (m.inlineOptions) inlineOptions = m.inlineOptions
      const value = m.value
      i++
      const body: string[] = []
      while (i < lines.length && (lines[i].trim() === '' || leadingWS(lines[i]) > 0)) {
        body.push(lines[i]); i++
      }
      while (body.length && body[body.length - 1].trim() === '') body.pop()
      branches[value] = parseLines(dedent(body))
    }

    const branch: BranchNode = { type: 'branch', triggerField, branches }
    if (inlineOptions) { branch.label = triggerField; branch.options = inlineOptions }
    nodes.push(branch)
  }

  flush()
  return nodes
}

function hasMarkup(nodes: TemplateNode[]): boolean {
  return nodes.some(n => n.type !== 'text')
}

function renderPreview(nodes: TemplateNode[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') out += n.content
    else if (n.type === 'step') out += `[${n.label}]`
    else if (n.type === 'choice') out += n.noInsert ? '' : (n.defaultValue ?? n.options[0] ?? `[${n.label}]`)
    else if (n.type === 'branch') {
      const first = Object.values(n.branches)[0]
      if (first) out += renderPreview(first)
    }
  }
  return out
}

function serializeNodes(nodes: TemplateNode[], indent = ''): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') out += n.content
    else if (n.type === 'step') out += `[${n.label}]`
    else if (n.type === 'choice') {
      const opts = n.options.map(o => (o === n.defaultValue && o !== n.options[0] ? `*${o}*` : o)).join(' | ')
      out += `[${n.noInsert ? '?' : ''}${n.label}: ${opts}]`
    } else if (n.type === 'branch') {
      for (const [value, body] of Object.entries(n.branches)) {
        const gate = n.options ? `[${n.triggerField}: ${n.options.join(' | ')}]` : n.triggerField
        const bodyText = serializeNodes(body, indent + '  ')
          .split('\n').map(l => (l ? indent + '  ' + l : l)).join('\n')
        out += `\n${indent}IF ${gate} = ${value}:\n${bodyText}`
      }
    }
  }
  return out
}

function expanderToBody(e: TextExpander): string {
  if (e.template && e.template.length) return serializeNodes(e.template)
  return e.expansion ?? ''
}

// ── PE block label ↔ key (provider templates store top-level block keys) ─────

const PE_LABEL_TO_KEY = new Map(MASTER_BLOCKS.map(b => [b.label.toLowerCase(), b.key]))
const PE_KEY_TO_LABEL = new Map(MASTER_BLOCKS.map(b => [b.key, b.label]))

// ── Column schemas ───────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = ['Abbr', 'Body'] as const

const ORDER_SET_COLUMNS: { header: string; key: PlanBlockKey }[] = [
  { header: 'Medications', key: 'meds' },
  { header: 'Lab', key: 'lab' },
  { header: 'Radiology', key: 'radiology' },
  { header: 'Referral', key: 'referral' },
  { header: 'Follow-Up', key: 'followUp' },
  { header: 'Instructions', key: 'instructions' },
]
const ORDER_SET_HEADERS = ['Name', ...ORDER_SET_COLUMNS.map(c => c.header)]

const PROVIDER_HEADERS = [
  'Name', 'HPI Shortcuts', 'HPI Text', 'PE Blocks', 'PE Text',
  'Assessment Shortcuts', 'Assessment Text', 'Plan Order Set', 'Plan Shortcuts', 'Plan Text',
] as const

// ── Export ───────────────────────────────────────────────────────────────────

export function exportTemplatesCSV(expanders: TextExpander[]): void {
  const rows = expanders.map(e => buildRow([e.abbr, expanderToBody(e)], TEMPLATE_HEADERS.length))
  download([TEMPLATE_HEADERS.join(','), ...rows], 'text-templates')
}

export function exportOrderSetsCSV(orderSets: PlanOrderSet[]): void {
  const rows = orderSets.map(os =>
    buildRow([os.name, ...ORDER_SET_COLUMNS.map(c => (os.presets[c.key] ?? []).join('; '))], ORDER_SET_HEADERS.length),
  )
  download([ORDER_SET_HEADERS.join(','), ...rows], 'order-sets')
}

export function exportProviderTemplatesCSV(templates: ProviderNoteTemplate[], orderSets: PlanOrderSet[]): void {
  const setNameById = new Map(orderSets.map(s => [s.id, s.name]))
  const rows = templates.map(t => buildRow([
    t.name,
    (t.hpiExpanderAbbrs ?? []).join('; '),
    t.hpiText ?? '',
    (t.peBlockKeys ?? []).map(k => PE_KEY_TO_LABEL.get(k) ?? k).join('; '),
    t.peText ?? '',
    (t.assessmentExpanderAbbrs ?? []).join('; '),
    t.assessmentText ?? '',
    t.planOrderSetId ? setNameById.get(t.planOrderSetId) ?? '' : '',
    (t.planExpanderAbbrs ?? []).join('; '),
    t.planText ?? '',
  ], PROVIDER_HEADERS.length))
  download([PROVIDER_HEADERS.join(','), ...rows], 'provider-templates')
}

function download(lines: string[], base: string): void {
  downloadCSVString(lines.join('\r\n'), `${base}-${new Date().toISOString().slice(0, 10)}.csv`)
}

// ── Starter templates ─────────────────────────────────────────────────────────

export function downloadNoteBlocksTemplate(kind: NoteBlocksCSVKind): void {
  if (kind === 'templates') {
    const example =
      'Pt seen for [Complaint].\n' +
      'Disposition: [Dispo: Quarters | Duty | Profile]\n\n' +
      'IF Dispo = Quarters:\n  24h quarters. Reassess in AM.\n' +
      'IF Dispo = Profile:\n  Temporary profile x[Days] days.'
    download([TEMPLATE_HEADERS.join(','), buildRow(['sickcall', example], 2)], 'text-templates-import')
  } else if (kind === 'orderSets') {
    download([
      ORDER_SET_HEADERS.join(','),
      buildRow(['URI', 'Acetaminophen 1000mg; Ibuprofen 800mg', '', '', '', 'RTC if worsening', 'Rest, fluids'], ORDER_SET_HEADERS.length),
    ], 'order-sets-import')
  } else {
    download([
      PROVIDER_HEADERS.join(','),
      buildRow(['Sick Call', 'hpi', '', 'General; HEENT', '', '', '', 'URI', 'plan', ''], PROVIDER_HEADERS.length),
    ], 'provider-templates-import')
  }
}

// ── Parse ──────────────────────────────────────────────────────────────────────

/** Unified preview row — every kind reduces to this for the import drawer. */
export interface CsvPreviewRow {
  primary: string
  secondary: string
  /** Render a marker icon (e.g. interactive template). */
  flag?: boolean
}

export interface NoteBlocksCsvParse {
  kind: NoteBlocksCSVKind
  /** Bundle payload for 'templates' / 'orderSets'. */
  data?: NoteBlocksData
  /** Payload for 'providerTemplates'. */
  providerTemplates?: ProviderNoteTemplate[]
  errors: string[]
  warnings: string[]
  previews: CsvPreviewRow[]
}

function emptyTags(): PlanOrderTags {
  return { referral: [], meds: [], radiology: [], lab: [], followUp: [] }
}

const HEADER_HINTS: Record<NoteBlocksCSVKind, (norm: string[]) => boolean> = {
  templates: norm => norm.includes('abbr') || norm.includes('body'),
  orderSets: norm => norm.includes('name') && ORDER_SET_COLUMNS.some(c => norm.includes(c.header.toLowerCase())),
  providerTemplates: norm => norm.includes('name') && norm.some(h => h.includes('hpi') || h.includes('assessment')),
}

export function parseNoteBlocksCSV(file: File, kind: NoteBlocksCSVKind, ctx: CsvParseCtx = {}): Promise<NoteBlocksCsvParse> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(parseText(reader.result as string, kind, ctx))
    reader.onerror = () => resolve({ kind, errors: ['Failed to read file'], warnings: [], previews: [] })
    reader.readAsText(file)
  })
}

function parseText(text: string, kind: NoteBlocksCSVKind, ctx: CsvParseCtx): NoteBlocksCsvParse {
  const lines = splitCSVLines(text)
  const errors: string[] = []
  const warnings: string[] = []
  if (lines.length === 0) return { kind, errors: ['File is empty'], warnings, previews: [] }

  const headerNorm = parseCSVRow(lines[0]).map(f => f.trim().toLowerCase())
  if (!HEADER_HINTS[kind](headerNorm)) {
    warnings.push('Header row doesn’t match this content type — parsed anyway.')
  }

  const dataLines = lines.slice(1)
  if (kind === 'templates') return parseTemplateRows(kind, dataLines, errors, warnings)
  if (kind === 'orderSets') return parseOrderSetRows(kind, dataLines, errors, warnings)
  return parseProviderRows(kind, dataLines, errors, warnings, ctx)
}

function dedupeName(name: string, seen: Set<string>, lineNum: number, noun: string, warnings: string[]): boolean {
  const key = name.toLowerCase()
  if (seen.has(key)) { warnings.push(`Row ${lineNum}: duplicate ${noun} "${name}" in file — skipped`); return false }
  seen.add(key)
  return true
}

function parseTemplateRows(kind: NoteBlocksCSVKind, dataLines: string[], errors: string[], warnings: string[]): NoteBlocksCsvParse {
  const expanders: TextExpander[] = []
  const previews: CsvPreviewRow[] = []
  const seen = new Set<string>()

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2
    const fields = parseCSVRow(dataLines[i])
    if (fields.every(f => f.trim() === '')) continue

    const abbr = (fields[0] ?? '').trim()
    if (!abbr) { errors.push(`Row ${lineNum}: Abbr is required`); continue }
    if (/\s/.test(abbr)) { errors.push(`Row ${lineNum}: Abbr "${abbr}" can’t contain spaces`); continue }
    if (!dedupeName(abbr, seen, lineNum, 'abbr', warnings)) continue

    const body = (fields[1] ?? '').trim()
    if (!body) { errors.push(`Row ${lineNum}: Body is empty for "${abbr}"`); continue }

    const nodes = parseLines(body.replace(/\r\n/g, '\n').split('\n'))
    if (hasMarkup(nodes)) {
      const choiceLabels = new Set(getChoiceLabels(nodes))
      for (const n of nodes) {
        if (n.type === 'branch' && !n.options && !choiceLabels.has(n.triggerField)) {
          warnings.push(`Row ${lineNum} ("${abbr}"): IF refers to "${n.triggerField}" but there is no [${n.triggerField}: …] choice`)
        }
      }
      expanders.push({ abbr, expansion: '', template: nodes })
      previews.push({ primary: abbr, secondary: renderPreview(nodes), flag: true })
    } else {
      expanders.push({ abbr, expansion: body })
      previews.push({ primary: abbr, secondary: body })
    }
  }

  return { kind, data: expanders.length ? { textExpanders: expanders } : {}, errors, warnings, previews }
}

function parseOrderSetRows(kind: NoteBlocksCSVKind, dataLines: string[], errors: string[], warnings: string[]): NoteBlocksCsvParse {
  const orderSets: PlanOrderSet[] = []
  const previews: CsvPreviewRow[] = []
  const tags = emptyTags()
  const instructionTags: string[] = []
  const seen = new Set<string>()
  const tagSeen: Record<string, Set<string>> = { meds: new Set(), lab: new Set(), radiology: new Set(), referral: new Set(), followUp: new Set() }
  const instrSeen = new Set<string>()

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2
    const fields = parseCSVRow(dataLines[i])
    if (fields.every(f => f.trim() === '')) continue

    const name = (fields[0] ?? '').trim()
    if (!name) { errors.push(`Row ${lineNum}: Name is required`); continue }
    if (!dedupeName(name, seen, lineNum, 'order set', warnings)) continue

    const presets: Partial<Record<PlanBlockKey, string[]>> = {}
    let count = 0
    ORDER_SET_COLUMNS.forEach((col, idx) => {
      const cellTags = splitList(fields[idx + 1] ?? '')
      if (!cellTags.length) return
      presets[col.key] = cellTags
      count += cellTags.length
      for (const t of cellTags) {
        if (col.key === 'instructions') {
          if (!instrSeen.has(t.toLowerCase())) { instrSeen.add(t.toLowerCase()); instructionTags.push(t) }
        } else if (!tagSeen[col.key].has(t.toLowerCase())) {
          tagSeen[col.key].add(t.toLowerCase())
          tags[col.key as keyof PlanOrderTags].push(t)
        }
      }
    })

    orderSets.push({ id: crypto.randomUUID(), name, presets })
    previews.push({ primary: name, secondary: count ? `${count} tag${count === 1 ? '' : 's'}` : 'no tags' })
  }

  const data: NoteBlocksData = {}
  if (orderSets.length) data.planOrderSets = orderSets
  if (PLAN_ORDER_CATEGORIES.some(c => tags[c].length)) data.planOrderTags = tags
  if (instructionTags.length) data.planInstructionTags = instructionTags

  return { kind, data, errors, warnings, previews }
}

function parseProviderRows(kind: NoteBlocksCSVKind, dataLines: string[], errors: string[], warnings: string[], ctx: CsvParseCtx): NoteBlocksCsvParse {
  const templates: ProviderNoteTemplate[] = []
  const previews: CsvPreviewRow[] = []
  const seen = new Set<string>()

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2
    const f = parseCSVRow(dataLines[i])
    if (f.every(x => x.trim() === '')) continue

    const name = (f[0] ?? '').trim()
    if (!name) { errors.push(`Row ${lineNum}: Name is required`); continue }
    if (!dedupeName(name, seen, lineNum, 'template', warnings)) continue

    const t: ProviderNoteTemplate = { id: crypto.randomUUID(), name }
    const parts: string[] = []

    const hpiAbbrs = splitList(f[1] ?? '')
    if (hpiAbbrs.length) { t.hpiExpanderAbbrs = hpiAbbrs; parts.push('HPI') }
    if ((f[2] ?? '').trim()) { t.hpiText = f[2].trim(); if (!hpiAbbrs.length) parts.push('HPI') }

    const peLabels = splitList(f[3] ?? '')
    if (peLabels.length) {
      const keys: string[] = []
      for (const lbl of peLabels) {
        const key = PE_LABEL_TO_KEY.get(lbl.toLowerCase())
        if (key) keys.push(key)
        else warnings.push(`Row ${lineNum} ("${name}"): unknown PE block "${lbl}" — skipped`)
      }
      if (keys.length) { t.peBlockKeys = keys; parts.push(`PE (${keys.length})`) }
    }
    if ((f[4] ?? '').trim()) { t.peText = f[4].trim(); if (!t.peBlockKeys) parts.push('PE') }

    const aAbbrs = splitList(f[5] ?? '')
    if (aAbbrs.length) { t.assessmentExpanderAbbrs = aAbbrs; parts.push('Assess') }
    if ((f[6] ?? '').trim()) { t.assessmentText = f[6].trim(); if (!aAbbrs.length) parts.push('Assess') }

    const setName = (f[7] ?? '').trim()
    if (setName) {
      const id = ctx.orderSetIdByName?.get(setName.toLowerCase())
      if (id) t.planOrderSetId = id
      else warnings.push(`Row ${lineNum} ("${name}"): order set "${setName}" not found — left unset`)
    }
    const planAbbrs = splitList(f[8] ?? '')
    if (planAbbrs.length) t.planExpanderAbbrs = planAbbrs
    if ((f[9] ?? '').trim()) t.planText = f[9].trim()
    if (t.planOrderSetId || planAbbrs.length || t.planText) parts.push('Plan')

    templates.push(t)
    previews.push({ primary: name, secondary: parts.join(' · ') || 'Empty' })
  }

  return { kind, providerTemplates: templates, errors, warnings, previews }
}
