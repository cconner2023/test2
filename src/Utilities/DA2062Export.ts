/**
 * DA Form 2062 (Hand Receipt) PDF generation.
 *
 * Programmatically builds the form using pdf-lib — no template needed
 * since the number of items is variable and requires auto-pagination.
 */
import type { PropertyItem, HolderInfo } from '../Types/PropertyTypes'

export interface DA2062Params {
  items: PropertyItem[]
  fromHolder: HolderInfo
  toHolder: HolderInfo
  handReceiptNumber: string
  date: string   // display date string
}

// Page dimensions (8.5" x 11" at 72 DPI)
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 36
const CONTENT_W = PAGE_W - 2 * MARGIN

// Table column widths
const COL = {
  ITEM_NO: 30,
  NSN: 100,
  DESC: 220,
  UI: 30,
  AUTH: 30,
  ON_HAND: 30,
  COND: 30,
  SERIAL: CONTENT_W - 30 - 100 - 220 - 30 - 30 - 30 - 30, // remainder
}

const ROW_HEIGHT = 14
const HEADER_BLOCK_HEIGHT = 90
const TABLE_HEADER_HEIGHT = 24
const SIGNATURE_BLOCK_HEIGHT = 80

/**
 * Generate a DA Form 2062 Hand Receipt PDF.
 * Returns raw PDF bytes.
 */
export async function generateDA2062(params: DA2062Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const fontSize = 8
  const headerFontSize = 10
  const titleFontSize = 12

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let currentY = PAGE_H - MARGIN

  function drawHeaderBlock() {
    const y = currentY

    // Title
    page.drawText('HAND RECEIPT / ANNEX NUMBER', {
      x: MARGIN,
      y: y - 14,
      size: titleFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    page.drawText('DA Form 2062', {
      x: PAGE_W - MARGIN - fontBold.widthOfTextAtSize('DA Form 2062', headerFontSize),
      y: y - 14,
      size: headerFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // FROM
    page.drawText('FROM:', {
      x: MARGIN,
      y: y - 34,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    page.drawText(params.fromHolder.displayName, {
      x: MARGIN + 40,
      y: y - 34,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })

    // TO
    page.drawText('TO:', {
      x: MARGIN,
      y: y - 48,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    page.drawText(params.toHolder.displayName, {
      x: MARGIN + 40,
      y: y - 48,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })

    // Hand receipt number + date
    page.drawText(`HR#: ${params.handReceiptNumber}`, {
      x: PAGE_W / 2,
      y: y - 34,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
    page.drawText(`Date: ${params.date}`, {
      x: PAGE_W / 2,
      y: y - 48,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })

    // Separator line
    page.drawLine({
      start: { x: MARGIN, y: y - 60 },
      end: { x: PAGE_W - MARGIN, y: y - 60 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    currentY = y - 70
  }

  function drawTableHeader() {
    const y = currentY
    const headers = ['Item#', 'NSN', 'Description / Nomenclature', 'UI', 'Auth', 'OH', 'Cond', 'Serial Number']
    const widths = [COL.ITEM_NO, COL.NSN, COL.DESC, COL.UI, COL.AUTH, COL.ON_HAND, COL.COND, COL.SERIAL]

    // Background
    page.drawRectangle({
      x: MARGIN,
      y: y - TABLE_HEADER_HEIGHT,
      width: CONTENT_W,
      height: TABLE_HEADER_HEIGHT,
      color: rgb(0.9, 0.9, 0.9),
    })

    let xOffset = MARGIN + 2
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], {
        x: xOffset,
        y: y - TABLE_HEADER_HEIGHT + 8,
        size: 7,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      xOffset += widths[i]
    }

    // Bottom line
    page.drawLine({
      start: { x: MARGIN, y: y - TABLE_HEADER_HEIGHT },
      end: { x: PAGE_W - MARGIN, y: y - TABLE_HEADER_HEIGHT },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    currentY = y - TABLE_HEADER_HEIGHT
  }

  function ensureSpace(needed: number): void {
    if (currentY - needed < MARGIN + SIGNATURE_BLOCK_HEIGHT) {
      // Start new page
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      currentY = PAGE_H - MARGIN
      drawTableHeader()
    }
  }

  function truncateText(text: string, maxWidth: number, f: typeof font): string {
    if (f.widthOfTextAtSize(text, fontSize) <= maxWidth) return text
    let truncated = text
    while (truncated.length > 0 && f.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return truncated + '...'
  }

  function drawItemRow(item: PropertyItem, index: number) {
    ensureSpace(ROW_HEIGHT)

    const y = currentY
    let xOffset = MARGIN + 2

    // Alternate row background
    if (index % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_HEIGHT,
        width: CONTENT_W,
        height: ROW_HEIGHT,
        color: rgb(0.97, 0.97, 0.97),
      })
    }

    const rowY = y - ROW_HEIGHT + 4

    // Item #
    page.drawText(String(index + 1), { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.ITEM_NO

    // NSN
    page.drawText(truncateText(item.nsn || '', COL.NSN - 4, font), { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.NSN

    // Description
    const desc = item.nomenclature || item.name
    page.drawText(truncateText(desc, COL.DESC - 4, font), { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.DESC

    // UI
    page.drawText('EA', { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.UI

    // Auth
    page.drawText('1', { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.AUTH

    // On Hand
    page.drawText('1', { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.ON_HAND

    // Condition
    const condMap: Record<string, string> = { serviceable: 'SVC', unserviceable: 'UNSVC', missing: 'MIS', damaged: 'DMG' }
    page.drawText(condMap[item.condition_code] || '', { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    xOffset += COL.COND

    // Serial
    page.drawText(truncateText(item.serial_number || '', COL.SERIAL - 4, font), { x: xOffset, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })

    currentY = y - ROW_HEIGHT
  }

  function drawSignatureBlock() {
    const y = currentY - 20

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    // FROM signature
    page.drawText('FROM (Signature):', {
      x: MARGIN,
      y: y - 30,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    page.drawLine({
      start: { x: MARGIN + 100, y: y - 32 },
      end: { x: PAGE_W / 2 - 20, y: y - 32 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    // TO signature
    page.drawText('TO (Signature):', {
      x: PAGE_W / 2,
      y: y - 30,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    page.drawLine({
      start: { x: PAGE_W / 2 + 90, y: y - 32 },
      end: { x: PAGE_W - MARGIN, y: y - 32 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    // Date lines
    page.drawText('Date:', {
      x: MARGIN,
      y: y - 50,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
    page.drawLine({
      start: { x: MARGIN + 30, y: y - 52 },
      end: { x: PAGE_W / 2 - 20, y: y - 52 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    page.drawText('Date:', {
      x: PAGE_W / 2,
      y: y - 50,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
    page.drawLine({
      start: { x: PAGE_W / 2 + 30, y: y - 52 },
      end: { x: PAGE_W - MARGIN, y: y - 52 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })
  }

  // ── Build the PDF ──────────────────────────────────────────

  drawHeaderBlock()
  drawTableHeader()

  params.items.forEach((item, i) => drawItemRow(item, i))

  drawSignatureBlock()

  return pdfDoc.save()
}

/**
 * Trigger a browser download of raw PDF bytes.
 * Reuses the pattern from DD689Export.
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
