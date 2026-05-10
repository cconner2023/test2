/**
 * Phase 4.4 — Strip-map PDF generator.
 *
 * Hand-rolled (no template) US Letter portrait PDF showing a leg-by-leg
 * navigation table for a route. Built from StripMapData produced by
 * computeLegs.ts.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │ STRIP MAP — <overlay> · <route>                  │
 *   │ ──────────────────────────────────────────────── │
 *   │ Total: 4.32 km · 43 min @ 100 m/min · Bearings G │
 *   │                                                  │
 *   │ #  Distance   Az     End grid              Time  │
 *   │ 1   245 m     087°G  18S UJ 2337 0651      2:27  │
 *   │ 2   180 m     145°G  18S UJ 2350 0640      1:48  │
 *   │ ...                                              │
 *   │                                                  │
 *   │ Generated 2026-05-10 12:00 · Bearing reference G │
 *   └──────────────────────────────────────────────────┘
 *
 * Multi-page when leg count exceeds page capacity. ~40 legs/page at body
 * font size 9.
 */

import {
  type StripMapData,
  formatDistance,
  formatPaceMinutes,
  formatBearingForRow,
  bearingSuffix,
} from './computeLegs'

const PAGE_W = 612    // US Letter portrait, points
const PAGE_H = 792
const MARGIN_X = 48
const MARGIN_TOP = 48
const MARGIN_BOTTOM = 48
const HEADER_H = 56
const SUMMARY_H = 22
const COLS_HEADER_H = 18
const ROW_H = 13
const FOOTER_H = 18

const FONT_TITLE = 14
const FONT_BODY = 9
const FONT_SUMMARY = 10
const FONT_FOOTER = 8

interface ColLayout {
  num: number
  dist: number
  az: number
  endLabel: number
  cumulative: number
  time: number
}

const COLS: ColLayout = {
  num:        MARGIN_X,
  dist:       MARGIN_X + 24,
  az:         MARGIN_X + 90,
  endLabel:   MARGIN_X + 140,
  cumulative: MARGIN_X + 360,
  time:       MARGIN_X + 460,
}

export async function generateStripMapPdf(data: StripMapData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold)
  const black = rgb(0, 0, 0)
  const grey = rgb(0.45, 0.45, 0.45)
  const lightGrey = rgb(0.86, 0.86, 0.86)

  const usable = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - HEADER_H - SUMMARY_H - COLS_HEADER_H - FOOTER_H
  const rowsPerPage = Math.max(1, Math.floor(usable / ROW_H))
  const totalPages = Math.max(1, Math.ceil(data.legs.length / rowsPerPage))

  const subText = stripMapSummary(data)

  for (let p = 0; p < totalPages; p++) {
    const page = pdf.addPage([PAGE_W, PAGE_H])

    // Header
    let y = PAGE_H - MARGIN_TOP
    page.drawText('STRIP MAP', { x: MARGIN_X, y: y - 14, size: FONT_TITLE, font: helvBold, color: black })
    page.drawText(`${data.overlayName}${data.routeName ? ' · ' + data.routeName : ''}`, {
      x: MARGIN_X + 110, y: y - 14, size: FONT_TITLE, font: helv, color: grey,
    })
    if (totalPages > 1) {
      page.drawText(`Page ${p + 1} of ${totalPages}`, {
        x: PAGE_W - MARGIN_X - 70, y: y - 14, size: FONT_FOOTER, font: helv, color: grey,
      })
    }
    page.drawLine({
      start: { x: MARGIN_X, y: y - HEADER_H + 24 },
      end:   { x: PAGE_W - MARGIN_X, y: y - HEADER_H + 24 },
      thickness: 0.7, color: black,
    })

    // Summary line
    y -= HEADER_H
    page.drawText(subText, { x: MARGIN_X, y, size: FONT_SUMMARY, font: helv, color: black })

    // Column headers
    y -= SUMMARY_H
    drawHeaderRow(page, y, helvBold, black)
    page.drawLine({
      start: { x: MARGIN_X, y: y - 4 },
      end:   { x: PAGE_W - MARGIN_X, y: y - 4 },
      thickness: 0.5, color: black,
    })

    // Body rows
    y -= COLS_HEADER_H
    const start = p * rowsPerPage
    const end = Math.min(start + rowsPerPage, data.legs.length)
    for (let i = start; i < end; i++) {
      const leg = data.legs[i]
      const rowY = y - 9
      // Zebra striping
      if ((i - start) % 2 === 1) {
        page.drawRectangle({
          x: MARGIN_X - 4,
          y: rowY - 3,
          width: (PAGE_W - 2 * MARGIN_X) + 8,
          height: ROW_H,
          color: lightGrey,
          opacity: 0.35,
        })
      }
      page.drawText(String(leg.index), { x: COLS.num, y: rowY, size: FONT_BODY, font: monoBold, color: black })
      page.drawText(formatDistance(leg.distanceM), { x: COLS.dist, y: rowY, size: FONT_BODY, font: mono, color: black })
      page.drawText(formatBearingForRow(leg.refBearing, data.bearingReference), { x: COLS.az, y: rowY, size: FONT_BODY, font: mono, color: black })
      page.drawText(truncate(leg.endLabel, 38), { x: COLS.endLabel, y: rowY, size: FONT_BODY, font: helv, color: black })
      page.drawText(formatDistance(leg.cumulativeM), { x: COLS.cumulative, y: rowY, size: FONT_BODY, font: mono, color: grey })
      page.drawText(formatPaceMinutes(leg.paceMinutes), { x: COLS.time, y: rowY, size: FONT_BODY, font: mono, color: black })
      y -= ROW_H
    }

    // Footer
    const footerY = MARGIN_BOTTOM
    page.drawLine({
      start: { x: MARGIN_X, y: footerY + 10 },
      end:   { x: PAGE_W - MARGIN_X, y: footerY + 10 },
      thickness: 0.4, color: grey,
    })
    page.drawText(stripMapFooter(data), {
      x: MARGIN_X, y: footerY, size: FONT_FOOTER, font: helv, color: grey,
    })
  }

  return pdf.save()
}

// ─────────────────────────── helpers ───────────────────────────

function drawHeaderRow(
  page: import('pdf-lib').PDFPage,
  y: number,
  font: import('pdf-lib').PDFFont,
  color: import('pdf-lib').Color,
): void {
  const opts = { y, size: FONT_BODY, font, color }
  page.drawText('#',          { x: COLS.num,        ...opts })
  page.drawText('Distance',   { x: COLS.dist,       ...opts })
  page.drawText('Az',         { x: COLS.az,         ...opts })
  page.drawText('End',        { x: COLS.endLabel,   ...opts })
  page.drawText('Cumulative', { x: COLS.cumulative, ...opts })
  page.drawText('Time',       { x: COLS.time,       ...opts })
}

export function stripMapSummary(data: StripMapData): string {
  const distance = formatDistance(data.totalDistanceM)
  const refLabel = data.bearingReference === 'true' ? 'True'
    : data.bearingReference === 'grid' ? 'Grid'
    : 'Magnetic'
  const parts: string[] = [
    `${data.legs.length} leg${data.legs.length === 1 ? '' : 's'}`,
    `Total ${distance}`,
  ]
  if (data.totalPaceMinutes != null) {
    const paceLabel = data.pace === '100' ? '100 m/min' : '80 m/min'
    parts.push(`${formatPaceMinutes(data.totalPaceMinutes)} @ ${paceLabel}`)
  }
  parts.push(`Bearings ${refLabel} (${bearingSuffix(data.bearingReference)})`)
  return parts.join(' · ')
}

export function stripMapFooter(data: StripMapData): string {
  const ts = data.generatedAt.replace('T', ' ').slice(0, 16)
  return `Beacon · Generated ${ts} UTC · Bearings ${bearingSuffix(data.bearingReference)}`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
