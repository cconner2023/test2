import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useDrag } from '@use-gesture/react'
import { MapPin, Package, ZoomIn, ZoomOut, X, GripHorizontal } from 'lucide-react'
import { clamp } from '../../Utilities/GestureUtils'
import type { LocationTag, LocalPropertyItem, LocalPropertyLocation, ZoneRect } from '../../Types/PropertyTypes'

/** Default rects for a simple rectangle zone */
const FULL_RECT: ZoneRect[] = [{ x: 0, y: 0, w: 1, h: 1 }]

/** Renders an invisible SVG with <clipPath> defs for each zone tag (composite shapes via rect union) */
function ZoneClipDefs({ tags }: { tags: LocationTag[] }) {
  const zoneTags = tags.filter(
    (t) => t.width != null && t.height != null && t.width > 0 && t.height > 0,
  )
  if (zoneTags.length === 0) return null
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {zoneTags.map((tag) => {
          const rects = tag.rects?.length ? tag.rects : FULL_RECT
          return (
            <clipPath key={tag.id} id={`zone-clip-${tag.id}`} clipPathUnits="objectBoundingBox">
              {rects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
              ))}
            </clipPath>
          )
        })}
      </defs>
    </svg>
  )
}

/** Returns true if a tag should render as a zone rectangle rather than a point badge. */
function isZoneTag(tag: LocationTag): boolean {
  return tag.width != null && tag.height != null && tag.width > 0 && tag.height > 0
}

interface LocationTagPhotoProps {
  photoData?: string | null
  tags: LocationTag[]
  isEditMode: boolean
  onTagTap?: (tag: LocationTag) => void
  onTagDrag?: (tagId: string, x: number, y: number) => void
  items?: LocalPropertyItem[]
  drawMode?: boolean
  onZoneDrawn?: (x: number, y: number, w: number, h: number) => void
  onZoneResize?: (tagId: string, w: number, h: number) => void
  onZoneMove?: (tagId: string, x: number, y: number) => void
  onTagRemove?: (tagId: string) => void
  // In-canvas pending zone input
  pendingZone?: { x: number; y: number; w: number; h: number } | null
  pendingZoneName?: string
  onPendingZoneNameChange?: (name: string) => void
  onPendingZoneConfirm?: () => void
  onPendingZoneCancel?: () => void
  // Zone selection (edit mode split/merge)
  selectedZoneIds?: Set<string>
  onZoneSelect?: (tagId: string) => void
  // Zone highlight (browse mode — which zone is selected in the tree)
  highlightedZoneId?: string | null
  // Zoom target — zone rect to zoom into
  zoomTarget?: { x: number; y: number; w: number; h: number } | null
  // Locations list — used to look up photos for zone backgrounds
  locations?: LocalPropertyLocation[]
  // Pre-fetched tags for child locations — used for mini-map previews in zones without photos
  childTagsMap?: Map<string, LocationTag[]>
  // Parent canvas context — cropped parent photo shown when current canvas has no photo
  parentContext?: { photo: string; zoneRect: { x: number; y: number; w: number; h: number } } | null
}

export function LocationTagPhoto({
  photoData,
  tags,
  isEditMode,
  onTagTap,
  onTagDrag,
  items,
  drawMode,
  onZoneDrawn,
  onZoneResize,
  onZoneMove,
  onTagRemove,
  pendingZone,
  pendingZoneName,
  onPendingZoneNameChange,
  onPendingZoneConfirm,
  onPendingZoneCancel,
  selectedZoneIds,
  onZoneSelect,
  highlightedZoneId,
  zoomTarget,
  locations,
  childTagsMap,
}: LocationTagPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  // Build a map of location id → photo_data for zone backgrounds
  const locationPhotoMap = useMemo(() => {
    if (!locations) return new Map<string, string>()
    const m = new Map<string, string>()
    for (const loc of locations) {
      if (loc.photo_data) m.set(loc.id, loc.photo_data)
    }
    return m
  }, [locations])

  // On initial content load, scroll viewport to top-left so content starts at (0,0).
  const initialScrollDone = useRef(false)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || initialScrollDone.current) return
    initialScrollDone.current = true
    requestAnimationFrame(() => {
      vp.scrollLeft = 0
      vp.scrollTop = 0
    })
  }, [photoData])

  // Zoom-to-zone: when a zone is selected, zoom in and scroll so its top-left
  // sits 15px from the top-left corner of the viewport for consistency.
  // Use a serialized key so the effect fires reliably regardless of object reference identity.
  const zoomTargetKey = zoomTarget
    ? `${zoomTarget.x},${zoomTarget.y},${zoomTarget.w},${zoomTarget.h}`
    : ''
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    if (zoomTarget) {
      const newZoom = Math.min(
        Math.max(Math.min(0.9 / zoomTarget.w, 0.9 / zoomTarget.h), 1),
        10,
      )
      setZoom(newZoom)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const contentW = vp.scrollWidth
          const contentH = vp.scrollHeight
          vp.scrollTo({
            left: zoomTarget.x * contentW - 15,
            top: zoomTarget.y * contentH - 15,
            behavior: 'smooth',
          })
        })
      })
    } else {
      setZoom(1)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          vp.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
        })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomTargetKey])

  // Click-drag panning (mouse only; touch uses native overflow scroll)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    let panning = false
    let didPan = false
    let startX = 0
    let startY = 0
    let scrollX = 0
    let scrollY = 0

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      // Skip if starting on edit-mode draggable elements or inputs
      if ((e.target as HTMLElement).closest('[data-no-pan], input')) return
      panning = true
      didPan = false
      startX = e.clientX
      startY = e.clientY
      scrollX = vp.scrollLeft
      scrollY = vp.scrollTop
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!didPan && Math.abs(dx) + Math.abs(dy) > 3) {
        didPan = true
        vp.style.cursor = 'grabbing'
      }
      if (didPan) {
        vp.scrollLeft = scrollX - dx
        vp.scrollTop = scrollY - dy
      }
    }

    const onMouseUp = () => {
      if (!panning) return
      panning = false
      vp.style.cursor = ''
    }

    // Block click after a pan drag so buttons/zones don't activate
    const onClick = (e: MouseEvent) => {
      if (didPan) {
        e.stopPropagation()
        e.preventDefault()
        didPan = false
      }
    }

    vp.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    vp.addEventListener('click', onClick, true) // capture phase
    return () => {
      vp.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      vp.removeEventListener('click', onClick, true)
    }
  }, [])

  // Manual zoom (+/-) maintains focal point at viewport center
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const vp = viewportRef.current
    if (!vp) return
    const oldW = vp.scrollWidth
    const oldH = vp.scrollHeight
    const cx = (vp.scrollLeft + vp.clientWidth / 2) / oldW
    const cy = (vp.scrollTop + vp.clientHeight / 2) / oldH

    setZoom(z => {
      const next = direction === 'in' ? Math.min(z + 0.5, 10) : Math.max(z - 0.5, 1)
      return next
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        vp.scrollLeft = cx * vp.scrollWidth - vp.clientWidth / 2
        vp.scrollTop = cy * vp.scrollHeight - vp.clientHeight / 2
      })
    })
  }, [])

  return (
    <div className="relative">
      {/* Scrollable viewport */}
      <div
        ref={viewportRef}
        className="max-h-[40vh] rounded-lg overflow-auto cursor-grab"
      >
        {/* Zoomable content — width scales with zoom so native scroll handles panning */}
        <div
          ref={containerRef}
          className="relative select-none"
          style={{
            width: `${zoom * 100}%`,

            touchAction: isEditMode || drawMode ? 'none' : 'auto',
          }}
        >
          {photoData ? (
            <img
              src={photoData}
              alt="Location"
              className="w-full rounded-lg"
              draggable={false}
            />
          ) : (
            <div
              className="w-full rounded-lg bg-themewhite2"
              style={{
                aspectRatio: '1 / 1',
                backgroundImage:
                  'linear-gradient(to right, color-mix(in srgb, var(--color-themegray1) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-themegray1) 35%, transparent) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />
          )}

          {/* SVG clip-path definitions for composite zone shapes */}
          <ZoneClipDefs tags={tags} />

          {/* Render tags: zones first (below), then point badges (above) */}
          {tags.filter(isZoneTag).map((tag) =>
            isEditMode ? (
              <DraggableZone
                key={tag.id}
                tag={tag}
                containerRef={containerRef}
                onMove={onZoneMove}
                onResize={onZoneResize}
                onRemove={onTagRemove}
                items={items}
                isSelected={selectedZoneIds?.has(tag.id) ?? false}
                onSelect={onZoneSelect}
                locationPhoto={locationPhotoMap.get(tag.target_id)}
                subZoneTags={childTagsMap?.get(tag.target_id)}
              />
            ) : (
              <StaticZone
                key={tag.id}
                tag={tag}
                onTap={onTagTap}
                items={items}
                isHighlighted={!!highlightedZoneId && tag.target_id === highlightedZoneId}
                hasSomeHighlight={!!highlightedZoneId}
                locationPhoto={locationPhotoMap.get(tag.target_id)}
                subZoneTags={childTagsMap?.get(tag.target_id)}
              />
            )
          )}

          {tags.filter((t) => !isZoneTag(t)).map((tag) =>
            isEditMode ? (
              <DraggableTag
                key={tag.id}
                tag={tag}
                containerRef={containerRef}
                onDrag={onTagDrag}
                onRemove={onTagRemove}
              />
            ) : (
              <StaticTag
                key={tag.id}
                tag={tag}
                onTap={onTagTap}
              />
            )
          )}

          {/* Pending zone name input overlay */}
          {pendingZone && (
            <PendingZoneOverlay
              zone={pendingZone}
              name={pendingZoneName ?? ''}
              onNameChange={onPendingZoneNameChange}
              onConfirm={onPendingZoneConfirm}
              onCancel={onPendingZoneCancel}
            />
          )}

          {/* Draw zone overlay */}
          {drawMode && (
            <DrawZoneOverlay
              containerRef={containerRef}
              onZoneDrawn={onZoneDrawn}
            />
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-10">
        <button
          className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-black/60 transition-colors disabled:opacity-30"
          onClick={() => handleZoom('in')}
          disabled={zoom >= 10}
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-black/60 transition-colors disabled:opacity-30"
          onClick={() => handleZoom('out')}
          disabled={zoom <= 1}
        >
          <ZoomOut size={14} />
        </button>
      </div>

      {/* Draw mode indicator */}
      {drawMode && (
        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-themeblue3 text-white text-[10px] font-medium shadow-md z-10">
          Draw a zone
        </div>
      )}
    </div>
  )
}

// ── Static Tag (point badge, browse mode) ───────────────────

function StaticTag({ tag, onTap }: { tag: LocationTag; onTap?: (tag: LocationTag) => void }) {
  return (
    <button
      className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 hover:bg-black/80 transition-colors max-w-[120px]"
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
      onClick={() => onTap?.(tag)}
    >
      {tag.target_type === 'location' ? (
        <MapPin size={10} className="shrink-0" />
      ) : (
        <Package size={10} className="shrink-0" />
      )}
      <span className="truncate">{tag.label}</span>
    </button>
  )
}

// ── Draggable Tag (point badge, edit mode) ──────────────────

function DraggableTag({
  tag,
  containerRef,
  onDrag,
  onRemove,
}: {
  tag: LocationTag
  containerRef: React.RefObject<HTMLDivElement | null>
  onDrag?: (tagId: string, x: number, y: number) => void
  onRemove?: (tagId: string) => void
}) {
  const labelRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ active, xy: [clientX, clientY], event }) => {
      event?.preventDefault()
      const container = containerRef.current
      const el = labelRef.current
      if (!container || !el) return

      const rect = container.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top

      if (active) {
        const pctX = clamp(px / rect.width, 0, 1) * 100
        const pctY = clamp(py / rect.height, 0, 1) * 100
        el.style.left = `${pctX}%`
        el.style.top = `${pctY}%`
      } else {
        const normalX = clamp(px / rect.width, 0, 1)
        const normalY = clamp(py / rect.height, 0, 1)
        onDrag?.(tag.id, normalX, normalY)
      }
    },
    { filterTaps: true },
  )

  return (
    <div
      ref={labelRef}
      {...bind()}
      data-no-pan
      className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-themeblue3/90 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing max-w-[120px] ring-2 ring-white/50"
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%`, touchAction: 'none' }}
    >
      {tag.target_type === 'location' ? (
        <MapPin size={10} className="shrink-0" />
      ) : (
        <Package size={10} className="shrink-0" />
      )}
      <span className="truncate">{tag.label}</span>
      {onRemove && (
        <button
          className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }}
        >
          <X size={8} />
        </button>
      )}
    </div>
  )
}

// ── Static Zone (rectangle, browse mode) ────────────────────

function StaticZone({
  tag,
  onTap,
  items,
  isHighlighted,
  hasSomeHighlight,
  locationPhoto,
  subZoneTags,
}: {
  tag: LocationTag
  onTap?: (tag: LocationTag) => void
  items?: LocalPropertyItem[]
  isHighlighted?: boolean
  hasSomeHighlight?: boolean
  locationPhoto?: string | null
  subZoneTags?: LocationTag[]
}) {
  const w = tag.width!
  const h = tag.height!
  const isLargeZone = w > 0.15 && h > 0.15
  const clipPath = `url(#zone-clip-${tag.id})`

  // Items assigned to the zone's linked sub-location
  const zoneItems = items?.filter((i) => i.location_id === tag.target_id) ?? []

  // Sub-zones that are actual zone rectangles (for mini-map preview)
  const subZones = subZoneTags?.filter(isZoneTag) ?? []
  const hasPreview = !locationPhoto && subZones.length > 0

  return (
    <button
      className={`absolute rounded-md transition-colors cursor-pointer overflow-hidden ${
        locationPhoto
          ? 'border border-zone-accent/40'
          : isHighlighted
            ? 'bg-zone-accent/30 border-2 border-zone-accent/70'
            : hasSomeHighlight
              ? 'bg-zone-accent/15 border border-zone-accent/40 opacity-50'
              : 'bg-zone-accent/15 border border-zone-accent/40 hover:bg-zone-accent/25'
      }`}
      style={{
        left: `${tag.x * 100}%`,
        top: `${tag.y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        clipPath,
      }}
      onClick={() => onTap?.(tag)}
    >
      {/* Photo background (if location has a photo) */}
      {locationPhoto && (
        <img
          src={locationPhoto}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-md"
          draggable={false}
        />
      )}

      {/* Mini-map preview of child zones (when no photo) */}
      {hasPreview && (
        <div className="absolute inset-0 pointer-events-none">
          {subZones.map((sz) => (
            <div
              key={sz.id}
              className="absolute rounded-sm border border-zone-accent/50 bg-zone-accent/10"
              style={{
                left: `${(sz.x) * 100}%`,
                top: `${(sz.y) * 100}%`,
                width: `${(sz.width ?? 0) * 100}%`,
                height: `${(sz.height ?? 0) * 100}%`,
              }}
            >
              <span className="absolute top-0 left-0.5 text-[7px] text-zone-accent/70 font-medium truncate max-w-full leading-tight">
                {sz.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Label */}
      <div className={`absolute top-0.5 left-1 flex items-center gap-0.5 text-[10px] font-medium max-w-[90%] ${
        locationPhoto ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-zone-accent'
      }`}>
        <MapPin size={9} className="shrink-0" />
        <span className="truncate">{tag.label}</span>
      </div>

      {/* Items inside zone */}
      {zoneItems.length > 0 && (
        isLargeZone ? (
          <div className="absolute inset-0 top-4 p-1 flex flex-wrap gap-0.5 content-start overflow-hidden">
            {zoneItems.map((item) => (
              <span
                key={item.id}
                className="px-1 py-0.5 rounded bg-black/60 text-white text-[9px] font-medium truncate max-w-full"
              >
                {item.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="absolute bottom-0.5 right-1 px-1.5 py-0.5 rounded-full bg-zone-accent/80 text-white text-[9px] font-medium">
            {zoneItems.length}
          </div>
        )
      )}
    </button>
  )
}

// ── Draggable Zone (rectangle, edit mode) ───────────────────

function DraggableZone({
  tag,
  containerRef,
  onMove,
  onResize,
  onRemove,
  items,
  isSelected,
  onSelect,
  locationPhoto,
  subZoneTags,
}: {
  tag: LocationTag
  containerRef: React.RefObject<HTMLDivElement | null>
  onMove?: (tagId: string, x: number, y: number) => void
  onResize?: (tagId: string, w: number, h: number) => void
  onRemove?: (tagId: string) => void
  items?: LocalPropertyItem[]
  isSelected?: boolean
  onSelect?: (tagId: string) => void
  locationPhoto?: string | null
  subZoneTags?: LocationTag[]
}) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const w = tag.width!
  const h = tag.height!
  const isLargeZone = w > 0.15 && h > 0.15
  const clipPath = `url(#zone-clip-${tag.id})`
  const zoneItems = items?.filter((i) => i.location_id === tag.target_id) ?? []
  const subZones = subZoneTags?.filter(isZoneTag) ?? []
  const hasPreview = !locationPhoto && subZones.length > 0

  // Move the entire zone body
  const moveBind = useDrag(
    ({ active, tap, xy: [clientX, clientY], event }) => {
      if (tap) return // tap → handled by onClick for selection, don't move
      event?.preventDefault()
      event?.stopPropagation()
      const container = containerRef.current
      const el = zoneRef.current
      if (!container || !el) return

      const rect = container.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top

      // Clamp so zone stays within container bounds
      const maxX = 1 - w
      const maxY = 1 - h
      const normalX = clamp(px / rect.width, 0, maxX)
      const normalY = clamp(py / rect.height, 0, maxY)

      if (active) {
        el.style.left = `${normalX * 100}%`
        el.style.top = `${normalY * 100}%`
      } else {
        onMove?.(tag.id, normalX, normalY)
      }
    },
    { filterTaps: true },
  )

  // Resize handle at bottom-right
  const resizeBind = useDrag(
    ({ xy: [clientX, clientY], active, tap, event }) => {
      if (tap) return
      event?.preventDefault()
      event?.stopPropagation()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top

      const newW = clamp(px / rect.width - tag.x, 0.05, 1 - tag.x)
      const newH = clamp(py / rect.height - tag.y, 0.05, 1 - tag.y)

      if (active) {
        const el = zoneRef.current
        if (el) {
          el.style.width = `${newW * 100}%`
          el.style.height = `${newH * 100}%`
        }
      } else {
        onResize?.(tag.id, newW, newH)
      }
    },
    { filterTaps: true },
  )

  return (
    <div
      ref={zoneRef}
      {...moveBind()}
      data-no-pan
      className={`absolute rounded-md cursor-grab active:cursor-grabbing overflow-visible transition-all duration-150 ${
        isSelected
          ? 'bg-amber-400/25 border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
          : 'bg-zone-accent/15 border border-zone-accent/40 ring-2 ring-zone-accent/50'
      }`}
      style={{
        left: `${tag.x * 100}%`,
        top: `${tag.y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        clipPath,
        touchAction: 'none',
      }}
      onClick={() => onSelect?.(tag.id)}
    >
      {/* Inner clip wrapper — ensures content is also clipped */}
      <div className="absolute inset-0 overflow-hidden rounded-md">
        {/* Photo background (if location has a photo) */}
        {locationPhoto && (
          <img
            src={locationPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover rounded-md pointer-events-none"
            draggable={false}
          />
        )}

        {/* Mini-map preview of child zones (when no photo) */}
        {hasPreview && (
          <div className="absolute inset-0 pointer-events-none">
            {subZones.map((sz) => (
              <div
                key={sz.id}
                className="absolute rounded-sm border border-zone-accent/50 bg-zone-accent/10"
                style={{
                  left: `${(sz.x) * 100}%`,
                  top: `${(sz.y) * 100}%`,
                  width: `${(sz.width ?? 0) * 100}%`,
                  height: `${(sz.height ?? 0) * 100}%`,
                }}
              >
                <span className="absolute top-0 left-0.5 text-[7px] text-zone-accent/70 font-medium truncate max-w-full leading-tight">
                  {sz.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Label */}
        <div className={`absolute top-0.5 left-1 flex items-center gap-0.5 text-[10px] font-medium max-w-[70%] ${
          locationPhoto ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-zone-accent'
        }`}>
          <MapPin size={9} className="shrink-0" />
          <span className="truncate">{tag.label}</span>
        </div>

        {/* Items inside zone */}
        {zoneItems.length > 0 && (
          isLargeZone ? (
            <div className="absolute inset-0 top-4 p-1 flex flex-wrap gap-0.5 content-start overflow-hidden pointer-events-none">
              {zoneItems.map((item) => (
                <span
                  key={item.id}
                  className="px-1 py-0.5 rounded bg-black/60 text-white text-[9px] font-medium truncate max-w-full"
                >
                  {item.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="absolute bottom-0.5 right-5 px-1.5 py-0.5 rounded-full bg-zone-accent/80 text-white text-[9px] font-medium pointer-events-none">
              {zoneItems.length}
            </div>
          )
        )}
      </div>

      {/* Controls outside clip region — positioned relative to zone, overflow-visible */}
      {/* Remove button — top-right outside */}
      {onRemove && (
        <button
          className="absolute -top-2 -right-2 p-0.5 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors z-20"
          style={{ clipPath: 'none' }}
          onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }}
        >
          <X size={10} />
        </button>
      )}

      {/* Resize handle — bottom-right, outside clip */}
      <div
        {...resizeBind()}
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 flex items-center justify-center cursor-nwse-resize z-10"
        style={{ touchAction: 'none', clipPath: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripHorizontal size={10} className="text-zone-accent/70 rotate-[-45deg]" />
      </div>
    </div>
  )
}

// ── Pending Zone Overlay (in-canvas name input) ─────────────

function PendingZoneOverlay({
  zone,
  name,
  onNameChange,
  onConfirm,
  onCancel,
}: {
  zone: { x: number; y: number; w: number; h: number }
  name: string
  onNameChange?: (name: string) => void
  onConfirm?: () => void
  onCancel?: () => void
}) {
  // Position the input directly below the zone rect, or inside if tall enough
  const inputTop = zone.y + zone.h
  const fitsBelow = inputTop + 0.08 <= 1
  const top = fitsBelow ? inputTop : Math.max(zone.y - 0.08, 0)

  return (
    <>
      {/* Dashed zone outline */}
      <div
        className="absolute border-2 border-dashed border-themeblue3 bg-themeblue3/10 rounded-sm pointer-events-none z-20"
        style={{
          left: `${zone.x * 100}%`,
          top: `${zone.y * 100}%`,
          width: `${zone.w * 100}%`,
          height: `${zone.h * 100}%`,
        }}
      />
      {/* Input overlay */}
      <div
        className="absolute z-30 flex gap-1 items-center"
        style={{
          left: `${zone.x * 100}%`,
          top: `${top * 100}%`,
          width: `${Math.max(zone.w, 0.3) * 100}%`,
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange?.(e.target.value)}
          placeholder="Zone name..."
          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded border border-themeblue3/40 bg-white text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3 shadow-md"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm?.()
            if (e.key === 'Escape') onCancel?.()
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="px-2 py-1 rounded bg-themeblue3 text-white text-[10px] font-medium shadow-md disabled:opacity-50 shrink-0"
          disabled={!name.trim()}
          onClick={(e) => { e.stopPropagation(); onConfirm?.() }}
        >
          Create
        </button>
        <button
          className="px-1.5 py-1 rounded border border-tertiary/20 bg-white text-[10px] text-tertiary shadow-md shrink-0"
          onClick={(e) => { e.stopPropagation(); onCancel?.() }}
        >
          <X size={10} />
        </button>
      </div>
    </>
  )
}

// ── Draw Zone Overlay ───────────────────────────────────────

function DrawZoneOverlay({
  containerRef,
  onZoneDrawn,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  onZoneDrawn?: (x: number, y: number, w: number, h: number) => void
}) {
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const startRef = useRef<{ nx: number; ny: number } | null>(null)

  const bind = useDrag(
    ({ first, active, xy: [clientX, clientY], event }) => {
      event?.preventDefault()
      event?.stopPropagation()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const nx = clamp((clientX - rect.left) / rect.width, 0, 1)
      const ny = clamp((clientY - rect.top) / rect.height, 0, 1)

      if (first) {
        startRef.current = { nx, ny }
      }

      const start = startRef.current
      if (!start) return

      // Compute rect from start → current (handle any drag direction)
      const x = Math.min(start.nx, nx)
      const y = Math.min(start.ny, ny)
      const w = Math.abs(nx - start.nx)
      const h = Math.abs(ny - start.ny)

      if (active) {
        setDrawRect({ x, y, w, h })
      } else {
        setDrawRect(null)
        startRef.current = null
        // Minimum size threshold: ignore draws smaller than 5% in either dimension
        if (w >= 0.05 && h >= 0.05) {
          onZoneDrawn?.(x, y, w, h)
        }
      }
    },
    { filterTaps: true },
  )

  return (
    <div
      {...bind()}
      data-no-pan
      className="absolute inset-0 z-20"
      style={{ touchAction: 'none', cursor: 'crosshair' }}
    >
      {drawRect && (
        <div
          className="absolute border-2 border-dashed border-themeblue3 bg-themeblue3/10 rounded-sm pointer-events-none"
          style={{
            left: `${drawRect.x * 100}%`,
            top: `${drawRect.y * 100}%`,
            width: `${drawRect.w * 100}%`,
            height: `${drawRect.h * 100}%`,
          }}
        />
      )}
    </div>
  )
}
