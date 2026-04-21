import { useRef, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeolocation } from '../../Hooks/useGeolocation'
import { useTheme } from '../../Utilities/ThemeContext'
import { createThemedTileLayer, TILE_THEME_LIGHT, TILE_THEME_DARK } from '../MapOverlay/ThemedTileLayer'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import { waypointIconSvg } from '../MapOverlay/WaypointIcon'
import { computeOverlayBbox } from '../../lib/mapTileService'

const DEFAULT_CENTER: [number, number] = [38.8977, -77.0365]
const DEFAULT_ZOOM = 13

interface MissionMapCardProps {
  onClick: () => void
  overlayFeatures?: OverlayFeature[]
  overlayId?: string
}

export function MissionMapCard({ onClick, overlayFeatures, overlayId: _overlayId }: MissionMapCardProps) {
  const { theme } = useTheme()
  const { position, startWatching, stopWatching } = useGeolocation()
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.GridLayer | null>(null)
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null)
  const featureLayerRef = useRef<L.LayerGroup>(L.layerGroup())

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const map = L.map(mapDivRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
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

    const layer = createThemedTileLayer(theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT)
    layer.addTo(map)
    tileLayerRef.current = layer

    featureLayerRef.current.addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      gpsMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    const layer = createThemedTileLayer(theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT)
    layer.addTo(map)
    tileLayerRef.current = layer
  }, [theme])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    featureLayerRef.current.clearLayers()

    const features = overlayFeatures ?? []

    for (const feature of features) {
      const geom = feature.geometry
      const color = feature.style?.color ?? '#2563EB'
      const label = feature.label

      if (feature.type === 'waypoint' && geom.length > 0) {
        const [lat, lng] = geom[0]
        const icon = L.divIcon({
          html: waypointIconSvg(feature.waypoint_type ?? 'generic', color, 22),
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        })
        const marker = L.marker([lat, lng], { icon })
        if (label) {
          marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -15] })
        }
        marker.addTo(featureLayerRef.current)
      } else if (feature.type === 'route' && geom.length >= 2) {
        const line = L.polyline(geom, {
          color,
          weight: 2.5,
          opacity: feature.style?.opacity ?? 1,
        })
        if (label) {
          line.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -15] })
        }
        line.addTo(featureLayerRef.current)
      } else if (feature.type === 'area' && geom.length >= 3) {
        const poly = L.polygon(geom, {
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.15,
        })
        if (label) {
          poly.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -15] })
        }
        poly.addTo(featureLayerRef.current)
      }
    }

    if (features.length > 0 && !position) {
      const bbox = computeOverlayBbox(features)
      if (bbox) {
        map.fitBounds(
          [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],
          { padding: [20, 20], maxZoom: 14 }
        )
      }
    }
  }, [overlayFeatures])

  useEffect(() => {
    startWatching()
    return () => stopWatching()
  }, [startWatching, stopWatching])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    const latlng: [number, number] = [position.lat, position.lng]
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLatLng(latlng)
    } else {
      gpsMarkerRef.current = L.circleMarker(latlng, {
        radius: 6,
        color: '#2563EB',
        fillColor: '#3B82F6',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
      const hasOverlay = (overlayFeatures ?? []).length > 0
      if (!hasOverlay) {
        map.setView(latlng, map.getZoom())
      }
    }
  }, [position])

  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapDivRef} className="w-full h-full" />
      {/* Transparent tap target over the map */}
      <div
        className="absolute inset-0 z-[500] cursor-pointer"
        onClick={onClick}
      />
      {position && (
        <span className="absolute top-1.5 left-1.5 z-[600] text-[9pt] md:text-[9pt] font-semibold px-1.5 py-0.5 rounded bg-themewhite/80 text-secondary pointer-events-none">
          GPS
        </span>
      )}
    </div>
  )
}
