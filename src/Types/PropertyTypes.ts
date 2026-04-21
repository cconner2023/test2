/**
 * Property / Equipment Management type definitions.
 *
 * Models military hand-receipt accountability: items with sub-components,
 * nested physical locations, custody transfer with inventory verification,
 * and discrepancy tracking.
 */

// ── Enum-like string unions ──────────────────────────────────

export type PropertyCondition = 'serviceable' | 'unserviceable' | 'missing' | 'damaged'

export type CustodyAction =
  | 'sign_down'     // HRH → subordinate
  | 'sign_up'       // subordinate → HRH (return)
  | 'lateral'       // peer-to-peer transfer
  | 'initial_issue' // first receipt
  | 'turn_in'       // back to supply
  | 'expended'      // consumable used/expended

export type DiscrepancyStatus = 'open' | 'rectified'

export type RectifyMethod =
  | 'found'
  | 'replaced'
  | 'statement_of_charges'
  | 'write_off'

// ── Core data models ─────────────────────────────────────────

export interface VisualFingerprint {
  /** Barcodes decoded from item label at enrollment (NSN, serial, etc.) — primary match signal */
  barcodes: string[]
  /** Width / height of bounding rect */
  aspect_ratio: number
  /** Silhouette area as fraction of frame */
  area_norm: number
  /** 7 Hu invariant moments — rotation/scale-invariant shape signature */
  hu_moments: number[]
  /** 24-bin RGB color histogram (8 per channel), L1-normalized */
  color_hist: number[]
  enrolled_at: string
  enroll_method: 'barcode' | 'visual' | 'both'
}

export interface PropertyItem {
  id: string
  clinic_id: string
  name: string
  nomenclature: string | null
  nsn: string | null
  lin: string | null
  serial_number: string | null
  quantity: number
  is_serialized: boolean
  condition_code: PropertyCondition
  parent_item_id: string | null   // self-FK for sub-items / components
  location_id: string | null      // FK to property_locations for placement
  current_holder_id: string | null
  location_tag_id: string | null
  photo_url: string | null
  visual_fingerprint: VisualFingerprint | null
  expiry_date: string | null      // ISO date (YYYY-MM-DD) for consumable/medical supply tracking
  notes: string | null
  created_at: string
  updated_at: string
}

/** Returns the expiry urgency for an item's expiry_date. null = not expiring. */
export function expiryStatus(expiry_date: string | null): 'expired' | 'expiring' | null {
  if (!expiry_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiry_date + 'T00:00:00')
  if (expiry < today) return 'expired'
  const soon = new Date(today)
  soon.setDate(soon.getDate() + 30)
  if (expiry <= soon) return 'expiring'
  return null
}

export interface PropertyLocation {
  id: string
  clinic_id: string
  parent_id: string | null  // self-FK for nesting
  name: string
  photo_data: string | null   // base64 data URL
  holder_user_id: string | null  // set on member-locations; null for physical locations
  created_by: string
  created_at: string
  updated_at: string
}

/** Sentinel name for the invisible root location that hosts the top-level canvas. */
export const ROOT_LOCATION_NAME = '__root__'

/** A single rectangle within a composite zone shape, normalised 0..1 within the zone bounding box. */
export interface ZoneRect {
  x: number
  y: number
  w: number
  h: number
}

export interface LocationTag {
  id: string
  location_id: string
  target_type: 'location' | 'item'
  target_id: string
  x: number  // 0..1 normalised
  y: number  // 0..1 normalised
  width?: number | null   // 0..1, null/undefined = point badge
  height?: number | null  // 0..1, null/undefined = point badge
  label: string
  /** Composite shape rectangles (normalised within bounding box). null/undefined = simple rect. */
  rects?: ZoneRect[] | null
}

export interface CustodyLedgerEntry {
  id: string
  item_id: string
  clinic_id: string
  action: CustodyAction
  from_holder_id: string | null
  to_holder_id: string | null
  condition_code: PropertyCondition
  sub_item_check: SubItemCheck[] | null  // jsonb snapshot
  notes: string | null
  recorded_at: string
  recorded_by: string
}

export interface SubItemCheck {
  item_id: string
  name: string
  present: boolean
}

export interface Discrepancy {
  id: string
  item_id: string
  parent_item_id: string
  responsible_holder_id: string
  transfer_ledger_id: string
  status: DiscrepancyStatus
  rectified_at: string | null
  rectified_by: string | null
  rectify_method: RectifyMethod | null
  rectify_notes: string | null
  created_at: string
}

// ── Local (offline-first) variants ───────────────────────────

export type SyncStatus = 'pending' | 'synced' | 'error'

/** Shared sync-tracking fields for all offline-first local types. */
export interface SyncMetadata {
  _sync_status: SyncStatus
  _sync_retry_count: number
  _last_sync_error: string | null
  _last_sync_error_message: string | null
}

export interface LocalPropertyItem extends PropertyItem, SyncMetadata {}

export interface LocalPropertyLocation extends PropertyLocation, SyncMetadata {}

export interface LocalDiscrepancy extends Discrepancy, SyncMetadata {}

// ── UI / workflow types ──────────────────────────────────────

export interface TransferChecklistItem {
  item_id: string
  name: string
  nsn: string | null
  serial_number: string | null
  present: boolean
}

export interface TransferPayload {
  parent_item_id: string
  from_holder_id: string
  to_holder_id: string
  condition_code: PropertyCondition
  quantity: number
  unitOfIssue: string
  checklist: TransferChecklistItem[]
  notes: string | null
}

export interface PropertySearchResult {
  type: 'item' | 'location'
  id: string
  name: string
  detail: string | null // NSN, serial, or parent location name
}

/** Holder info resolved from profiles for display. */
export interface HolderInfo {
  id: string
  rank: string | null
  firstName: string | null
  lastName: string | null
  displayName: string
}
