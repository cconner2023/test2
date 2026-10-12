/**
 * pdf-lib StandardFonts (Helvetica) only encode WinAnsi — any other glyph
 * (♀, →, emoji…) throws inside widthOfTextAtSize / drawText and kills the export.
 * Run every user-sourced string through toWinAnsi before measuring or drawing.
 */

interface MeasurableFont {
  widthOfTextAtSize: (text: string, size: number) => number
}

// Readable stand-ins for symbols medics actually type; anything else unencodable → '?'.
const REPLACEMENTS: Record<string, string> = {
  '♀': 'F', '♂': 'M',
  '→': '->', '←': '<-', '↑': '^', '↓': 'v', '↔': '<->',
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~',
  '✓': 'x', '✔': 'x', '✗': 'x', '✘': 'x',
  ' ': ' ', '\t': ' ', '\r': '',
}

// Combining marks / format chars (variation selectors, ZWJ) carry no glyph — drop them.
const INVISIBLE = /[\p{M}\p{Cf}]/u

const cache = new WeakMap<MeasurableFont, Map<string, boolean>>()

function encodable(ch: string, font: MeasurableFont): boolean {
  let known = cache.get(font)
  if (!known) cache.set(font, (known = new Map()))
  let ok = known.get(ch)
  if (ok === undefined) {
    try { font.widthOfTextAtSize(ch, 1); ok = true } catch { ok = false }
    known.set(ch, ok)
  }
  return ok
}

/** Replace characters the font can't encode. Newlines are preserved. */
export function toWinAnsi(text: string, font: MeasurableFont): string {
  let out = ''
  for (const ch of text) {
    if (ch === '\n' || encodable(ch, font)) { out += ch; continue }
    if (INVISIBLE.test(ch)) continue
    const sub = REPLACEMENTS[ch]
    out += sub !== undefined && [...sub].every(c => encodable(c, font)) ? sub : '?'
  }
  return out
}
