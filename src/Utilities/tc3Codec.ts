// Utilities/tc3Codec.ts
// Compact encoding/decoding for TC3 Card barcode — mirrors noteParser pattern.
// Encoded string starts with "TC3|" prefix so the decoder knows the path.

import { compressText, decompressText } from './textCodec'
import type {
  TC3Card, MechanismType, InjuryType, BodySide, BodyRegion, TourniquetType,
  TreatmentCategory, TC3InjuryTreatmentLink,
  AVPU, EvacPriority, MedRoute, IVType, NeedleDecompSide,
} from '../Types/TC3Types'

// ── Encoding ──────────────────────────────────────────────────

/** Encode a TC3Card into a compact pipe-delimited string with TC3| prefix. */
export function encodeTC3Card(card: TC3Card, userId?: string): string {
  const parts: string[] = ['TC3']

  // C: Casualty info (compressed)
  const c = card.casualty
  const casualtyStr = [c.battleRosterNo, c.lastName, c.firstName, c.last4, c.unit, c.dateTimeOfInjury, c.dateTimeOfTreatment].join('~')
  if (casualtyStr.replace(/~/g, '')) parts.push(`C${compressText(casualtyStr)}`)

  // M: Mechanism types + other
  if (card.mechanism.types.length > 0) {
    let seg = `M${card.mechanism.types.join(',')}`
    if (card.mechanism.otherDescription) seg += `~${compressText(card.mechanism.otherDescription)}`
    parts.push(seg)
  }

  // J: Injuries (id not needed for encoding — positional)
  // Format: x,y,F|B,type[,desc[,bodyRegion[,links]]]
  // links = cat:id:desc&cat:id:desc (& separated)
  if (card.injuries.length > 0) {
    const injStrs = card.injuries.map(inj => {
      let s = `${Math.round(inj.x)},${Math.round(inj.y)},${inj.side === 'front' ? 'F' : 'B'},${inj.type}`
      const hasDesc = !!inj.description
      const hasRegion = !!inj.bodyRegion
      const hasLinks = inj.treatmentLinks && inj.treatmentLinks.length > 0
      if (hasDesc || hasRegion || hasLinks) {
        s += ',' + (inj.description ? compressText(inj.description) : '')
      }
      if (hasRegion || hasLinks) {
        s += ',' + (inj.bodyRegion || '')
      }
      if (hasLinks) {
        const linkStr = inj.treatmentLinks.map(l =>
          `${l.treatmentCategory}:${l.treatmentId}:${compressText(l.description)}`
        ).join('&')
        s += ',' + linkStr
      }
      return s
    })
    parts.push(`J${injStrs.join(';')}`)
  }

  // T: Tourniquets
  if (card.march.massiveHemorrhage.tourniquets.length > 0) {
    const tqStrs = card.march.massiveHemorrhage.tourniquets.map(tq =>
      `${tq.type},${tq.location},${tq.time}`
    )
    parts.push(`T${tqStrs.join(';')}`)
  }

  // K: Hemostatics
  if (card.march.massiveHemorrhage.hemostatics.length > 0) {
    const hStrs = card.march.massiveHemorrhage.hemostatics.map(h =>
      `${h.type},${h.location}`
    )
    parts.push(`K${hStrs.join(';')}`)
  }

  // A: Airway (bitmask: intact=1, npa=2, cric=4, ett=8, supraglottic=16, chinLift=32)
  {
    const a = card.march.airway
    let mask = 0
    if (a.intact) mask |= 1
    if (a.npa) mask |= 2
    if (a.cric) mask |= 4
    if (a.ett) mask |= 8
    if (a.supraglottic) mask |= 16
    if (a.chinLift) mask |= 32
    if (mask) parts.push(`A${mask.toString(36)}`)
  }

  // R: Respiration
  {
    const r = card.march.respiration
    const rParts: string[] = []
    if (r.needleDecomp.performed) rParts.push(`N${encodeSide(r.needleDecomp.side)}`)
    if (r.chestSeal.applied) rParts.push(`S${encodeSide(r.chestSeal.side)}`)
    if (r.o2) rParts.push(`O${compressText(r.o2Method)}`)
    if (rParts.length) parts.push(`R${rParts.join(',')}`)
  }

  // V: IV/IO access
  if (card.march.circulation.ivAccess.length > 0) {
    const ivStrs = card.march.circulation.ivAccess.map(iv =>
      `${iv.type},${iv.site},${iv.gauge}`
    )
    parts.push(`V${ivStrs.join(';')}`)
  }

  // L: Fluids
  if (card.march.circulation.fluids.length > 0) {
    const fStrs = card.march.circulation.fluids.map(f => `${f.type},${f.volume}`)
    parts.push(`L${fStrs.join(';')}`)
  }

  // B: Blood products
  if (card.march.circulation.bloodProducts.length > 0) {
    const bStrs = card.march.circulation.bloodProducts.map(b => `${b.type},${b.volume}`)
    parts.push(`B${bStrs.join(';')}`)
  }

  // H: Hypothermia
  if (card.march.hypothermia.prevention) {
    parts.push(`H${compressText(card.march.hypothermia.method)}`)
  }

  // D: Medications administered
  if (card.medications.length > 0) {
    const mStrs = card.medications.map(m =>
      `${m.name},${m.dose},${m.route},${m.time}`
    )
    parts.push(`D${compressText(mStrs.join(';'))}`)
  }

  // W: Vitals
  if (card.vitals.length > 0) {
    const vStrs = card.vitals.map(v =>
      `${v.time},${v.pulse},${v.bp},${v.rr},${v.spo2},${v.avpu},${v.painScale}`
    )
    parts.push(`W${compressText(vStrs.join(';'))}`)
  }

  // G: Mental status (AVPU + GCS)
  if (card.avpu || card.gcs) {
    let seg = `G${card.avpu || '-'}`
    if (card.gcs) seg += `,${card.gcs.eye},${card.gcs.verbal},${card.gcs.motor}`
    parts.push(seg)
  }

  // E: Evacuation
  if (card.evacuation.priority || card.evacuation.precedence) {
    let seg = `E${card.evacuation.priority || '-'}`
    if (card.evacuation.precedence) seg += `~${compressText(card.evacuation.precedence)}`
    parts.push(seg)
  }

  // N: Notes
  if (card.notes.trim()) {
    parts.push(`N${compressText(card.notes.trim())}`)
  }

  // I: User ID
  if (userId) {
    parts.push(`I${userId.replace(/-/g, '')}`)
  }

  return parts.join('|')
}

// ── Decoding ──────────────────────────────────────────────────

export interface ParsedTC3 {
  card: TC3Card
  userId: string | null
}

/** Detect whether an encoded string is a TC3 card (starts with "TC3|"). */
export function isTC3Encoding(encoded: string): boolean {
  return encoded.startsWith('TC3|')
}

/** Parse a TC3-encoded pipe-delimited string back into a TC3Card. */
export function parseTC3Encoding(encoded: string): ParsedTC3 | null {
  if (!isTC3Encoding(encoded)) return null

  const parts = encoded.split('|')
  // parts[0] === 'TC3'

  const card: TC3Card = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    casualty: { battleRosterNo: '', lastName: '', firstName: '', last4: '', unit: '', dateTimeOfInjury: '', dateTimeOfTreatment: '' },
    mechanism: { types: [], otherDescription: '' },
    injuries: [],
    march: {
      massiveHemorrhage: { tourniquets: [], hemostatics: [] },
      airway: { intact: false, npa: false, cric: false, ett: false, supraglottic: false, chinLift: false },
      respiration: { needleDecomp: { performed: false, side: 'none' }, chestSeal: { applied: false, side: 'none' }, o2: false, o2Method: '' },
      circulation: { ivAccess: [], fluids: [], bloodProducts: [] },
      hypothermia: { prevention: false, method: '' },
    },
    medications: [],
    vitals: [],
    avpu: '',
    gcs: null,
    evacuation: { priority: '', precedence: '' },
    notes: '',
  }
  let userId: string | null = null

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const prefix = part[0]
    const value = part.substring(1)

    switch (prefix) {
      case 'C': {
        const segs = decompressText(value).split('~')
        card.casualty.battleRosterNo = segs[0] ?? ''
        card.casualty.lastName = segs[1] ?? ''
        card.casualty.firstName = segs[2] ?? ''
        card.casualty.last4 = segs[3] ?? ''
        card.casualty.unit = segs[4] ?? ''
        card.casualty.dateTimeOfInjury = segs[5] ?? ''
        card.casualty.dateTimeOfTreatment = segs[6] ?? ''
        break
      }
      case 'M': {
        const [typesStr, otherCompressed] = value.split('~')
        card.mechanism.types = typesStr.split(',') as MechanismType[]
        if (otherCompressed) card.mechanism.otherDescription = decompressText(otherCompressed)
        break
      }
      case 'J': {
        const injStrs = value.split(';')
        card.injuries = injStrs.map(s => {
          const segs = s.split(',')
          // Parse treatment links if present (7th field onwards, & separated)
          let treatmentLinks: TC3InjuryTreatmentLink[] = []
          if (segs[6]) {
            treatmentLinks = segs.slice(6).join(',').split('&').map(linkStr => {
              const [cat, tid, descComp] = linkStr.split(':')
              return {
                treatmentCategory: (cat || 'other') as TreatmentCategory,
                treatmentId: tid || '',
                description: descComp ? decompressText(descComp) : '',
              }
            }).filter(l => l.treatmentId)
          }
          return {
            id: crypto.randomUUID(),
            x: parseInt(segs[0], 10),
            y: parseInt(segs[1], 10),
            side: (segs[2] === 'F' ? 'front' : 'back') as BodySide,
            type: segs[3] as InjuryType,
            description: segs[4] ? decompressText(segs[4]) : '',
            bodyRegion: (segs[5] || '') as BodyRegion | '',
            treatmentLinks,
          }
        })
        break
      }
      case 'T': {
        const tqStrs = value.split(';')
        card.march.massiveHemorrhage.tourniquets = tqStrs.map(s => {
          const segs = s.split(',')
          return { id: crypto.randomUUID(), type: segs[0] as TourniquetType, location: segs[1] ?? '', time: segs[2] ?? '' }
        })
        break
      }
      case 'K': {
        const hStrs = value.split(';')
        card.march.massiveHemorrhage.hemostatics = hStrs.map(s => {
          const segs = s.split(',')
          return { id: crypto.randomUUID(), applied: true, type: segs[0] ?? '', location: segs[1] ?? '' }
        })
        break
      }
      case 'A': {
        const mask = parseInt(value, 36)
        card.march.airway.intact = !!(mask & 1)
        card.march.airway.npa = !!(mask & 2)
        card.march.airway.cric = !!(mask & 4)
        card.march.airway.ett = !!(mask & 8)
        card.march.airway.supraglottic = !!(mask & 16)
        card.march.airway.chinLift = !!(mask & 32)
        break
      }
      case 'R': {
        const rParts = value.split(',')
        for (const rp of rParts) {
          if (rp.startsWith('N')) {
            card.march.respiration.needleDecomp = { performed: true, side: decodeSide(rp[1]) }
          } else if (rp.startsWith('S')) {
            card.march.respiration.chestSeal = { applied: true, side: decodeSide(rp[1]) }
          } else if (rp.startsWith('O')) {
            card.march.respiration.o2 = true
            card.march.respiration.o2Method = decompressText(rp.substring(1))
          }
        }
        break
      }
      case 'V': {
        const ivStrs = value.split(';')
        card.march.circulation.ivAccess = ivStrs.map(s => {
          const segs = s.split(',')
          return { id: crypto.randomUUID(), type: segs[0] as IVType, site: segs[1] ?? '', gauge: segs[2] ?? '' }
        })
        break
      }
      case 'L': {
        const fStrs = value.split(';')
        card.march.circulation.fluids = fStrs.map(s => {
          const segs = s.split(',')
          return { type: segs[0] ?? '', volume: segs[1] ?? '' }
        })
        break
      }
      case 'B': {
        const bStrs = value.split(';')
        card.march.circulation.bloodProducts = bStrs.map(s => {
          const segs = s.split(',')
          return { type: segs[0] ?? '', volume: segs[1] ?? '' }
        })
        break
      }
      case 'H': {
        card.march.hypothermia.prevention = true
        card.march.hypothermia.method = decompressText(value)
        break
      }
      case 'D': {
        const mStrs = decompressText(value).split(';')
        card.medications = mStrs.map(s => {
          const segs = s.split(',')
          return { id: crypto.randomUUID(), name: segs[0] ?? '', dose: segs[1] ?? '', route: (segs[2] ?? 'IV') as MedRoute, time: segs[3] ?? '' }
        })
        break
      }
      case 'W': {
        const vStrs = decompressText(value).split(';')
        card.vitals = vStrs.map(s => {
          const segs = s.split(',')
          return {
            id: crypto.randomUUID(), time: segs[0] ?? '', pulse: segs[1] ?? '', bp: segs[2] ?? '',
            rr: segs[3] ?? '', spo2: segs[4] ?? '', avpu: (segs[5] || 'A') as AVPU, painScale: segs[6] ?? '',
          }
        })
        break
      }
      case 'G': {
        const gParts = value.split(',')
        card.avpu = (gParts[0] === '-' ? '' : gParts[0]) as AVPU | ''
        if (gParts.length >= 4) {
          card.gcs = { eye: parseInt(gParts[1], 10) || 0, verbal: parseInt(gParts[2], 10) || 0, motor: parseInt(gParts[3], 10) || 0 }
        }
        break
      }
      case 'E': {
        const [prio, precCompressed] = value.split('~')
        card.evacuation.priority = (prio === '-' ? '' : prio) as EvacPriority
        if (precCompressed) card.evacuation.precedence = decompressText(precCompressed)
        break
      }
      case 'N':
        card.notes = decompressText(value)
        break
      case 'I':
        if (value.length === 32) {
          userId = `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`
        }
        break
    }
  }

  return { card, userId }
}

// ── Side encoding helpers ─────────────────────────────────────

function encodeSide(side: NeedleDecompSide): string {
  switch (side) {
    case 'left': return 'L'
    case 'right': return 'R'
    case 'bilateral': return 'B'
    default: return '-'
  }
}

function decodeSide(ch: string | undefined): NeedleDecompSide {
  switch (ch) {
    case 'L': return 'left'
    case 'R': return 'right'
    case 'B': return 'bilateral'
    default: return 'none'
  }
}
