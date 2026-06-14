import { useCallback, useEffect, useState } from 'react'
import { Calendar, Map as MapIcon, Plus, Check, RefreshCw } from 'lucide-react'
import type { SharedBundleContent } from '../../lib/signal/messageContent'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import {
  unpackBundle,
  bundleToEvent,
  bundleToOverlay,
  type ObjectBundle,
} from '../../lib/objectBundle'
import { OverlaySnapshot } from '../MapOverlay/OverlaySnapshot'
import { useAuth } from '../../Hooks/useAuth'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useLongPress } from '../../Hooks/useLongPress'
import { createLogger } from '../../Utilities/Logger'
import { loadIngested, markIngested } from '../../lib/bundleIngestLog'
import { NoteBlocksBundleCard } from './NoteBlocksBundleCard'

const logger = createLogger('SharedBundleCard')

interface Props {
  content: SharedBundleContent
  isOwn: boolean
  senderName?: string
  messageId: string
  onLongPress?: (x: number, y: number) => void
}

/** Map a decrypted overlay bundle's features into the OverlayFeature shape the
 *  static OverlaySnapshot renders. Placeholder ids — preview only, never saved. */
function previewFeatures(bundle: ObjectBundle): OverlayFeature[] {
  if (bundle.kind !== 'map-overlay') return []
  return bundle.overlay.features.map((bf, i) => ({
    id: `preview-${i}`,
    overlay_id: 'preview',
    type: bf.type,
    geometry: bf.geometry,
    label: bf.label,
    style: bf.style,
    created_at: '',
    updated_at: '',
    ...(bf.waypoint_type ? { waypoint_type: bf.waypoint_type } : {}),
  }))
}

/**
 * Cross-cluster shared-object card. Renders a frozen calendar event / map
 * overlay that arrived from ANOTHER cluster and lets the recipient Add it,
 * which re-mints a fresh local copy (new ids, their own clinic) into their
 * vault. No silent write — Add is the human gate. Overlay bundles decrypt their
 * blob on mount to show a geometry preview (and to make Add instant); calendar
 * bundles decrypt lazily on Add since the label/date already describe them.
 */
export function SharedBundleCard({ content, isOwn, senderName, messageId, onLongPress }: Props) {
  // Note-blocks (text templates / order sets / plan tags) ingest into the
  // receiver's profile/clinic config, not the vault — dedicated card.
  if (content.bundleKind === 'note-blocks') {
    return (
      <NoteBlocksBundleCard
        content={content}
        isOwn={isOwn}
        senderName={senderName}
        messageId={messageId}
        onLongPress={onLongPress}
      />
    )
  }
  return (
    <ObjectBundleCard
      content={content}
      isOwn={isOwn}
      senderName={senderName}
      messageId={messageId}
      onLongPress={onLongPress}
    />
  )
}

function ObjectBundleCard({ content, isOwn, senderName, messageId, onLongPress }: Props) {
  const { user, clinicId } = useAuth()
  const userId = user?.id ?? null
  const { writeEvent } = useCalendarWrite()
  const { writeOverlay } = useMapOverlayWrite()
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)

  const isOverlay = content.bundleKind === 'map-overlay'
  const Icon = isOverlay ? MapIcon : Calendar

  const [bundle, setBundle] = useState<ObjectBundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(() => loadIngested().has(content.contentHash))

  // Eagerly decrypt overlay bundles so the geometry preview can render.
  useEffect(() => {
    if (!isOverlay || bundle || added) return
    let cancelled = false
    void (async () => {
      const res = await unpackBundle(content.path, content.key, content.contentHash)
      if (cancelled) return
      if (res.ok) setBundle(res.data)
    })()
    return () => { cancelled = true }
  }, [isOverlay, bundle, added, content.path, content.key, content.contentHash])

  const handleAdd = useCallback(async () => {
    if (!userId || !clinicId || busy || added) return
    setBusy(true)
    setError(null)
    try {
      let b = bundle
      if (!b) {
        const res = await unpackBundle(content.path, content.key, content.contentHash)
        if (!res.ok) { setError('Couldn’t open this item.'); return }
        b = res.data
        setBundle(b)
      }
      const ctx = { clinicId, userId, now: new Date().toISOString() }
      if (b.kind === 'calendar-event') {
        const event = bundleToEvent(b, ctx)
        await writeEvent(event)
        markIngested(content.contentHash)
        setAdded(true)
        openCalendarEvent(event.id)
      } else {
        const params = bundleToOverlay(b, ctx)
        const written = await writeOverlay(params)
        markIngested(content.contentHash)
        setAdded(true)
        if (written) setShowMapOverlayDrawer(true, written.id, null)
      }
    } catch (e) {
      logger.warn('Bundle ingest failed:', e instanceof Error ? e.message : e)
      setError('Couldn’t add this item.')
    } finally {
      setBusy(false)
    }
  }, [userId, clinicId, busy, added, bundle, content, writeEvent, writeOverlay, openCalendarEvent, setShowMapOverlayDrawer])

  const longPress = useLongPress((x, y) => onLongPress?.(x, y))

  const cardBg = isOwn ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-primary'
  const align = isOwn ? 'justify-end' : 'justify-start'
  const corner = isOwn ? 'rounded-br-md' : 'rounded-bl-md'

  return (
    <div className={`group flex ${align} items-center px-1 mb-1.5`} data-message-id={messageId}>
      <div
        className={`max-w-[260px] w-[260px] p-3 rounded-2xl ${corner} ${cardBg} select-none`}
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        {/* Sender / source-cluster header */}
        <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-current/10">
          <span className={`text-[9pt] font-semibold truncate ${isOwn ? 'text-white/90' : 'text-themeblue2'}`}>
            {senderName || 'Shared'}
          </span>
          <span className={`text-[9pt] truncate ${isOwn ? 'text-white/60' : 'text-tertiary'}`}>
            · from {content.sourceCluster}
          </span>
        </div>

        {/* Overlay geometry preview (decrypts on mount). */}
        {isOverlay && bundle && bundle.kind === 'map-overlay' && (
          <OverlaySnapshot
            features={previewFeatures(bundle)}
            width={236}
            height={110}
            className="rounded-lg mb-2"
          />
        )}

        {/* Title row */}
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-themeblue3/10'}`}>
            <Icon size={17} className={isOwn ? 'text-white' : 'text-themeblue3'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-primary'}`}>{content.label}</p>
            {content.subLabel && (
              <p className={`text-[9pt] truncate ${isOwn ? 'text-white/70' : 'text-tertiary'}`}>{content.subLabel}</p>
            )}
          </div>
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || added}
          className={`mt-2.5 w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium active:scale-[0.98] transition-all
                     ${added
                       ? (isOwn ? 'bg-white/15 text-white/80' : 'bg-themegreen/15 text-themegreen')
                       : (isOwn ? 'bg-white text-themeblue2' : 'bg-themeblue3 text-white')}`}
        >
          {busy ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : added ? (
            <><Check size={15} /> Added to your {isOverlay ? 'map' : 'calendar'}</>
          ) : (
            <><Plus size={15} /> Add to my {isOverlay ? 'map' : 'calendar'}</>
          )}
        </button>
        {error && <p className={`mt-1.5 text-[9pt] ${isOwn ? 'text-white/80' : 'text-themeredred'}`}>{error}</p>}
      </div>
    </div>
  )
}
