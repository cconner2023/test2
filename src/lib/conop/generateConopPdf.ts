/**
 * CONOP / WARNO landscape PDF generator.
 *
 * Hand-rolled (no template) US-Letter LANDSCAPE one-pager built from a calendar
 * event. Full-width header band, a left 30% column (title, date range, details,
 * task checklist) and a right 70% themed map snapshot of the event's linked
 * geometry. Mirrors the pdf-lib conventions in src/lib/stripMap/generatePdf.ts
 * (dynamic import, StandardFonts, returns Uint8Array). PPTX is a later phase.
 *
 * NO PHI: every field is operational vocabulary (titles, grids, equipment /
 * location labels, free-text tasks). PHI never reaches an OverlayFeature or a
 * subtask label.
 */

const PAGE_W = 792 // US Letter landscape, points
const PAGE_H = 612
const MARGIN = 36
const HEADER_H = 52
const GUTTER = 18
const FOOTER_H = 16
const LEFT_FRAC = 0.3

// Army baseline is Arial 10pt; pdf-lib has no Arial, so we use Helvetica (the
// metric-compatible standard-14 substitute) and consolidate everything onto the
// 10pt baseline. Title is the lone heading step-up; footer chrome stays smaller.
const FONT_TITLE = 14
const FONT_DTG = 10
const FONT_SECTION = 10
const FONT_BODY = 10
const FONT_FOOTER = 8

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Military date-time group in local time, e.g. 210010JUN26 (DDHHMM + MON + YY). */
function toDtg(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${MONTHS[d.getMonth()]}${p2(d.getFullYear() % 100)}`
}

export interface ConopSubtask {
  label: string
  done: boolean
}

export interface ConopData {
  title: string
  /** ISO start timestamp — rendered as a military DTG (Start: 210010JUN26). */
  startTime: string
  /** ISO end timestamp — rendered as a military DTG (End: 211200JUN26). */
  endTime: string
  /** All-day events have no meaningful end time; the End line is suppressed. */
  allDay: boolean
  location?: string | null
  assignedNames: string[]
  uniform?: string | null
  reportTime?: string | null
  notes?: string | null
  subtasks: ConopSubtask[]
  /** Themed map PNG from renderConopMapSnapshot. Absent → left column spans full width. */
  mapPng?: Uint8Array | null
  mapW?: number
  mapH?: number
  /** ISO timestamp; rendered in the footer. */
  generatedAt: string
}

type Font = import('pdf-lib').PDFFont
type Page = import('pdf-lib').PDFPage
type Color = import('pdf-lib').Color

interface Ctx {
  pdf: import('pdf-lib').PDFDocument
  page: Page
  helv: Font
  bold: Font
  y: number
  leftX: number
  leftW: number
  black: Color
  grey: Color
  hair: Color
  generatedAt: string
}

function wrapText(font: Font, size: number, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

const bottomLimit = MARGIN + FOOTER_H + 6

function drawFooter(ctx: Ctx, page: Page): void {
  page.drawLine({
    start: { x: MARGIN, y: MARGIN + FOOTER_H },
    end: { x: PAGE_W - MARGIN, y: MARGIN + FOOTER_H },
    thickness: 0.4,
    color: ctx.hair,
  })
  page.drawText(`CONOP · Generated ${toDtg(ctx.generatedAt)}`, {
    x: MARGIN,
    y: MARGIN + 4,
    size: FONT_FOOTER,
    font: ctx.helv,
    color: ctx.grey,
  })
}

/** Continuation page for an overflowing left column — no header band, no map. */
function newContinuationPage(ctx: Ctx, title: string): void {
  drawFooter(ctx, ctx.page)
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  ctx.page.drawText(`${title} (cont.)`, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 12,
    size: FONT_DTG,
    font: ctx.bold,
    color: ctx.grey,
  })
  // Continuation column spans the full usable width.
  ctx.leftX = MARGIN
  ctx.leftW = PAGE_W - 2 * MARGIN
  ctx.y = PAGE_H - MARGIN - 28
}

function ensureSpace(ctx: Ctx, needed: number, title: string): void {
  if (ctx.y - needed < bottomLimit) newContinuationPage(ctx, title)
}

function drawSectionHeader(ctx: Ctx, label: string, title: string): void {
  ensureSpace(ctx, FONT_SECTION + 8, title)
  ctx.y -= FONT_SECTION + 6
  ctx.page.drawText(label.toUpperCase(), {
    x: ctx.leftX,
    y: ctx.y,
    size: FONT_SECTION,
    font: ctx.bold,
    color: ctx.grey,
  })
  ctx.y -= 4
}

function drawWrapped(ctx: Ctx, text: string, title: string, font: Font, size = FONT_BODY): void {
  for (const line of wrapText(font, size, text, ctx.leftW)) {
    ensureSpace(ctx, size + 4, title)
    ctx.y -= size + 3
    ctx.page.drawText(line, { x: ctx.leftX, y: ctx.y, size, font, color: ctx.black })
  }
}

export async function generateConopPdf(data: ConopData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const black = rgb(0.06, 0.08, 0.1)
  const grey = rgb(0.42, 0.45, 0.48)
  const hair = rgb(0.8, 0.82, 0.84)

  const usableW = PAGE_W - 2 * MARGIN
  const hasMap = !!data.mapPng && !!data.mapW && !!data.mapH
  const leftW = hasMap ? usableW * LEFT_FRAC - GUTTER / 2 : usableW

  // ── Header band (full width) ──
  const headerY = PAGE_H - MARGIN
  page.drawText(data.title || 'Untitled', {
    x: MARGIN,
    y: headerY - 16,
    size: FONT_TITLE,
    font: bold,
    color: black,
  })
  // Start / End military DTG as the header subtext (no category).
  page.drawText(`Start: ${toDtg(data.startTime)}`, {
    x: MARGIN,
    y: headerY - 30,
    size: FONT_DTG,
    font: helv,
    color: grey,
  })
  if (!data.allDay) {
    page.drawText(`End: ${toDtg(data.endTime)}`, {
      x: MARGIN,
      y: headerY - 42,
      size: FONT_DTG,
      font: helv,
      color: grey,
    })
  }
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    thickness: 0.8,
    color: black,
  })

  // ── Right 70% map ──
  if (hasMap) {
    const png = await pdf.embedPng(data.mapPng!)
    const paneX = MARGIN + usableW * LEFT_FRAC + GUTTER / 2
    const paneW = PAGE_W - MARGIN - paneX
    const paneTop = PAGE_H - MARGIN - HEADER_H - 10
    const paneH = paneTop - (MARGIN + FOOTER_H + 6)
    const scale = Math.min(paneW / data.mapW!, paneH / data.mapH!)
    const drawW = data.mapW! * scale
    const drawH = data.mapH! * scale
    page.drawImage(png, {
      x: paneX + (paneW - drawW) / 2,
      y: paneTop - drawH,
      width: drawW,
      height: drawH,
    })
    page.drawRectangle({
      x: paneX + (paneW - drawW) / 2,
      y: paneTop - drawH,
      width: drawW,
      height: drawH,
      borderColor: hair,
      borderWidth: 0.8,
    })
  }

  // ── Left 30% column ──
  const ctx: Ctx = {
    pdf,
    page,
    helv,
    bold,
    y: PAGE_H - MARGIN - HEADER_H - 6,
    leftX: MARGIN,
    leftW,
    black,
    grey,
    hair,
    generatedAt: data.generatedAt,
  }
  const title = data.title || 'CONOP'

  if (data.reportTime) drawWrapped(ctx, `Report: ${data.reportTime}`, title, helv)

  if (data.location) {
    drawSectionHeader(ctx, 'Where', title)
    drawWrapped(ctx, data.location, title, helv)
  }

  if (data.assignedNames.length) {
    drawSectionHeader(ctx, 'Assigned', title)
    drawWrapped(ctx, data.assignedNames.join(', '), title, helv)
  }

  if (data.uniform) {
    drawSectionHeader(ctx, 'Uniform', title)
    drawWrapped(ctx, data.uniform, title, helv)
  }

  if (data.notes) {
    drawSectionHeader(ctx, 'Notes', title)
    drawWrapped(ctx, data.notes, title, helv)
  }

  if (data.subtasks.length) {
    drawSectionHeader(ctx, 'Tasks', title)
    for (const t of data.subtasks) {
      const boxSize = 8
      const lines = wrapText(helv, FONT_BODY, t.label, leftW - boxSize - 6)
      ensureSpace(ctx, FONT_BODY + 5, title)
      ctx.y -= FONT_BODY + 3
      const rowY = ctx.y
      // Checkbox
      ctx.page.drawRectangle({
        x: ctx.leftX,
        y: rowY - 1,
        width: boxSize,
        height: boxSize,
        borderColor: ctx.grey,
        borderWidth: 0.8,
      })
      if (t.done) {
        ctx.page.drawLine({
          start: { x: ctx.leftX + 1.5, y: rowY + 3 },
          end: { x: ctx.leftX + 3.2, y: rowY + 0.5 },
          thickness: 1,
          color: ctx.black,
        })
        ctx.page.drawLine({
          start: { x: ctx.leftX + 3.2, y: rowY + 0.5 },
          end: { x: ctx.leftX + 6.8, y: rowY + 6 },
          thickness: 1,
          color: ctx.black,
        })
      }
      const textX = ctx.leftX + boxSize + 6
      lines.forEach((line, i) => {
        if (i > 0) {
          ensureSpace(ctx, FONT_BODY + 4, title)
          ctx.y -= FONT_BODY + 2
        }
        const ly = i === 0 ? rowY : ctx.y
        ctx.page.drawText(line, {
          x: textX,
          y: ly,
          size: FONT_BODY,
          font: helv,
          color: t.done ? ctx.grey : ctx.black,
        })
        if (t.done) {
          const w = helv.widthOfTextAtSize(line, FONT_BODY)
          ctx.page.drawLine({
            start: { x: textX, y: ly + FONT_BODY / 2 - 1 },
            end: { x: textX + w, y: ly + FONT_BODY / 2 - 1 },
            thickness: 0.6,
            color: ctx.grey,
          })
        }
      })
    }
  }

  drawFooter(ctx, ctx.page)
  return pdf.save()
}
