// Utilities/TC3Formatter.ts
// Pure formatting functions for generating readable note text from TC3 Card state.

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

function formatCasualty(card: TC3Card): string {
  const c = card.casualty
  const lines: string[] = ['CASUALTY INFORMATION']
  if (card.evacuation.priority) lines.push(`EVAC: ${card.evacuation.priority}`)
  if (c.battleRosterNo) lines.push(`Battle Roster #: ${c.battleRosterNo}`)
  if (c.lastName || c.firstName) lines.push(`Name: ${[c.lastName, c.firstName].filter(Boolean).join(', ')}`)
  if (c.last4) lines.push(`Last 4: ${c.last4}`)
  if (c.sex) lines.push(`Sex: ${c.sex}`)
  if (c.bloodType) lines.push(`Blood Type: ${c.bloodType}`)
  if (c.service) lines.push(`Service: ${c.service}`)
  if (c.unit) lines.push(`Unit: ${c.unit}`)
  if (c.allergies) lines.push(`Allergies: ${c.allergies}`)
  const m = card.mechanism
  if (m.types.length > 0) {
    let moiLine = `MOI: ${m.types.join(', ')}`
    if (m.types.includes('Other') && m.otherDescription) moiLine += ` (${m.otherDescription})`
    lines.push(moiLine)
  }
  if (c.dateTimeOfInjury) lines.push(`DTG Injury: ${fmtDateTime(c.dateTimeOfInjury)}`)
  if (c.dateTimeOfTreatment) lines.push(`DTG Treatment: ${fmtDateTime(c.dateTimeOfTreatment)}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

function formatInjuries(card: TC3Card): string {
  if (card.markers.length > 0) {
    const lines: string[] = ['INJURIES & PROCEDURES']
    card.markers.forEach((m, i) => {
      const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : `(${Math.round(m.x)}%, ${Math.round(m.y)}%)`
      const items = [...m.injuries, ...m.treatments, ...m.procedures]
      const label = items.length > 0 ? items.join(', ') : 'Marker'
      const prio = m.priority ? ` [${m.priority}]` : ''
      lines.push(`${i + 1}. ${label}${prio}`)
      lines.push(`   ${region}`)
      if (m.dateTime) lines.push(`   ${m.dateTime.replace('T', ' ')}`)
      if (m.description) lines.push(`   ${m.description}`)
      if (m.procedures.length > 0 && m.gauge) lines.push(`   ${m.procedures.join('/')} ${m.gauge}`)
    })
    return lines.join('\n')
  }

  if (card.injuries.length === 0) return ''
  const lines: string[] = ['INJURIES']
  card.injuries.forEach((inj, i) => {
    const region = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : `(${Math.round(inj.x)}%, ${Math.round(inj.y)}%)`
    lines.push(`${i + 1}. ${inj.type} (${region})`)
    if (inj.description) lines.push(`   ${inj.description}`)
    if (inj.treatmentLinks && inj.treatmentLinks.length > 0) {
      inj.treatmentLinks.forEach(link => lines.push(`   → ${link.description}`))
    }
  })
  return lines.join('\n')
}

function formatTreatments(card: TC3Card): string {
  const m = card.march
  const lines: string[] = ['TREATMENTS']
  let hasContent = false

  if (m.massiveHemorrhage.tourniquets.length > 0 || m.massiveHemorrhage.hemostatics.length > 0) {
    hasContent = true
    lines.push('[C] HEMORRHAGE CONTROL')
    m.massiveHemorrhage.tourniquets.forEach(tq => {
      lines.push(`  TQ (${tq.tqCategory}): ${tq.type} @ ${tq.location}`)
      if (tq.time) lines.push(`  Time: ${tq.time}`)
    })
    m.massiveHemorrhage.hemostatics.forEach(h => {
      lines.push(`  Dressing (${h.dressingType}): ${h.type}`)
      if (h.location) lines.push(`  Location: ${h.location}`)
    })
  }

  const airwayItems: string[] = []
  if (m.airway.intact) airwayItems.push('Intact')
  if (m.airway.npa) airwayItems.push('NPA')
  if (m.airway.cric) airwayItems.push('CRIC')
  if (m.airway.ett) airwayItems.push('ET-Tube')
  if (m.airway.supraglottic) airwayItems.push('SGA')
  if (m.airway.chinLift) airwayItems.push('Chin Lift')
  if (airwayItems.length > 0) {
    hasContent = true
    lines.push(`[A] AIRWAY: ${airwayItems.join(', ')}`)
    if (m.airway.airwayType) lines.push(`  Type: ${m.airway.airwayType}`)
  }

  const breathItems: string[] = []
  if (m.respiration.o2) breathItems.push(`O2 via ${m.respiration.o2Method || '?'}`)
  if (m.respiration.needleDecomp.performed) breathItems.push(`Needle-D (${m.respiration.needleDecomp.side})`)
  if (m.respiration.chestTube) breathItems.push('Chest-Tube')
  if (m.respiration.chestSeal.applied) breathItems.push(`Chest-Seal (${m.respiration.chestSeal.side})`)
  if (breathItems.length > 0) {
    hasContent = true
    lines.push('[B] BREATHING')
    breathItems.forEach(item => lines.push(`  ${item}`))
  }

  if (!hasContent) return ''
  return lines.join('\n')
}

function formatMedications(card: TC3Card): string {
  if (card.medications.length === 0) return ''
  const lines: string[] = ['MEDICATIONS ADMINISTERED']

  const grouped: Record<MedCategory, typeof card.medications> = { Analgesic: [], Antibiotic: [], Other: [] }
  card.medications.forEach(med => {
    const cat = med.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(med)
  })

  for (const cat of ['Analgesic', 'Antibiotic', 'Other'] as MedCategory[]) {
    const meds = grouped[cat]
    if (!meds || meds.length === 0) continue
    lines.push(`[${cat.toUpperCase()}]`)
    meds.forEach(med => {
      lines.push(`  ${med.name} ${med.dose} ${med.route}`)
      if (med.time) lines.push(`  Time: ${med.time}`)
    })
  }

  return lines.join('\n')
}

function formatFluids(card: TC3Card): string {
  const circ = card.march.circulation
  if (circ.fluids.length === 0 && circ.bloodProducts.length === 0 && circ.ivAccess.length === 0) return ''
  const lines: string[] = ['FLUIDS & BLOOD PRODUCTS']

  circ.ivAccess.forEach(iv => lines.push(`Access: ${iv.type} ${iv.gauge} @ ${iv.site}`))
  if (circ.fluids.length > 0) {
    lines.push('FLUIDS:')
    circ.fluids.forEach(f => lines.push(`  ${f.type} ${f.volume} ${f.route} @ ${f.time}`))
  }
  if (circ.bloodProducts.length > 0) {
    lines.push('BLOOD PRODUCTS:')
    circ.bloodProducts.forEach(b => lines.push(`  ${b.type} ${b.volume} ${b.route} @ ${b.time}`))
  }

  return lines.join('\n')
}

function formatVitals(card: TC3Card): string {
  if (card.vitals.length === 0 && !card.avpu && !card.gcs) return ''

  const lines: string[] = ['VITAL SIGNS']

  // Mental status first
  const mentalParts: string[] = []
  if (card.avpu) mentalParts.push(`AVPU: ${card.avpu}`)
  if (card.gcs) {
    const total = card.gcs.eye + card.gcs.verbal + card.gcs.motor
    mentalParts.push(`GCS: ${total} (E${card.gcs.eye} V${card.gcs.verbal} M${card.gcs.motor})`)
  }
  if (mentalParts.length > 0) lines.push(`  ${mentalParts.join('  ')}`)

  card.vitals.forEach((vs, i) => {
    lines.push(`Set #${i + 1} (${vs.time})`)
    const items = [
      fmt('HR', vs.pulse),
      vs.pulseLocation ? `(${vs.pulseLocation})` : '',
      fmt('BP', vs.bp),
      fmt('RR', vs.rr),
      fmt('SpO2', vs.spo2),
    ].filter(Boolean)
    if (items.length > 0) lines.push(`  ${items.join(', ')}`)
    if (vs.painScale) lines.push(`  Pain: ${vs.painScale}`)
  })

  return lines.join('\n')
}

function formatOther(card: TC3Card): string {
  const o = card.other
  const items: string[] = []
  if (o.combatPillPack) items.push('Combat Pill Pack')
  if (o.eyeShield.applied) items.push(`Eye Shield (${o.eyeShield.side || 'N/A'})`)
  if (o.splint) items.push('Splint')
  if (o.hypothermiaPrevention.applied) items.push(`Hypothermia Prevention: ${o.hypothermiaPrevention.type || 'Yes'}`)
  if (items.length === 0) return ''

  return ['OTHER', ...items.map(item => `[X] ${item}`)].join('\n')
}

function formatFirstResponder(card: TC3Card): string {
  const fr = card.firstResponder
  if (!fr.lastName && !fr.firstName && !fr.last4) return ''
  const lines: string[] = ['FIRST RESPONDER']
  if (fr.lastName || fr.firstName) lines.push(`Name: ${[fr.lastName, fr.firstName].filter(Boolean).join(', ')}`)
  if (fr.last4) lines.push(`Last 4: ${fr.last4}`)
  return lines.join('\n')
}

/** Format a MIST handoff report for verbal/radio pre-hospital transfer. */
export function formatMISTReport(card: TC3Card): string {
  const lines: string[] = ['MIST REPORT', '-----------']

  // M — Mechanism
  const mTypes = card.mechanism.types.length > 0 ? [...card.mechanism.types] : []
  let mLine = mTypes.length > 0 ? mTypes.join(', ') : 'Unknown'
  if (card.mechanism.types.includes('Other') && card.mechanism.otherDescription) {
    mLine += ` (${card.mechanism.otherDescription})`
  }
  lines.push(`M - MECHANISM: ${mLine}`)

  // I — Injuries
  const injuryLines: string[] = []
  if (card.markers.length > 0) {
    card.markers.forEach((m, i) => {
      if (m.injuries.length === 0) return
      const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : `(${Math.round(m.x)}%, ${Math.round(m.y)}%)`
      injuryLines.push(`${i + 1}. ${m.injuries.join(', ')} (${region})`)
    })
  } else if (card.injuries.length > 0) {
    card.injuries.forEach((inj, i) => {
      const region = inj.bodyRegion ? getRegionLabel(inj.bodyRegion) : `(${Math.round(inj.x)}%, ${Math.round(inj.y)}%)`
      injuryLines.push(`${i + 1}. ${inj.type} (${region})`)
    })
  }
  if (injuryLines.length > 0) {
    lines.push(`I - INJURIES: ${injuryLines[0]}`)
    injuryLines.slice(1).forEach(l => lines.push(`              ${l}`))
  } else {
    lines.push('I - INJURIES: None documented')
  }

  // S — Signs & Symptoms
  const vs = card.vitals.length > 0 ? card.vitals[card.vitals.length - 1] : null
  if (vs || card.avpu || card.gcs) {
    const sParts: string[] = []
    if (card.avpu) sParts.push(`AVPU: ${card.avpu}`)
    if (vs) {
      if (vs.pulse) sParts.push(`HR: ${vs.pulse}`)
      if (vs.bp) sParts.push(`BP: ${vs.bp}`)
      if (vs.spo2) sParts.push(`SpO2: ${vs.spo2}`)
      if (vs.rr) sParts.push(`RR: ${vs.rr}`)
    }
    lines.push(`S - SIGNS: ${sParts.join('  ')}`)
    const s2Parts: string[] = []
    if (vs?.painScale) s2Parts.push(`Pain: ${vs.painScale}/10`)
    if (card.gcs) {
      const total = card.gcs.eye + card.gcs.verbal + card.gcs.motor
      s2Parts.push(`GCS: ${total}`)
    }
    if (s2Parts.length > 0) lines.push(`    ${s2Parts.join('  ')}`)
  } else {
    lines.push('S - SIGNS: Not assessed')
  }

  // T — Treatment
  const tLines: string[] = []
  const mh = card.march.massiveHemorrhage
  mh.tourniquets.forEach(tq => {
    const timePart = tq.time ? ` ${tq.time}` : ''
    tLines.push(`TQ (${tq.type}) @ ${tq.location}${timePart}`)
  })
  mh.hemostatics.forEach(h => {
    const locPart = h.location ? ` @ ${h.location}` : ''
    tLines.push(`${h.type} (${h.dressingType})${locPart}`)
  })
  card.medications.forEach(med => {
    const timePart = med.time ? ` ${med.time}` : ''
    tLines.push(`${med.name} ${med.dose} ${med.route}${timePart}`)
  })
  const circ = card.march.circulation
  circ.ivAccess.forEach(iv => tLines.push(`${iv.type} access ${iv.gauge} @ ${iv.site}`))
  circ.fluids.forEach(f => tLines.push(`${f.volume} ${f.type} given`))
  circ.bloodProducts.forEach(b => tLines.push(`${b.volume} ${b.type} given`))

  if (tLines.length > 0) {
    lines.push(`T - TREATMENT: ${tLines[0]}`)
    tLines.slice(1).forEach(l => lines.push(`               ${l}`))
  } else {
    lines.push('T - TREATMENT: None')
  }

  // Evac priority
  lines.push(`EVAC PRIORITY: ${card.evacuation.priority || 'Not assigned'}`)

  return lines.join('\n')
}

/** Assemble the full TC3 card into a plain text note. */
export function formatTC3Note(card: TC3Card, profile?: UserTypes): string {
  const sections: string[] = []

  const casualty = formatCasualty(card)
  if (casualty) sections.push(casualty)

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
    sections.push(`NOTES\n${card.notes.trim()}`)
  }

  const firstResponder = formatFirstResponder(card)
  if (firstResponder) sections.push(firstResponder)

  if (profile) {
    const sig = formatSignature(profile)
    if (sig) sections.push(sig)
  }

  return sections.join('\n\n')
}
