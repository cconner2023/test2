/**
 * CSV formula-injection guard. Exported cells carry other users' text (event titles,
 * item names, display names), and a spreadsheet runs any cell that starts with
 * = + - @ (or a tab/CR before one) as a formula. Such cells get a leading apostrophe,
 * which Excel/Sheets treat as "text" and hide. Plain negative numbers are left alone.
 *
 * The app re-imports its own calendar, property and note-block CSVs, so those parsers
 * call restoreCsvFormula to drop the apostrophe again. A value the user typed with a
 * real leading apostrophe before one of these characters loses it on round trip.
 */
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^-\d+(\.\d+)?$/

export function neutralizeCsvFormula(value: string): string {
  return FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value
}

export function restoreCsvFormula(value: string): string {
  return value.length > 1 && value[0] === "'" && FORMULA_START.test(value.slice(1)) && !PLAIN_NUMBER.test(value.slice(1))
    ? value.slice(1)
    : value
}
