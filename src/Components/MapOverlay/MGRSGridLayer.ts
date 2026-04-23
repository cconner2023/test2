/**
 * MGRSGridLayer — Leaflet GridLayer that draws UTM/MGRS grid lines on canvas tiles.
 *
 * LOD by zoom level:
 *   zoom ≤ 8   → 100 km
 *   zoom 9-11  → 10 km
 *   zoom 12-14 → 1 km
 *   zoom 15+   → 100 m
 *
 * Major lines are solid, minor lines are dashed.
 * Labels: easting at the top edge, northing at the left edge — one per line.
 */
import L from 'leaflet'
import { latLngToUTM, utmToLatLng, utmZone } from './utmProjection'
import type { ThemeName, ThemeMode } from '../../Utilities/ThemeContext'

interface GridTheme {
  lineColor: string
  lineColorMajor: string
  labelColor: string
  labelBg: string
}

const GRID_THEMES: Record<`${ThemeName}-${ThemeMode}`, GridTheme> = {
  'default-light':    { lineColor: 'rgba(0,66,92,0.25)',       lineColorMajor: 'rgba(0,66,92,0.45)',       labelColor: '#00425C', labelBg: 'rgba(240,242,245,0.8)' },
  'default-dark':     { lineColor: 'rgba(129,161,181,0.25)',   lineColorMajor: 'rgba(129,161,181,0.45)',   labelColor: '#81A1B5', labelBg: 'rgba(14,22,32,0.8)' },

  'ironclad-light':   { lineColor: 'rgba(160,100,20,0.30)',    lineColorMajor: 'rgba(160,100,20,0.55)',    labelColor: '#8B6010', labelBg: 'rgba(248,242,225,0.8)' },
  'ironclad-dark':    { lineColor: 'rgba(218,140,38,0.25)',    lineColorMajor: 'rgba(218,140,38,0.45)',    labelColor: '#C8901A', labelBg: 'rgba(30,26,20,0.8)' },

  'forest-light':     { lineColor: 'rgba(22,110,82,0.28)',     lineColorMajor: 'rgba(22,110,82,0.50)',     labelColor: '#166E52', labelBg: 'rgba(240,244,238,0.8)' },
  'forest-dark':      { lineColor: 'rgba(52,162,124,0.25)',    lineColorMajor: 'rgba(52,162,124,0.45)',    labelColor: '#34A27C', labelBg: 'rgba(14,16,14,0.8)' },

  'void-light':       { lineColor: 'rgba(0,110,148,0.28)',     lineColorMajor: 'rgba(0,110,148,0.50)',     labelColor: '#006E94', labelBg: 'rgba(238,242,248,0.8)' },
  'void-dark':        { lineColor: 'rgba(0,164,190,0.25)',     lineColorMajor: 'rgba(0,164,190,0.45)',     labelColor: '#00A4BE', labelBg: 'rgba(10,12,16,0.8)' },

  'slipstream-light': { lineColor: 'rgba(48,100,88,0.28)',     lineColorMajor: 'rgba(48,100,88,0.50)',     labelColor: '#306458', labelBg: 'rgba(242,244,240,0.8)' },
  'slipstream-dark':  { lineColor: 'rgba(84,136,124,0.25)',    lineColorMajor: 'rgba(84,136,124,0.45)',    labelColor: '#54887C', labelBg: 'rgba(14,18,22,0.8)' },

  'urban-light':      { lineColor: 'rgba(90,66,48,0.28)',      lineColorMajor: 'rgba(90,66,48,0.50)',      labelColor: '#5A4230', labelBg: 'rgba(244,240,232,0.8)' },
  'urban-dark':       { lineColor: 'rgba(132,100,78,0.25)',    lineColorMajor: 'rgba(132,100,78,0.45)',    labelColor: '#84644E', labelBg: 'rgba(14,13,11,0.8)' },
}

export function getGridTheme(name: ThemeName, mode: ThemeMode): GridTheme {
  return GRID_THEMES[`${name}-${mode}`] ?? GRID_THEMES[`default-${mode}`]
}

// Backward-compat aliases
export const GRID_THEME_LIGHT: GridTheme = GRID_THEMES['default-light']
export const GRID_THEME_DARK: GridTheme  = GRID_THEMES['default-dark']

function gridInterval(zoom: number): { major: number; minor: number } {
  if (zoom <= 8) return { major: 100000, minor: 100000 }
  if (zoom <= 11) return { major: 100000, minor: 10000 }
  if (zoom <= 14) return { major: 10000, minor: 1000 }
  return { major: 1000, minor: 100 }
}

function formatLabel(value: number, interval: number): string {
  if (interval >= 100000) return `${Math.round(value / 100000)}`
  if (interval >= 10000) return `${Math.round((value % 100000) / 10000)}`
  if (interval >= 1000) return `${String(Math.round((value % 100000) / 1000)).padStart(2, '0')}`
  return `${String(Math.round((value % 100000) / 100)).padStart(3, '0')}`
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
      const { major, minor } = gridInterval(zoom)

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
      const startE = Math.floor(minE / minor) * minor
      const startN = Math.floor(minN / minor) * minor

      const toPixel = (easting: number, northing: number): [number, number] | null => {
        const [lat, lng] = utmToLatLng(easting, northing, zone, northern)
        if (lat < -85 || lat > 85) return null
        const pt = map.project([lat, lng], zoom)
        return [pt.x - coords.x * tileSize.x, pt.y - coords.y * tileSize.y]
      }

      ctx.lineCap = 'butt'
      const labelFontSize = zoom >= 14 ? 10 : 9
      ctx.font = `600 ${labelFontSize}px ui-monospace, monospace`

      const steps = 8
      const pad = 3

      // ── Vertical lines (constant easting) — label once at top edge ──
      for (let e = startE; e <= maxE + minor; e += minor) {
        const isMajor = e % major === 0
        ctx.strokeStyle = isMajor ? theme.lineColorMajor : theme.lineColor
        ctx.lineWidth = isMajor ? 1.5 : 0.75
        ctx.setLineDash(isMajor ? [] : [4, 4])

        ctx.beginPath()
        let started = false
        let topPx: [number, number] | null = null
        for (let i = 0; i <= steps; i++) {
          const n = minN + (maxN - minN) * (i / steps)
          const px = toPixel(e, n)
          if (!px) continue
          if (!started) { ctx.moveTo(px[0], px[1]); started = true }
          else ctx.lineTo(px[0], px[1])
          // Keep the pixel closest to the top edge
          if (!topPx || px[1] < topPx[1]) topPx = px
        }
        ctx.stroke()

        // Label at top edge
        if (topPx && topPx[0] > 4 && topPx[0] < tileSize.x - 24) {
          const lbl = formatLabel(e, minor)
          const tw = ctx.measureText(lbl).width
          const lx = topPx[0] + 2
          const ly = pad
          ctx.fillStyle = theme.labelBg
          ctx.textBaseline = 'top'
          ctx.fillRect(lx - 2, ly - 1, tw + 4, labelFontSize + 3)
          ctx.fillStyle = theme.labelColor
          ctx.fillText(lbl, lx, ly)
        }
      }

      // ── Horizontal lines (constant northing) — label once at left edge ──
      for (let n = startN; n <= maxN + minor; n += minor) {
        const isMajor = n % major === 0
        ctx.strokeStyle = isMajor ? theme.lineColorMajor : theme.lineColor
        ctx.lineWidth = isMajor ? 1.5 : 0.75
        ctx.setLineDash(isMajor ? [] : [4, 4])

        ctx.beginPath()
        let started = false
        let leftPx: [number, number] | null = null
        for (let i = 0; i <= steps; i++) {
          const e = minE + (maxE - minE) * (i / steps)
          const px = toPixel(e, n)
          if (!px) continue
          if (!started) { ctx.moveTo(px[0], px[1]); started = true }
          else ctx.lineTo(px[0], px[1])
          // Keep the pixel closest to the left edge
          if (!leftPx || px[0] < leftPx[0]) leftPx = px
        }
        ctx.stroke()

        // Label at left edge
        if (leftPx && leftPx[1] > 4 && leftPx[1] < tileSize.y - 14) {
          const lbl = formatLabel(n, minor)
          const tw = ctx.measureText(lbl).width
          const lx = pad
          const ly = leftPx[1] - labelFontSize - 2
          ctx.fillStyle = theme.labelBg
          ctx.textBaseline = 'top'
          ctx.fillRect(lx - 1, ly - 1, tw + 4, labelFontSize + 3)
          ctx.fillStyle = theme.labelColor
          ctx.fillText(lbl, lx + 1, ly)
        }
      }

      ctx.setLineDash([])
      return canvas
    },
  })

  return new GridLayer({ opacity: 1, pane: 'overlayPane' }) as L.GridLayer
}
