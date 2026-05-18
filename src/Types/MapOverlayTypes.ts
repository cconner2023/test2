export type WaypointType =
  | 'circle' | 'cross' | 'triangle'
  | 'friendly' | 'enemy' | 'neutral'
  | 'lz' | 'pz' | 'dz'
  | 'ccp' | 'axp' | 'obj' | 'rally'
  | 'hazard' | 'target' | 'supply' | 'vehicle' | 'medic' | 'comms'
  | 'casualty'

export type FeatureType = 'waypoint' | 'route' | 'area'

export type DrawMode = 'pan' | 'pin' | 'route' | 'area' | 'drag' | 'measure' | 'track'

export interface FeatureStyle {
  color: string
  weight?: number
  dash?: string
  opacity?: number
}

export interface OverlayFeature {
  id: string
  overlay_id: string
  type: FeatureType
  geometry: [number, number][]
  label: string
  style: FeatureStyle
  waypoint_type?: WaypointType
  mgrs?: string
  notes?: string
  created_at: string
  updated_at: string
  /**
   * Recorded routes (Phase 2.3) flow through type='route' but carry these
   * extra fields so the UI can distinguish them from hand-drawn polylines
   * and surface a duration-traveled stat.
   */
  recorded?: boolean
  recorded_started_at?: string
  recorded_ended_at?: string
  /**
   * Phase 4.1 — opaque link to a TC3 card (useTC3Store.card.id or queue
   * entry id). The OverlayFeature carries ONLY this id. PHI lives device-
   * side in the TC3 store, never in the overlay's payload, so syncing the
   * overlay to Supabase / fanning out via Signal does not leak patient
   * detail. Tap a linked waypoint to open its card.
   */
  tc3_card_id?: string
}

export interface MapOverlay {
  id: string
  clinic_id: string
  name: string
  description?: string
  center: [number, number]
  zoom: number
  features: OverlayFeature[]
  created_by: string
  created_at: string
  updated_at: string
  /**
   * Vault fan-out origin id. Set after the 'c' (or 'u' replacement) message
   * reaches the clinic vault — lets a later 'd' pair-clean the vault row.
   */
  originId?: string
}

export interface LocalMapOverlay extends MapOverlay {
  _sync_status: 'pending' | 'synced' | 'error'
  _sync_retry_count: number
  _last_sync_error: string | null
  _last_sync_error_message: string | null
}

export const WAYPOINT_LABELS: Record<WaypointType, string> = {
  circle: 'Point',
  cross: 'Cross',
  triangle: 'Triangle',
  friendly: 'Friendly',
  enemy: 'Enemy',
  neutral: 'Neutral',
  lz: 'LZ',
  pz: 'PZ',
  dz: 'DZ',
  ccp: 'CCP',
  axp: 'AXP',
  obj: 'OBJ',
  rally: 'Rally',
  hazard: 'Hazard',
  target: 'Target',
  supply: 'Supply',
  vehicle: 'Vehicle',
  medic: 'Medic',
  comms: 'Comms',
  casualty: 'Casualty',
}

export const WAYPOINT_CATEGORIES: { id: string; label: string; types: WaypointType[] }[] = [
  { id: 'basic', label: 'Basic', types: ['circle', 'cross', 'triangle'] },
  { id: 'forces', label: 'Forces', types: ['friendly', 'enemy', 'neutral'] },
  { id: 'zones', label: 'Zones', types: ['lz', 'pz', 'dz', 'rally'] },
  { id: 'mission', label: 'Mission', types: ['obj', 'ccp', 'axp', 'target'] },
  { id: 'assets', label: 'Assets', types: ['supply', 'vehicle', 'medic', 'comms'] },
  { id: 'caution', label: 'Caution', types: ['hazard'] },
  { id: 'casualty', label: 'Casualty', types: ['casualty'] },
]

// Flat, ordered list of waypoint glyphs offered in the map creation toolbar's
// Drop-pin submenu AND in the FeatureEditor glyph picker. Single source of
// truth — keep both surfaces in lockstep. Forces / assets / caution / casualty
// are intentionally omitted to keep the picker mobile-friendly.
export const PIN_GLYPHS: WaypointType[] = [
  'circle', 'cross', 'triangle',
  'lz', 'pz', 'dz', 'rally',
  'obj', 'ccp', 'axp', 'target',
]

// Tactical palette references the app's CSS theme tokens so feature colors
// shift with the active theme (light/dark/sepia/etc.). Stored as `var(--…)`
// strings — resolved by `resolveColor` before being handed to Leaflet, which
// sets attributes that don't natively support CSS vars.
export const TACTICAL_COLORS = [
  { name: 'Blue', hex: 'var(--color-themeblue2)' },
  { name: 'Red', hex: 'var(--color-themeredred)' },
  { name: 'Green', hex: 'var(--color-themegreen)' },
  { name: 'Yellow', hex: 'var(--color-themeyellow)' },
  { name: 'Purple', hex: 'var(--color-themepurple)' },
] as const

export type TacticalColor = typeof TACTICAL_COLORS[number]

export const DEFAULT_FEATURE_STYLE: FeatureStyle = {
  color: 'var(--color-themeblue2)',
  weight: 3,
  opacity: 1,
}

/**
 * Resolves `var(--…)` color strings to their computed rgba via getComputedStyle.
 * Pre-existing rgba/hex strings pass through unchanged. Used at the boundary
 * where colors hand off to Leaflet (which sets SVG attributes that don't
 * understand CSS variables).
 */
export function resolveColor(color: string): string {
  if (typeof window === 'undefined' || !color.startsWith('var(')) return color
  const match = color.match(/var\(([^),]+)/)
  if (!match) return color
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1].trim())
    .trim()
  return resolved || color
}
