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

interface GridTheme {
  lineColor: string
  lineColorMajor: string
  labelColor: string
  labelBg: string
}

export const GRID_THEME_LIGHT: GridTheme = {
  lineColor: 'rgba(0,66,92,0.25)',
  lineColorMajor: 'rgba(0,66,92,0.45)',
  labelColor: '#00425C',
  labelBg: 'rgba(240,242,245,0.8)',
}

export const GRID_THEME_DARK: GridTheme = {
  lineColor: 'rgba(129,161,181,0.25)',
  lineColorMajor: 'rgba(129,161,181,0.45)',
  labelColor: '#81A1B5',
  labelBg: 'rgba(15,25,35,0.8)',
}

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
