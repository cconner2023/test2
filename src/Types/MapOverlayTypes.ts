export type WaypointType =
  | 'hlz'
  | 'ccp'
  | 'role1'
  | 'role2'
  | 'role3'
  | 'rp'
  | 'sp'
  | 'cp'
  | 'generic'

export type FeatureType = 'waypoint' | 'route' | 'area'

export type DrawMode = 'pan' | 'pin' | 'route' | 'edit' | 'delete'

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
}

export interface LocalMapOverlay extends MapOverlay {
  _sync_status: 'pending' | 'synced' | 'error'
  _sync_retry_count: number
  _last_sync_error: string | null
  _last_sync_error_message: string | null
}

export const WAYPOINT_LABELS: Record<WaypointType, string> = {
  hlz: 'HLZ',
  ccp: 'CCP',
  role1: 'ROLE 1',
  role2: 'ROLE 2',
  role3: 'ROLE 3',
  rp: 'RP',
  sp: 'SP',
  cp: 'CP',
  generic: 'WPT',
}

export const TACTICAL_COLORS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Black', hex: '#1F2937' },
  { name: 'White', hex: '#F9FAFB' },
] as const

export type TacticalColor = typeof TACTICAL_COLORS[number]

export const DEFAULT_FEATURE_STYLE: FeatureStyle = {
  color: '#3B82F6',
  weight: 3,
  opacity: 1,
}
