import { useMemo } from 'react'
import { Map as MapIcon } from 'lucide-react'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import { resolveColor } from '../../Types/MapOverlayTypes'
import { waypointIconSvg } from './WaypointIcon'
import { computeOverlayBbox } from '../../lib/mapTileService'
import { useMapOverlaysStore } from '../../stores/useMapOverlaysStore'

/**
 * Static, dependency-light thumbnail of a map overlay's features. Unlike
 * MissionMapCard (a live Leaflet instance + GPS watcher), this renders ONE
 * memoized SVG: routes/areas as polylines/polygons, waypoints as injected
 * WaypointIcon glyphs, projected into a fixed viewport via Web Mercator.
 *
 * Cheap enough to drop into list rows and message bubbles. No tiles, no
 * network — fully offline. Resolve features by `overlayId` from the overlays
 * cache, or pass `features` directly. Everything (incl. glyphs) lives inside
 * the SVG, so the thumbnail scales cleanly: pass `fill` to stretch to the
 * parent width while keeping the width:height aspect ratio.
 *
 * NO-PHI INVARIANT: renders only geometry/labels/glyphs already on the
 * OverlayFeature. tc3_card_id is an opaque link and is never surfaced here.
 */
interface OverlaySnapshotProps {
  features?: OverlayFeature[]
  overlayId?: string
  /** Intrinsic viewport — also the aspect ratio when `fill` is set. */
  width?: number
  height?: number
  /** Stretch to the parent's width (keeping the width:height aspect). */
  fill?: boolean
  /** Waypoint glyph size in px, in viewport coordinates (default 16). */
  glyphSize?: number
  className?: string
  onClick?: () => void
}

const WORLD = 1e-9 // floor so a single-point overlay still gets a span

function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat))
  const rad = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

export function OverlaySnapshot({
  features,
  overlayId,
  width = 240,
  height = 120,
  fill = false,
  glyphSize = 16,
  className,
  onClick,
}: OverlaySnapshotProps) {
  // Resolve features from the cache when only an id is supplied. Selector keeps
  // the subscription scoped to the one overlay we care about.
  const resolved = useMapOverlaysStore(s =>
    features ? undefined : (overlayId ? s.overlays.find(o => o.id === overlayId)?.features : undefined),
  )
  const feats = features ?? resolved ?? []

  // Content version — recompute the projection only when geometry actually
  // changes, not on every parent render / scroll.
  const version = useMemo(
    () => feats.map(f => `${f.id}:${f.updated_at}:${f.geometry.length}`).join('|'),
    [feats],
  )

  const scene = useMemo(() => {
    const bbox = computeOverlayBbox(feats)
    if (!bbox) return null
    const [minLng, minLat, maxLng, maxLat] = bbox

    // Project to Web Mercator (x = lng, y = mercatorY) so shapes match the map.
    const xMin = minLng
    const xMax = maxLng
    const yMin = mercatorY(minLat)
    const yMax = mercatorY(maxLat)
    const xRange = Math.max(WORLD, xMax - xMin)
    const yRange = Math.max(WORLD, yMax - yMin)

    const pad = glyphSize // keep glyphs off the edge
    const usableW = Math.max(1, width - pad * 2)
    const usableH = Math.max(1, height - pad * 2)
    // Uniform scale (letterbox) so geometry isn't distorted.
    const scale = Math.min(usableW / xRange, usableH / yRange)
    const drawnW = xRange * scale
    const drawnH = yRange * scale
    const offX = pad + (usableW - drawnW) / 2
    const offY = pad + (usableH - drawnH) / 2

    const project = (lat: number, lng: number): [number, number] => {
      const px = offX + (lng - xMin) * scale
      // SVG y grows downward; mercator y grows up → flip.
      const py = offY + (yMax - mercatorY(lat)) * scale
      return [px, py]
    }

    const lines: { points: string; color: string; opacity: number }[] = []
    const polys: { points: string; color: string }[] = []
    const glyphs: { x: number; y: number; href: string }[] = []

    for (const f of feats) {
      const color = resolveColor(f.style?.color ?? 'var(--color-themeblue2)')
      if (f.type === 'waypoint' && f.geometry.length > 0) {
        const [lat, lng] = f.geometry[0]
        const [px, py] = project(lat, lng)
        const svg = waypointIconSvg(f.waypoint_type, color, glyphSize, false, !!f.tc3_card_id)
        glyphs.push({
          x: px - glyphSize / 2,
          y: py - glyphSize / 2,
          href: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        })
      } else if (f.type === 'route' && f.geometry.length >= 2) {
        lines.push({
          points: f.geometry.map(([lat, lng]) => project(lat, lng).join(',')).join(' '),
          color,
          opacity: f.style?.opacity ?? 1,
        })
      } else if (f.type === 'area' && f.geometry.length >= 3) {
        polys.push({
          points: f.geometry.map(([lat, lng]) => project(lat, lng).join(',')).join(' '),
          color,
        })
      }
    }

    return { lines, polys, glyphs }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, width, height, glyphSize])

  const clickable = !!onClick
  const boxStyle = fill
    ? { width: '100%', aspectRatio: `${width} / ${height}` }
    : { width, height }

  if (!scene) {
    return (
      <div
        className={`flex items-center justify-center bg-themewhite2 text-tertiary ${clickable ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className ?? ''}`}
        style={boxStyle}
        onClick={onClick}
      >
        <MapIcon size={18} />
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden bg-themewhite2 ${clickable ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className ?? ''}`}
      style={boxStyle}
      onClick={onClick}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0"
      >
        {scene.polys.map((p, i) => (
          <polygon
            key={`a${i}`}
            points={p.points}
            fill={p.color}
            fillOpacity={0.15}
            stroke={p.color}
            strokeWidth={1.5}
          />
        ))}
        {scene.lines.map((l, i) => (
          <polyline
            key={`r${i}`}
            points={l.points}
            fill="none"
            stroke={l.color}
            strokeWidth={2}
            strokeOpacity={l.opacity}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {scene.glyphs.map((g, i) => (
          <image
            key={`w${i}`}
            href={g.href}
            x={g.x}
            y={g.y}
            width={glyphSize}
            height={glyphSize}
          />
        ))}
      </svg>
    </div>
  )
}
