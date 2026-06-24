import type { CalendarEvent, EventSubtask } from '../../Types/CalendarTypes'
import type { OverlayFeature, LocalMapOverlay } from '../../Types/MapOverlayTypes'
import type { TileTheme } from '../../Components/MapOverlay/ThemedTileLayer'
import { renderConopMapSnapshot } from './mapSnapshot'
import { generateConopPdf, type ConopData } from './generateConopPdf'
import { downloadPdfBytes } from '../../Utilities/downloadUtils'

/** Scheduling-zone map anchor (room_id ↔ overlay link). */
export interface ConopRoomAnchor {
  overlay_id: string
  overlay_feature_id: string | null
}

/**
 * Collect every overlay feature the event links — structured_location,
 * linked_overlays (whole overlays), linked_features (single features), and the
 * scheduling-zone roomAnchor — into one deduped list for the CONOP map snapshot.
 * Full geometry comes from the overlays cache. `overlayId` is the primary overlay
 * whose cached tiles back the offline render. "Whatever is linked": a lone feature
 * → tight zoom; a whole overlay → overlay-extent zoom (the snapshot fits bbox to
 * this union). `overlayIds` tracks every overlay that contributed a feature so the
 * snapshot can pull cached tiles from all of them (avoids blank basemap where the
 * geometry spans overlays).
 */
export function gatherLinkedGeometry(
  event: CalendarEvent,
  overlays: LocalMapOverlay[],
  roomAnchor?: ConopRoomAnchor,
): { features: OverlayFeature[]; overlayId?: string; overlayIds: string[] } {
  const byId = new Map(overlays.map(o => [o.id, o]))
  const seen = new Set<string>()
  const features: OverlayFeature[] = []
  const overlayIds: string[] = []
  const seenOverlay = new Set<string>()
  const noteOverlay = (id?: string) => {
    if (id && !seenOverlay.has(id)) { seenOverlay.add(id); overlayIds.push(id) }
  }
  const add = (f?: OverlayFeature, owner?: string) => {
    if (f && !seen.has(f.id)) { seen.add(f.id); features.push(f); noteOverlay(owner) }
  }

  const fullIds = event.linked_overlays ?? []
  for (const id of fullIds) byId.get(id)?.features.forEach(f => add(f, id))

  for (const fa of event.linked_features ?? []) {
    if (fullIds.includes(fa.overlay_id)) continue
    add(byId.get(fa.overlay_id)?.features.find(x => x.id === fa.feature_id), fa.overlay_id)
  }

  const sl = event.structured_location
  if (sl?.overlay_id && !fullIds.includes(sl.overlay_id)) {
    const o = byId.get(sl.overlay_id)
    if (sl.primary_waypoint_id) add(o?.features.find(x => x.id === sl.primary_waypoint_id), sl.overlay_id)
    else o?.features.forEach(f => add(f, sl.overlay_id))
  }

  if (roomAnchor) {
    const o = byId.get(roomAnchor.overlay_id)
    if (roomAnchor.overlay_feature_id) add(o?.features.find(x => x.id === roomAnchor.overlay_feature_id), roomAnchor.overlay_id)
    else o?.features.forEach(f => add(f, roomAnchor.overlay_id))
  }

  return { features, overlayId: overlayIds[0], overlayIds }
}

export interface ExportEventConopArgs {
  event: CalendarEvent
  /** Resolved display names of the event's assignees. */
  assignedNames: string[]
  /** Full overlays cache (geometry source for the snapshot). */
  overlays: LocalMapOverlay[]
  /** Scheduling-zone anchor, when the zone is linked to an overlay. */
  roomAnchor?: ConopRoomAnchor
  /** Pre-resolved tile theme — getTileTheme(themeName, theme) at the call site. */
  tileTheme: TileTheme
  /** Subtask → display label resolver (mirrors EventTasksCard.labelFor). */
  subtaskLabel: (sub: EventSubtask) => string
}

/**
 * Render the event's linked geometry to a themed basemap snapshot (when any) and
 * emit a CONOP PDF download. Shared by EventDetailPanel and CalendarPanel's
 * lifted-row menu so both surfaces produce an identical export.
 */
export async function exportEventConop({
  event,
  assignedNames,
  overlays,
  roomAnchor,
  tileTheme,
  subtaskLabel,
}: ExportEventConopArgs): Promise<void> {
  const geom = gatherLinkedGeometry(event, overlays, roomAnchor)
  const snap = geom.features.length > 0
    ? await renderConopMapSnapshot({
        features: geom.features,
        overlayIds: geom.overlayIds,
        theme: tileTheme,
        width: 1040,
        height: 980,
      })
    : null

  const sorted = [...(event.subtasks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const data: ConopData = {
    title: event.title || 'CONOP',
    startTime: event.start_time,
    endTime: event.end_time,
    allDay: event.all_day,
    location: event.location,
    assignedNames,
    uniform: event.uniform,
    reportTime: event.report_time,
    notes: event.description,
    subtasks: sorted.map(s => ({ label: subtaskLabel(s), done: !!s.done_at })),
    mapPng: snap?.pngBytes ?? null,
    mapW: snap?.width,
    mapH: snap?.height,
    generatedAt: new Date().toISOString(),
  }

  const bytes = await generateConopPdf(data)
  const safe = (event.title || 'conop').replace(/[^\w-]+/g, '_').slice(0, 40) || 'conop'
  downloadPdfBytes(bytes, `conop-${safe}.pdf`)
}
