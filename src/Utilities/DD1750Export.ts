/**
 * DD Form 1750 (Packing List, SEP 70) PDF generation.
 *
 * Mirrors DA2062Export: load the DD1750 template, overlay text at mapped
 * coordinates (page-space, origin = bottom-left). One packing list = one zone (the
 * END ITEM) and everything packed inside it — its contents plus each child zone's
 * LIN-component line and their nested contents (the caller flattens the subtree;
 * see collectDD1750Lines). Generated on demand from live contents — no stored record.
 *
 * PAGE POLICY (per USR): the template PDF has TWO pages — page 0 is the FORM,
 * page 1 is the "NOTES TO CONSIGNEE" reverse. We use ONLY page 0. When the item
 * list overflows one page, we REPEAT page 0 (never emit the notes page).
 *
 * FIELD MAP (DD 1750 boxes → our data):
 *   PACKED BY        ← params.packedBy (optional)
 *   3. END ITEM      ← params.zoneName (the container / zone identity)
 *   4. DATE          ← params.date
 *   5. PAGE _ OF _   ← page index / total
 *   Table col b (CONTENTS — STOCK NUMBER AND NOMENCLATURE) ← nsn + nomenclature (+ serial)
 *   Table col c (UNIT OF ISSUE)  ← "EA"
 *   Table col f (TOTAL)          ← quantity
 *   (col a BOX NO. / cols d,e INITIAL·SPARES left blank — optional on the form.)
 *
 * COORDS are FIRST-PASS estimates from the form image (portrait Letter,
 * 612×792). Preview + nudge the numbers here to calibrate, exactly like the
 * DA2062 COORDS block. No PHI — equipment nomenclature / NSN / serial are
 * operational vocab.
 */
import type { PropertyItem } from '../Types/PropertyTypes'
export { downloadPdfBytes } from './downloadUtils'

/** Only the fields the 1750 renders — lets full store items satisfy the export
 *  without a cast. */
export type DD1750Item = Pick<PropertyItem, 'name' | 'nomenclature' | 'nsn' | 'serial_number'> & {
  /** On-hand quantity for this line. Absent → 1. */
  quantity?: number
}

export interface DD1750Params {
  /** The zone whose contents this packing list covers → the "3. END ITEM" box. */
  zoneName: string
  /** Who packed it → the "PACKED BY" box. "RANK LAST FIRST". */
  packedBy?: string
  /** Reviewer → the bottom "TYPED NAME AND TITLE" cert block (item 6). "RANK LAST FIRST". */
  reviewedBy?: string
  /** Display date string (e.g. "2026-07-04") → the "4. DATE" box. */
  date: string
  items: DD1750Item[]
}

// TODO(calibration): tune to the ruled rows once previewed.
const ITEMS_PER_PAGE = 22

// ── Layout constants (PDF points, origin = bottom-left) — FIRST-PASS ESTIMATES ──
const COORDS = {
  // Header band.
  packedBy: { x: 185, y: 723 },   // "PACKED BY" cell
  noBoxes:  { cx: 320, y: 723 },  // "1. NO. BOXES" — we stamp "1" (single container)
  endItem:  { x: 52, y: 672 },    // "3. END ITEM" (zone / container identity)
  date:     { x: 412, y: 681 },   // "4. DATE"
  pageNum:  { cx: 470, y: 659 },  // "5. PAGE __" (this page)
  pageTot:  { cx: 520, y: 659 },  // "… OF __ PAGE(S)" (total)
  reviewedBy: { x: 55, y: 44 },   // bottom cert block "TYPED NAME AND TITLE" (item 6)

  // Item table.
  table: {
    firstRowY: 605,   // baseline of row 1
    rowHeight: 23.5,  // TODO: match the ruled row pitch
    cols: {
      boxNo:    { cx: 67 },                // a. BOX NO. (incremental line number)
      contents: { x: 92,  maxWidth: 268 }, // b. CONTENTS — STOCK NUMBER AND NOMENCLATURE
      ui:       { cx: 382 },               // c. UNIT OF ISSUE
      initial:  { cx: 427 },               // d. INITIAL OPERATION (complete amount packed)
      // e. RUNNING SPARES left blank (optional).
      total:    { cx: 537 },               // f. TOTAL
    },
  },

  fontSize: { header: 9, body: 8 },
} as const

/**
 * Generate a DD Form 1750 Packing List PDF by overlaying data on the template.
 * Returns raw PDF bytes.
 */
export async function generateDD1750(params: DD1750Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  // Template committed at src/Data/DD1750.pdf (DA2062 convention).
  const templateUrl = new URL('../Data/DD1750.pdf', import.meta.url).href
  const templateBytes = await fetch(templateUrl).then((r) => r.arrayBuffer())
  // DoD fillable forms ship with permissions encryption (no user password) —
  // load through it; we only read page 0 and overlay text.
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })

  // The template is an interactive AcroForm; its widget annotations make copyPages
  // choke ("Expected instance of PDFDict"). Flatten the (empty) form so page 0 is
  // static content we can freely copy + draw on.
  try { pdfDoc.getForm().flatten() } catch { /* no form / nothing to flatten */ }

  // Page policy (USR): use ONLY page 0 (the PACKING LIST form); drop the reverse
  // "NOTES TO CONSIGNEE" page(s), then repeat page 0 for overflow.
  while (pdfDoc.getPageCount() > 1) pdfDoc.removePage(1)

  const totalPages = Math.max(1, Math.ceil(params.items.length / ITEMS_PER_PAGE))
  for (let p = 1; p < totalPages; p++) {
    const [copy] = await pdfDoc.copyPages(pdfDoc, [0])
    pdfDoc.addPage(copy)
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const black = rgb(0, 0, 0)

  /** Draw text horizontally centered on `cx`. */
  const drawCentered = (page: import('pdf-lib').PDFPage, text: string, cx: number, y: number, size: number) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: cx - w / 2, y, size, font, color: black })
  }

  const pages = pdfDoc.getPages()

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pages[pageIdx]
    const startIdx = pageIdx * ITEMS_PER_PAGE
    const pageItems = params.items.slice(startIdx, startIdx + ITEMS_PER_PAGE)
    const hz = COORDS.fontSize.header

    // ── Header fields ──
    if (params.packedBy) {
      page.drawText(params.packedBy, { x: COORDS.packedBy.x, y: COORDS.packedBy.y, size: hz, font, color: black })
    }
    drawCentered(page, '1', COORDS.noBoxes.cx, COORDS.noBoxes.y, hz)
    page.drawText(params.zoneName, { x: COORDS.endItem.x, y: COORDS.endItem.y, size: hz, font, color: black })
    page.drawText(params.date, { x: COORDS.date.x, y: COORDS.date.y, size: hz, font, color: black })
    drawCentered(page, String(pageIdx + 1), COORDS.pageNum.cx, COORDS.pageNum.y, hz)
    drawCentered(page, String(totalPages), COORDS.pageTot.cx, COORDS.pageTot.y, hz)
    if (params.reviewedBy) {
      page.drawText(params.reviewedBy, { x: COORDS.reviewedBy.x, y: COORDS.reviewedBy.y, size: hz, font, color: black })
    }

    // ── Item rows ──
    const { cols } = COORDS.table
    pageItems.forEach((item, i) => {
      const y = COORDS.table.firstRowY - i * COORDS.table.rowHeight
      const sz = COORDS.fontSize.body
      const qty = String(item.quantity ?? 1)

      // a. BOX NO. — incremental running line number across the whole list.
      drawCentered(page, String(startIdx + i + 1), cols.boxNo.cx, y, sz)

      // b. CONTENTS — stock number (NSN) + nomenclature (+ serial), one column.
      const nom = item.nomenclature || item.name
      const contents = [
        item.nsn ? item.nsn : null,
        nom,
        item.serial_number ? `(S/N: ${item.serial_number})` : null,
      ].filter(Boolean).join('  ')
      page.drawText(contents, { x: cols.contents.x, y, size: sz, font, color: black, maxWidth: cols.contents.maxWidth })

      // c. UNIT OF ISSUE.
      drawCentered(page, 'EA', cols.ui.cx, y, sz)

      // d. INITIAL OPERATION + f. TOTAL — the complete amount packed.
      drawCentered(page, qty, cols.initial.cx, y, sz)
      drawCentered(page, qty, cols.total.cx, y, sz)
    })
  }

  return pdfDoc.save()
}
