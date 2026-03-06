/**
 * DA Form 2062 (Hand Receipt) PDF generation.
 *
 * Loads the DA2062-1.pdf template and overlays text at mapped coordinates,
 * following the same pattern as DD689Export.
 *
 * Max 15 items per page; overflow items get additional template pages.
 */
import type { PropertyItem, HolderInfo } from '../Types/PropertyTypes'

export interface DA2062Params {
  items: PropertyItem[]
  fromHolder: HolderInfo
  toHolder: HolderInfo
  handReceiptNumber: string
  date: string   // display date string
}

const ITEMS_PER_PAGE = 15

// ── Layout constants (PDF points, origin = bottom-left) ──────
// Adjust these to calibrate placement on the DA2062-1.pdf template.
const COORDS = {
  // Header field values (positioned after their printed labels)
  from: { x: 310, y: 762 },
  to:   { x: 478, y: 762 },
  hrId: { x: 520, y: 762 },

  // Item table
  table: {
    firstRowY: 685,   // text baseline of the first data row
    rowHeight: 32,     // vertical spacing between rows
    cols: {
      itemNo: { x: 22 },
      nsn:    { x: 52,  maxWidth: 145 },
      desc:   { x: 200, maxWidth: 205 },
      ui:     { x: 470 },
      qtyAuth: { x: 497 },
      qtyA:   { x: 522 },           // QUANTITY column A (on-hand)
    },
  },

  fontSize: { header: 8, body: 7 },
} as const

/**
 * Generate a DA Form 2062 Hand Receipt PDF by overlaying data on the template.
 * Returns raw PDF bytes.
 */
export async function generateDA2062(params: DA2062Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  // Load the template PDF
  const templateUrl = new URL('../Data/DA2062-1.pdf', import.meta.url).href
  const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(templateBytes)

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const black = rgb(0, 0, 0)

  const totalPages = Math.max(1, Math.ceil(params.items.length / ITEMS_PER_PAGE))

  // Copy template page for overflow items (page 0 already exists)
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
    pageItems.forEach((item, i) => {
      const globalIdx = startIdx + i
      const y = COORDS.table.firstRowY - i * COORDS.table.rowHeight
      const sz = COORDS.fontSize.body

      // Item number
      page.drawText(String(globalIdx + 1), {
        x: COORDS.table.cols.itemNo.x, y, size: sz, font, color: black,
      })

      // Material number (NSN)
      if (item.nsn) {
        page.drawText(item.nsn, {
          x: COORDS.table.cols.nsn.x, y, size: sz, font, color: black,
          maxWidth: COORDS.table.cols.nsn.maxWidth,
        })
      }

      // Item description (nomenclature/name + serial number)
      const desc = item.nomenclature || item.name
      const fullDesc = item.serial_number
        ? `${desc} (S/N: ${item.serial_number})`
        : desc
      page.drawText(fullDesc, {
        x: COORDS.table.cols.desc.x, y, size: sz, font, color: black,
        maxWidth: COORDS.table.cols.desc.maxWidth,
      })

      // UI
      page.drawText('EA', {
        x: COORDS.table.cols.ui.x, y, size: sz, font, color: black,
      })

      // QTY AUTH
      page.drawText('1', {
        x: COORDS.table.cols.qtyAuth.x, y, size: sz, font, color: black,
      })

      // QUANTITY column A (on-hand)
      page.drawText('1', {
        x: COORDS.table.cols.qtyA.x, y, size: sz, font, color: black,
      })
    })
  }

  return pdfDoc.save()
}

/**
 * Trigger a browser download of raw PDF bytes.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
