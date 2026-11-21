/**
 * useTrackingBoardData — real inputs for the Tracking Board.
 *
 *  - viewerId : the operating-as cluster (supervisingClinicId, else home). Its
 *               stations are the board's columns / groups; check-ins stamp it as
 *               origin; settings, sharing and reconcile act on it
 *  - viewerIds: the viewer + any of my other clusters (loans) it live-receives
 *               from. The board holds every casualty fanned to them; the origin
 *               filter offers exactly these
 *  - originFilter: render-only trackingClusterFilter, by check-in origin (null = all)
 *  - clusters : tracking_cluster_directory RPC for the viewer (itself,
 *               its parent / children / siblings, live patient-chain clusters and
 *               live senders), cached per viewer in localStorage (names / UICs /
 *               parents / link flags only — no PHI) so the board groups
 *               offline. Cache-first: the RPC runs once per session per viewer
 *               (shared by drawer + widget), then only after TREE_TTL_MS, a
 *               'clinics' invalidation, or this cluster's own sharing toggle —
 *               never on every open / mount
 *  - places   : tracking features from local overlays — own and those fanned in
 *               from clusters sending to us over a live link (getAllLocalMapOverlays;
 *               the by-clinic map store would miss the latter). Overlays from a
 *               cluster no longer linked drop out here, before the owner's
 *               reconcile lands.
 *  - events   : useCalendarStore.tracking (hidden tracking calendar events)
 *  - links    : per-cluster link rows for settings — every hierarchy neighbour
 *               (parent / children / siblings) with both sides' flags. A link
 *               A → B is live when A sends to B AND B receives from A.
 *  - relatedIds: clusters live-receiving from the viewer, from this session's
 *               fetch (null until one lands); the drawer feeds it to
 *               reconcileTargets
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useInvalidation } from '../stores/useInvalidationStore'
import { getAllLocalMapOverlays } from '../lib/offlineDb'
import { clusterLabelParts } from '../Utilities/clusterLabel'
import { buildClusters, derivePlaces, type TrackingNetwork } from '../Components/TrackingBoard/trackingModel'
import type { LocalMapOverlay } from '../Types/MapOverlayTypes'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('TrackingBoardData')

/** Per-cluster cache key — the tree is the viewer's, so a different viewer
 *  must never paint from another cluster's rows. */
const cacheKey = (viewerId: string) => `tracking.clusterDir:${viewerId}`

/** Tree re-pull floor. The tree only changes when a link flag flips, so serve the cache and refresh at most this often — plus on a
 *  'clinics' invalidation or our own sharing toggle. */
const TREE_TTL_MS = 10 * 60 * 1000

/** Session memory, shared by every hook instance (drawer + overview widget):
 *  when each viewer's tree was last fetched, at which 'clinics' generation,
 *  and the linked ids it returned (fed to reconcileTargets without a re-pull). */
const treeSession = new Map<string, { at: number; gen: number; relatedIds: string[] }>()
const inflight = new Map<string, Promise<ClusterRow[] | null>>()

interface ClusterRow {
  id: string
  name: string
  nickname: string | null
  uic: string
  parentId: string | null
  /** Flags relative to the tree's viewer: viewer sends to / receives from this
   *  cluster; this cluster sends to / receives from the viewer. */
  iSend?: boolean
  iReceive?: boolean
  theySend?: boolean
  theyReceive?: boolean
}

/** One hierarchy neighbour in board settings. */
export interface TrackingLink {
  clinicId: string
  label: string
  iSend: boolean
  iReceive: boolean
  theySend: boolean
  theyReceive: boolean
}

/** Live senders to `viewerId` (id → label) from its cached directory — the Map
 *  reads this to surface their tracking overlays without a fetch of its own. The
 *  cache refreshes when the board (or its overview widget) loads. */
export const cachedTrackingSenders = (viewerId: string): Map<string, string> =>
  new Map(loadCachedRows(viewerId)
    .filter(r => r.theySend && r.iReceive)
    .map(r => [r.id, clusterLabelParts(r.id, r.name).primary || r.nickname || r.name || 'Cluster']))

const liveReceivers = (rows: ClusterRow[]) => rows.filter(r => r.iSend && r.theyReceive).map(r => r.id)

function loadCachedRows(viewerId: string): ClusterRow[] {
  if (!viewerId) return []
  try {
    const raw = window.localStorage.getItem(cacheKey(viewerId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveCachedRows(viewerId: string, rows: ClusterRow[]): void {
  try { window.localStorage.setItem(cacheKey(viewerId), JSON.stringify(rows)) } catch { /* private mode */ }
}

/** One RPC per viewer at a time — the drawer and the widget share it. */
function fetchTree(viewerId: string): Promise<ClusterRow[] | null> {
  const running = inflight.get(viewerId)
  if (running) return running
  const p = (async () => {
    try {
      const { data, error } = await supabase.rpc('tracking_cluster_directory', { p_clinic_id: viewerId })
      if (error || !Array.isArray(data)) {
        if (error) logger.warn('tracking_cluster_directory failed:', error.message)
        return null
      }
      const next: ClusterRow[] = (data as Array<{ id: string; name: string | null; nickname: string | null; uics: string[] | null; parent_clinic_id: string | null; i_send: boolean; i_receive: boolean; they_send: boolean; they_receive: boolean }>)
        .map(r => ({
          id: r.id, name: r.name ?? '', nickname: r.nickname, uic: r.uics?.[0] ?? '', parentId: r.parent_clinic_id,
          iSend: r.i_send, iReceive: r.i_receive, theySend: r.they_send, theyReceive: r.they_receive,
        }))
      saveCachedRows(viewerId, next)
      return next
    } catch (e) {
      logger.warn('tracking_cluster_directory threw:', e instanceof Error ? e.message : e)
      return null
    } finally {
      inflight.delete(viewerId)
    }
  })()
  inflight.set(viewerId, p)
  return p
}

export function useTrackingBoardData(isVisible: boolean) {
  const { clinicId, surrogateClinicIds, supervisingClinicId } = useAuth()
  const filter = useCalendarStore(s => s.trackingClusterFilter)
  const home = clinicId ?? ''
  const loanKey = surrogateClinicIds.join(',')
  const reachable = useMemo(
    () => (home ? [home, ...surrogateClinicIds.filter(id => id !== home)] : []),
    [home, loanKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // A stale operating-as id (loan ended) falls back to home rather than
  // writing check-ins into a cluster we can no longer reach.
  const viewerId = supervisingClinicId && reachable.includes(supervisingClinicId) ? supervisingClinicId : home
  // The board is the operating-as cluster's: only its own directory is held.
  // Other clusters (loans included) reach it only by live-sending to it.
  const scopeIds = useMemo(() => (viewerId ? [viewerId] : []), [viewerId])
  const scopeKey = scopeIds.join(',')

  // Cache-first: paint from each cluster's cached tree; the RPC only refreshes it.
  const [trees, setTrees] = useState<Record<string, ClusterRow[]>>({})
  const treeOf = useCallback(
    (id: string): ClusterRow[] => trees[id] ?? loadCachedRows(id),
    [trees],
  )
  const setTree = useCallback((id: string, next: ClusterRow[]) => setTrees(t => ({ ...t, [id]: next })), [])
  const [treeGen, setTreeGen] = useState(0)
  const clinicsGen = useInvalidation('clinics')
  useEffect(() => {
    if (!isVisible) return
    let cancelled = false
    for (const id of scopeIds) {
      const seen = treeSession.get(id)
      // Fresh this session at the same 'clinics' generation → cache only. A sharing
      // toggle drops the session entry, so its treeGen bump falls through to the RPC.
      if (seen && seen.gen === clinicsGen && Date.now() - seen.at < TREE_TTL_MS) continue
      void fetchTree(id).then(next => {
        if (!next) return
        treeSession.set(id, { at: Date.now(), gen: clinicsGen, relatedIds: liveReceivers(next) })
        if (!cancelled) setTree(id, next)
      })
    }
    return () => { cancelled = true }
  }, [isVisible, scopeKey, treeGen, clinicsGen, setTree]) // eslint-disable-line react-hooks/exhaustive-deps

  // Union of the scoped trees. A cluster linked to two of my boards appears once.
  const rows = useMemo(() => {
    const byId = new Map<string, ClusterRow>()
    for (const id of scopeIds) for (const r of treeOf(id)) if (!byId.has(r.id)) byId.set(r.id, r)
    return Array.from(byId.values())
  }, [scopeKey, treeOf]) // eslint-disable-line react-hooks/exhaustive-deps
  // Live receivers from this session's fetch (any instance's), null until one lands.
  // Read at render: the fetch writes treeSession before setTree re-renders.
  const relatedIds = treeSession.get(viewerId)?.relatedIds ?? null

  // Hierarchy neighbours — the only clusters a link can be made with.
  const viewerRows = treeOf(viewerId)
  const links = useMemo<TrackingLink[]>(() => {
    const me = viewerRows.find(r => r.id === viewerId)
    if (!me) return []
    return viewerRows
      .filter(r => r.id !== viewerId
        && (r.id === me.parentId || r.parentId === viewerId || (!!me.parentId && r.parentId === me.parentId)))
      .map(r => ({
        clinicId: r.id,
        label: clusterLabelParts(r.id, r.name).primary || r.nickname || r.name || 'Cluster',
        iSend: !!r.iSend, iReceive: !!r.iReceive, theySend: !!r.theySend, theyReceive: !!r.theyReceive,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [viewerRows, viewerId])

  /** Optimistic per-cluster toggle; a re-fetched tree then drives reconcileTargets. */
  const setLink = useCallback(async (otherId: string, next: { send?: boolean; receive?: boolean }): Promise<void> => {
    if (!viewerId) return
    const prev = treeOf(viewerId)
    setTree(viewerId, prev.map(r => (r.id === otherId
      ? { ...r, ...(next.send !== undefined ? { iSend: next.send } : {}), ...(next.receive !== undefined ? { iReceive: next.receive } : {}) }
      : r)))
    const { error } = await supabase.rpc('supervisor_set_tracking_link', {
      p_clinic_id: viewerId,
      p_other_clinic_id: otherId,
      p_send: next.send ?? null,
      p_receive: next.receive ?? null,
    })
    if (error) {
      logger.warn('supervisor_set_tracking_link failed:', error.message)
      setTree(viewerId, prev)
      return
    }
    // Our own flip changed the links — the one write that must re-pull.
    treeSession.delete(viewerId)
    setTreeGen(g => g + 1)
  }, [viewerId, treeOf, setTree])

  const overlayGen = useInvalidation('mapOverlays')
  const [allOverlays, setOverlays] = useState<LocalMapOverlay[]>([])
  useEffect(() => {
    if (!isVisible) return
    let cancelled = false
    getAllLocalMapOverlays()
      .then(all => { if (!cancelled) setOverlays(all) })
      .catch(e => logger.warn('overlay load failed:', e instanceof Error ? e.message : e))
    return () => { cancelled = true }
  }, [isVisible, overlayGen])

  // Clusters live-sending to the viewer (it sends AND we receive). Not
  // receiving from a cluster = none of its stations, overlays or filter row.
  const senderKey = viewerRows.filter(r => r.theySend && r.iReceive).map(r => r.id).sort().join(',')
  const senders = useMemo(() => new Set(senderKey ? senderKey.split(',') : []), [senderKey])

  // Board scope: the viewer + any of my other clusters (loans) it receives from.
  // Entries fanned to them show; the origin filter offers exactly these.
  const viewerIds = useMemo(
    () => (viewerId ? [viewerId, ...reachable.filter(id => id !== viewerId && senders.has(id))] : []),
    [viewerId, reachable, senders],
  )
  // Check-in origin narrowing; null = the whole scope. A selection that no
  // longer matches it (loan ended, link dropped) reads as no filter.
  const originFilter = useMemo(() => {
    if (!filter) return null
    const narrowed = viewerIds.filter(id => filter.includes(id))
    return narrowed.length > 0 ? narrowed : null
  }, [viewerIds, filter])

  // Own overlays + those of live senders aimed at the viewer. No link list yet
  // (first offline run) = own only — never every overlay that names us.
  const overlays = useMemo(
    () => allOverlays.filter(o => o.clinic_id === viewerId
      || (senders.has(o.clinic_id) && (o.target_clinic_ids?.includes(viewerId) ?? false))),
    [allOverlays, viewerId, senders],
  )

  const events = useCalendarStore(s => s.tracking)

  const net = useMemo<TrackingNetwork>(() => {
    const places = derivePlaces(overlays)
    // Any cluster the board references but the trees haven't returned (offline
    // first run, RPC miss) still gets a group so its stations / origins show.
    const known = new Map(rows.map(r => [r.id, r]))
    const referenced = [...scopeIds, ...places.map(p => p.clinicId), ...events.map(e => e.clinic_id)]
    for (const id of referenced) {
      if (id && !known.has(id)) known.set(id, { id, name: '', nickname: null, uic: '', parentId: null })
    }
    const clusters = buildClusters(Array.from(known.values()).map(r => ({
      id: r.id,
      label: clusterLabelParts(r.id, r.name).primary || r.nickname || r.name || 'Cluster',
      uic: r.uic,
      parentId: r.parentId,
    })))
    return { clusters, places }
  }, [rows, overlays, events, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { viewerId, viewerIds, originFilter, net, events, overlays, links, setLink, relatedIds }
}
