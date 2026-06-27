/**
 * DA Form 2062 (Hand Receipt / Shortage Listing, DEC 2023 edition) PDF generation.
 *
 * Loads the DA2062-1.pdf template (landscape, 792×612) and overlays text at
 * mapped coordinates, following the same pattern as DD689Export.
 *
 * COORDS below were calibrated from the template's own grid lines (page-space,
 * origin = bottom-left). 19 item rows per page; overflow items get extra pages.
 */
import type { PropertyItem, HolderInfo } from '../Types/PropertyTypes'
export { downloadPdfBytes } from './downloadUtils'

/** Only the fields the 2062 actually renders — lets both full store items and
 *  lean reprint rows satisfy the export without a cast. */
export type DA2062Item = Pick<PropertyItem, 'name' | 'nomenclature' | 'nsn' | 'serial_number'> & {
  /** Quantity signed out for this row. Absent → 1 (legacy/serialized single units). */
  quantity?: number
}

/** Recipient's acknowledgement, stamped vertically in QUANTITY column B
 *  below the last item (the standard DA 2062 hand-receipt signature block). */
export interface DA2062Signature {
  /** Printed name, rank-first — e.g. "CPT Conner Christopher D". */
  printedName: string
  /** Signature date as YYYYMMDD — e.g. "20260626". */
  date: string
  /** Drawn signature as a PNG data URL. Absent → name + date only (e.g. reprint). */
  image?: string
}

export interface DA2062Params {
  items: DA2062Item[]
  fromHolder: HolderInfo
  toHolder: HolderInfo
  handReceiptNumber: string
  date: string   // display date string
  signature?: DA2062Signature
}

const ITEMS_PER_PAGE = 19

// ── Layout constants (PDF points, origin = bottom-left) ──────
// Calibrated from the DA2062-1.pdf grid lines. Tweak here to re-calibrate.
const COORDS = {
  // Header band (cells: FROM 214–436, TO 436–657, IDENTIFIER 657–768).
  // Values sit on the ruled write-line below each printed label.
  from: { x: 220, y: 571 },
  to:   { x: 440, y: 571 },
  hrId: { x: 662, y: 571 },

  // Item table — column x-ranges from the vertical grid lines.
  table: {
    firstRowY: 492,     // text baseline of row 1 (top line 509, bottom 485)
    rowHeight: 23.37,   // (509 − 65) / 19 data rows
    cols: {
      itemNo:  { cx: 40 },                  // a. 28–53   (centered)
      nsn:     { x: 57,  maxWidth: 145 },   // b. 53–206
      desc:    { x: 210, maxWidth: 298 },   // c. 206–511
      // d. ARC 511–541 and e. CIIC 541–570 left blank (no source data)
      ui:      { cx: 582 },                 // f. 570–594 (centered)
      qtyAuth: { cx: 607 },                 // g. 594–620 (centered)
      // h. QUANTITY columns A–F (centers); A = the initial issue
      qtyCols: { A: 632, B: 656, C: 681, D: 705, E: 730, F: 754 },
    },
  },

  // Vertical recipient-signature stamp, drawn in QUANTITY column A (x 620–644),
  // a single "name | date | signature" line rotated 90° → reads bottom-to-top.
  // The line END (the drawn signature) lands in the cell beneath the last item;
  // the name/date trail downward into the empty column below.
  signature: {
    textX: 636,         // baseline x of the rotated (90°) text, centered in column A (cx 632)
    imageX: 641,        // anchor x of the rotated (90°) signature image → center 632 (632 + thickness/2)
    fontSize: 7,
    endGap: 8,          // gap below the last item where the line's END (top) sits
    sep: ' | ',         // separator between name | date | signature
    image: { length: 46, thickness: 18 }, // pre-rotation w×h of the drawn signature
  },

  fontSize: { header: 8, body: 7 },
} as const

/**
 * Generate a DA Form 2062 Hand Receipt PDF by overlaying data on the template.
 * Returns raw PDF bytes.
 */
export async function generateDA2062(params: DA2062Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')

  // Load the template PDF
  const templateUrl = new URL('../Data/DA2062-1.pdf', import.meta.url).href
  const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(templateBytes)

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const black = rgb(0, 0, 0)

  /** Draw text horizontally centered on `cx`. */
  const drawCentered = (page: import('pdf-lib').PDFPage, text: string, cx: number, y: number, size: number) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: cx - w / 2, y, size, font, color: black })
  }

  const totalPages = Math.max(1, Math.ceil(params.items.length / ITEMS_PER_PAGE))

  // Copy template page for overflow items (page 0 already exists)
  if (totalPages > 1) {
    const srcDoc = await PDFDocument.load(templateBytes)
    for (let p = 1; p < totalPages; p++) {
      const [copied] = await pdfDoc.copyPages(srcDoc, [0])
      pdfDoc.addPage(copied)
    }
  }

  // Embed the drawn signature once (reused only on the last page).
  const sigImage = params.signature?.image
    ? await pdfDoc.embedPng(params.signature.image)
    : null

  const pages = pdfDoc.getPages()

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pages[pageIdx]
    const startIdx = pageIdx * ITEMS_PER_PAGE
    const pageItems = params.items.slice(startIdx, startIdx + ITEMS_PER_PAGE)

    // ── Header fields ──
    page.drawText(params.fromHolder.displayName, {
      x: COORDS.from.x, y: COORDS.from.y,
      size: COORDS.fontSize.header, font, color: black,
    })
    page.drawText(params.toHolder.displayName, {
      x: COORDS.to.x, y: COORDS.to.y,
      size: COORDS.fontSize.header, font, color: black,
    })
    page.drawText(params.handReceiptNumber, {
      x: COORDS.hrId.x, y: COORDS.hrId.y,
      size: COORDS.fontSize.header, font, color: black,
    })

    // ── Item rows ──
    const { cols } = COORDS.table
    pageItems.forEach((item, i) => {
      const globalIdx = startIdx + i
      const y = COORDS.table.firstRowY - i * COORDS.table.rowHeight
      const sz = COORDS.fontSize.body

      // a. Item number
      drawCentered(page, String(globalIdx + 1), cols.itemNo.cx, y, sz)

      // b. Material number (NSN)
      if (item.nsn) {
        page.drawText(item.nsn, {
          x: cols.nsn.x, y, size: sz, font, color: black,
          maxWidth: cols.nsn.maxWidth,
        })
      }

      // c. Item description (nomenclature/name + serial number)
      const desc = item.nomenclature || item.name
      const fullDesc = item.serial_number
        ? `${desc} (S/N: ${item.serial_number})`
        : desc
      page.drawText(fullDesc, {
        x: cols.desc.x, y, size: sz, font, color: black,
        maxWidth: cols.desc.maxWidth,
      })

      // f. UI
      drawCentered(page, 'EA', cols.ui.cx, y, sz)

      // g. QTY AUTH + h. QUANTITY column A (signed-out count; defaults to 1)
      const qtyStr = String(item.quantity ?? 1)
      drawCentered(page, qtyStr, cols.qtyAuth.cx, y, sz)
      drawCentered(page, qtyStr, cols.qtyCols.A, y, sz)
    })

    // ── Recipient signature: vertical stamp in column A, ending beneath the last item ──
    // Only on the last page (where the final item sits). A single
    // "name | date | signature" line rotated 90° reads bottom-to-top, so its END
    // (the drawn signature) sits in the cell beneath the last item; the printed
    // name/date trail downward into the empty column below.
    const sig = params.signature
    if (sig && pageIdx === totalPages - 1 && pageItems.length > 0) {
      const S = COORDS.signature
      const lastItemY = COORDS.table.firstRowY - (pageItems.length - 1) * COORDS.table.rowHeight
      const endY = lastItemY - S.endGap   // top (END) of the line — the cell beneath the last item

      // "name | date | " — trailing separator when a drawn signature follows.
      const textLine = sigImage
        ? `${sig.printedName}${S.sep}${sig.date}${S.sep}`
        : `${sig.printedName}${S.sep}${sig.date}`
      const textWidth = font.widthOfTextAtSize(textLine, S.fontSize)
      const imageLen = sigImage ? S.image.length : 0
      const baseY = endY - (textWidth + imageLen)   // bottom anchor; line reads upward to endY

      // rotate 90° → reads bottom-to-top; text body advances in +y by its width.
      page.drawText(textLine, {
        x: S.textX, y: baseY, size: S.fontSize, font, color: black,
        rotate: degrees(90),
      })

      if (sigImage) {
        const { length, thickness } = S.image
        // rotate 90° image: occupies x∈[x−thickness, x], y∈[y, y+length].
        // Center the thickness across column A (center ≈ 632); the image caps the
        // line top, ending at endY directly above the text.
        page.drawImage(sigImage, {
          x: S.imageX,
          y: baseY + textWidth,
          width: length,
          height: thickness,
          rotate: degrees(90),
        })
      }
    }
  }

  return pdfDoc.save()
}

