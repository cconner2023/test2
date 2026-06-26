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
  /** Ownership root. null = CLUSTER-owned (default; stays/stranded on PCS). Set = PERSONALLY
   *  owned (travels with the owner's member-zone on PCS). Bare uuid, no FK (mirrors
   *  current_holder_id / holder_user_id) so cross-cluster/offline owner refs never hit an FK gate.
   *  Partition discriminator only — NOT a fan-out routing key (the zone subtree is the travel unit).
   *  See .claude/Projects/_ideas/personal-zone-pcs-rehome.md. */
  owner_user_id: string | null
  location_tag_id: string | null
  photo_url: string | null
  visual_fingerprint: VisualFingerprint | null
  expiry_date: string | null      // ISO date (YYYY-MM-DD) for consumable/medical supply tracking
  /** True when signed out on a DA 2062 to a recipient OUTSIDE the cluster (no profile
   *  id exists for them — recipient name lives in the hand receipt's ledger notes). */
  signed_out_external: boolean
  notes: string | null
  created_at: string
  updated_at: string
  /** Soft-delete tombstone marker on the plaintext spine. Set on delete; null = live. */
  deleted_at?: string | null
  /**
   * Clinics this item is distributed to = {clinic_id} ∪ holder's [home, ...active loans].
   * Computed at fan-out time (propertyVault.resolvePropertyTargetClinics) and stamped so a
   * single source drives cross-cluster fan-out, the clinic-vault snapshot retain filter, and
   * the visibility filter. Absent on legacy rows → treated as [clinic_id].
   */
  target_clinic_ids?: string[]
  /** Origin id of the latest vault fan-out for this item (hard-delete resolution). */
  originId?: string
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

export type ItemAlert = 'expired' | 'expiring' | 'depleted'

/** Unified "needs attention" state for an item row/tag — drives the RED treatment in
 *  the property tree and on the map. Depleted (0 on hand) OR expired OR expiring within
 *  30 days. null = healthy. Depletion takes precedence (no stock is the louder signal).
 *  All three render red — only the trailing label (qty / date) differs. */
export function itemAlert(item: { expiry_date: string | null; quantity: number }): ItemAlert | null {
  if (item.quantity <= 0) return 'depleted'
  return expiryStatus(item.expiry_date)
}

export interface PropertyLocation {
  id: string
  clinic_id: string
  parent_id: string | null  // self-FK for nesting
  name: string
  photo_data: string | null   // base64 data URL
  holder_user_id: string | null  // set on member-locations; null for physical locations
  /**
   * Sub-zone shape discriminator:
   * - 'area'    (default) — a drawn rectangle on its parent's canvas (existing behaviour).
   * - 'level'   — a full-size sub-zone (e.g. a building floor). Occupies its parent's
   *   whole footprint via a 0..1 full-extent tag; sibling levels stack on the same
   *   footprint and only the active one renders (Genshin-style floor switcher).
   * - 'vehicle' — a container that both HOLDS property (child items = BII/components)
   *   and IS property (signed for via holder_user_id). Drawn like an 'area' on the
   *   parent canvas; distinguished by a vehicle marker in the book views.
   */
  kind?: 'area' | 'level' | 'vehicle'
  /** Stack order among sibling levels (floor number; basements negative). Unused for 'area'. */
  ordinal?: number
  /** Optional real-world map anchor — links this zone to a map OverlayFeature (geo coords). */
  overlay_feature_id?: string | null
  overlay_id?: string | null
  /** True on the single auto-provisioned cluster default zone (BAS / aid station) per clinic. */
  is_default_zone?: boolean
  created_by: string
  created_at: string
  updated_at: string
  /** Soft-delete tombstone marker on the plaintext spine. Set on delete; null = live. */
  deleted_at?: string | null
  /** Cross-cluster fan-out set; zones are single-clinic so normally [clinic_id]. */
  target_clinic_ids?: string[]
  /** Origin id of the latest vault fan-out for this zone (hard-delete resolution). */
  originId?: string
}

/** Sentinel name for the invisible root location that hosts the top-level canvas. */
export const ROOT_LOCATION_NAME = '__root__'

/** Display name for the auto-provisioned default cluster zone (battalion aid station). */
export const DEFAULT_CLUSTER_ZONE_NAME = 'BAS'

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
  /** Groups the per-item ledger rows written by ONE sign-out action into a single
   *  DA 2062 hand receipt (1..N items). Null on legacy/non-receipt entries. */
  hand_receipt_id?: string | null
  action: CustodyAction
  /** Units consumed on an 'expended' entry; defaults to 0/unused for transfer actions. */
  quantity_delta?: number | null
  from_holder_id: string | null
  to_holder_id: string | null
  condition_code: PropertyCondition
  sub_item_check: SubItemCheck[] | null  // jsonb snapshot
  notes: string | null
  recorded_at: string
  recorded_by: string
  /** Cross-cluster fan-out set = {clinic_id} ∪ from/to holder clinic sets. Append-only entity. */
  target_clinic_ids?: string[]
  /** Origin id of the vault fan-out for this ledger row. */
  originId?: string
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
  /** Origin id of the latest vault fan-out for this discrepancy. */
  originId?: string
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

export interface LocalCustodyEntry extends CustodyLedgerEntry, SyncMetadata {}

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

/**
 * A DA 2062 hand receipt — the folded view of all custody_ledger rows that share a
 * `hand_receipt_id`. One receipt covers 1..N items signed to a single recipient.
 */
export interface HandReceipt {
  handReceiptId: string
  /** Member holder id when signed within the cluster; null when external. */
  toHolderId: string | null
  /** True when signed to a recipient outside the cluster (recipient is free-text). */
  isExternal: boolean
  /** Display label: resolved member name, or the external recipient free-text. */
  recipientLabel: string
  /** ISO timestamp of the receipt (recorded_at of its sign-out rows). */
  recordedAt: string
  recordedBy: string
  notes: string | null
  /** 'open' = still signed out; 'returned' = signed back in (has sign_up rows). */
  status: 'open' | 'returned'
  /** ISO timestamp of the return, when status === 'returned'. */
  returnedAt: string | null
  /** The per-item sign-out ledger rows that make up this receipt, newest first. */
  entries: CustodyLedgerEntry[]
}

/** Holder info resolved from profiles for display. */
export interface HolderInfo {
  id: string
  rank: string | null
  firstName: string | null
  lastName: string | null
  displayName: string
}
