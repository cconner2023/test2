/**
 * useTrackingBoardData — real inputs for the Tracking Board.
 *
 *  - viewerId : the member's operating cluster (supervising ?? home)
 *  - clusters : tracking_cluster_tree RPC (related clusters: chain + siblings),
 *               cached per device in localStorage (names / UICs / parents only —
 *               no PHI) so the board groups offline
 *  - places   : tracking pins from EVERY local overlay — own and those fanned in
 *               from related clusters (getAllLocalMapOverlays; the by-clinic map
 *               store would miss the latter)
 *  - events   : useCalendarStore.tracking (hidden tracking calendar events)
 */

import { useEffect, useMemo, useState } from 'react'
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

interface ClusterRow { id: string; name: string; nickname: string | null; uic: string; parentId: string | null }

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
  useEffect(() => {
    if (!isVisible || !viewerId) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('tracking_cluster_tree')
        if (error || !Array.isArray(data)) {
          if (error) logger.warn('tracking_cluster_tree failed:', error.message)
          return
        }
        const next: ClusterRow[] = (data as Array<{ id: string; name: string | null; nickname: string | null; uics: string[] | null; parent_clinic_id: string | null }>)
          .map(r => ({ id: r.id, name: r.name ?? '', nickname: r.nickname, uic: r.uics?.[0] ?? '', parentId: r.parent_clinic_id }))
        if (cancelled) return
        setRows(next)
        saveCachedRows(next)
      } catch (e) {
        logger.warn('tracking_cluster_tree threw:', e instanceof Error ? e.message : e)
      }
    })()
    return () => { cancelled = true }
  }, [isVisible, viewerId])

  const overlayGen = useInvalidation('mapOverlays')
  const [overlays, setOverlays] = useState<LocalMapOverlay[]>([])
  useEffect(() => {
    if (!isVisible) return
    let cancelled = false
    getAllLocalMapOverlays()
      .then(all => { if (!cancelled) setOverlays(all) })
      .catch(e => logger.warn('overlay load failed:', e instanceof Error ? e.message : e))
    return () => { cancelled = true }
  }, [isVisible, overlayGen])

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

  return { viewerId, net, events, overlays }
}
