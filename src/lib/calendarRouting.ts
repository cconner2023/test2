/**
 * Shared calendar event routing — applies calendar event actions from any
 * message processing path (realtime, vault, backup restore) to the calendar
 * Zustand store. The store's persistence middleware handles IDB write-through.
 *
 * This centralises the routing logic so every path that decrypts a calendar
 * event message can call a single function instead of duplicating the
 * create/update/delete branching.
 */

import type { MessageContent, CalendarEventContent } from './signal/messageContent'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { useCalendarStore } from '../stores/useCalendarStore'
import { loadCalendarTombstones, addCalendarTombstone } from './calendarEventStore'

/** Returns true if the content is a calendar event message. */
export function isCalendarEvent(content: MessageContent | undefined | null): content is CalendarEventContent {
  return content?.type === 'calendar_event'
}

/**
 * Append a full clinic-vault drain's authoritative live event-ids to the
 * reconcile set so useCalendarSync can drop-stale prune. Bridges the signal
 * drain to the store without signal/* importing the store. No-ops on a delta
 * drain (set is null), so additive deltas never trigger a destructive prune.
 */
export function publishFullReplayLiveIds(ids: string[]): void {
  useCalendarStore.getState().appendFullReplayLiveIds(ids)
}

/**
 * Disable the drop-stale reconcile for the whole login (fail-closed). Called
 * when a full drain decrypted only partially, so its live set can't be trusted
 * as authoritative truth — better to skip the prune than wrongly delete cached
 * events. Any later clinic's append no-ops while the set is null.
 */
export function poisonFullReplayReconcile(): void {
  useCalendarStore.getState().setFullReplayLiveIds(null)
}

// Module-level tombstone set for O(1) lookups — avoids IDB on every message.
let _tombstones: Set<string> = new Set()

/** Expose the in-memory tombstone set for hydration filtering. */
export function getTombstones(): Set<string> {
  return _tombstones
}

/**
 * Load persisted tombstones into the in-memory set.
 * Must be called once during hydration before replaying any message stream.
 */
export async function initCalendarTombstones(): Promise<void> {
  _tombstones = await loadCalendarTombstones()
}

/**
 * Route a calendar event to the calendar store.
 * Safe to call from any context (hook, service, module scope) since it
 * uses getState() rather than requiring React rendering context.
 *
 * Create/update actions are silently dropped for tombstoned event IDs so
 * vault replay and backup restore cannot resurrect deleted events.
 */
export function routeCalendarEvent(content: CalendarEventContent): void {
  const { action, data } = content
  const store = useCalendarStore.getState()

  if (action === 'delete') {
    _tombstones.add(data.id)
    addCalendarTombstone(data.id).catch(() => {})
    store.removeEvent(data.id)
    return
  }

  // Guard: skip create/update for any tombstoned event.
  if (_tombstones.has(data.id)) return

  if (action === 'create') {
    // Upsert: if the event already exists (replacement message after edit),
    // update it with the full new state; otherwise add as new.
    if (store.events.some(e => e.id === data.id)) {
      store.updateEvent(data.id, data as Partial<CalendarEvent>)
    } else {
      store.addEvent(data as CalendarEvent)
    }
  } else if (action === 'update') {
    // Legacy delta updates — kept for backward compat with in-flight messages
    if (store.events.some(e => e.id === data.id)) {
      store.updateEvent(data.id, data as Partial<CalendarEvent>)
    } else {
      store.addEvent(data as CalendarEvent)
    }
  }
}

/**
 * Resolved live calendar events for a clinic — the clinic-vault snapshot write
 * source. Reads the store (the synchronous landing spot for every routed event)
 * and filters to this clinic, excluding tombstoned ids. Bridges store→signal so
 * clinicVaultDevice never imports the store directly.
 *
 * REAP-SAFETY: this is also the retain filter for the clinic-vault compaction —
 * reap_clinic_vault_below deletes every vault row this snapshot covers, so an
 * event NOT returned here is permanently dropped from the clinic. We therefore
 * include cross-cluster copies fanned in for a loaned assignee
 * (target_clinic_ids contains this clinic) even though their authoring
 * clinic_id differs. Omitting that clause would let the reap eat every
 * cross-cluster copy after the first snapshot cycle.
 */
export function snapshotCalendarEvents(clinicId: string, vaultLiveIds?: Set<string>): CalendarEvent[] {
  return useCalendarStore.getState().events.filter(e => {
    if (_tombstones.has(e.id)) return false
    const inClinic = e.clinic_id === clinicId || (e.target_clinic_ids?.includes(clinicId) ?? false)
    if (!inClinic) return false
    // When the caller supplies the authoritative vault-resolved id set (snapshot
    // base ∪ tail), retain a store event only if the vault actually carries it,
    // OR it's a local create not yet fanned out (no originId). This excludes
    // cache-first-painted ORPHANS: events a returning device cached but whose 'd'
    // was reaped during its absence, so it never tombstoned them. Without this
    // the snapshot writer re-seals those orphans and resurrects them clinic-wide
    // (poison snapshot). Same retain predicate as useCalendarSync Phase B's
    // drop-stale reconcile, applied at WRITE time so the snapshot can't lie.
    if (vaultLiveIds && e.originId && !vaultLiveIds.has(e.id)) return false
    return true
  })
}

/**
 * Apply a set of event-id tombstones carried inside a clinic snapshot.
 *
 * Deletion in the clinic-vault calendar is otherwise recorded ONLY as (a) a 'd'
 * tail row — reaped after the next snapshot folds it in — and (b) a per-device
 * IDB tombstone that never leaves the device that processed the delete. A fresh
 * device has neither, so before this existed it trusted the snapshot's events[]
 * verbatim and resurrected anything a prior snapshot writer happened to still
 * carry (the snapshot is self-perpetuating). Persisting tombstones IN the one
 * durable store makes deletion durable: a fresh device learns it from the
 * snapshot, and no re-fanning peer can re-add a snapshot-tombstoned id.
 *
 * Must run BEFORE loadSnapshotCalendarEvents so the event load's tombstone guard
 * drops the deleted ids; also removes any already-painted (cache-first) copies.
 */
export async function applyCalendarTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const store = useCalendarStore.getState()
  for (const id of ids) {
    _tombstones.add(id)
    store.removeEvent(id)
  }
  await Promise.all(ids.map(id => addCalendarTombstone(id).catch(() => {})))
}

/**
 * Load a clinic snapshot's resolved events into the store as the bootstrap base
 * (before the tail is decrypted on top). Tombstone-guarded upsert — a snapshot
 * can never resurrect an event deleted locally after the snapshot was sealed.
 */
export function loadSnapshotCalendarEvents(events: CalendarEvent[]): void {
  const store = useCalendarStore.getState()
  for (const ev of events) {
    if (_tombstones.has(ev.id)) continue
    if (store.events.some(e => e.id === ev.id)) {
      store.updateEvent(ev.id, ev as Partial<CalendarEvent>)
    } else {
      store.addEvent(ev)
    }
  }
}
