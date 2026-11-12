/**
 * useTrackingBoardData — real inputs for the Tracking Board.
 *
 *  - viewerId : the operating-as cluster (supervisingClinicId, else home). Its
 *               stations are the board's columns / groups; check-ins stamp it as
 *               origin; settings, sharing and reconcile act on it
 *  - viewerIds: home + every active loan. The board holds every casualty fanned
 *               to any of them, regardless of operating-as
 *  - originFilter: render-only trackingClusterFilter, by check-in origin (null = all)
 *  - clusters : tracking_cluster_tree RPC per reachable cluster, merged (clusters joined by an active
 *               send → receive link), cached per viewer in localStorage (names /
 *               UICs / parents / sharing flags only — no PHI) so the board groups
 *               offline. Cache-first: the RPC runs once per session per viewer
 *               (shared by drawer + widget), then only after TREE_TTL_MS, a
 *               'clinics' invalidation, or this cluster's own sharing toggle —
 *               never on every open / mount
 *  - places   : tracking pins from local overlays — own and those fanned in from
 *               linked clusters (getAllLocalMapOverlays; the by-clinic map store
 *               would miss the latter). Overlays from a cluster no longer linked
 *               drop out here, before the owner's reconcile lands.
 *  - events   : useCalendarStore.tracking (hidden tracking calendar events)
 *  - sharing  : this cluster's send / receive toggles (null until known)
 *  - relatedIds: linked cluster ids from the latest tree fetch (null until one
 *               lands this session); the drawer feeds it to reconcileTargets
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
const cacheKey = (viewerId: string) => `tracking.clusterTree:${viewerId}`

/** Tree re-pull floor. The tree only changes when a link's send / receive
 *  flag flips, so serve the cache and refresh at most this often — plus on a
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
  send?: boolean
  receive?: boolean
}

export interface TrackingSharing { send: boolean; receive: boolean }

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
      const { data, error } = await supabase.rpc('tracking_cluster_tree', { p_clinic_id: viewerId })
      if (error || !Array.isArray(data)) {
        if (error) logger.warn('tracking_cluster_tree failed:', error.message)
        return null
      }
      const next: ClusterRow[] = (data as Array<{ id: string; name: string | null; nickname: string | null; uics: string[] | null; parent_clinic_id: string | null; tracking_send: boolean; tracking_receive: boolean }>)
        .map(r => ({ id: r.id, name: r.name ?? '', nickname: r.nickname, uic: r.uics?.[0] ?? '', parentId: r.parent_clinic_id, send: r.tracking_send, receive: r.tracking_receive }))
      saveCachedRows(viewerId, next)
      return next
    } catch (e) {
      logger.warn('tracking_cluster_tree threw:', e instanceof Error ? e.message : e)
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
  const viewerIds = reachable
  // Check-in origin narrowing; null = every one of my clusters. A selection that
  // no longer matches any reachable cluster (loan ended) reads as no filter.
  const originFilter = useMemo(() => {
    if (!filter) return null
    const narrowed = reachable.filter(id => filter.includes(id))
    return narrowed.length > 0 ? narrowed : null
  }, [reachable, filter])
  // Trees to hold: every reachable cluster (the operating-as one among them), so
  // a loan's check-ins resolve their stations and move targets.
  const scopeIds = reachable
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
        treeSession.set(id, { at: Date.now(), gen: clinicsGen, relatedIds: next.map(r => r.id) })
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
  // Linked ids from this session's fetch (any instance's), null until one lands.
  // Read at render: the fetch writes treeSession before setTree re-renders.
  const relatedIds = treeSession.get(viewerId)?.relatedIds ?? null

  const me = treeOf(viewerId).find(r => r.id === viewerId)
  const sharing = useMemo<TrackingSharing | null>(
    () => (me ? { send: !!me.send, receive: !!me.receive } : null),
    [me],
  )

  /** Optimistic toggle; a re-fetched tree then drives reconcileTargets. */
  const setSharing = useCallback(async (next: TrackingSharing): Promise<void> => {
    if (!viewerId) return
    const prev = treeOf(viewerId)
    setTree(viewerId, prev.map(r => (r.id === viewerId ? { ...r, ...next } : r)))
    const { error } = await supabase.rpc('supervisor_set_tracking_sharing', {
      p_clinic_id: viewerId,
      p_send: next.send,
      p_receive: next.receive,
    })
    if (error) {
      logger.warn('supervisor_set_tracking_sharing failed:', error.message)
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

  const overlays = useMemo(() => {
    const scoped = new Set(scopeIds)
    const linked = new Set(rows.map(r => r.id))
    return allOverlays.filter(o => scoped.has(o.clinic_id)
      || ((o.target_clinic_ids?.some(id => scoped.has(id)) ?? false) && (rows.length === 0 || linked.has(o.clinic_id))))
  }, [allOverlays, rows, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useCalendarStore(s => s.tracking)

  const net = useMemo<TrackingNetwork>(() => {
    const places = derivePlaces(overlays)
    // Any cluster the board references but the trees haven't returned (offline
    // first run, RPC miss) still gets a group so its stations / origins show.
    const known = new Map(rows.map(r => [r.id, r]))
    const referenced = [...scopeIds, ...places.map(p => p.clinicId), ...places.flatMap(p => p.targetClinicIds), ...events.map(e => e.clinic_id)]
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

  return { viewerId, viewerIds, originFilter, net, events, overlays, sharing, setSharing, relatedIds }
}
