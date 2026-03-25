import type { BurnRegion } from './burnDiagramTypes'

export const BURN_REGIONS: BurnRegion[] = [
    // Front view (8 regions)
    { id: 'head-front',   label: 'Head & Neck (front)', view: 'front', adultPct: 4.5,  pedPct: 9 },
    { id: 'chest',        label: 'Chest',               view: 'front', adultPct: 9,    pedPct: 9 },
    { id: 'abdomen',      label: 'Abdomen',             view: 'front', adultPct: 9,    pedPct: 9 },
    { id: 'l-arm-front',  label: 'L Arm (front)',       view: 'front', adultPct: 4.5,  pedPct: 4.5 },
    { id: 'r-arm-front',  label: 'R Arm (front)',       view: 'front', adultPct: 4.5,  pedPct: 4.5 },
    { id: 'genitalia',    label: 'Genitalia',           view: 'front', adultPct: 1,    pedPct: 1 },
    { id: 'l-leg-front',  label: 'L Leg (front)',       view: 'front', adultPct: 9,    pedPct: 6.75 },
    { id: 'r-leg-front',  label: 'R Leg (front)',       view: 'front', adultPct: 9,    pedPct: 6.75 },
    // Back view (7 regions)
    { id: 'head-back',    label: 'Head & Neck (back)',  view: 'back',  adultPct: 4.5,  pedPct: 9 },
    { id: 'upper-back',   label: 'Upper Back',          view: 'back',  adultPct: 9,    pedPct: 9 },
    { id: 'lower-back',   label: 'Lower Back',          view: 'back',  adultPct: 9,    pedPct: 9 },
    { id: 'l-arm-back',   label: 'L Arm (back)',        view: 'back',  adultPct: 4.5,  pedPct: 4.5 },
    { id: 'r-arm-back',   label: 'R Arm (back)',        view: 'back',  adultPct: 4.5,  pedPct: 4.5 },
    { id: 'l-leg-back',   label: 'L Leg (back)',        view: 'back',  adultPct: 9,    pedPct: 6.75 },
    { id: 'r-leg-back',   label: 'R Leg (back)',        view: 'back',  adultPct: 9,    pedPct: 6.75 },
]

export const REGIONS_MAP: Record<string, BurnRegion> = Object.fromEntries(
    BURN_REGIONS.map(r => [r.id, r])
)

/** Format percentage with vulgar fractions for clean display */
export function formatPct(n: number): string {
    const whole = Math.floor(n)
    const frac = n - whole
    if (frac === 0) return `${whole}%`
    if (Math.abs(frac - 0.25) < 0.01) return `${whole}¼%`
    if (Math.abs(frac - 0.5) < 0.01) return `${whole}½%`
    if (Math.abs(frac - 0.75) < 0.01) return `${whole}¾%`
    return `${n}%`
}
