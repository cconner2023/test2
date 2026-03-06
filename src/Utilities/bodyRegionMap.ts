// Utilities/bodyRegionMap.ts
// Maps SVG body diagram coordinates to anatomical regions and treatment suggestions.
// Coordinates are percentages (0-100) within the 200×400 SVG viewBox.

import type { BodyRegion, BodySide, TreatmentCategory } from '../Types/TC3Types'

interface RegionBounds {
  region: BodyRegion
  xMin: number; xMax: number
  yMin: number; yMax: number
}

// Regions for front view (same geometry applies to back, with overrides below)
const FRONT_REGIONS: RegionBounds[] = [
  // Head
  { region: 'head', xMin: 35, xMax: 65, yMin: 0, yMax: 16 },
  // Neck
  { region: 'neck', xMin: 42, xMax: 58, yMin: 16, yMax: 19 },
  // Chest left (viewer's right = body's left)
  { region: 'chest-left', xMin: 50, xMax: 72, yMin: 19, yMax: 35 },
  // Chest right
  { region: 'chest-right', xMin: 28, xMax: 50, yMin: 19, yMax: 35 },
  // Abdomen
  { region: 'abdomen', xMin: 28, xMax: 72, yMin: 35, yMax: 52 },
  // Upper arm left
  { region: 'upper-arm-left', xMin: 72, xMax: 88, yMin: 19, yMax: 35 },
  // Upper arm right
  { region: 'upper-arm-right', xMin: 12, xMax: 28, yMin: 19, yMax: 35 },
  // Forearm left
  { region: 'forearm-left', xMin: 78, xMax: 92, yMin: 35, yMax: 50 },
  // Forearm right
  { region: 'forearm-right', xMin: 8, xMax: 22, yMin: 35, yMax: 50 },
  // Hand left
  { region: 'hand-left', xMin: 82, xMax: 95, yMin: 50, yMax: 55 },
  // Hand right
  { region: 'hand-right', xMin: 5, xMax: 18, yMin: 50, yMax: 55 },
  // Upper leg left
  { region: 'upper-leg-left', xMin: 50, xMax: 70, yMin: 52, yMax: 72 },
  // Upper leg right
  { region: 'upper-leg-right', xMin: 30, xMax: 50, yMin: 52, yMax: 72 },
  // Lower leg left
  { region: 'lower-leg-left', xMin: 50, xMax: 70, yMin: 72, yMax: 92 },
  // Lower leg right
  { region: 'lower-leg-right', xMin: 30, xMax: 50, yMin: 72, yMax: 92 },
  // Foot left
  { region: 'foot-left', xMin: 50, xMax: 70, yMin: 92, yMax: 100 },
  // Foot right
  { region: 'foot-right', xMin: 30, xMax: 50, yMin: 92, yMax: 100 },
]

const BACK_REGIONS: RegionBounds[] = [
  { region: 'head', xMin: 35, xMax: 65, yMin: 0, yMax: 16 },
  { region: 'neck', xMin: 42, xMax: 58, yMin: 16, yMax: 19 },
  { region: 'back-upper', xMin: 28, xMax: 72, yMin: 19, yMax: 35 },
  { region: 'back-lower', xMin: 28, xMax: 72, yMin: 35, yMax: 52 },
  // Arms and legs same as front
  { region: 'upper-arm-left', xMin: 72, xMax: 88, yMin: 19, yMax: 35 },
  { region: 'upper-arm-right', xMin: 12, xMax: 28, yMin: 19, yMax: 35 },
  { region: 'forearm-left', xMin: 78, xMax: 92, yMin: 35, yMax: 50 },
  { region: 'forearm-right', xMin: 8, xMax: 22, yMin: 35, yMax: 50 },
  { region: 'hand-left', xMin: 82, xMax: 95, yMin: 50, yMax: 55 },
  { region: 'hand-right', xMin: 5, xMax: 18, yMin: 50, yMax: 55 },
  { region: 'upper-leg-left', xMin: 50, xMax: 70, yMin: 52, yMax: 72 },
  { region: 'upper-leg-right', xMin: 30, xMax: 50, yMin: 52, yMax: 72 },
  { region: 'lower-leg-left', xMin: 50, xMax: 70, yMin: 72, yMax: 92 },
  { region: 'lower-leg-right', xMin: 30, xMax: 50, yMin: 72, yMax: 92 },
  { region: 'foot-left', xMin: 50, xMax: 70, yMin: 92, yMax: 100 },
  { region: 'foot-right', xMin: 30, xMax: 50, yMin: 92, yMax: 100 },
]

/** Map an SVG click position (% coords) to an anatomical body region. */
export function getBodyRegion(x: number, y: number, side: BodySide): BodyRegion | '' {
  const regions = side === 'front' ? FRONT_REGIONS : BACK_REGIONS
  for (const r of regions) {
    if (x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax) {
      return r.region
    }
  }
  return ''
}

/** Return treatment categories relevant to a body region. */
export function getSuggestedTreatments(region: BodyRegion | ''): TreatmentCategory[] {
  if (!region) return ['hemostatic', 'other']

  const isExtremity = region.startsWith('upper-arm') || region.startsWith('forearm')
    || region.startsWith('hand') || region.startsWith('upper-leg')
    || region.startsWith('lower-leg') || region.startsWith('foot')

  const isChest = region === 'chest-left' || region === 'chest-right'
    || region === 'back-upper'

  if (isExtremity) return ['tourniquet', 'hemostatic']
  if (isChest) return ['chestSeal', 'needleDecomp', 'hemostatic']
  return ['hemostatic', 'other']
}

const REGION_LABELS: Record<BodyRegion, string> = {
  'head': 'Head',
  'neck': 'Neck',
  'chest-left': 'L Chest',
  'chest-right': 'R Chest',
  'abdomen': 'Abdomen',
  'upper-arm-left': 'L Upper Arm',
  'upper-arm-right': 'R Upper Arm',
  'forearm-left': 'L Forearm',
  'forearm-right': 'R Forearm',
  'hand-left': 'L Hand',
  'hand-right': 'R Hand',
  'upper-leg-left': 'L Thigh',
  'upper-leg-right': 'R Thigh',
  'lower-leg-left': 'L Lower Leg',
  'lower-leg-right': 'R Lower Leg',
  'foot-left': 'L Foot',
  'foot-right': 'R Foot',
  'back-upper': 'Upper Back',
  'back-lower': 'Lower Back',
}

/** Human-readable label for a body region. */
export function getRegionLabel(region: BodyRegion | ''): string {
  if (!region) return ''
  return REGION_LABELS[region] ?? region
}
