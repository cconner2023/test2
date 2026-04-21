// lib/reportExport.ts
// Text, download, and print-to-PDF export for all tactical report formats.

import type { LaceReport, Sitrep, Opord } from '../Types/ReportTypes'
import type { MedevacRequest } from '../Types/MedevacTypes'
import {
  MEDEVAC_PRECEDENCE_LABELS,
  MEDEVAC_EQUIPMENT_LABELS,
  MEDEVAC_SECURITY_LABELS,
  MEDEVAC_MARKING_LABELS,
  MEDEVAC_NATIONALITY_LABELS,
  MEDEVAC_NBC_LABELS,
  medevacPatientTotal,
  emptyMedevacRequest,
  type MedevacNationality,
} from '../Types/MedevacTypes'

// ── 9-Line MEDEVAC ────────────────────────────────────────────────────────────

export function medevacToText(req: MedevacRequest): string {
  const isWartime = req.mode !== 'peacetime'
  const lines: string[] = [`9-LINE MEDEVAC REQUEST (${isWartime ? 'WARTIME' : 'PEACETIME'})`, '']
  lines.push(`LINE 1 — PICKUP SITE: ${req.l1 || '—'}${req.l1d ? ` (${req.l1d})` : ''}`)
  lines.push(`LINE 2 — RADIO: ${req.l2f || '—'} / ${req.l2c || '—'}${req.l2s ? `-${req.l2s}` : ''}`)
  const breakdown = (Object.entries(req.l3) as [string, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${MEDEVAC_PRECEDENCE_LABELS[k as keyof typeof MEDEVAC_PRECEDENCE_LABELS]}`)
    .join(', ')
  lines.push(`LINE 3 — PATIENTS: ${medevacPatientTotal(req)} total (${breakdown || 'none'})`)
  lines.push(`LINE 4 — EQUIPMENT: ${req.l4.map(e => MEDEVAC_EQUIPMENT_LABELS[e]).join(', ')}`)
  lines.push(`LINE 5 — PATIENT TYPE: ${req.l5l} Litter / ${req.l5a} Ambulatory`)
  if (isWartime) {
    lines.push(`LINE 6 — SECURITY: ${MEDEVAC_SECURITY_LABELS[req.l6]}`)
  } else {
    const wounds = req.l6wounds ?? []
    if (wounds.length === 0) {
      lines.push('LINE 6 — WOUNDS/INJURIES: —')
    } else {
      lines.push(`LINE 6 — WOUNDS/INJURIES (${wounds.length}):`)
      wounds.forEach((w, i) => lines.push(`  ${i + 1}. ${w.text}`))
    }
  }
  let l7 = MEDEVAC_MARKING_LABELS[req.l7]
  if (req.l7 === 'C' && req.l7c) l7 += ` — ${req.l7c}`
  if (req.l7 === 'E' && req.l7o) l7 += ` — ${req.l7o}`
  lines.push(`LINE 7 — MARKING: ${l7}`)
  const l8text = (['A','B','C','D','E'] as MedevacNationality[])
    .filter(n => (req.l8[n] ?? 0) > 0)
    .map(n => `${req.l8[n]} ${MEDEVAC_NATIONALITY_LABELS[n]}`)
    .join(', ')
  lines.push(`LINE 8 — NATIONALITY: ${l8text || '—'}`)
  if (isWartime) {
    lines.push(`LINE 9 — NBC: ${MEDEVAC_NBC_LABELS[req.l9]}`)
  } else {
    lines.push(`LINE 9 — TERRAIN: ${req.l9p || '—'}`)
  }
  if (req.notes) lines.push(`\nNOTES: ${req.notes}`)
  return lines.join('\n')
}

// ── LACE ──────────────────────────────────────────────────────────────────────

export function laceToText(r: LaceReport): string {
  const lines: string[] = ['LACE REPORT', '']
  lines.push(`UNIT: ${r.unit || '—'}`)
  lines.push(`DTG:  ${r.dtg || '—'}`)
  lines.push('')
  lines.push('L — LIQUIDS')
  lines.push(`  On Hand:          ${r.waterLiters} L`)
  lines.push(`  Hours Remaining:  ${r.waterHours} hrs`)
  lines.push(`  Resupply Needed:  ${r.waterResupply ? 'YES' : 'NO'}`)
  lines.push('')
  lines.push('A — AMMUNITION')
  const activeAmmo = r.ammo.filter(a => a.onHand > 0)
  if (activeAmmo.length) {
    activeAmmo.forEach(a => {
      lines.push(`  ${a.type.padEnd(16)} ${String(a.onHand).padStart(6)} rds  (${a.pct}%)`)
    })
  } else {
    lines.push('  (none entered)')
  }
  lines.push('')
  lines.push('C — CASUALTIES')
  lines.push(`  KIA:              ${r.kia}`)
  lines.push(`  WIA Urgent:       ${r.wiaUrgent}`)
  lines.push(`  WIA Priority:     ${r.wiaPriority}`)
  lines.push(`  WIA Routine:      ${r.wiaRoutine}`)
  lines.push(`  Medevac Req:      ${r.medevacRequested ? 'YES' : 'NO'}`)
  lines.push('')
  lines.push('E — EQUIPMENT')
  if (r.equipment.length) {
    r.equipment.forEach(e => {
      lines.push(`  [${e.status}] ${e.item}${e.notes ? ` — ${e.notes}` : ''}`)
    })
  } else {
    lines.push('  (none entered)')
  }
  if (r.notes) lines.push(`\nNOTES: ${r.notes}`)
  return lines.join('\n')
}

// ── SITREP ────────────────────────────────────────────────────────────────────

export function sitrepToText(r: Sitrep): string {
  const lines: string[] = ['SITUATION REPORT (SITREP)', '']
  lines.push(`UNIT:     ${r.unit || '—'}`)
  lines.push(`DTG:      ${r.dtg || '—'}`)
  lines.push(`LOCATION: ${r.mgrs || '—'}`)
  lines.push('')
  lines.push(`SITUATION:\n  ${r.situation || '—'}`)
  lines.push('')
  lines.push('ENEMY ACTIVITY:')
  if (!r.enemyContact) {
    lines.push('  No enemy contact')
  } else {
    lines.push('  Contact: YES')
    if (r.enemyType) lines.push(`  Type: ${r.enemyType.replace('-', ' ').toUpperCase()}`)
    if (r.enemyDirection) lines.push(`  Direction: ${r.enemyDirection}`)
    if (r.enemyDistanceM) lines.push(`  Distance: ${r.enemyDistanceM}m`)
    if (r.actionsTaken) lines.push(`  Actions Taken: ${r.actionsTaken}`)
  }
  lines.push('')
  lines.push('FRIENDLY FORCES:')
  lines.push(`  Strength: ${r.strengthPct}%`)
  lines.push(`  Morale: ${r.morale.toUpperCase()}`)
  lines.push('')
  lines.push(`ASSESSMENT:\n  ${r.assessment || '—'}`)
  lines.push('')
  lines.push(`NEXT ACTION:\n  ${r.nextAction || '—'}${r.eta ? `\n  ETA: ${r.eta}` : ''}`)
  if (r.notes) lines.push(`\nNOTES: ${r.notes}`)
  return lines.join('\n')
}

// ── OPORD ─────────────────────────────────────────────────────────────────────

export function opordToText(r: Opord): string {
  const lines: string[] = [
    `OPERATION ORDER${r.operationName ? ` — ${r.operationName.toUpperCase()}` : ''}`,
    '',
    `UNIT: ${r.unit || '—'}`,
    `DTG:  ${r.dtg || '—'}`,
    '',
    '1. SITUATION',
    '  a. Enemy Forces',
    `     Composition:     ${r.enemyComposition || '—'}`,
    `     Recent Activity: ${r.enemyActivity || '—'}`,
    '  b. Friendly Forces',
    `     Higher:          ${r.friendlyHigher || '—'}`,
    `     Adjacent:        ${r.friendlyAdjacent || '—'}`,
    `  c. Attachments/Detachments: ${r.attachments || 'None'}`,
    `  d. Civil Considerations: ${r.civilConsiderations || 'None'}`,
    '',
    '2. MISSION',
    `  WHO:   ${r.missionWho || '—'}`,
    `  WHAT:  ${r.missionWhat || '—'}`,
    `  WHEN:  ${r.missionWhen || '—'}`,
    `  WHERE: ${r.missionWhere || '—'}`,
    `  WHY:   ${r.missionWhy || '—'}`,
    '',
    '3. EXECUTION',
    `  a. Commander\'s Intent: ${r.commanderIntent || '—'}`,
    `  b. Concept of Operations: ${r.conceptOfOps || '—'}`,
    '  c. Tasks to Subordinate Units:',
  ]
  if (r.subordinateTasks.length) {
    r.subordinateTasks.forEach(t => lines.push(`     ${t.unit}: ${t.task}`))
  } else {
    lines.push('     (none)')
  }
  lines.push(`  d. Coordinating Instructions: ${r.coordinatingInstructions || '—'}`)
  lines.push('')
  lines.push('4. ADMINISTRATION / LOGISTICS')
  lines.push('  a. Supply')
  lines.push(`     Class I  (Food/Water): ${r.supplyClass1 || '—'}`)
  lines.push(`     Class III (Fuel):      ${r.supplyClass3 || '—'}`)
  lines.push(`     Class V  (Ammo):       ${r.supplyClass5 || '—'}`)
  lines.push(`     Class VIII (Medical):  ${r.supplyClass8 || '—'}`)
  lines.push(`  b. Transportation: ${r.transportation || '—'}`)
  lines.push('  c. Medical')
  lines.push(`     CCP Location:    ${r.medicalCCP || '—'}`)
  lines.push(`     Medevac Channel: ${r.medevacChannel || '—'}`)
  lines.push('')
  lines.push('5. COMMAND AND SIGNAL')
  lines.push('  a. Command')
  lines.push(`     CO Location:  ${r.commandLocation || '—'}`)
  lines.push(`     Succession:   ${r.successionOfCommand || '—'}`)
  lines.push('  b. Signal')
  lines.push(`     Primary Freq:       ${r.freqPrimary || '—'}`)
  lines.push(`     Alternate Freq:     ${r.freqAlternate || '—'}`)
  lines.push(`     Call Signs:         ${r.callSigns || '—'}`)
  lines.push(`     Challenge/Password: ${r.challengePassword || '—'}`)
  lines.push(`     PACE Plan:          ${r.pacePlan || '—'}`)
  if (r.notes) lines.push(`\nNOTES: ${r.notes}`)
  return lines.join('\n')
}

// ── 9-Line compact encoding (for data matrix / import) ───────────────────────

const MEDEVAC_COMPACT_PREFIX = '9L:'

function _utf8ToB64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  )
}

function _b64ToUtf8(b64: string): string {
  return decodeURIComponent(
    Array.from(atob(b64))
      .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Compact base64 encoding of a MedevacRequest — used for data matrix barcodes. */
export function medevacToCompact(req: MedevacRequest): string {
  // Strip cross-domain link fields that are meaningless out of context
  const { tc3CardId: _a, featureId: _b, overlayId: _c, ...rest } = req
  return MEDEVAC_COMPACT_PREFIX + _utf8ToB64(JSON.stringify(rest))
}

/** Decode a compact-encoded string back to a MedevacRequest. Returns null on failure. */
export function medevacFromCompact(str: string): MedevacRequest | null {
  try {
    const trimmed = str.trim()
    if (!trimmed.startsWith(MEDEVAC_COMPACT_PREFIX)) return null
    const parsed = JSON.parse(_b64ToUtf8(trimmed.slice(MEDEVAC_COMPACT_PREFIX.length)))
    if (typeof parsed !== 'object' || !parsed) return null
    if (typeof parsed.mode !== 'string') return null
    return { ...emptyMedevacRequest(), ...parsed } as MedevacRequest
  } catch {
    return null
  }
}

// ── Shared export utilities ───────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function downloadAsText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function printReport(title: string, text: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  win.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.6;
         padding: 32px 48px; color: #000; background: #fff; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
  @media print { @page { margin: 1in; } }
</style>
</head><body><pre>${escaped}</pre>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`)
  win.document.close()
}
