/**
 * Actions for shared-object chat messages (shared_ref deep-links + shared_bundle
 * frozen bundles). Backs the lifted-row menu that opens when a shared-object
 * bubble is tapped: `openRef` navigates to a live-linked object; `addBundle`
 * materializes a frozen bundle into the receiver's own data (calendar event,
 * map overlay, property line, or note-blocks config) and records it in the device
 * ingest log so a re-tap can hide the Add action instead of duplicating.
 *
 * Previously this logic lived inside the per-bubble cards (SharedBundleCard /
 * NoteBlocksBundleCard). Consolidating the bubbles to a single text+chevron
 * shape moved the Add/Open affordances into the message menu, so the write
 * plumbing moved here where the menu (in ChatDetailView) can reach it.
 */

import { useCallback } from 'react'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useAuth } from './useAuth'
import { useCalendarWrite } from './useCalendarWrite'
import { useMapOverlayWrite } from './useMapOverlayWrite'
import { useNoteBlocksIngest, type IngestScope } from './useNoteBlocksIngest'
import { unpackBundle, bundleToEvent, bundleToOverlay, bundleToPropertyItem } from '../lib/objectBundle'
import { usePropertyStore } from '../stores/usePropertyStore'
import { loadIngested, markIngested } from '../lib/bundleIngestLog'
import type { SharedRefContent, SharedBundleContent } from '../lib/signal/messageContent'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('useSharedObjectActions')

export function useSharedObjectActions() {
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const setShowPropertyDrawer = useNavigationStore(s => s.setShowPropertyDrawer)
  const { user, clinicId } = useAuth()
  const { writeEvent } = useCalendarWrite()
  const { writeOverlay } = useMapOverlayWrite()
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()

  /** Navigate to the live object a shared_ref points at. */
  const openRef = useCallback((c: SharedRefContent) => {
    if (c.refKind === 'calendar-event') openCalendarEvent(c.refId)
    else if (c.refKind === 'property-item') setShowPropertyDrawer(true, c.refId)
    else setShowMapOverlayDrawer(true, c.refId, c.featureId ?? null)
  }, [openCalendarEvent, setShowPropertyDrawer, setShowMapOverlayDrawer])

  /**
   * Decrypt a frozen bundle and materialize it into the receiver's own data.
   * `scope` applies to note-blocks only ('personal' = profile, 'clinic' = home
   * clinic config, supervisor-gated). Idempotent via the device ingest log.
   */
  const addBundle = useCallback(async (c: SharedBundleContent, scope: IngestScope = 'personal') => {
    if (!user?.id || !clinicId) return
    try {
      const res = await unpackBundle(c.path, c.key, c.contentHash)
      if (!res.ok) { logger.warn('Bundle unpack failed'); return }
      const b = res.data
      const ctx = { clinicId, userId: user.id, now: new Date().toISOString() }
      if (b.kind === 'note-blocks') {
        ingest(b, scope)
        markIngested(c.contentHash)
      } else if (b.kind === 'calendar-event') {
        const event = bundleToEvent(b, ctx)
        await writeEvent(event)
        markIngested(c.contentHash)
        openCalendarEvent(event.id)
      } else if (b.kind === 'property-item') {
        // Lands unassigned in the receiver's book — addItem owns the id, the
        // fan-out targets and the item.created audit row, same as a hand add.
        const created = await usePropertyStore.getState().addItem(bundleToPropertyItem(b, ctx))
        if (!created) { logger.warn('Property bundle ingest write failed'); return }
        markIngested(c.contentHash)
        setShowPropertyDrawer(true, created.id)
      } else {
        const written = await writeOverlay(bundleToOverlay(b, ctx))
        markIngested(c.contentHash)
        if (written) setShowMapOverlayDrawer(true, written.id, null)
      }
    } catch (e) {
      logger.warn('Bundle ingest failed:', e instanceof Error ? e.message : e)
    }
  }, [user?.id, clinicId, ingest, writeEvent, writeOverlay, openCalendarEvent, setShowMapOverlayDrawer, setShowPropertyDrawer])

  /** Has this device already materialized the given bundle? */
  const isAdded = useCallback((contentHash: string) => loadIngested().has(contentHash), [])

  return { openRef, addBundle, isAdded, canIngestToClinic }
}
