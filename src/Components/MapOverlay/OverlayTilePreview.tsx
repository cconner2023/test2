import { useRef, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../Utilities/ThemeContext'
import { createThemedTileLayer, getTileTheme } from './ThemedTileLayer'
import { getTileFromCache, getTileSource } from '../../lib/mapTileService'
import { computeOverlayBbox } from '../../lib/mapTileService'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import { resolveColor } from '../../Types/MapOverlayTypes'
import { waypointIconSvg } from './WaypointIcon'

/**
 * Static, non-interactive map preview with REAL themed tiles. Unlike
 * OverlaySnapshot (a tile-less SVG of geometry only), this mounts a locked
 * Leaflet map and renders the actual basemap behind the features — served
 * offline from the per-overlay IDB tile cache (getTileFromCache), falling
 * back to network only when a tile isn't cached.
 *
 * No GPS watcher, no controls, no panning — cheap enough for a detail panel
 * (1–2 instances), but heavier than OverlaySnapshot. Prefer OverlaySnapshot
 * for scrolling lists / message bubbles where live tiles aren't worth it.
 *
 * NO-PHI INVARIANT: renders only geometry/labels/glyphs already on the
 * OverlayFeature; tc3_card_id stays an opaque link and never surfaces here.
 */
interface OverlayTilePreviewProps {
  features: OverlayFeature[]
  /** Overlay whose downloaded tiles back the offline cache. Uncached tiles fall back to network. */
  overlayId?: string
  /** Tile source the overlay's tiles were cached under (defaults to OSM street). */
  basemapId?: string
  onClick?: () => void
  className?: string
}

export function OverlayTilePreview({ features, overlayId, basemapId, onClick, className }: OverlayTilePreviewProps) {
  const { theme, themeName } = useTheme()
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.GridLayer | null>(null)
  const featureLayerRef = useRef<L.LayerGroup>(L.layerGroup())

  // Mount the locked map once.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, {
      center: [0, 0],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    })
    mapRef.current = map
    featureLayerRef.current.addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  // (Re)build the themed tile layer when theme or cache source changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    const tileCache = overlayId
      ? (z: number, x: number, y: number) => getTileFromCache(overlayId, z, x, y, basemapId)
      : null
    const layer = createThemedTileLayer(getTileTheme(themeName, theme), tileCache, getTileSource(basemapId))
    layer.addTo(map)
    tileLayerRef.current = layer
  }, [theme, themeName, overlayId, basemapId])

  // Draw geometry + fit bounds when the features change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    featureLayerRef.current.clearLayers()

    for (const feature of features) {
      const geom = feature.geometry
      const color = resolveColor(feature.style?.color ?? 'var(--color-themeblue2)')
      const label = feature.label

      if (feature.type === 'waypoint' && geom.length > 0) {
        const [lat, lng] = geom[0]
        const icon = L.divIcon({
          html: waypointIconSvg(feature.waypoint_type, color, 20, false, !!feature.tc3_card_id),
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        L.marker([lat, lng], { icon }).addTo(featureLayerRef.current)
      } else if (feature.type === 'route' && geom.length >= 2) {
        const line = L.polyline(geom, { color, weight: 2.5, opacity: feature.style?.opacity ?? 1 })
        if (label) line.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -15] })
        line.addTo(featureLayerRef.current)
      } else if (feature.type === 'area' && geom.length >= 3) {
        const poly = L.polygon(geom, { color, weight: 2, fillColor: color, fillOpacity: 0.15 })
        if (label) poly.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -15] })
        poly.addTo(featureLayerRef.current)
      }
    }

    const bbox = computeOverlayBbox(features)
    if (bbox) {
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [16, 16], maxZoom: 16 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features])

  // Leaflet measures 0×0 if mounted hidden — re-measure after layout settles.
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`relative overflow-hidden bg-themewhite2 ${className ?? ''}`}>
      <div ref={mapDivRef} className="w-full h-full" />
      {onClick && (
        <div className="absolute inset-0 z-[500] cursor-pointer active:scale-[0.99] transition-transform" onClick={onClick} />
      )}
    </div>
  )
}
