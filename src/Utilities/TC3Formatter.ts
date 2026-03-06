// Utilities/TC3Formatter.ts
// Pure formatting functions for generating readable note text from TC3 Card state.
// Mimics the DD Form 1380 (TCCC Casualty Card) layout.

import type { TC3Card } from '../Types/TC3Types'
import type { UserTypes } from '../Data/User'
import { formatSignature } from './NoteFormatter'
import { getRegionLabel } from './bodyRegionMap'

function fmt(label: string, value: string): string {
  return value ? `${label}: ${value}` : ''
}

function fmtDateTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', hour12: false })
  } catch { return iso }
}

function line(width: number): string {
  return '─'.repeat(width)
}

/** Format TC3Card casualty info — DD1380 Block 1 */
function formatCasualty(card: TC3Card): string {
  const c = card.casualty
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 1. CASUALTY INFORMATION' + ' '.repeat(14) + '│',
    '├' + line(38) + '┤',
  ]
  if (c.battleRosterNo) lines.push(`│  Battle Roster #: ${c.battleRosterNo.padEnd(18)}│`)
  if (c.lastName || c.firstName) lines.push(`│  Name: ${(c.lastName + ', ' + c.firstName).padEnd(29)}│`)
  if (c.last4) lines.push(`│  Last 4: ${c.last4.padEnd(27)}│`)
  if (c.unit) lines.push(`│  Unit: ${c.unit.padEnd(29)}│`)
  if (c.dateTimeOfInjury) lines.push(`│  DTG Injury: ${fmtDateTime(c.dateTimeOfInjury).padEnd(23)}│`)
  if (c.dateTimeOfTreatment) lines.push(`│  DTG Treatment: ${fmtDateTime(c.dateTimeOfTreatment).padEnd(20)}│`)
  lines.push('└' + line(38) + '┘')
  return lines.length > 4 ? lines.join('\n') : ''
}

/** Format mechanism of injury — DD1380 Block 2 */
function formatMechanism(card: TC3Card): string {
  const m = card.mechanism
  if (m.types.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 2. MECHANISM OF INJURY' + ' '.repeat(15) + '│',
    '├' + line(38) + '┤',
    `│  ${m.types.map(t => `[X] ${t.toUpperCase()}`).join('  ').padEnd(36)}│`,
  ]
  if (m.types.includes('other') && m.otherDescription) {
    lines.push(`│  Other: ${m.otherDescription.substring(0, 28).padEnd(28)}│`)
  }
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format injury locations — DD1380 Block 3 */
function formatInjuries(card: TC3Card): string {
  if (card.injuries.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 3. INJURIES' + ' '.repeat(26) + '│',
    '├' + line(38) + '┤',
  ]
  card.injuries.forEach((inj, i) => {
    const region = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : inj.side
    const typeStr = `${inj.type} (${region})`
    lines.push(`│  ${(i + 1)}. ${typeStr.padEnd(33)}│`)
    if (inj.description) {
      lines.push(`│     ${inj.description.substring(0, 32).padEnd(32)}│`)
    }
    if (inj.treatmentLinks && inj.treatmentLinks.length > 0) {
      inj.treatmentLinks.forEach(link => {
        lines.push(`│     → ${link.description.substring(0, 30).padEnd(30)}│`)
      })
    }
  })
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format MARCH protocol — DD1380 Block 4-5 */
function formatMARCH(card: TC3Card): string {
  const m = card.march
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 4. TREATMENT (MARCH)' + ' '.repeat(17) + '│',
    '├' + line(38) + '┤',
  ]

  let hasContent = false

  // M — Massive Hemorrhage
  if (m.massiveHemorrhage.tourniquets.length > 0 || m.massiveHemorrhage.hemostatics.length > 0) {
    hasContent = true
    lines.push('│  [M] MASSIVE HEMORRHAGE' + ' '.repeat(14) + '│')
    m.massiveHemorrhage.tourniquets.forEach(tq => {
      lines.push(`│    TQ: ${tq.type} @ ${tq.location}`.padEnd(39) + '│')
      if (tq.time) lines.push(`│    Time: ${tq.time}`.padEnd(39) + '│')
    })
    m.massiveHemorrhage.hemostatics.forEach(h => {
      lines.push(`│    Hemostatic: ${h.type} @ ${h.location}`.padEnd(39) + '│')
    })
  }

  // A — Airway
  const airwayItems: string[] = []
  if (m.airway.intact) airwayItems.push('Intact')
  if (m.airway.npa) airwayItems.push('NPA')
  if (m.airway.cric) airwayItems.push('Cric')
  if (m.airway.ett) airwayItems.push('ETT')
  if (m.airway.supraglottic) airwayItems.push('Supraglottic')
  if (m.airway.chinLift) airwayItems.push('Chin Lift')
  if (airwayItems.length > 0) {
    hasContent = true
    lines.push(`│  [A] AIRWAY: ${airwayItems.join(', ')}`.padEnd(39) + '│')
  }

  // R — Respiration
  const respItems: string[] = []
  if (m.respiration.needleDecomp.performed) {
    respItems.push(`Needle Decomp (${m.respiration.needleDecomp.side})`)
  }
  if (m.respiration.chestSeal.applied) {
    respItems.push(`Chest Seal (${m.respiration.chestSeal.side})`)
  }
  if (m.respiration.o2) {
    respItems.push(`O2 via ${m.respiration.o2Method || '?'}`)
  }
  if (respItems.length > 0) {
    hasContent = true
    lines.push('│  [R] RESPIRATION' + ' '.repeat(21) + '│')
    respItems.forEach(item => {
      lines.push(`│    ${item}`.padEnd(39) + '│')
    })
  }

  // C — Circulation
  const circItems: string[] = []
  m.circulation.ivAccess.forEach(iv => {
    circItems.push(`${iv.type} ${iv.gauge} @ ${iv.site}`)
  })
  m.circulation.fluids.forEach(f => {
    circItems.push(`Fluid: ${f.type} ${f.volume}`)
  })
  m.circulation.bloodProducts.forEach(b => {
    circItems.push(`Blood: ${b.type} ${b.volume}`)
  })
  if (circItems.length > 0) {
    hasContent = true
    lines.push('│  [C] CIRCULATION' + ' '.repeat(21) + '│')
    circItems.forEach(item => {
      lines.push(`│    ${item}`.padEnd(39) + '│')
    })
  }

  // H — Hypothermia
  if (m.hypothermia.prevention) {
    hasContent = true
    const method = m.hypothermia.method || 'Yes'
    lines.push(`│  [H] HYPOTHERMIA: ${method}`.padEnd(39) + '│')
  }

  if (!hasContent) return ''
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format medications — DD1380 Block 6 */
function formatMedications(card: TC3Card): string {
  if (card.medications.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 5. MEDICATIONS ADMINISTERED' + ' '.repeat(10) + '│',
    '├' + line(38) + '┤',
  ]
  card.medications.forEach(med => {
    lines.push(`│  ${med.name} ${med.dose} ${med.route}`.padEnd(39) + '│')
    if (med.time) lines.push(`│    Time: ${med.time}`.padEnd(39) + '│')
  })
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format vital signs — DD1380 Block 7 */
function formatVitals(card: TC3Card): string {
  const parts: string[] = []

  // Vital sets
  if (card.vitals.length > 0) {
    const lines: string[] = [
      '┌' + line(38) + '┐',
      '│ 6. VITAL SIGNS' + ' '.repeat(23) + '│',
      '├' + line(38) + '┤',
    ]
    card.vitals.forEach((vs, i) => {
      lines.push(`│  Set #${i + 1} (${vs.time})`.padEnd(39) + '│')
      const items = [
        fmt('HR', vs.pulse),
        fmt('BP', vs.bp),
        fmt('RR', vs.rr),
        fmt('SpO2', vs.spo2),
      ].filter(Boolean)
      if (items.length > 0) lines.push(`│    ${items.join(', ')}`.padEnd(39) + '│')
      lines.push(`│    AVPU: ${vs.avpu}  Pain: ${vs.painScale || '-'}`.padEnd(39) + '│')
    })
    lines.push('└' + line(38) + '┘')
    parts.push(lines.join('\n'))
  }

  // Mental status (separate block if not captured in vitals)
  if (card.avpu || card.gcs) {
    const lines: string[] = [
      '┌' + line(38) + '┐',
      '│ 7. MENTAL STATUS' + ' '.repeat(21) + '│',
      '├' + line(38) + '┤',
    ]
    if (card.avpu) lines.push(`│  AVPU: ${card.avpu}`.padEnd(39) + '│')
    if (card.gcs) {
      const total = card.gcs.eye + card.gcs.verbal + card.gcs.motor
      lines.push(`│  GCS: ${total} (E${card.gcs.eye} V${card.gcs.verbal} M${card.gcs.motor})`.padEnd(39) + '│')
    }
    lines.push('└' + line(38) + '┘')
    parts.push(lines.join('\n'))
  }

  return parts.join('\n\n')
}

/** Format evacuation — DD1380 Block 8 */
function formatEvacuation(card: TC3Card): string {
  if (!card.evacuation.priority) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 8. EVACUATION' + ' '.repeat(24) + '│',
    '├' + line(38) + '┤',
    `│  Priority: ${card.evacuation.priority}`.padEnd(39) + '│',
    '└' + line(38) + '┘',
  ]
  return lines.join('\n')
}

/** Assemble the full TC3 card into a formatted text note mimicking DD1380 layout. */
export function formatTC3Note(card: TC3Card, profile?: UserTypes): string {
  const sections: string[] = [
    '╔' + '═'.repeat(38) + '╗',
    '║   DD FORM 1380 — TCCC CASUALTY CARD  ║',
    '╚' + '═'.repeat(38) + '╝',
  ]

  const casualty = formatCasualty(card)
  if (casualty) sections.push(casualty)

  const mechanism = formatMechanism(card)
  if (mechanism) sections.push(mechanism)

  const injuries = formatInjuries(card)
  if (injuries) sections.push(injuries)

  const march = formatMARCH(card)
  if (march) sections.push(march)

  const meds = formatMedications(card)
  if (meds) sections.push(meds)

  const vitals = formatVitals(card)
  if (vitals) sections.push(vitals)

  const evac = formatEvacuation(card)
  if (evac) sections.push(evac)

  if (card.notes.trim()) {
    const noteLines = [
      '┌' + line(38) + '┐',
      '│ NOTES' + ' '.repeat(32) + '│',
      '├' + line(38) + '┤',
      `│  ${card.notes.trim().substring(0, 35).padEnd(36)}│`,
    ]
    // Handle multi-line notes
    const remaining = card.notes.trim().substring(35)
    for (let i = 0; i < remaining.length; i += 36) {
      noteLines.push(`│  ${remaining.substring(i, i + 36).padEnd(36)}│`)
    }
    noteLines.push('└' + line(38) + '┘')
    sections.push(noteLines.join('\n'))
  }

  if (profile) {
    const sig = formatSignature(profile)
    if (sig) sections.push(sig)
  }

  return sections.join('\n\n')
}
