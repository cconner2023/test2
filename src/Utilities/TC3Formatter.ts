// Utilities/TC3Formatter.ts
// Pure formatting functions for generating readable note text from TC3 Card state.
// Mimics the DD Form 1380 (TCCC Casualty Card) layout.

import type { TC3Card, MedCategory } from '../Types/TC3Types'
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
  if (card.evacuation.priority) lines.push(`│  EVAC: ${card.evacuation.priority.padEnd(29)}│`)
  if (c.battleRosterNo) lines.push(`│  Battle Roster #: ${c.battleRosterNo.padEnd(18)}│`)
  if (c.lastName || c.firstName) lines.push(`│  Name: ${(c.lastName + ', ' + c.firstName).padEnd(29)}│`)
  if (c.last4) lines.push(`│  Last 4: ${c.last4.padEnd(27)}│`)
  if (c.sex) lines.push(`│  Sex: ${c.sex.padEnd(31)}│`)
  if (c.service) lines.push(`│  Service: ${c.service.padEnd(26)}│`)
  if (c.unit) lines.push(`│  Unit: ${c.unit.padEnd(29)}│`)
  if (c.allergies) lines.push(`│  Allergies: ${c.allergies.substring(0, 24).padEnd(24)}│`)
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
    `│  ${m.types.map(t => `[X] ${t}`).join('  ').padEnd(36)}│`,
  ]
  if (m.types.includes('Other') && m.otherDescription) {
    lines.push(`│  Other: ${m.otherDescription.substring(0, 28).padEnd(28)}│`)
  }
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format injuries & procedures — DD1380 Block 3 */
function formatInjuries(card: TC3Card): string {
  // Use markers if available, fall back to legacy injuries
  if (card.markers.length > 0) {
    const lines: string[] = [
      '┌' + line(38) + '┐',
      '│ 3. INJURIES & PROCEDURES' + ' '.repeat(13) + '│',
      '├' + line(38) + '┤',
    ]
    card.markers.forEach((m, i) => {
      const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : `(${Math.round(m.x)}%, ${Math.round(m.y)}%)`
      const items: string[] = [
        ...m.injuries,
        ...m.treatments,
        ...m.procedures,
      ]
      const label = items.length > 0 ? items.join(', ') : 'Marker'
      const prio = m.priority ? ` [${m.priority}]` : ''
      lines.push(`│  ${(i + 1)}. ${(label + prio).substring(0, 33).padEnd(33)}│`)
      lines.push(`│     ${region.padEnd(33)}│`)
      if (m.dateTime) {
        const dt = m.dateTime.replace('T', ' ')
        lines.push(`│     ${dt.padEnd(33)}│`)
      }
      if (m.description) {
        lines.push(`│     ${m.description.substring(0, 32).padEnd(32)}│`)
      }
      if (m.procedures.length > 0 && m.gauge) {
        lines.push(`│     ${(m.procedures.join('/') + ' ' + m.gauge).padEnd(33)}│`)
      }
    })
    lines.push('└' + line(38) + '┘')
    return lines.join('\n')
  }

  // Legacy fallback
  if (card.injuries.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 3. INJURIES' + ' '.repeat(26) + '│',
    '├' + line(38) + '┤',
  ]
  card.injuries.forEach((inj, i) => {
    const region = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : `(${Math.round(inj.x)}%, ${Math.round(inj.y)}%)`
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

/** Format treatments — DD1380 Block 4 */
function formatTreatments(card: TC3Card): string {
  const m = card.march
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 4. TREATMENTS' + ' '.repeat(24) + '│',
    '├' + line(38) + '┤',
  ]

  let hasContent = false

  // C — Hemorrhage Control
  if (m.massiveHemorrhage.tourniquets.length > 0 || m.massiveHemorrhage.hemostatics.length > 0) {
    hasContent = true
    lines.push('│  [C] HEMORRHAGE CONTROL' + ' '.repeat(14) + '│')
    m.massiveHemorrhage.tourniquets.forEach(tq => {
      lines.push(`│    TQ (${tq.tqCategory}): ${tq.type} @ ${tq.location}`.padEnd(39) + '│')
      if (tq.time) lines.push(`│    Time: ${tq.time}`.padEnd(39) + '│')
    })
    m.massiveHemorrhage.hemostatics.forEach(h => {
      lines.push(`│    Dressing (${h.dressingType}): ${h.type}`.padEnd(39) + '│')
      if (h.location) lines.push(`│    Location: ${h.location}`.padEnd(39) + '│')
    })
  }

  // A — Airway
  const airwayItems: string[] = []
  if (m.airway.intact) airwayItems.push('Intact')
  if (m.airway.npa) airwayItems.push('NPA')
  if (m.airway.cric) airwayItems.push('CRIC')
  if (m.airway.ett) airwayItems.push('ET-Tube')
  if (m.airway.supraglottic) airwayItems.push('SGA')
  if (m.airway.chinLift) airwayItems.push('Chin Lift')
  if (airwayItems.length > 0) {
    hasContent = true
    lines.push(`│  [A] AIRWAY: ${airwayItems.join(', ')}`.padEnd(39) + '│')
    if (m.airway.airwayType) {
      lines.push(`│    Type: ${m.airway.airwayType}`.padEnd(39) + '│')
    }
  }

  // B — Breathing
  const breathItems: string[] = []
  if (m.respiration.o2) {
    breathItems.push(`O2 via ${m.respiration.o2Method || '?'}`)
  }
  if (m.respiration.needleDecomp.performed) {
    breathItems.push(`Needle-D (${m.respiration.needleDecomp.side})`)
  }
  if (m.respiration.chestTube) {
    breathItems.push('Chest-Tube')
  }
  if (m.respiration.chestSeal.applied) {
    breathItems.push(`Chest-Seal (${m.respiration.chestSeal.side})`)
  }
  if (breathItems.length > 0) {
    hasContent = true
    lines.push('│  [B] BREATHING' + ' '.repeat(23) + '│')
    breathItems.forEach(item => {
      lines.push(`│    ${item}`.padEnd(39) + '│')
    })
  }

  if (!hasContent) return ''
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format medications — DD1380 Block 5 (grouped by category) */
function formatMedications(card: TC3Card): string {
  if (card.medications.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ 5. MEDICATIONS ADMINISTERED' + ' '.repeat(10) + '│',
    '├' + line(38) + '┤',
  ]

  // Group by category
  const grouped: Record<MedCategory, typeof card.medications> = { Analgesic: [], Antibiotic: [], Other: [] }
  card.medications.forEach(med => {
    const cat = med.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(med)
  })

  for (const cat of ['Analgesic', 'Antibiotic', 'Other'] as MedCategory[]) {
    const meds = grouped[cat]
    if (!meds || meds.length === 0) continue
    lines.push(`│  [${cat.toUpperCase()}]`.padEnd(39) + '│')
    meds.forEach(med => {
      lines.push(`│    ${med.name} ${med.dose} ${med.route}`.padEnd(39) + '│')
      if (med.time) lines.push(`│    Time: ${med.time}`.padEnd(39) + '│')
    })
  }

  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format fluids & blood — DD1380 */
function formatFluids(card: TC3Card): string {
  const circ = card.march.circulation
  if (circ.fluids.length === 0 && circ.bloodProducts.length === 0 && circ.ivAccess.length === 0) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ FLUIDS & BLOOD PRODUCTS' + ' '.repeat(14) + '│',
    '├' + line(38) + '┤',
  ]

  circ.ivAccess.forEach(iv => {
    lines.push(`│  Access: ${iv.type} ${iv.gauge} @ ${iv.site}`.padEnd(39) + '│')
  })
  if (circ.fluids.length > 0) {
    lines.push('│  FLUIDS:' + ' '.repeat(29) + '│')
    circ.fluids.forEach(f => {
      lines.push(`│    ${f.type} ${f.volume} ${f.route} @ ${f.time}`.padEnd(39) + '│')
    })
  }
  if (circ.bloodProducts.length > 0) {
    lines.push('│  BLOOD PRODUCTS:' + ' '.repeat(21) + '│')
    circ.bloodProducts.forEach(b => {
      lines.push(`│    ${b.type} ${b.volume} ${b.route} @ ${b.time}`.padEnd(39) + '│')
    })
  }

  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format vital signs — DD1380 Block 6 */
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
        vs.pulseLocation ? `(${vs.pulseLocation})` : '',
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

/** Format OTHER section */
function formatOther(card: TC3Card): string {
  const o = card.other
  const items: string[] = []
  if (o.combatPillPack) items.push('Combat Pill Pack')
  if (o.eyeShield.applied) items.push(`Eye Shield (${o.eyeShield.side || 'N/A'})`)
  if (o.splint) items.push('Splint')
  if (o.hypothermiaPrevention.applied) items.push(`Hypothermia Prevention: ${o.hypothermiaPrevention.type || 'Yes'}`)

  if (items.length === 0) return ''

  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ OTHER' + ' '.repeat(32) + '│',
    '├' + line(38) + '┤',
  ]
  items.forEach(item => {
    lines.push(`│  [X] ${item}`.padEnd(39) + '│')
  })
  lines.push('└' + line(38) + '┘')
  return lines.join('\n')
}

/** Format first responder block */
function formatFirstResponder(card: TC3Card): string {
  const fr = card.firstResponder
  if (!fr.lastName && !fr.firstName && !fr.last4) return ''
  const lines: string[] = [
    '┌' + line(38) + '┐',
    '│ FIRST RESPONDER' + ' '.repeat(22) + '│',
    '├' + line(38) + '┤',
  ]
  if (fr.lastName || fr.firstName) {
    lines.push(`│  Name: ${(fr.lastName + ', ' + fr.firstName).padEnd(29)}│`)
  }
  if (fr.last4) lines.push(`│  Last 4: ${fr.last4.padEnd(27)}│`)
  lines.push('└' + line(38) + '┘')
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

  const treatments = formatTreatments(card)
  if (treatments) sections.push(treatments)

  const meds = formatMedications(card)
  if (meds) sections.push(meds)

  const fluids = formatFluids(card)
  if (fluids) sections.push(fluids)

  const vitals = formatVitals(card)
  if (vitals) sections.push(vitals)

  const other = formatOther(card)
  if (other) sections.push(other)

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

  const firstResponder = formatFirstResponder(card)
  if (firstResponder) sections.push(firstResponder)

  if (profile) {
    const sig = formatSignature(profile)
    if (sig) sections.push(sig)
  }

  return sections.join('\n\n')
}
