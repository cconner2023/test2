/**
 * Portable object bundles — the cross-cluster counterpart to a `shared_ref`.
 *
 * A `shared_ref` is a LIVE link: it resolves an opaque id against the RECEIVER's
 * own clinic vault, so it only works inside the sending cluster. To share a
 * calendar event or map overlay with a user in ANOTHER cluster, the actual data
 * has to travel as a FROZEN, self-contained value the receiver re-materializes
 * as a brand-new local copy in their own vault.
 *
 * This module owns that value:
 *  - export projection  (event/overlay → bundle)  — strips PHI + cluster-local refs
 *  - import remint      (bundle → fresh local object) — NEW ids, receiver's clinic
 *  - integrity hash     (sha-256 of the canonical bundle JSON)
 *  - transport pack/unpack via the existing encrypted-attachment path
 *    (`message-attachments` bucket; AES key rides inside the E2E Signal message).
 *
 * NO-PHI INVARIANT (enforced at EXPORT): events drop assignees / property /
 * subtasks / mission data; overlays drop `tc3_card_id`; property items drop the
 * holder / owner / zone placement and the enrollment photo + fingerprint. Only
 * operational vocabulary leaves the device. Mirrors the `.ics` export rule (which
 * already strips assignments) and the no-PHI-on-the-map overlay invariant.
 */

import type { CalendarEvent, EventCategory } from '../Types/CalendarTypes'
import type { MapOverlay, OverlayFeature } from '../Types/MapOverlayTypes'
import type { PropertyItem, ItemType, UnitOfIssue, PropertyCondition } from '../Types/PropertyTypes'
import type { TextExpander, PlanOrderSet, PlanOrderTags } from '../Data/User'
import { uploadEncryptedAttachment, downloadDecryptedAttachment } from './signal/attachmentService'
import { ok, err, type Result } from './result'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ObjectBundle')

export const CALENDAR_BUNDLE_SCHEMA = 1
export const OVERLAY_BUNDLE_SCHEMA = 1
export const NOTE_BLOCKS_BUNDLE_SCHEMA = 1
export const PROPERTY_ITEM_BUNDLE_SCHEMA = 1

// ---- Bundle payloads (the frozen value that travels) ----

/** Operational, non-PHI projection of a calendar event. No ids, no assignees. */
export interface BundledEvent {
  title: string
  description: string | null
  category: EventCategory
  start_time: string
  end_time: string
  all_day: boolean
  location: string | null
  uniform: string | null
  report_time: string | null
  opord_notes: string | null
}

/** Operational projection of a single overlay feature. No id / overlay_id /
 *  tc3_card_id — ids are reminted on import, the TC3 link never leaves. */
export interface BundledFeature {
  type: OverlayFeature['type']
  geometry: [number, number][]
  label: string
  style: OverlayFeature['style']
  waypoint_type?: OverlayFeature['waypoint_type']
  mgrs?: string
  notes?: string
  recorded?: boolean
  recorded_started_at?: string
  recorded_ended_at?: string
}

export interface CalendarEventBundle {
  schema: number
  kind: 'calendar-event'
  /** ISO timestamp the bundle was exported. */
  exportedAt: string
  /** Human label of the originating cluster — shown as "from [cluster]". */
  sourceCluster: string
  event: BundledEvent
}

export interface MapOverlayBundle {
  schema: number
  kind: 'map-overlay'
  exportedAt: string
  sourceCluster: string
  overlay: {
    name: string
    description: string | null
    center: [number, number]
    zoom: number
    features: BundledFeature[]
  }
}

/**
 * Operational projection of ONE property line. Every id is dropped: the item is
 * reminted unassigned in the receiver's cluster, so holder / owner / zone /
 * parent-SKO / zone-shadow links have no meaning outside the sending cluster and
 * are accountability claims we must not export. The enrollment photo and visual
 * fingerprint stay home too — they are device-captured imagery, not vocabulary.
 * Lifecycle state (turn-in, external sign-out, tombstone) is sender-local and
 * resets on the copy.
 */
export interface BundledPropertyItem {
  name: string
  nomenclature: string | null
  nsn: string | null
  lin: string | null
  serial_number: string | null
  quantity: number
  quantity_authorized: number | null
  is_serialized: boolean
  item_type: ItemType
  unit_of_issue: UnitOfIssue | null
  pack_size: number | null
  condition_code: PropertyCondition
  expiry_date: string | null
  notes: string | null
}

export interface PropertyItemBundle {
  schema: number
  kind: 'property-item'
  exportedAt: string
  sourceCluster: string
  item: BundledPropertyItem
}

/**
 * Portable note-building blocks — text expanders ("text templates"), plan order
 * sets, and plan tag lists. Unlike calendar/overlay bundles these are NOT vault
 * objects: they're personal/clinic config with zero PHI and no cluster-local
 * refs, so the SAME frozen value works for same- AND cross-cluster recipients
 * (there is no live `shared_ref` counterpart — always send the bundle).
 *
 * A single bundle can carry any mix: one item (row-level "Share to chat") or a
 * whole panel (bulk "Export"). Order-set ids are remint-able on ingest; text
 * expanders are keyed by `abbr`, tags by string value — those are the dedup keys.
 */
export interface NoteBlocksBundle {
  schema: number
  kind: 'note-blocks'
  exportedAt: string
  sourceCluster: string
  textExpanders?: TextExpander[]
  planOrderSets?: PlanOrderSet[]
  planOrderTags?: PlanOrderTags
  planInstructionTags?: string[]
}

export type ObjectBundle = CalendarEventBundle | MapOverlayBundle | PropertyItemBundle | NoteBlocksBundle

/** Source object handed to the share picker so it can build a bundle for a
 *  cross-cluster recipient (the picker still sends a live `shared_ref` to
 *  same-cluster recipients, where the object is already vault-resolvable). */
export type BundleSource =
  | { kind: 'calendar-event'; event: CalendarEvent }
  | { kind: 'map-overlay'; overlay: MapOverlay }
  | { kind: 'property-item'; item: PropertyItem }
  | { kind: 'note-blocks'; blocks: NoteBlocksData; label: string; subLabel?: string }

/** The raw block payload a caller hands the share picker / file exporter. */
export interface NoteBlocksData {
  textExpanders?: TextExpander[]
  planOrderSets?: PlanOrderSet[]
  planOrderTags?: PlanOrderTags
  planInstructionTags?: string[]
}

// ---- Export projection (object → bundle) ----

export function eventToBundle(event: CalendarEvent, sourceCluster: string, exportedAt: string): CalendarEventBundle {
  return {
    schema: CALENDAR_BUNDLE_SCHEMA,
    kind: 'calendar-event',
    exportedAt,
    sourceCluster,
    event: {
      title: event.title,
      description: event.description ?? null,
      category: event.category,
      start_time: event.start_time,
      end_time: event.end_time,
      all_day: event.all_day,
      location: event.location ?? null,
      uniform: event.uniform ?? null,
      report_time: event.report_time ?? null,
      opord_notes: event.opord_notes ?? null,
    },
  }
}

export function overlayToBundle(overlay: MapOverlay, sourceCluster: string, exportedAt: string): MapOverlayBundle {
  return {
    schema: OVERLAY_BUNDLE_SCHEMA,
    kind: 'map-overlay',
    exportedAt,
    sourceCluster,
    overlay: {
      name: overlay.name,
      description: overlay.description ?? null,
      center: overlay.center,
      zoom: overlay.zoom,
      features: overlay.features.map(featureToBundled),
    },
  }
}

/** Strip ids + tc3 link; keep only operational geometry/label/style. */
function featureToBundled(f: OverlayFeature): BundledFeature {
  const out: BundledFeature = {
    type: f.type,
    geometry: f.geometry,
    label: f.label,
    style: f.style,
  }
  if (f.waypoint_type) out.waypoint_type = f.waypoint_type
  if (f.mgrs) out.mgrs = f.mgrs
  if (f.notes) out.notes = f.notes
  if (f.recorded) {
    out.recorded = true
    if (f.recorded_started_at) out.recorded_started_at = f.recorded_started_at
    if (f.recorded_ended_at) out.recorded_ended_at = f.recorded_ended_at
  }
  return out
}

export function propertyItemToBundle(item: PropertyItem, sourceCluster: string, exportedAt: string): PropertyItemBundle {
  return {
    schema: PROPERTY_ITEM_BUNDLE_SCHEMA,
    kind: 'property-item',
    exportedAt,
    sourceCluster,
    item: {
      name: item.name,
      nomenclature: item.nomenclature,
      nsn: item.nsn,
      lin: item.lin,
      serial_number: item.serial_number,
      quantity: item.quantity,
      quantity_authorized: item.quantity_authorized,
      is_serialized: item.is_serialized,
      item_type: item.item_type,
      unit_of_issue: item.unit_of_issue,
      pack_size: item.pack_size,
      condition_code: item.condition_code,
      expiry_date: item.expiry_date,
      notes: item.notes,
    },
  }
}

/** Project a raw block payload into a self-contained note-blocks bundle. Drops
 *  empty arrays so the bundle only advertises what it actually carries. */
export function noteBlocksToBundle(data: NoteBlocksData, sourceCluster: string, exportedAt: string): NoteBlocksBundle {
  const out: NoteBlocksBundle = { schema: NOTE_BLOCKS_BUNDLE_SCHEMA, kind: 'note-blocks', exportedAt, sourceCluster }
  if (data.textExpanders && data.textExpanders.length) out.textExpanders = data.textExpanders
  if (data.planOrderSets && data.planOrderSets.length) out.planOrderSets = data.planOrderSets
  if (data.planInstructionTags && data.planInstructionTags.length) out.planInstructionTags = data.planInstructionTags
  if (data.planOrderTags && Object.values(data.planOrderTags).some(v => v.length)) out.planOrderTags = data.planOrderTags
  return out
}

export function bundleSourceToBundle(source: BundleSource, sourceCluster: string, exportedAt: string): ObjectBundle {
  switch (source.kind) {
    case 'calendar-event': return eventToBundle(source.event, sourceCluster, exportedAt)
    case 'map-overlay':    return overlayToBundle(source.overlay, sourceCluster, exportedAt)
    case 'property-item':  return propertyItemToBundle(source.item, sourceCluster, exportedAt)
    case 'note-blocks':    return noteBlocksToBundle(source.blocks, sourceCluster, exportedAt)
  }
}

/** Count the discrete blocks a note-blocks bundle carries (for labels/previews). */
export function noteBlocksCounts(b: NoteBlocksBundle): { templates: number; orderSets: number; tags: number } {
  const tags =
    (b.planInstructionTags?.length ?? 0) +
    (b.planOrderTags ? Object.values(b.planOrderTags).reduce((n, v) => n + v.length, 0) : 0)
  return { templates: b.textExpanders?.length ?? 0, orderSets: b.planOrderSets?.length ?? 0, tags }
}

// ---- Import remint (bundle → fresh local object) ----

/** Context the receiver supplies when materializing a bundle into their cluster. */
export interface IngestContext {
  clinicId: string
  userId: string
  /** ISO 'now' — caller stamps it (Date.now is unavailable in some contexts). */
  now: string
}

/**
 * Remint a calendar bundle into a fresh CalendarEvent in the receiver's cluster.
 * NEW id, the receiver's clinic_id/created_by, empty assignees/property, no
 * originId. `templated` is coerced to `appointment` so the imported copy isn't
 * locked behind the supervisor-only edit gate.
 */
export function bundleToEvent(bundle: CalendarEventBundle, ctx: IngestContext): CalendarEvent {
  const category: EventCategory = bundle.event.category === 'templated' ? 'appointment' : bundle.event.category
  return {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    title: bundle.event.title,
    description: bundle.event.description,
    category,
    status: 'pending',
    start_time: bundle.event.start_time,
    end_time: bundle.event.end_time,
    all_day: bundle.event.all_day,
    location: bundle.event.location,
    opord_notes: bundle.event.opord_notes,
    uniform: bundle.event.uniform,
    report_time: bundle.event.report_time,
    assigned_to: [],
    property_item_ids: [],
    created_by: ctx.userId,
    created_at: ctx.now,
    updated_at: ctx.now,
  }
}

/** Remint an overlay bundle into fresh writeOverlay params (NEW overlay id +
 *  NEW feature ids + overlay_id rebind). Returns the new overlay id too so the
 *  caller can deep-link to it after the write lands. */
export function bundleToOverlay(
  bundle: MapOverlayBundle,
  ctx: IngestContext,
): { overlayId: string; clinicId: string; name: string; description?: string; center: [number, number]; zoom: number; features: OverlayFeature[] } {
  const overlayId = crypto.randomUUID()
  const features: OverlayFeature[] = bundle.overlay.features.map(bf => ({
    id: crypto.randomUUID(),
    overlay_id: overlayId,
    type: bf.type,
    geometry: bf.geometry,
    label: bf.label,
    style: bf.style,
    created_at: ctx.now,
    updated_at: ctx.now,
    ...(bf.waypoint_type ? { waypoint_type: bf.waypoint_type } : {}),
    ...(bf.mgrs ? { mgrs: bf.mgrs } : {}),
    ...(bf.notes ? { notes: bf.notes } : {}),
    ...(bf.recorded
      ? {
          recorded: true,
          ...(bf.recorded_started_at ? { recorded_started_at: bf.recorded_started_at } : {}),
          ...(bf.recorded_ended_at ? { recorded_ended_at: bf.recorded_ended_at } : {}),
        }
      : {}),
  }))
  return {
    overlayId,
    clinicId: ctx.clinicId,
    name: bundle.overlay.name,
    ...(bundle.overlay.description ? { description: bundle.overlay.description } : {}),
    center: bundle.overlay.center,
    zoom: bundle.overlay.zoom,
    features,
  }
}

/**
 * Remint a property bundle into `addItem` params for the receiver's cluster. The
 * copy lands UNASSIGNED (no zone, no holder, no parent): zone ids are cluster-
 * local, and receiving a description of someone else's equipment is not a custody
 * event — the receiver places and signs for it themselves. Turn-in / external
 * sign-out state does not travel, so the copy starts clean on the books.
 */
export function bundleToPropertyItem(
  bundle: PropertyItemBundle,
  ctx: IngestContext,
): Omit<PropertyItem, 'id' | 'created_at' | 'updated_at' | 'signed_out_external' | 'owner_user_id' | 'turned_in_at'> {
  const b = bundle.item
  return {
    clinic_id: ctx.clinicId,
    name: b.name,
    nomenclature: b.nomenclature,
    nsn: b.nsn,
    lin: b.lin,
    serial_number: b.serial_number,
    quantity: b.quantity,
    quantity_authorized: b.quantity_authorized,
    is_serialized: b.is_serialized,
    item_type: b.item_type,
    unit_of_issue: b.unit_of_issue,
    pack_size: b.pack_size,
    condition_code: b.condition_code,
    expiry_date: b.expiry_date,
    notes: b.notes,
    parent_item_id: null,
    location_id: null,
    current_holder_id: null,
    location_tag_id: null,
    photo_url: null,
    visual_fingerprint: null,
  }
}

// ---- Labels (for the chat card + conversation preview) ----

export function bundleLabel(bundle: ObjectBundle): { label: string; subLabel?: string } {
  if (bundle.kind === 'calendar-event') {
    return { label: bundle.event.title || 'Event', subLabel: formatEventSub(bundle.event) }
  }
  if (bundle.kind === 'property-item') {
    const i = bundle.item
    // Same shape the live shared_ref uses, so a same- and cross-cluster share of
    // the one item read identically in the thread.
    const qty = i.is_serialized ? (i.serial_number ? `SN ${i.serial_number}` : 'Serialized') : `Qty ${i.quantity}`
    return {
      label: i.name || i.nomenclature || 'Item',
      subLabel: i.nsn ? `${qty} · Material/NSN ${i.nsn}` : qty,
    }
  }
  if (bundle.kind === 'note-blocks') {
    const c = noteBlocksCounts(bundle)
    // Single-item shares read naturally ("URI Basic"); mixed/bulk shares summarize.
    if (c.templates === 1 && !c.orderSets && !c.tags) return { label: bundle.textExpanders![0].abbr, subLabel: 'Text template' }
    if (c.orderSets === 1 && !c.templates && !c.tags) return { label: bundle.planOrderSets![0].name, subLabel: 'Order set' }
    const parts: string[] = []
    if (c.templates) parts.push(`${c.templates} ${c.templates === 1 ? 'template' : 'templates'}`)
    if (c.orderSets) parts.push(`${c.orderSets} ${c.orderSets === 1 ? 'order set' : 'order sets'}`)
    if (c.tags) parts.push(`${c.tags} ${c.tags === 1 ? 'tag' : 'tags'}`)
    return { label: 'Note blocks', subLabel: parts.join(' · ') || 'Empty' }
  }
  const n = bundle.overlay.features.length
  return { label: bundle.overlay.name || 'Overlay', subLabel: `${n} ${n === 1 ? 'feature' : 'features'}` }
}

function formatEventSub(e: BundledEvent): string {
  try {
    const start = new Date(e.start_time)
    const d = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    if (e.all_day) return `${d} · all day`
    const t = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${d} · ${t}`
  } catch {
    return ''
  }
}

// ---- Integrity hash ----

/** sha-256 hex of an arbitrary string (the canonical bundle JSON). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---- Transport (pack to / unpack from message-attachments) ----

export interface PackedBundle {
  kind: ObjectBundle['kind']
  path: string
  key: string
  contentHash: string
  label: string
  subLabel?: string
  sourceCluster: string
}

/**
 * Serialize → hash → AES-encrypt → upload to the message-attachments bucket.
 * Returns everything the SharedBundleContent message needs to carry. The blob
 * in storage is ciphertext; the key is returned to ride INSIDE the E2E message.
 */
export async function packBundle(userId: string, bundle: ObjectBundle): Promise<Result<PackedBundle>> {
  const json = JSON.stringify(bundle)
  const contentHash = await sha256Hex(json)
  const blob = new Blob([json], { type: 'application/json' })
  const up = await uploadEncryptedAttachment(userId, blob)
  if (!up.ok) return err(up.error)
  const { label, subLabel } = bundleLabel(bundle)
  return ok({
    kind: bundle.kind,
    path: up.data.path,
    key: up.data.key,
    contentHash,
    label,
    ...(subLabel ? { subLabel } : {}),
    sourceCluster: bundle.sourceCluster,
  })
}

/**
 * Download ciphertext from the bucket, decrypt with the carried key, verify the
 * integrity hash, and parse back into a typed bundle.
 */
export async function unpackBundle(path: string, key: string, expectedHash: string): Promise<Result<ObjectBundle>> {
  const dl = await downloadDecryptedAttachment(path, key)
  if (!dl.ok) return err(dl.error)
  let json: string
  try {
    json = await dl.data.text()
  } catch {
    return err('Could not read bundle blob')
  }
  const actualHash = await sha256Hex(json)
  if (actualHash !== expectedHash) {
    logger.warn('Bundle hash mismatch — refusing to ingest')
    return err('Bundle integrity check failed')
  }
  const parsed = parseBundle(json)
  if (!parsed) return err('Bundle could not be parsed')
  return ok(parsed)
}

/** Defensive parse — validates the discriminant + schema before trusting it. */
export function parseBundle(json: string): ObjectBundle | null {
  try {
    const raw = JSON.parse(json) as Partial<ObjectBundle>
    if (raw.kind === 'calendar-event' && raw.event && typeof (raw as CalendarEventBundle).event.title === 'string') {
      return raw as CalendarEventBundle
    }
    if (raw.kind === 'map-overlay' && (raw as MapOverlayBundle).overlay && Array.isArray((raw as MapOverlayBundle).overlay.features)) {
      return raw as MapOverlayBundle
    }
    if (raw.kind === 'property-item' && (raw as PropertyItemBundle).item && typeof (raw as PropertyItemBundle).item.name === 'string') {
      return raw as PropertyItemBundle
    }
    if (raw.kind === 'note-blocks') {
      const nb = raw as NoteBlocksBundle
      const arraysOk =
        (nb.textExpanders === undefined || Array.isArray(nb.textExpanders)) &&
        (nb.planOrderSets === undefined || Array.isArray(nb.planOrderSets)) &&
        (nb.planInstructionTags === undefined || Array.isArray(nb.planInstructionTags))
      if (arraysOk) return nb
    }
    return null
  } catch {
    return null
  }
}
