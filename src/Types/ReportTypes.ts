// Types/ReportTypes.ts
// Tactical report formats: LACE, SITREP, OPORD

// ── LACE Report ──────────────────────────────────────────────────────────────
// Liquids, Ammunition, Casualties, Equipment

export interface LaceAmmoLine {
  type: string
  onHand: number
  pct: number      // 0–100
}

export interface LaceEquipmentLine {
  item: string
  status: 'FMC' | 'PMC' | 'NMC'
  notes?: string
}

export interface LaceReport {
  unit: string
  dtg: string

  // L — Liquids
  waterLiters: number
  waterHours: number
  waterResupply: boolean

  // A — Ammunition
  ammo: LaceAmmoLine[]

  // C — Casualties
  kia: number
  wiaUrgent: number
  wiaPriority: number
  wiaRoutine: number
  medevacRequested: boolean

  // E — Equipment
  equipment: LaceEquipmentLine[]

  notes?: string
}

export const DEFAULT_AMMO_TYPES = ['5.56mm', '7.62mm', '9mm', '40mm', 'M67 Grenade', 'AT4'] as const

export function emptyLaceReport(): LaceReport {
  return {
    unit: '', dtg: '',
    waterLiters: 0, waterHours: 0, waterResupply: false,
    ammo: DEFAULT_AMMO_TYPES.map(type => ({ type, onHand: 0, pct: 100 })),
    kia: 0, wiaUrgent: 0, wiaPriority: 0, wiaRoutine: 0, medevacRequested: false,
    equipment: [],
    notes: '',
  }
}

// ── SITREP ───────────────────────────────────────────────────────────────────

export type EnemyContactType = 'small-arms' | 'indirect' | 'ied' | 'other'
export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
export type MoraleLevel = 'good' | 'fair' | 'poor'

export interface Sitrep {
  unit: string
  dtg: string
  mgrs: string

  situation: string

  enemyContact: boolean
  enemyType?: EnemyContactType
  enemyDirection?: CardinalDirection
  enemyDistanceM?: number
  actionsTaken?: string

  strengthPct: number
  morale: MoraleLevel

  assessment: string
  nextAction: string
  eta?: string

  notes?: string
}

export function emptySitrep(): Sitrep {
  return {
    unit: '', dtg: '', mgrs: '',
    situation: '',
    enemyContact: false,
    strengthPct: 100,
    morale: 'good',
    assessment: '',
    nextAction: '',
    notes: '',
  }
}

// ── OPORD ─────────────────────────────────────────────────────────────────────
// 5-Paragraph Field Order (SMEAC)

export interface OpordTask {
  unit: string
  task: string
}

export interface Opord {
  unit: string
  dtg: string
  operationName?: string

  // 1 — Situation
  enemyComposition: string
  enemyActivity: string
  friendlyHigher: string
  friendlyAdjacent: string
  attachments: string
  civilConsiderations: string

  // 2 — Mission (5Ws)
  missionWho: string
  missionWhat: string
  missionWhen: string
  missionWhere: string
  missionWhy: string

  // 3 — Execution
  commanderIntent: string
  conceptOfOps: string
  subordinateTasks: OpordTask[]
  coordinatingInstructions: string

  // 4 — Administration / Logistics
  supplyClass1: string
  supplyClass3: string
  supplyClass5: string
  supplyClass8: string
  transportation: string
  medicalCCP: string
  medevacChannel: string

  // 5 — Command / Signal
  commandLocation: string
  successionOfCommand: string
  freqPrimary: string
  freqAlternate: string
  callSigns: string
  challengePassword: string
  pacePlan: string

  notes?: string
}

export function emptyOpord(): Opord {
  return {
    unit: '', dtg: '', operationName: '',
    enemyComposition: '', enemyActivity: '',
    friendlyHigher: '', friendlyAdjacent: '',
    attachments: '', civilConsiderations: '',
    missionWho: '', missionWhat: '', missionWhen: '', missionWhere: '', missionWhy: '',
    commanderIntent: '', conceptOfOps: '',
    subordinateTasks: [],
    coordinatingInstructions: '',
    supplyClass1: '', supplyClass3: '', supplyClass5: '', supplyClass8: '',
    transportation: '', medicalCCP: '', medevacChannel: '',
    commandLocation: '', successionOfCommand: '',
    freqPrimary: '', freqAlternate: '',
    callSigns: '', challengePassword: '', pacePlan: '',
    notes: '',
  }
}
