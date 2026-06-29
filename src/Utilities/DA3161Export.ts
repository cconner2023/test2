/**
 * DA Form 3161 (Request for Issue or Turn-In, AUG 2011 edition) PDF generation.
 *
 * Loads the DA3161.pdf template (landscape, 792×612) and overlays text at mapped
 * coordinates — same pattern as DA2062Export. The template is a CONTENT-ONLY raster of
 * the official form: the source is an XFA/LiveCycle PDF that pdf-lib cannot load, and a
 * naive flatten bakes the interactive widget markup (the CODE-column dropdown arrows,
 * empty field boxes) onto the page. Rendering the page content with annotations DISABLED
 * drops every widget, leaving a clean blank form embedded in a pdf-lib-friendly page.
 *
 * COORDS below were calibrated from the form's own AcroForm field rects (origin =
 * bottom-left, 792×612). 14 item rows per page; overflow items get extra pages.
 *
 * Turn-in only (the "TURN-IN" box is marked): Beacon emits the 3161 as a transcription-
 * ready document the user hand-jams INTO the system of record — it is not the SoR.
 */
import type { PropertyItem, HolderInfo } from '../Types/PropertyTypes'
export { downloadPdfBytes } from './downloadUtils'

/** Only the fields the 3161 renders — lets full store items and lean turn-in rows
 *  satisfy the export without a cast. */
export type DA3161Item = Pick<PropertyItem, 'name' | 'nomenclature' | 'nsn' | 'serial_number'> & {
  /** Turn-in quantity for this line. Absent → 1. */
  quantity?: number
  /** Turn-in reason code for column f (EX = excess, FWT, RS, SC, LT). Absent → 'EX'. */
  reasonCode?: string
}

export interface DA3161Params {
  items: DA3161Item[]
  /** The unit/person turning the property in (block 8, REQUEST FROM). */
  fromHolder: HolderInfo
  /** Receiving SSA / supply activity (block 3, SEND TO). Optional — often hand-filled. */
  sendTo?: string
  /** Document number (block 1, REQUEST NO.) — the turn-in doc id, short. */
  requestNo: string
  /** Turn-in date as YYYYMMDD. */
  date: string
}

const ITEMS_PER_PAGE = 14

// ── Layout constants (PDF points, origin = bottom-left). Calibrated from the form's
//    AcroForm field rects; verified against a test render. ──
const COORDS = {
  turnInMark: { cx: 287.5, y: 567, size: 9 }, // "X" in the TURN-IN box (field ISSUE_1)
  reqFrom: { x: 33, y: 521 },                  // 8. REQUEST FROM
  sendTo:  { x: 33, y: 545 },                  // 3. SEND TO
  reqNo:   { x: 429, y: 569 },                 // 1. REQUEST NO
  dateRqd: { x: 338, y: 545 },                 // 4. DATE (YYYYMMDD)
  row: { firstY: 429, height: 24 },            // row 1 baseline; clean 24pt steps
  cols: {
    itemNoCx: 50,            // a. ITEM NO (centered)
    stock: 75,               // b. STOCK NO (NSN)
    desc: 183, descW: 144,   // c. ITEM DESCRIPTION
    uiCx: 348,               // d. UNIT OF ISSUE (centered)
    qtyCx: 395,              // e. QUANTITY (centered)
    codeCx: 449,             // f. CODE (centered)
  },
  bottom: { dateX: 104, dateY: 54, byX: 183, byY: 53 }, // 13. turn-in DATE / BY
  fontSize: 7,
} as const

/**
 * Generate a DA Form 3161 (Turn-In) PDF by overlaying data on the template.
 * Returns raw PDF bytes.
 */
export async function generateDA3161(params: DA3161Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const templateUrl = new URL('../Data/DA3161.pdf', import.meta.url).href
  const templateBytes = await fetch(templateUrl).then((r) => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(templateBytes)

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const black = rgb(0, 0, 0)
  const sz = COORDS.fontSize

  const draw = (page: import('pdf-lib').PDFPage, text: string, x: number, y: number, maxWidth?: number) =>
    page.drawText(text, { x, y, size: sz, font, color: black, ...(maxWidth ? { maxWidth } : {}) })
  const drawCentered = (page: import('pdf-lib').PDFPage, text: string, cx: number, y: number, size = sz) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: cx - w / 2, y, size, font, color: black })
  }

  const totalPages = Math.max(1, Math.ceil(params.items.length / ITEMS_PER_PAGE))

  if (totalPages > 1) {
    const srcDoc = await PDFDocument.load(templateBytes)
    for (let p = 1; p < totalPages; p++) {
      const [copied] = await pdfDoc.copyPages(srcDoc, [0])
      pdfDoc.addPage(copied)
    }
  }

  const pages = pdfDoc.getPages()

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pages[pageIdx]
    const startIdx = pageIdx * ITEMS_PER_PAGE
    const pageItems = params.items.slice(startIdx, startIdx + ITEMS_PER_PAGE)

    // ── Header (every sheet is a 3161) ──
    drawCentered(page, 'X', COORDS.turnInMark.cx, COORDS.turnInMark.y, COORDS.turnInMark.size)
    draw(page, params.fromHolder.displayName, COORDS.reqFrom.x, COORDS.reqFrom.y, 244)
    if (params.sendTo) draw(page, params.sendTo, COORDS.sendTo.x, COORDS.sendTo.y, 244)
    draw(page, params.requestNo, COORDS.reqNo.x, COORDS.reqNo.y, 158)
    draw(page, params.date, COORDS.dateRqd.x, COORDS.dateRqd.y)

    // ── Item rows ──
    const { cols } = COORDS
    pageItems.forEach((item, i) => {
      const globalIdx = startIdx + i
      const y = COORDS.row.firstY - i * COORDS.row.height

      drawCentered(page, String(globalIdx + 1), cols.itemNoCx, y)
      if (item.nsn) draw(page, item.nsn, cols.stock, y, 100)
      const base = item.nomenclature || item.name
      const desc = item.serial_number ? `${base} (S/N: ${item.serial_number})` : base
      draw(page, desc, cols.desc, y, cols.descW)
      drawCentered(page, 'EA', cols.uiCx, y)
      drawCentered(page, String(item.quantity ?? 1), cols.qtyCx, y)
      drawCentered(page, item.reasonCode || 'EX', cols.codeCx, y)
    })

    // ── 13. Turn-in date + by (last page only, beneath the rows) ──
    if (pageIdx === totalPages - 1) {
      draw(page, params.date, COORDS.bottom.dateX, COORDS.bottom.dateY)
      draw(page, params.fromHolder.displayName, COORDS.bottom.byX, COORDS.bottom.byY, 108)
    }
  }

  return pdfDoc.save()
}
