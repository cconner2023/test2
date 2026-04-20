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
  | 'casualty'
  | 'contact'

export type FeatureType = 'waypoint' | 'route' | 'area'

export type DrawMode = 'pan' | 'pin' | 'route' | 'area' | 'edit' | 'delete' | 'measure'

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
  casualty: 'CAS',
  contact: 'ENMY',
}

export const TACTICAL_COLORS = [
  { name: 'Blue', hex: 'rgba(21,142,172,1)' },
  { name: 'Red', hex: 'rgb(170,65,65)' },
  { name: 'Green', hex: 'rgba(96,146,92,1)' },
  { name: 'Yellow', hex: 'rgba(255,194,34,1)' },
  { name: 'Black', hex: '#000000' },
] as const

export type TacticalColor = typeof TACTICAL_COLORS[number]

export const DEFAULT_FEATURE_STYLE: FeatureStyle = {
  color: 'rgba(21,142,172,1)',
  weight: 3,
  opacity: 1,
}
