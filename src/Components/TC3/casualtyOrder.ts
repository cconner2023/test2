import type { TC3Card } from '../../Types/TC3Types'

/**
 * Triage ordering + labelling for the casualty roster and the level slider.
 *
 * Two independent numbers ride on every casualty:
 *
 *  1. ARRIVAL NUMBER — a stable identity anchor = rank by card-creation time
 *     (`createdAt`). "Who hit the ground first." It never moves when priorities
 *     churn, so the medic can always name the same patient ("get me #1"). It is
 *     contiguous among the LIVE roster, so discarding an earlier casualty does
 *     renumber the ones after it — acceptable for a session roster; promote to a
 *     persisted counter if immutability-through-discard is ever required.
 *
 *  2. TRIAGE CODE — band letter + per-band ordinal (U1, R2, E1…). This is the
 *     churning half: re-triaging a casualty changes it. Bands, most-urgent first:
 *     Urgent → Priority → Routine → (untriaged) → Expectant.
 *
 * The roster label glues them: `${arrival}${bandCode}${ordinal}` → `1U1`, `3R2`,
 * `4E1`. Arrival = stable prefix (identity); code = live suffix (disposition).
 *
 * Sort axis is the same field the priority dots use (`card.evacuation.priority`),
 * PLUS the separate `card.expectant` disposition, which sinks the casualty to the
 * foot of the ladder (its own black band) without touching the 9-line evac field.
 */

/** Band key for a card: Expectant wins over evac precedence, else the evac band. */
export const bandOf = (card: TC3Card): string =>
  card.expectant ? 'E' : card.evacuation.priority

/** Band → sort rank (lower = more urgent = higher on the slider). */
const BAND_RANK: Record<string, number> = { Urgent: 0, Priority: 1, Routine: 2, '': 3, E: 4 }

/** Rank of a card on the triage ladder (Expectant folded in). */
export const triageRank = (card: TC3Card): number => BAND_RANK[bandOf(card)] ?? 3

/** Compact band code + fill colour, shared by the slider thumb/notches + dots. */
export const BAND_META: Record<string, { code: string; color: string }> = {
  Urgent: { code: 'U', color: 'bg-themeredred' },
  Priority: { code: 'P', color: 'bg-amber-500' },
  Routine: { code: 'R', color: 'bg-themegreen' },
  E: { code: 'E', color: 'bg-neutral-800' },
  '': { code: '·', color: 'bg-tertiary/40' },
}

/** Sort `{ card }`-shaped rows by triage band, then createdAt. Pure (returns a copy). */
export function orderByPriority<T extends { card: TC3Card }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const r = triageRank(a.card) - triageRank(b.card)
    return r !== 0 ? r : a.card.createdAt.localeCompare(b.card.createdAt)
  })
}

/** One notch on the casualty slider: arrival+band+ordinal label + band colour. */
export interface CasualtyStop {
  id: string
  label: string
  colorClass: string
}

/** Stable arrival number per card = 1-based rank by createdAt across the roster. */
export function arrivalNumbers(cards: TC3Card[]): Map<string, number> {
  const byArrival = [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return new Map(byArrival.map((c, i) => [c.id, i + 1]))
}

/**
 * Build slider/roster notches from priority-ordered cards. Each label is the
 * stable arrival number + the band code + the per-band ordinal (which resets per
 * band): `1U1`, `3R2`, `4E1`. `ordered` MUST already be priority-sorted (via
 * {@link orderByPriority}) so the per-band ordinals come out contiguous; the
 * arrival number is computed independently of that order (from createdAt).
 */
export function buildCasualtyStops(ordered: TC3Card[]): CasualtyStop[] {
  const arrival = arrivalNumbers(ordered)
  const counts: Record<string, number> = {}
  return ordered.map((c) => {
    const band = bandOf(c)
    const meta = BAND_META[band] ?? BAND_META['']
    counts[band] = (counts[band] ?? 0) + 1
    return {
      id: c.id,
      label: `${arrival.get(c.id) ?? '?'}${meta.code}${counts[band]}`,
      colorClass: meta.color,
    }
  })
}
