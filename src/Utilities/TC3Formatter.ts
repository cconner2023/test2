// Utilities/TC3Formatter.ts
// Pure formatting functions for generating readable note text from TC3 Card state.

import type { TC3Card } from '../Types/TC3Types'
import type { UserTypes } from '../Data/User'
import { formatSignature } from './NoteFormatter'

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

/** Format TC3Card casualty info section */
function formatCasualty(card: TC3Card): string {
  const c = card.casualty
  const lines: string[] = ['CASUALTY INFORMATION:']
  if (c.battleRosterNo) lines.push(`  Battle Roster #: ${c.battleRosterNo}`)
  if (c.lastName || c.firstName) lines.push(`  Name: ${c.lastName}, ${c.firstName}`)
  if (c.last4) lines.push(`  Last 4: ${c.last4}`)
  if (c.unit) lines.push(`  Unit: ${c.unit}`)
  if (c.dateTimeOfInjury) lines.push(`  DTG Injury: ${fmtDateTime(c.dateTimeOfInjury)}`)
  if (c.dateTimeOfTreatment) lines.push(`  DTG Treatment: ${fmtDateTime(c.dateTimeOfTreatment)}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

/** Format mechanism of injury */
function formatMechanism(card: TC3Card): string {
  const m = card.mechanism
  if (m.types.length === 0) return ''
  const lines: string[] = ['MECHANISM OF INJURY:']
  lines.push(`  ${m.types.map(t => t.toUpperCase()).join(', ')}`)
  if (m.types.includes('other') && m.otherDescription) {
    lines.push(`  Other: ${m.otherDescription}`)
  }
  return lines.join('\n')
}

/** Format injury locations */
function formatInjuries(card: TC3Card): string {
  if (card.injuries.length === 0) return ''
  const lines: string[] = ['INJURIES:']
  card.injuries.forEach((inj, i) => {
    const desc = inj.description ? ` — ${inj.description}` : ''
    lines.push(`  ${i + 1}. ${inj.type} (${inj.side})${desc}`)
  })
  return lines.join('\n')
}

/** Format MARCH protocol */
function formatMARCH(card: TC3Card): string {
  const m = card.march
  const lines: string[] = ['MARCH PROTOCOL:']

  // M — Massive Hemorrhage
  if (m.massiveHemorrhage.tourniquets.length > 0 || m.massiveHemorrhage.hemostatics.length > 0) {
    lines.push('  [M] Massive Hemorrhage:')
    m.massiveHemorrhage.tourniquets.forEach(tq => {
      lines.push(`    TQ: ${tq.type} @ ${tq.location} (${tq.time})`)
    })
    m.massiveHemorrhage.hemostatics.forEach(h => {
      lines.push(`    Hemostatic: ${h.type} @ ${h.location}`)
    })
  }

  // A — Airway
  const airwayItems: string[] = []
  if (m.airway.intact) airwayItems.push('Intact')
  if (m.airway.npa) airwayItems.push('NPA')
  if (m.airway.cric) airwayItems.push('Cric')
  if (m.airway.ett) airwayItems.push('ETT')
  if (m.airway.supraglottic) airwayItems.push('Supraglottic')
  if (m.airway.chinLift) airwayItems.push('Chin Lift/Jaw Thrust')
  if (airwayItems.length > 0) {
    lines.push(`  [A] Airway: ${airwayItems.join(', ')}`)
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
    respItems.push(`O2 via ${m.respiration.o2Method || 'unspecified'}`)
  }
  if (respItems.length > 0) {
    lines.push(`  [R] Respiration: ${respItems.join(', ')}`)
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
    lines.push('  [C] Circulation:')
    circItems.forEach(item => lines.push(`    ${item}`))
  }

  // H — Hypothermia
  if (m.hypothermia.prevention) {
    lines.push(`  [H] Hypothermia Prevention: ${m.hypothermia.method || 'Yes'}`)
  }

  return lines.length > 1 ? lines.join('\n') : ''
}

/** Format medications */
function formatMedications(card: TC3Card): string {
  if (card.medications.length === 0) return ''
  const lines: string[] = ['MEDICATIONS:']
  card.medications.forEach(med => {
    lines.push(`  ${med.name} ${med.dose} ${med.route} @ ${med.time}`)
  })
  return lines.join('\n')
}

/** Format vital signs */
function formatVitals(card: TC3Card): string {
  const parts: string[] = []

  // Mental status
  if (card.avpu) parts.push(`MENTAL STATUS: AVPU = ${card.avpu}`)
  if (card.gcs) {
    const total = card.gcs.eye + card.gcs.verbal + card.gcs.motor
    parts.push(`GCS: ${total} (E${card.gcs.eye} V${card.gcs.verbal} M${card.gcs.motor})`)
  }

  // Vital sets
  if (card.vitals.length > 0) {
    const lines: string[] = ['VITAL SIGNS:']
    card.vitals.forEach((vs, i) => {
      const items = [
        fmt('HR', vs.pulse),
        fmt('BP', vs.bp),
        fmt('RR', vs.rr),
        fmt('SpO2', vs.spo2),
        `AVPU: ${vs.avpu}`,
        fmt('Pain', vs.painScale),
      ].filter(Boolean)
      lines.push(`  Set #${i + 1} (${vs.time}): ${items.join(', ')}`)
    })
    parts.push(lines.join('\n'))
  }

  return parts.join('\n')
}

/** Format evacuation */
function formatEvacuation(card: TC3Card): string {
  if (!card.evacuation.priority && !card.evacuation.precedence) return ''
  const lines: string[] = ['EVACUATION:']
  if (card.evacuation.priority) lines.push(`  Priority: ${card.evacuation.priority}`)
  if (card.evacuation.precedence) lines.push(`  ${card.evacuation.precedence}`)
  return lines.join('\n')
}

/** Assemble the full TC3 card into a formatted text note. */
export function formatTC3Note(card: TC3Card, profile?: UserTypes): string {
  const sections: string[] = [
    'DD FORM 1380 — TCCC CASUALTY CARD',
    '═'.repeat(40),
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
    sections.push(`NOTES:\n  ${card.notes.trim()}`)
  }

  if (profile) {
    const sig = formatSignature(profile)
    if (sig) sections.push(sig)
  }

  return sections.join('\n\n')
}
