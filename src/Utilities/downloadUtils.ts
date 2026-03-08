/**
 * Shared download utilities for browser-triggered file downloads.
 * Extracted from DD689Export.ts and DA2062Export.ts to eliminate duplication.
 */

/**
 * Trigger a browser download of a Blob object.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Trigger a browser download from raw PDF bytes.
 * Creates a Blob with application/pdf MIME type and triggers the download.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  downloadBlob(blob, filename)
}
