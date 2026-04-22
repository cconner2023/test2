// Army Heat Categories — TB MED 507 / DA PAM 40-501
export const CATEGORIES = [
  { num: 1, flag: 'White',  min: 78.0, max: 81.9,     workRest: '50 / 10 min', water: '½ qt' },
  { num: 2, flag: 'Green',  min: 82.0, max: 84.9,     workRest: '50 / 10 min', water: '1 qt' },
  { num: 3, flag: 'Yellow', min: 85.0, max: 87.9,     workRest: '40 / 20 min', water: '1 qt' },
  { num: 4, flag: 'Red',    min: 88.0, max: 89.9,     workRest: '30 / 30 min', water: '1½ qt' },
  { num: 5, flag: 'Black',  min: 90.0, max: Infinity,  workRest: '20 / 40 min', water: '1½ qt' },
] as const

export type HeatCategory = (typeof CATEGORIES)[number]

export const CATEGORY_BG: Record<string, string> = {
  White:  'bg-tertiary/10',
  Green:  'bg-themegreen/15',
  Yellow: 'bg-amber-400/15',
  Red:    'bg-orange-500/15',
  Black:  'bg-themeredred/15',
}

/**
 * Wet-bulb temperature via Stull (2011) — input/output in °F.
 * Accurate to ±1°C for RH 5–99% and T 2–50°C (35–122°F).
 */
export function wetBulbF(T_f: number, RH: number): number {
  const T = (T_f - 32) * 5 / 9
  const Tw = T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
    + Math.atan(T + RH)
    - Math.atan(RH - 1.676331)
    + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
    - 4.686035
  return Tw * 9 / 5 + 32
}

/**
 * Outdoor WBGT estimate — sunny conditions, calm wind.
 * WBGT = 0.7 × T_wb + 0.2 × T_g + 0.1 × T_db
 * Globe temp (T_g) estimated as T_db + 15°F for direct sun exposure.
 */
export function estimateWBGT(T_f: number, RH: number): number {
  const T_wb = wetBulbF(T_f, RH)
  const T_g  = T_f + 15
  const wbgt = 0.7 * T_wb + 0.2 * T_g + 0.1 * T_f
  return Math.round(wbgt * 10) / 10
}

export function getCategory(wbgt: number): HeatCategory | null {
  return CATEGORIES.find(c => wbgt >= c.min && wbgt <= c.max) ?? null
}
