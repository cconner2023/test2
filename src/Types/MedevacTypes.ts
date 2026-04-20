// Types/MedevacTypes.ts
// 9-Line MEDEVAC Request — ATP 4-02.2
// Brevity codes used throughout for compact JSONB storage.
// Identity (id, clinicId, createdBy, etc.) lives on the CalendarEvent that carries this.

export type MedevacStatus = 'draft' | 'submitted' | 'acknowledged' | 'inbound' | 'complete' | 'cancelled'

// Line 3 — Precedence: A=Urgent, B=Urgent Surgical, C=Priority, D=Routine, E=Convenience
export type MedevacPrecedence = 'A' | 'B' | 'C' | 'D' | 'E'

// Line 4 — Equipment: A=None, B=Hoist, C=Extraction Equipment, D=Ventilator
export type MedevacEquipment = 'A' | 'B' | 'C' | 'D'

// Line 6 — Security: N=No enemy, P=Possible, E=Enemy in area, X=Armed escort required
export type MedevacSecurity = 'N' | 'P' | 'E' | 'X'

// Line 7 — Marking: A=Panels, B=Pyrotechnic, C=Smoke, D=None, E=Other
export type MedevacMarking = 'A' | 'B' | 'C' | 'D' | 'E'

// Line 8 — Nationality: A=US Mil, B=US Civ, C=Non-US Mil, D=Non-US Civ, E=EPW
export type MedevacNationality = 'A' | 'B' | 'C' | 'D' | 'E'

// Line 9 — NBC: N=None, B=Biological, C=Chemical, R=Radiological/Nuclear
export type MedevacNBC = 'N' | 'B' | 'C' | 'R'

export interface MedevacRequest {
  status: MedevacStatus

  // Line 1 — Pickup site
  l1: string       // MGRS grid
  l1d?: string     // description

  // Line 2 — Radio
  l2f: string      // frequency
  l2c: string      // call sign
  l2s?: string     // suffix

  // Line 3 — Patients by precedence (omit zero counts)
  l3: Partial<Record<MedevacPrecedence, number>>

  // Line 4 — Special equipment
  l4: MedevacEquipment[]

  // Line 5 — Patient type
  l5l: number      // litter
  l5a: number      // ambulatory

  // Line 6 — Security
  l6: MedevacSecurity

  // Line 7 — Marking method
  l7: MedevacMarking
  l7c?: string     // smoke color (l7 = 'C')
  l7o?: string     // other description (l7 = 'E')

  // Line 8 — Nationality / status
  l8: MedevacNationality[]

  // Line 9 — NBC contamination
  l9: MedevacNBC

  // Cross-domain links
  tc3CardId?: string
  featureId?: string
  overlayId?: string

  notes?: string
}

// ── Label maps ─────────────────────────────────────────────────────────────

export const MEDEVAC_PRECEDENCE_LABELS: Record<MedevacPrecedence, string> = {
  A: 'Urgent',
  B: 'Urgent Surgical',
  C: 'Priority',
  D: 'Routine',
  E: 'Convenience',
}

export const MEDEVAC_EQUIPMENT_LABELS: Record<MedevacEquipment, string> = {
  A: 'None',
  B: 'Hoist',
  C: 'Extraction Equipment',
  D: 'Ventilator',
}

export const MEDEVAC_SECURITY_LABELS: Record<MedevacSecurity, string> = {
  N: 'No Enemy',
  P: 'Possible Enemy',
  E: 'Enemy in Area',
  X: 'Armed Escort Required',
}

export const MEDEVAC_MARKING_LABELS: Record<MedevacMarking, string> = {
  A: 'Panels',
  B: 'Pyrotechnic Signal',
  C: 'Smoke Signal',
  D: 'None',
  E: 'Other',
}

export const MEDEVAC_NATIONALITY_LABELS: Record<MedevacNationality, string> = {
  A: 'US Military',
  B: 'US Civilian',
  C: 'Non-US Military',
  D: 'Non-US Civilian',
  E: 'EPW',
}

export const MEDEVAC_NBC_LABELS: Record<MedevacNBC, string> = {
  N: 'None',
  B: 'Biological',
  C: 'Chemical',
  R: 'Radiological/Nuclear',
}

export const MEDEVAC_STATUS_LABELS: Record<MedevacStatus, string> = {
  draft:        'Draft',
  submitted:    'Submitted',
  acknowledged: 'Acknowledged',
  inbound:      'Inbound',
  complete:     'Complete',
  cancelled:    'Cancelled',
}

export const SMOKE_COLORS = ['Violet', 'Green', 'Yellow', 'Red', 'Orange', 'White'] as const

// ── Helpers ────────────────────────────────────────────────────────────────

export function medevacPatientTotal(req: MedevacRequest): number {
  return Object.values(req.l3).reduce((s, n) => s + (n ?? 0), 0)
}

export function medevacHighestPrecedence(req: MedevacRequest): MedevacPrecedence | null {
  for (const p of ['A', 'B', 'C', 'D', 'E'] as MedevacPrecedence[]) {
    if ((req.l3[p] ?? 0) > 0) return p
  }
  return null
}

export function emptyMedevacRequest(overrides?: Partial<MedevacRequest>): MedevacRequest {
  return {
    status: 'draft',
    l1: '', l2f: '', l2c: '',
    l3: {},
    l4: ['A'],
    l5l: 0, l5a: 0,
    l6: 'N',
    l7: 'C',
    l8: ['A'],
    l9: 'N',
    ...overrides,
  }
}
