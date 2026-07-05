import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { HudLoader } from './HudLoader'
import { PdfPreviewFallback } from './PdfPreviewFallback'

// Resolve pdf.js's worker via a URL relative to the bundled mjs — same idiom as
// the geopdf import worker. The worker loads from our own origin, so it satisfies
// the CSP `worker-src 'self' blob:`; nothing here uses <object>/<embed>, so the
// build-time `object-src 'none'` (which broke the old native PDF preview on every
// platform) is irrelevant. This renders pages to <canvas>, which works everywhere
// including iOS Safari (our capability floor).
;(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PdfCanvasViewProps {
  /** Raw PDF bytes. Copied before decode (pdf.js detaches the buffer), so the
   *  caller's `bytes` stay intact for the Save/Download path. */
  bytes: Uint8Array
  /** Extra classes for the scroll wrapper (e.g. a background fill for body-mode). */
  className?: string
}

/**
 * PdfCanvasView — renders a generated PDF to a scrollable column of page canvases
 * using the already-bundled pdfjs-dist. Replaces the native `<object data=…pdf>`
 * embed, which the build CSP (`object-src 'none'`) blocked on every deployed
 * surface AND which iOS Safari won't inline-render regardless. Owns its own
 * loading (HUD) and error (PdfPreviewFallback) states. Shared by the three PDF
 * preview hosts: PdfPreviewModal, Da2062Preview, Da2062PdfView.
 *
 * Layout: the root is a `overflow-y-auto` scroll wrapper so it works both as
 * bounded body content (Da2062PdfView fills h-full) and nested inside a
 * PreviewOverlay's own scroll area (double-scroll is inert — pages fit the width
 * and the inner column rarely overflows the overlay's own max-height first).
 */
export function PdfCanvasView({ bytes, className = '' }: PdfCanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  // Width we last rendered pages at — a ResizeObserver bumps it on meaningful
  // changes (orientation flip / pane resize) so pages re-raster crisp.
  const [renderWidth, setRenderWidth] = useState(0)

  // Track the container width; only commit changes ≥ 4px to avoid render churn.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const commit = () => {
      const w = Math.floor(host.clientWidth)
      setRenderWidth((prev) => (Math.abs(w - prev) >= 4 ? w : prev))
    }
    commit()
    const ro = new ResizeObserver(commit)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const pagesEl = pagesRef.current
    if (!pagesEl || renderWidth <= 0) return

    let cancelled = false
    let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null = null
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null

    const run = async () => {
      setStatus('loading')
      try {
        // slice() — getDocument detaches the ArrayBuffer; the caller reuses `bytes`.
        doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
        if (cancelled) return
        pagesEl.replaceChildren()
        const dpr = window.devicePixelRatio || 1
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          if (cancelled) return
          const unscaled = page.getViewport({ scale: 1 })
          const scale = renderWidth / unscaled.width
          const viewport = page.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.background = '#fff'
          canvas.className = 'block rounded-lg shadow-sm'
          pagesEl.appendChild(canvas)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          renderTask = page.render({ canvasContext: ctx, viewport, canvas })
          await renderTask.promise
          if (cancelled) return
        }
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    run()

    return () => {
      cancelled = true
      try { renderTask?.cancel?.() } catch { /* already settled */ }
      doc?.destroy?.()
    }
  }, [bytes, renderWidth])

  return (
    <div ref={hostRef} className={`relative w-full h-full overflow-y-auto overscroll-contain ${className}`}>
      {status === 'error' ? (
        <PdfPreviewFallback />
      ) : (
        <>
          <div ref={pagesRef} className="flex flex-col gap-3 p-3" />
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <HudLoader size={88} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
