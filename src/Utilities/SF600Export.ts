/**
 * SF600 (Chronological Record of Medical Care) PDF generation.
 *
 * Overlays note text onto SF600_1.pdf (first page with header/footer)
 * and SF600_2.pdf (continuation pages). Long notes overflow across
 * multiple continuation pages, following the DA2062Export pattern.
 */
export { downloadPdfBytes } from './downloadUtils'

export interface SF600Params {
  noteText: string
  date: string        // display date string (e.g. "18 MAR 2026")
  facilityName?: string
  signature?: string
}

// ── Layout constants (PDF points, origin = bottom-left, 72 pts/inch) ──
// Calibrated against SF600_1.pdf and SF600_2.pdf templates.
const PAGE1 = {
  dateCol:   { x: 32 },
  noteCol:   { x: 100, maxWidth: 470 },
  firstRowY: 595,
  lineHeight: 11.5,
  linesPerPage: 20,
  facilityName: { x: 100, y: 110 },
  fontSize: 8,
} as const

const PAGE2 = {
  dateCol:   { x: 32 },
  noteCol:   { x: 100, maxWidth: 470 },
  firstRowY: 700,
  lineHeight: 11.5,
  linesPerPage: 35,
  fontSize: 8,
} as const

/**
 * Word-wrap text to fit within maxWidth at a given font size.
 * Uses pdf-lib font metrics for accurate measurement.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        // If a single word exceeds maxWidth, push it anyway (will be clipped)
        current = word
      }
    }
    if (current) lines.push(current)
  }

  return lines
}

/**
 * Generate a filled SF600 PDF by overlaying note text on the templates.
 * Returns raw PDF bytes.
 */
export async function generateSF600(params: SF600Params): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  // Fetch both templates in parallel
  const [template1Url, template2Url] = [
    new URL('../Data/SF600_1.pdf', import.meta.url).href,
    new URL('../Data/SF600_2.pdf', import.meta.url).href,
  ]
  const [template1Bytes, template2Bytes] = await Promise.all([
    fetch(template1Url).then(r => r.arrayBuffer()),
    fetch(template2Url).then(r => r.arrayBuffer()),
  ])

  const pdfDoc = await PDFDocument.load(template1Bytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const black = rgb(0, 0, 0)

  // Wrap note text into visual lines
  const allLines = wrapText(params.noteText, font, PAGE1.fontSize, PAGE1.noteCol.maxWidth)

  // Paginate: first chunk → page 1, remaining → continuation pages
  const page1Lines = allLines.slice(0, PAGE1.linesPerPage)
  const overflowLines = allLines.slice(PAGE1.linesPerPage)
  const continuationPageCount = overflowLines.length > 0
    ? Math.ceil(overflowLines.length / PAGE2.linesPerPage)
    : 0

  // Add continuation pages from SF600_2 template
  if (continuationPageCount > 0) {
    const srcDoc = await PDFDocument.load(template2Bytes)
    for (let p = 0; p < continuationPageCount; p++) {
      const [copied] = await pdfDoc.copyPages(srcDoc, [0])
      pdfDoc.addPage(copied)
    }
  }

  const pages = pdfDoc.getPages()

  // ── Draw page 1 ──
  const p1 = pages[0]

  // Date in DATE column (first line only)
  if (params.date) {
    p1.drawText(params.date, {
      x: PAGE1.dateCol.x,
      y: PAGE1.firstRowY,
      size: PAGE1.fontSize,
      font,
      color: black,
    })
  }

  // Note lines on page 1
  page1Lines.forEach((line, i) => {
    if (!line && line !== '') return
    p1.drawText(line, {
      x: PAGE1.noteCol.x,
      y: PAGE1.firstRowY - i * PAGE1.lineHeight,
      size: PAGE1.fontSize,
      font,
      color: black,
    })
  })

  // Facility name in footer area
  if (params.facilityName) {
    p1.drawText(params.facilityName, {
      x: PAGE1.facilityName.x,
      y: PAGE1.facilityName.y,
      size: PAGE1.fontSize,
      font,
      color: black,
    })
  }

  // ── Draw continuation pages ──
  for (let p = 0; p < continuationPageCount; p++) {
    const page = pages[p + 1]
    const startLine = p * PAGE2.linesPerPage
    const chunk = overflowLines.slice(startLine, startLine + PAGE2.linesPerPage)

    chunk.forEach((line, i) => {
      if (!line && line !== '') return
      page.drawText(line, {
        x: PAGE2.noteCol.x,
        y: PAGE2.firstRowY - i * PAGE2.lineHeight,
        size: PAGE2.fontSize,
        font,
        color: black,
      })
    })
  }

  return pdfDoc.save()
}
