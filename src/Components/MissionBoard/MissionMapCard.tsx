import { useRef, useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGeolocation } from '../../Hooks/useGeolocation'
import { useTheme } from '../../Utilities/ThemeContext'
import { createThemedTileLayer, TILE_THEME_LIGHT, TILE_THEME_DARK } from '../MapOverlay/ThemedTileLayer'

const MAP_HEIGHT = 220
const DEFAULT_CENTER: [number, number] = [38.8977, -77.0365]
const DEFAULT_ZOOM = 13

interface MissionMapCardProps {
  onOpenMap: () => void
}

export function MissionMapCard({ onOpenMap }: MissionMapCardProps) {
  const { theme } = useTheme()
  const { position, startWatching, stopWatching } = useGeolocation()
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.GridLayer | null>(null)
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null)
  const [expanded, setExpanded] = useState(true)

  // Init map once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const map = L.map(mapDivRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    })
    mapRef.current = map

    const layer = createThemedTileLayer(theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT)
    layer.addTo(map)
    tileLayerRef.current = layer

    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      gpsMarkerRef.current = null
    }
  }, [])

  // Swap tile theme
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    const layer = createThemedTileLayer(theme === 'dark' ? TILE_THEME_DARK : TILE_THEME_LIGHT)
    layer.addTo(map)
    tileLayerRef.current = layer
  }, [theme])

  // GPS tracking
  useEffect(() => {
    startWatching()
    return () => stopWatching()
  }, [startWatching, stopWatching])

  // Update GPS marker and center
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
      map.setView(latlng, map.getZoom())
    }
  }, [position])

  // Invalidate size after expand animation
  useEffect(() => {
    if (expanded) {
      const t = setTimeout(() => mapRef.current?.invalidateSize(), 60)
      return () => clearTimeout(t)
    }
  }, [expanded])

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2">
      {/* Header — toggle */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 active:bg-themeblue2/5"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xs font-medium text-primary flex-1 text-left">Map</span>
        {position && (
          <span className="text-[10px] text-secondary">GPS</span>
        )}
        {expanded
          ? <ChevronUp size={13} className="text-tertiary shrink-0" />
          : <ChevronDown size={13} className="text-tertiary shrink-0" />
        }
      </button>

      {/* Map area */}
      <div
        className="overflow-hidden transition-[height] duration-300 ease-in-out relative"
        style={{ height: expanded ? MAP_HEIGHT : 0 }}
      >
        <div ref={mapDivRef} className="w-full" style={{ height: MAP_HEIGHT }} />
        <button
          onClick={onOpenMap}
          className="absolute bottom-2 right-2 z-[400] text-[10px] font-semibold px-2.5 py-1 rounded-full bg-themewhite/90 border border-themeblue3/15 text-themeblue1 shadow-xs active:scale-95 transition-transform"
        >
          Open Map
        </button>
      </div>
    </div>
  )
}
