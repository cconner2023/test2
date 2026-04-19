import type { OverlayFeature } from './MapOverlayTypes'
import type { PropertyItem } from './PropertyTypes'

export type AllocationRole = 'primary' | 'backup' | 'transport' | 'comms' | 'medical'

export const ALLOCATION_ROLE_LABELS: Record<AllocationRole, string> = {
  primary: 'Primary',
  backup: 'Backup',
  transport: 'Transport',
  comms: 'Comms',
  medical: 'Medical',
}

export interface ResourceAllocation {
  /** FK → PropertyItem.id */
  item_id: string
  /** FK → OverlayFeature.id within the linked overlay, or null if unpositioned. */
  waypoint_id?: string | null
  /** User ID of the person responsible for this item at this waypoint. */
  personnel_id?: string | null
  role: AllocationRole
  quantity?: number
  notes?: string | null
}

/** Geo-binding stored on the CalendarEvent. */
export interface StructuredLocation {
  overlay_id: string
  primary_waypoint_id?: string
}

/** Computed view — allocations grouped by waypoint for the Mission Board UI. */
export interface WaypointAllocationSummary {
  waypoint: OverlayFeature
  items: (ResourceAllocation & { resolvedItem?: PropertyItem })[]
  /** User IDs of all personnel assigned to this waypoint via any allocation. */
  personnel: string[]
}
