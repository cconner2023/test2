/**
 * MGRSGridLayer — Leaflet GridLayer that draws UTM/MGRS grid lines on canvas tiles.
 *
 * Single-tier interval per zoom (no major/minor split — minor dashed lines were
 * unreadable). Labels are NOT drawn here; the peripheral label overlay
 * (MGRSGridLabels) renders eastings along the top edge and northings along
 * the right edge of the map container.
 *
 *   zoom ≤ 8   → 100 km
 *   zoom 9-11  → 10 km
 *   zoom 12-14 → 1 km
 *   zoom 15+   → 100 m
 */
import L from 'leaflet'
import { latLngToUTM, utmToLatLng, utmZone } from './utmProjection'
import type { ThemeName, ThemeMode } from '../../Utilities/ThemeContext'

export interface GridTheme {
  lineColor: string
  lineColorMajor: string
  labelColor: string
  labelBg: string
}

const GRID_THEMES: Record<`${ThemeName}-${ThemeMode}`, GridTheme> = {
  'default-light':    { lineColor: 'rgba(0,66,92,0.75)',       lineColorMajor: 'rgba(0,66,92,0.95)',       labelColor: '#00425C', labelBg: 'rgba(240,242,245,0.9)' },
  'default-dark':     { lineColor: 'rgba(129,161,181,0.75)',   lineColorMajor: 'rgba(129,161,181,0.95)',   labelColor: '#81A1B5', labelBg: 'rgba(14,22,32,0.9)' },

  'ironclad-light':   { lineColor: 'rgba(160,100,20,0.80)',    lineColorMajor: 'rgba(160,100,20,1.00)',    labelColor: '#8B6010', labelBg: 'rgba(248,242,225,0.9)' },
  'ironclad-dark':    { lineColor: 'rgba(218,140,38,0.75)',    lineColorMajor: 'rgba(218,140,38,0.95)',    labelColor: '#C8901A', labelBg: 'rgba(30,26,20,0.9)' },

  'void-light':       { lineColor: 'rgba(0,110,148,0.78)',     lineColorMajor: 'rgba(0,110,148,1.00)',     labelColor: '#006E94', labelBg: 'rgba(238,242,248,0.9)' },
  'void-dark':        { lineColor: 'rgba(0,164,190,0.75)',     lineColorMajor: 'rgba(0,164,190,0.95)',     labelColor: '#00A4BE', labelBg: 'rgba(10,12,16,0.9)' },

  'slipstream-light': { lineColor: 'rgba(48,100,88,0.78)',     lineColorMajor: 'rgba(48,100,88,1.00)',     labelColor: '#306458', labelBg: 'rgba(242,244,240,0.9)' },
  'slipstream-dark':  { lineColor: 'rgba(84,136,124,0.75)',    lineColorMajor: 'rgba(84,136,124,0.95)',    labelColor: '#54887C', labelBg: 'rgba(14,18,22,0.9)' },

  'topo-light':       { lineColor: 'rgba(96,88,36,0.80)',      lineColorMajor: 'rgba(96,88,36,1.00)',      labelColor: '#605824', labelBg: 'rgba(241,234,211,0.9)' },
  'topo-dark':        { lineColor: 'rgba(164,148,76,0.75)',    lineColorMajor: 'rgba(164,148,76,0.95)',    labelColor: '#A4944C', labelBg: 'rgba(12,16,10,0.9)' },
}

export function getGridTheme(name: ThemeName, mode: ThemeMode): GridTheme {
  return GRID_THEMES[`${name}-${mode}`] ?? GRID_THEMES[`default-${mode}`]
}

export const GRID_THEME_LIGHT: GridTheme = GRID_THEMES['default-light']
export const GRID_THEME_DARK: GridTheme  = GRID_THEMES['default-dark']

export function gridIntervalMeters(zoom: number): number {
  if (zoom <= 8) return 100000
  if (zoom <= 11) return 10000
  if (zoom <= 14) return 1000
  return 100
}

export function formatGridLabel(value: number, interval: number): string {
  if (interval >= 100000) return `${Math.round(value / 100000)}`
  if (interval >= 10000) return `${Math.round((value % 100000) / 10000)}`
  if (interval >= 1000) return `${String(Math.round((value % 100000) / 1000)).padStart(2, '0')}`
  return `${String(Math.round((value % 100000) / 100)).padStart(3, '0')}`
}

// Lat/lng graticule interval in decimal degrees, chosen by zoom.
export function llGridInterval(zoom: number): number {
  if (zoom <= 3) return 10
  if (zoom <= 5) return 5
  if (zoom <= 7) return 1
  if (zoom <= 9) return 0.5
  if (zoom <= 11) return 0.1
  if (zoom <= 13) return 0.05
  if (zoom <= 15) return 0.01
  return 0.005
}

export function formatLLLabel(value: number, interval: number): string {
  const digits = interval >= 1 ? 0 : interval >= 0.1 ? 1 : interval >= 0.01 ? 2 : 3
  return `${value.toFixed(digits)}°`
}

export function createMGRSGridLayer(theme: GridTheme): L.GridLayer {
  const GridLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords): HTMLCanvasElement {
      const tileSize = this.getTileSize()
      const canvas = document.createElement('canvas')
      canvas.width = tileSize.x
      canvas.height = tileSize.y
      const ctx = canvas.getContext('2d')
      if (!ctx) return canvas

      const map = this._map as L.Map
      if (!map) return canvas

      const zoom = coords.z
      const interval = gridIntervalMeters(zoom)

      const nw = map.unproject([coords.x * tileSize.x, coords.y * tileSize.y], zoom)
      const se = map.unproject([(coords.x + 1) * tileSize.x, (coords.y + 1) * tileSize.y], zoom)

      const centerLng = (nw.lng + se.lng) / 2
      const centerLat = (nw.lat + se.lat) / 2
      const zone = utmZone(centerLng)

      const nwUtm = latLngToUTM(nw.lat, nw.lng, zone)
      const seUtm = latLngToUTM(se.lat, se.lng, zone)

      const minE = Math.min(nwUtm.easting, seUtm.easting)
      const maxE = Math.max(nwUtm.easting, seUtm.easting)
      const minN = Math.min(nwUtm.northing, seUtm.northing)
      const maxN = Math.max(nwUtm.northing, seUtm.northing)

      const northern = centerLat >= 0
      const startE = Math.floor(minE / interval) * interval
      const startN = Math.floor(minN / interval) * interval

      const toPixel = (easting: number, northing: number): [number, number] | null => {
        const [lat, lng] = utmToLatLng(easting, northing, zone, northern)
        if (lat < -85 || lat > 85) return null
        const pt = map.project([lat, lng], zoom)
        return [pt.x - coords.x * tileSize.x, pt.y - coords.y * tileSize.y]
      }

      ctx.lineCap = 'butt'
      ctx.strokeStyle = theme.lineColorMajor
      ctx.lineWidth = 1.5
      ctx.setLineDash([])

      const steps = 8

      // Vertical lines (constant easting)
      for (let e = startE; e <= maxE + interval; e += interval) {
        ctx.beginPath()
        let started = false
        for (let i = 0; i <= steps; i++) {
          const n = minN + (maxN - minN) * (i / steps)
          const px = toPixel(e, n)
          if (!px) continue
          if (!started) { ctx.moveTo(px[0], px[1]); started = true }
          else ctx.lineTo(px[0], px[1])
        }
        ctx.stroke()
      }

      // Horizontal lines (constant northing)
      for (let n = startN; n <= maxN + interval; n += interval) {
        ctx.beginPath()
        let started = false
        for (let i = 0; i <= steps; i++) {
          const e = minE + (maxE - minE) * (i / steps)
          const px = toPixel(e, n)
          if (!px) continue
          if (!started) { ctx.moveTo(px[0], px[1]); started = true }
          else ctx.lineTo(px[0], px[1])
        }
        ctx.stroke()
      }

      return canvas
    },
  })

  return new GridLayer({ opacity: 1, pane: 'overlayPane' }) as L.GridLayer
}

// Lat/lng graticule — lines at constant latitude (horizontal) and constant
// longitude (vertical). Used when coordDisplay = 'latlng'.
export function createLLGridLayer(theme: GridTheme): L.GridLayer {
  const GridLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords): HTMLCanvasElement {
      const tileSize = this.getTileSize()
      const canvas = document.createElement('canvas')
      canvas.width = tileSize.x
      canvas.height = tileSize.y
      const ctx = canvas.getContext('2d')
      if (!ctx) return canvas

      const map = this._map as L.Map
      if (!map) return canvas

      const zoom = coords.z
      const interval = llGridInterval(zoom)

      const nw = map.unproject([coords.x * tileSize.x, coords.y * tileSize.y], zoom)
      const se = map.unproject([(coords.x + 1) * tileSize.x, (coords.y + 1) * tileSize.y], zoom)

      const minLat = Math.min(nw.lat, se.lat)
      const maxLat = Math.max(nw.lat, se.lat)
      const minLng = Math.min(nw.lng, se.lng)
      const maxLng = Math.max(nw.lng, se.lng)

      const startLat = Math.floor(minLat / interval) * interval
      const startLng = Math.floor(minLng / interval) * interval

      const toPixel = (lat: number, lng: number): [number, number] => {
        const pt = map.project([lat, lng], zoom)
        return [pt.x - coords.x * tileSize.x, pt.y - coords.y * tileSize.y]
      }

      ctx.lineCap = 'butt'
      ctx.strokeStyle = theme.lineColorMajor
      ctx.lineWidth = 1.5
      ctx.setLineDash([])

      // Vertical lines (constant longitude)
      for (let lng = startLng; lng <= maxLng + interval; lng += interval) {
        const p1 = toPixel(maxLat, lng)
        const p2 = toPixel(minLat, lng)
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }

      // Horizontal lines (constant latitude)
      for (let lat = startLat; lat <= maxLat + interval; lat += interval) {
        const p1 = toPixel(lat, minLng)
        const p2 = toPixel(lat, maxLng)
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }

      return canvas
    },
  })

  return new GridLayer({ opacity: 1, pane: 'overlayPane' }) as L.GridLayer
}
