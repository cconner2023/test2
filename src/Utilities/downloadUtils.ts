/**
 * Shared download utilities for browser-triggered file downloads.
 * Extracted from DD689Export.ts and DA2062Export.ts to eliminate duplication.
 */

/**
 * Trigger a browser download of a Blob object.
 * Must be called synchronously inside the user gesture — iOS Safari drops the
 * download (and navigator.share rejects) once transient activation is lost.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  // Touch devices (iOS standalone PWA ignores <a download> on blob URLs) → share
  // sheet, which offers "Save to Files". Desktop keeps the plain anchor download.
  const file = new File([blob], filename, { type: blob.type })
  if (window.matchMedia?.('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch((err: unknown) => {
      // AbortError = user dismissed the sheet; anything else → anchor fallback.
      if ((err as DOMException)?.name !== 'AbortError') anchorDownload(blob, filename)
    })
    return
  }
  anchorDownload(blob, filename)
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Deferred revoke — revoking synchronously cancels the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Trigger a browser download from raw PDF bytes.
 * Creates a Blob with application/pdf MIME type and triggers the download.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  downloadBlob(blob, filename)
}
