/**
 * useTrackingBoardData — real inputs for the Tracking Board.
 *
 *  - viewerId : the member's operating cluster (supervising ?? home)
 *  - clusters : tracking_cluster_tree RPC (clusters joined by an active
 *               send → receive link), cached per device in localStorage (names /
 *               UICs / parents / sharing flags only — no PHI) so the board groups
 *               offline
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

const CLUSTER_CACHE_KEY = 'tracking.clusterTree'

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

function loadCachedRows(): ClusterRow[] {
  try {
    const raw = window.localStorage.getItem(CLUSTER_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveCachedRows(rows: ClusterRow[]): void {
  try { window.localStorage.setItem(CLUSTER_CACHE_KEY, JSON.stringify(rows)) } catch { /* private mode */ }
}

export function useTrackingBoardData(isVisible: boolean) {
  const { clinicId, supervisingClinicId } = useAuth()
  const viewerId = supervisingClinicId ?? clinicId ?? ''

  const [rows, setRows] = useState<ClusterRow[]>(loadCachedRows)
  const [relatedIds, setRelatedIds] = useState<string[] | null>(null)
  const [treeGen, setTreeGen] = useState(0)
  useEffect(() => {
    if (!isVisible || !viewerId) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('tracking_cluster_tree', { p_clinic_id: viewerId })
        if (error || !Array.isArray(data)) {
          if (error) logger.warn('tracking_cluster_tree failed:', error.message)
          return
        }
        const next: ClusterRow[] = (data as Array<{ id: string; name: string | null; nickname: string | null; uics: string[] | null; parent_clinic_id: string | null; tracking_send: boolean; tracking_receive: boolean }>)
          .map(r => ({ id: r.id, name: r.name ?? '', nickname: r.nickname, uic: r.uics?.[0] ?? '', parentId: r.parent_clinic_id, send: r.tracking_send, receive: r.tracking_receive }))
        if (cancelled) return
        setRows(next)
        setRelatedIds(next.map(r => r.id))
        saveCachedRows(next)
      } catch (e) {
        logger.warn('tracking_cluster_tree threw:', e instanceof Error ? e.message : e)
      }
    })()
    return () => { cancelled = true }
  }, [isVisible, viewerId, treeGen])

  const me = rows.find(r => r.id === viewerId)
  const sharing = useMemo<TrackingSharing | null>(
    () => (me ? { send: !!me.send, receive: !!me.receive } : null),
    [me],
  )

  /** Optimistic toggle; a re-fetched tree then drives reconcileTargets. */
  const setSharing = useCallback(async (next: TrackingSharing): Promise<void> => {
    if (!viewerId) return
    const prev = rows
    setRows(prev.map(r => (r.id === viewerId ? { ...r, ...next } : r)))
    const { error } = await supabase.rpc('supervisor_set_tracking_sharing', {
      p_clinic_id: viewerId,
      p_send: next.send,
      p_receive: next.receive,
    })
    if (error) {
      logger.warn('supervisor_set_tracking_sharing failed:', error.message)
      setRows(prev)
      return
    }
    setTreeGen(g => g + 1)
  }, [viewerId, rows])

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
    const linked = new Set(rows.map(r => r.id))
    return allOverlays.filter(o => o.clinic_id === viewerId
      || ((o.target_clinic_ids?.includes(viewerId) ?? false) && (rows.length === 0 || linked.has(o.clinic_id))))
  }, [allOverlays, rows, viewerId])

  const events = useCalendarStore(s => s.tracking)

  const net = useMemo<TrackingNetwork>(() => {
    const places = derivePlaces(overlays)
    // Any cluster the board references but the tree hasn't returned (offline
    // first run, RPC miss) still gets a group so its stations / origins show.
    const known = new Map(rows.map(r => [r.id, r]))
    const referenced = [viewerId, ...places.map(p => p.clinicId), ...places.flatMap(p => p.targetClinicIds), ...events.map(e => e.clinic_id)]
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
  }, [rows, overlays, events, viewerId])

  return { viewerId, net, events, overlays, sharing, setSharing, relatedIds }
}
