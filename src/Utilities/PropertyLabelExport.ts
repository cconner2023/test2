/**
 * Property item label-sheet PDF generation.
 *
 * Renders a grid of printable labels — each = a Data Matrix (encoding the
 * item's opaque id via itemLabelCodec) plus item name + NSN. Output is a
 * Letter-size PDF the user prints onto label stock; it is a receipt of the
 * property book, not a stored file (process-primacy / no-file-storage).
 *
 * Geometry is calibration data — tweak a preset (or pass a custom one) to
 * match real label stock. Two presets ship: standard address (Avery 5160,
 * 1" x 2-5/8") and file-folder (Avery 5066, 2/3" x 3-7/16").
 */
import { renderBarcodeToCanvas } from './barcodeCodec'
import { encodeItemTag } from './itemLabelCodec'
export { downloadPdfBytes } from './downloadUtils'

const PT = 72 // PDF points per inch

/** A printed label's worth of data. */
export interface LabelItem {
  id: string
  name: string
  nsn: string | null
}

/**
 * Grid geometry in PDF points (origin bottom-left). All distances are knobs
 * for calibrating against physical label stock.
 */
export interface LabelGeometry {
  pageW: number
  pageH: number
  marginLeft: number // left edge of column 0 from the page's left edge
  marginTop: number  // top edge of row 0 from the page's TOP edge
  labelW: number
  labelH: number
  colPitch: number   // left-edge to left-edge between columns
  rowPitch: number   // top-edge to top-edge between rows
  cols: number
  rows: number
}

export type LabelPresetKey = 'standard' | 'fileFolder'

/** Avery 5160 — 1" x 2-5/8", 30/sheet (3 x 10). */
const STANDARD: LabelGeometry = {
  pageW: 8.5 * PT, pageH: 11 * PT,
  marginLeft: 0.1875 * PT, marginTop: 0.5 * PT,
  labelW: 2.625 * PT, labelH: 1 * PT,
  colPitch: 2.75 * PT, rowPitch: 1 * PT,
  cols: 3, rows: 10,
}

/** Avery 5066 — 2/3" x 3-7/16", 30/sheet (2 x 15). */
const FILE_FOLDER: LabelGeometry = {
  pageW: 8.5 * PT, pageH: 11 * PT,
  marginLeft: 0.3 * PT, marginTop: 0.5 * PT,
  labelW: 3.4375 * PT, labelH: 0.6667 * PT,
  colPitch: 3.65 * PT, rowPitch: 0.6667 * PT,
  cols: 2, rows: 15,
}

export const LABEL_PRESETS: Record<LabelPresetKey, LabelGeometry> = {
  standard: STANDARD,
  fileFolder: FILE_FOLDER,
}

export interface LabelSheetParams {
  items: LabelItem[]
  /** Named preset or a fully custom geometry. */
  geometry: LabelPresetKey | LabelGeometry
  /** Skip this many cells on the first page (reuse partially-used stock). */
  startOffset?: number
}

/** Render an item's Data Matrix to a base64 PNG data URL at print resolution. */
function renderTagPng(itemId: string): string {
  const canvas = document.createElement('canvas')
  renderBarcodeToCanvas(canvas, encodeItemTag(itemId), { scale: 6, padding: 0 })
  return canvas.toDataURL('image/png')
}

/** Trim text to fit `maxWidth` at `size`, appending an ellipsis when clipped. */
function fit(font: any, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let s = text
  while (s.length > 1 && font.widthOfTextAtSize(s + '…', size) > maxWidth) {
    s = s.slice(0, -1)
  }
  return s + '…'
}

/** Generate a label-sheet PDF. Returns raw PDF bytes. */
export async function generateLabelSheet(params: LabelSheetParams): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const g = typeof params.geometry === 'string' ? LABEL_PRESETS[params.geometry] : params.geometry
  const perPage = g.cols * g.rows
  const black = rgb(0, 0, 0)
  const gray = rgb(0.35, 0.35, 0.35)

  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Cache embedded Data Matrix images by item id (an item could repeat).
  const imgCache = new Map<string, any>()
  async function imgFor(itemId: string) {
    let img = imgCache.get(itemId)
    if (!img) {
      img = await pdfDoc.embedPng(renderTagPng(itemId))
      imgCache.set(itemId, img)
    }
    return img
  }

  const pad = 4
  // startOffset only skips cells on the FIRST sheet, so clamp it within a page.
  const offset = Math.min(perPage - 1, Math.max(0, params.startOffset ?? 0))

  // Size text relative to label height so both presets stay legible.
  const nameSize = Math.min(9, Math.max(6, g.labelH * 0.16))
  const nsnSize = Math.max(5.5, nameSize - 1.5)

  let page = pdfDoc.addPage([g.pageW, g.pageH])
  for (let i = 0; i < params.items.length; i++) {
    const cellIndex = offset + i
    const pageNo = Math.floor(cellIndex / perPage)
    if (pageNo > 0 && cellIndex % perPage === 0) {
      page = pdfDoc.addPage([g.pageW, g.pageH])
    }
    const slot = cellIndex % perPage
    const col = slot % g.cols
    const row = Math.floor(slot / g.cols)

    const cellLeft = g.marginLeft + col * g.colPitch
    const cellTopY = g.pageH - (g.marginTop + row * g.rowPitch) // top edge in PDF coords

    const item = params.items[i]
    const dmSize = g.labelH - pad * 2
    const img = await imgFor(item.id)

    // Data Matrix on the left, vertically inset by pad.
    page.drawImage(img, {
      x: cellLeft + pad,
      y: cellTopY - pad - dmSize,
      width: dmSize,
      height: dmSize,
    })

    // Text block to the right of the symbol.
    const textX = cellLeft + pad * 2 + dmSize
    const textW = g.labelW - (textX - cellLeft) - pad
    page.drawText(fit(fontBold, item.name, nameSize, textW), {
      x: textX,
      y: cellTopY - pad - nameSize,
      size: nameSize,
      font: fontBold,
      color: black,
    })
    if (item.nsn) {
      page.drawText(fit(fontReg, `NSN ${item.nsn}`, nsnSize, textW), {
        x: textX,
        y: cellTopY - pad - nameSize - 2 - nsnSize,
        size: nsnSize,
        font: fontReg,
        color: gray,
      })
    }
  }

  return pdfDoc.save()
}
