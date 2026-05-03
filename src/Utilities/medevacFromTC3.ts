// Utilities/medevacFromTC3.ts
// Derives a peacetime 9-line MEDEVAC projection from one or more TC3 cards.
// Pure — TC3Card is the source of truth; recompute on change.
// Non-derivable fields (L1 pickup, L2 radio, L7 marking, L8 nationality) are left empty
// for the medic / RTO to fill at request time.

import type { TC3Card, AVPU, InjuryType } from '../Types/TC3Types'
import {
  emptyMedevacRequest,
  type MedevacRequest,
  type MedevacEquipment,
  type MedevacPrecedence,
} from '../Types/MedevacTypes'
import { getRegionLabel } from './bodyRegionMap'

const INJURY_LABEL: Record<InjuryType, string> = {
  GSW: 'GSW',
  blast: 'Blast',
  burn: 'Burn',
  laceration: 'Laceration',
  fracture: 'Fracture',
  amputation: 'Amputation',
  other: 'Other',
}

/** Modern doctrine: every Urgent is treated as Urgent Surgical (B). A is unused. */
export function priorityToPrecedence(priority: TC3Card['evacuation']['priority']): MedevacPrecedence | null {
  switch (priority) {
    case 'Urgent':   return 'B'
    case 'Priority': return 'C'
    case 'Routine':  return 'D'
    default:         return null
  }
}

export interface TC3PatientCategory {
  cardId: string
  displayName: string
  precedence: MedevacPrecedence | null
}

/** Per-patient category list — UI breakdown beneath L3, not part of clipboard text. */
export function patientCategories(cards: TC3Card[]): TC3PatientCategory[] {
  return cards.map((c, i) => {
    const last = c.casualty.lastName.trim()
    const firstInitial = c.casualty.firstName.trim().charAt(0)
    const name =
      last && firstInitial ? `${last}, ${firstInitial}` :
      last || c.casualty.battleRosterNo || `Casualty #${i + 1}`
    return {
      cardId: c.id,
      displayName: name,
      precedence: priorityToPrecedence(c.evacuation.priority),
    }
  })
}

function avpuIsAmbulatory(avpu: AVPU | ''): boolean {
  return avpu === 'A'
}

function airwayHasIntervention(airway: TC3Card['march']['airway']): boolean {
  return airway.npa || airway.cric || airway.ett || airway.supraglottic || airway.chinLift
}

interface CardSummary {
  precedence: MedevacPrecedence | null
  ambulatory: boolean
  needsEquipment: boolean
  injuryGroups: Map<InjuryType, { region: string; description: string }[]>
}

function summarizeCard(card: TC3Card): CardSummary {
  const latestVitals = card.vitals.length > 0 ? card.vitals[card.vitals.length - 1] : null
  const ambulatory = latestVitals ? avpuIsAmbulatory(latestVitals.avpu) : false

  const injuryGroups = new Map<InjuryType, { region: string; description: string }[]>()
  card.markers.forEach(m => {
    const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : ''
    m.injuries.forEach(inj => {
      const list = injuryGroups.get(inj) ?? []
      list.push({ region, description: m.description })
      injuryGroups.set(inj, list)
    })
  })

  return {
    precedence: priorityToPrecedence(card.evacuation.priority),
    ambulatory,
    needsEquipment: airwayHasIntervention(card.march.airway),
    injuryGroups,
  }
}

function buildL6Wounds(groups: Map<InjuryType, { region: string; description: string }[]>) {
  const order: InjuryType[] = ['GSW', 'amputation', 'burn', 'blast', 'fracture', 'laceration', 'other']
  const wounds: { id: string; text: string }[] = []
  order.forEach(type => {
    const entries = groups.get(type)
    if (!entries || entries.length === 0) return
    const details = entries
      .map(e => [e.region, e.description].filter(Boolean).join(' — '))
      .filter(Boolean)
    const detailPart = details.length > 0 ? ` (${details.join('; ')})` : ''
    wounds.push({
      id: `tc3-${type}-${wounds.length}`,
      text: `${entries.length}x ${INJURY_LABEL[type]}${detailPart}`,
    })
  })
  return wounds
}

/** Derive a 9-line projection from a single TC3 card. Always peacetime mode. */
export function deriveMedevacFromTC3(card: TC3Card): MedevacRequest {
  const s = summarizeCard(card)

  const l3: Partial<Record<MedevacPrecedence, number>> = {}
  if (s.precedence) l3[s.precedence] = 1

  const l4: MedevacEquipment[] = s.needsEquipment ? ['D'] : ['A']

  return emptyMedevacRequest({
    mode: 'peacetime',
    l3,
    l4,
    l5l: s.ambulatory ? 0 : 1,
    l5a: s.ambulatory ? 1 : 0,
    l6wounds: buildL6Wounds(s.injuryGroups),
    tc3CardId: card.id,
  })
}

/** Merge medic-entered overrides on top of a derived projection. Override wins for any defined field. */
export function mergeMedevacOverrides(derived: MedevacRequest, overrides: Partial<MedevacRequest>): MedevacRequest {
  return { ...derived, ...overrides }
}

/** Derive a 9-line projection aggregated across multiple TC3 cards (mass-cas). */
export function deriveMedevacFromTC3Cards(cards: TC3Card[]): MedevacRequest {
  if (cards.length === 0) return emptyMedevacRequest({ mode: 'peacetime' })
  if (cards.length === 1) return deriveMedevacFromTC3(cards[0])

  const l3: Partial<Record<MedevacPrecedence, number>> = {}
  let l5l = 0
  let l5a = 0
  let needsEquipment = false
  const merged = new Map<InjuryType, { region: string; description: string }[]>()

  cards.forEach(card => {
    const s = summarizeCard(card)
    if (s.precedence) l3[s.precedence] = (l3[s.precedence] ?? 0) + 1
    if (s.ambulatory) l5a += 1; else l5l += 1
    if (s.needsEquipment) needsEquipment = true
    s.injuryGroups.forEach((entries, type) => {
      const acc = merged.get(type) ?? []
      acc.push(...entries)
      merged.set(type, acc)
    })
  })

  return emptyMedevacRequest({
    mode: 'peacetime',
    l3,
    l4: needsEquipment ? ['D'] : ['A'],
    l5l,
    l5a,
    l6wounds: buildL6Wounds(merged),
  })
}
