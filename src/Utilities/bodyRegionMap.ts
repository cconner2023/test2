// Utilities/bodyRegionMap.ts
// Maps SVG body diagram coordinates to anatomical regions and treatment suggestions.
// Coordinates are percentages (0-100) within the combined 1040×909 SVG viewBox.

import type { BodyRegion, TreatmentCategory } from '../Types/TC3Types'
import { ALL_TC3_RECTS } from '../Components/TC3/tc3RegionRects'

/** Map a click position (% coords within combined viewBox) to an anatomical body region. */
export function getBodyRegion(x: number, y: number): BodyRegion | '' {
    for (const rect of ALL_TC3_RECTS) {
        // For angled rects, use a simple AABB check — close enough for hit detection
        const rx = rect.x
        const ry = rect.y
        const rw = rect.w
        const rh = rect.h
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
            return rect.id as BodyRegion
        }
    }
    return ''
}

/** Return treatment categories relevant to a body region. */
export function getSuggestedTreatments(region: BodyRegion | ''): TreatmentCategory[] {
    if (!region) return ['hemostatic', 'other']

    const isExtremity = region.includes('upper-arm') || region.includes('forearm')
        || region.includes('hand') || region.includes('upper-leg')
        || region.includes('lower-leg') || region.includes('foot')

    const isChest = region === 'chest-left' || region === 'chest-right'
        || region === 'back-upper'

    if (isExtremity) return ['tourniquet', 'hemostatic']
    if (isChest) return ['chestSeal', 'needleDecomp', 'hemostatic']
    return ['hemostatic', 'other']
}

const REGION_LABELS: Record<string, string> = {
    'head-front': 'Head (Front)',
    'head-back': 'Head (Back)',
    'neck-front': 'Neck (Front)',
    'neck-back': 'Neck (Back)',
    'chest-left': 'L Chest',
    'chest-right': 'R Chest',
    'abdomen': 'Abdomen',
    'genitalia': 'Genitalia',
    'back-upper': 'Upper Back',
    'back-lower': 'Lower Back',
    'upper-arm-left-front': 'L Upper Arm (Front)',
    'upper-arm-right-front': 'R Upper Arm (Front)',
    'upper-arm-left-back': 'L Upper Arm (Back)',
    'upper-arm-right-back': 'R Upper Arm (Back)',
    'forearm-left-front': 'L Forearm (Front)',
    'forearm-right-front': 'R Forearm (Front)',
    'forearm-left-back': 'L Forearm (Back)',
    'forearm-right-back': 'R Forearm (Back)',
    'hand-left-front': 'L Hand (Front)',
    'hand-right-front': 'R Hand (Front)',
    'hand-left-back': 'L Hand (Back)',
    'hand-right-back': 'R Hand (Back)',
    'upper-leg-left-front': 'L Thigh (Front)',
    'upper-leg-right-front': 'R Thigh (Front)',
    'upper-leg-left-back': 'L Thigh (Back)',
    'upper-leg-right-back': 'R Thigh (Back)',
    'lower-leg-left-front': 'L Lower Leg (Front)',
    'lower-leg-right-front': 'R Lower Leg (Front)',
    'lower-leg-left-back': 'L Lower Leg (Back)',
    'lower-leg-right-back': 'R Lower Leg (Back)',
    'foot-left-front': 'L Foot (Front)',
    'foot-right-front': 'R Foot (Front)',
    'foot-left-back': 'L Foot (Back)',
    'foot-right-back': 'R Foot (Back)',
}

/** Human-readable label for a body region. */
export function getRegionLabel(region: BodyRegion | ''): string {
    if (!region) return ''
    return REGION_LABELS[region] ?? region
}
