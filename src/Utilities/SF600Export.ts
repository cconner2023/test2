/**
 * SF600 (Chronological Record of Medical Care) PDF generation.
 * Overlays note text onto SF600_1.pdf (first page with header/footer)
 * and SF600_2.pdf (continuation pages)
 */
export { downloadPdfBytes } from './downloadUtils'

export interface SF600Params {
  noteText: string
  date: string        // display date string (e.g. "18 MAR 2026")
  signatureName?: string  // e.g. "CONNER CHRISTOPHER D PA-C, CPT, USA"
}

// ── Layout constants (PDF points, origin = bottom-left, 72 pts/inch) ──
// Tune anchor Y and line heights here; row arrays are computed below.

const PAGE1_ANCHOR_Y = 603     // first row baseline
const PAGE1_FIRST_GAP = 25    // row 0 → row 1 (thinner header row)
const PAGE1_LINE_HEIGHT = 24 // row 1+ spacing
const PAGE1_ROWS = 18

const PAGE2_ANCHOR_Y = 720     // first row baseline
const PAGE2_LINE_HEIGHT = 24 // uniform spacing
const PAGE2_ROWS = 25

function buildRowPositions(anchor: number, rows: number, lineHeight: number, firstGap?: number): number[] {
  const positions = [anchor]
  for (let i = 1; i < rows; i++) {
    const gap = i === 1 && firstGap !== undefined ? firstGap : lineHeight
    positions.push(positions[i - 1] - gap)
  }
  return positions
}

const PAGE1_ROW_Y = buildRowPositions(PAGE1_ANCHOR_Y, PAGE1_ROWS, PAGE1_LINE_HEIGHT, PAGE1_FIRST_GAP)
const PAGE2_ROW_Y = buildRowPositions(PAGE2_ANCHOR_Y, PAGE2_ROWS, PAGE2_LINE_HEIGHT)

const LAYOUT = {
  dateCol: { x: 25 },
  noteCol: { x: 125, maxWidth: 470 },
  page2NoteX: 115,  // adjust independently from page 1
  fontSize: 10,
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
  const pdfLib = await import('pdf-lib')
  const { PDFDocument, StandardFonts, rgb } = pdfLib

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
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0, 0, 0)

  // Lines that should render in bold
  const BOLD_HEADERS = new Set(['SUBJECTIVE:', 'OBJECTIVE:', 'ASSESSMENT:', 'PLAN:'])
  const isBoldLine = (line: string) => BOLD_HEADERS.has(line.trim())

  // Strip existing "Signed:" line — SF600 uses a signature field instead
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  let noteBody = params.noteText.replace(/\n?Signed:.*$/m, '').trimEnd()

  // Wrap note text into visual lines, then append signature row marker
  const SIG_LINE = '__SIG_LINE__'
  const allLines = wrapText(noteBody, font, LAYOUT.fontSize, LAYOUT.noteCol.maxWidth)
  if (params.signatureName) {
    allLines.push(SIG_LINE)
  }

  // Paginate: first chunk → page 1, remaining → continuation pages
  const page1Lines = allLines.slice(0, PAGE1_ROW_Y.length)
  const overflowLines = allLines.slice(PAGE1_ROW_Y.length)
  const continuationPageCount = overflowLines.length > 0
    ? Math.ceil(overflowLines.length / PAGE2_ROW_Y.length)
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

  // Date in DATE column (first row)
  if (params.date) {
    p1.drawText(params.date, {
      x: LAYOUT.dateCol.x,
      y: PAGE1_ROW_Y[0],
      size: LAYOUT.fontSize,
      font,
      color: black,
    })
  }

  // Helper: draw a text line or the signature row
  const drawLine = (page: ReturnType<typeof pdfDoc.getPages>[0], line: string, x: number, y: number, rowHeight: number) => {
    if (line === SIG_LINE) {
      // Render: NAME / [signature field] / DATE  — all on one row
      const nameText = params.signatureName!
      const nameWidth = font.widthOfTextAtSize(nameText, LAYOUT.fontSize)
      const dateText = dateStamp
      const dateWidth = font.widthOfTextAtSize(dateText, LAYOUT.fontSize)
      const slashWidth = font.widthOfTextAtSize(' / ', LAYOUT.fontSize)
      const padding = 4

      // Name on the left
      page.drawText(nameText, { x, y, size: LAYOUT.fontSize, font, color: black })

      // First slash
      const slash1X = x + nameWidth
      page.drawText(' / ', { x: slash1X, y, size: LAYOUT.fontSize, font, color: black })

      // Signature field in the middle
      const sigX = slash1X + slashWidth
      const sigEndX = x + LAYOUT.noteCol.maxWidth - dateWidth - slashWidth
      const sigWidth = Math.max(sigEndX - sigX, 60)
      const sigFieldDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [sigX, y - padding, sigX + sigWidth, y + rowHeight - padding],
        T: pdfLib.PDFHexString.fromText('DigitalSignature'),
        F: 4,
        P: page.ref,
      })
      const sigFieldRef = pdfDoc.context.register(sigFieldDict)

      const annots = page.node.Annots()
      if (annots) {
        annots.push(sigFieldRef)
      } else {
        page.node.set(pdfLib.PDFName.of('Annots'), pdfDoc.context.obj([sigFieldRef]))
      }

      let acroForm = pdfDoc.catalog.lookup(pdfLib.PDFName.of('AcroForm')) as any
      if (!acroForm) {
        acroForm = pdfDoc.context.obj({ Fields: [] })
        pdfDoc.catalog.set(pdfLib.PDFName.of('AcroForm'), acroForm)
      }
      const fields = acroForm.lookup(pdfLib.PDFName.of('Fields'))
      if (fields && typeof fields.push === 'function') {
        fields.push(sigFieldRef)
      }

      // Second slash + date on the right
      const slash2X = sigX + sigWidth
      page.drawText(' / ', { x: slash2X, y, size: LAYOUT.fontSize, font, color: black })
      page.drawText(dateText, { x: slash2X + slashWidth, y, size: LAYOUT.fontSize, font, color: black })
      return
    }

    if (!line && line !== '') return
    page.drawText(line, {
      x,
      y,
      size: LAYOUT.fontSize,
      font: isBoldLine(line) ? boldFont : font,
      color: black,
    })
  }

  // Note lines on page 1 — each line placed at its exact row position
  page1Lines.forEach((line, i) => {
    drawLine(p1, line, LAYOUT.noteCol.x, PAGE1_ROW_Y[i], i === 0 ? PAGE1_FIRST_GAP : PAGE1_LINE_HEIGHT)
  })

  // ── Draw continuation pages ──
  for (let p = 0; p < continuationPageCount; p++) {
    const page = pages[p + 1]
    const startLine = p * PAGE2_ROW_Y.length
    const chunk = overflowLines.slice(startLine, startLine + PAGE2_ROW_Y.length)

    chunk.forEach((line, i) => {
      drawLine(page, line, LAYOUT.page2NoteX, PAGE2_ROW_Y[i], PAGE2_LINE_HEIGHT)
    })
  }

  return pdfDoc.save()
}
