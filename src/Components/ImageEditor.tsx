import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, Crop, ZoomIn } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { PillButton } from './HeaderPill'
import { ActionButton } from './ActionButton'
import { fileToCanvas, cropToFile, type RasterImage } from '../lib/imageEdit'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ImageEditor')

/**
 * ImageEditor — a lightweight "review before send" step for chat photos. The
 * composer used to feed a picked/pasted/captured image straight into sendImage
 * (optimistic AND final — no way to fix it). Taking a page from the PMCS /
 * dispatch DocScanner's crop screen, this drops one overlay between pick and
 * send where the user can ZOOM (pinch / wheel / drag-to-pan, purely a viewing
 * aid) and CROP (drag the four corner handles). On confirm it renders the crop
 * to a fresh JPEG File and hands it back; the caller then runs the unchanged
 * sendImage pipeline (which resizes/thumbnails it). Cancel throws the pick away.
 *
 * All 2D-canvas (lib/imageEdit + lib/docScan) so it works in the pure PWA on the
 * iOS Safari floor. Built on PreviewOverlay (like DocScanner) and scoped to the
 * conversation container so it stacks above the chat, inside the messages drawer.
 */

interface ImageEditorProps {
  /** The picked/pasted/captured image awaiting review; null keeps the overlay closed. */
  file: File | null
  onCancel: () => void
  /** Receives the cropped JPEG File (caller sends it, then clears `file`). */
  onConfirm: (edited: File) => void
  /** Scopes the overlay to the conversation container (matches SharedObjectPicker). */
  containerRef?: React.RefObject<HTMLElement | null>
}

/** Crop rectangle as normalised edges (0..1) on the source image. */
interface Rect { x0: number; y0: number; x1: number; y1: number }

const FULL: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }
const MIN_SIZE = 0.08 // smallest crop edge, so a corner can't collapse the box
const MAX_ZOOM = 6

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function ImageEditor({ file, onCancel, onConfirm, containerRef }: ImageEditorProps) {
  const [src, setSrc] = useState<RasterImage | null>(null)
  const [srcUrl, setSrcUrl] = useState<string>('')
  const [rect, setRect] = useState<Rect>(FULL)
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Decode the picked file when it changes; reset the crop + zoom each time.
  useEffect(() => {
    if (!file) { setSrc(null); setSrcUrl(''); return }
    let cancelled = false
    setBusy(true); setError(null); setRect(FULL); setView({ scale: 1, tx: 0, ty: 0 })
    ;(async () => {
      try {
        const raster = await fileToCanvas(file)
        if (cancelled) return
        setSrc(raster)
        setSrcUrl(raster.canvas.toDataURL('image/jpeg', 0.85))
      } catch (err) {
        if (cancelled) return
        logger.warn('image decode failed:', err)
        setError('Could not open that image.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [file])

  const handleConfirm = useCallback(() => {
    if (!src || busy) return
    setBusy(true)
    try {
      const out = cropToFile(
        src,
        { x: rect.x0, y: rect.y0, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 },
        { name: file?.name },
      )
      onConfirm(out)
    } catch (err) {
      logger.warn('crop failed:', err)
      setError('Could not prepare that image — try again.')
      setBusy(false)
    }
  }, [src, busy, rect, file, onConfirm])

  const resetEdits = useCallback(() => {
    setRect(FULL)
    setView({ scale: 1, tx: 0, ty: 0 })
  }, [])

  return (
    <PreviewOverlay
      isOpen={!!file}
      onClose={onCancel}
      anchorRect={null}
      containerRef={containerRef}
      title="Edit photo"
      maxWidth={420}
      previewMaxHeight="64dvh"
      preview={
        <CropStage
          srcUrl={srcUrl}
          rect={rect}
          onRect={setRect}
          view={view}
          onView={setView}
          busy={busy && !src}
          error={error}
        />
      }
      footer={
        <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
          <ActionButton icon={Crop} label="Reset" variant={src ? 'default' : 'disabled'} onClick={resetEdits} />
        </div>
      }
      rightFooter={
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          <PillButton
            icon={Check}
            iconSize={16}
            accent="success"
            disabled={!src || busy}
            onClick={handleConfirm}
            label="Send photo"
          />
        </div>
      }
    />
  )
}

// ── Crop stage ────────────────────────────────────────────────────────────────

type PMode = 'none' | 'corner' | 'pan' | 'pinch'

function CropStage({
  srcUrl, rect, onRect, view, onView, busy, error,
}: {
  srcUrl: string
  rect: Rect
  onRect: (r: Rect) => void
  view: { scale: number; tx: number; ty: number }
  onView: (v: { scale: number; tx: number; ty: number }) => void
  busy: boolean
  error: string | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  // Live gesture snapshot (refs so pointer handlers don't need re-binding).
  const g = useRef({
    mode: 'none' as PMode,
    corner: -1,
    startDist: 0,
    startScale: 1,
    startTx: 0, startTy: 0,
    startMidX: 0, startMidY: 0,
  })
  const rectRef = useRef(rect); rectRef.current = rect
  const viewRef = useRef(view); viewRef.current = view

  // The transformed element whose on-screen rect maps 1:1 to normalised image
  // coords (the <img> fills it, so scaling both keeps the ratio exact).
  const imgRectNorm = (clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el) return { nx: 0, ny: 0 }
    const r = el.getBoundingClientRect()
    return {
      nx: clamp((clientX - r.left) / r.width, 0, 1),
      ny: clamp((clientY - r.top) / r.height, 0, 1),
    }
  }

  const clampPan = useCallback((scale: number, tx: number, ty: number) => {
    const el = wrapRef.current
    if (!el) return { tx, ty }
    // Allow panning up to half the overflow in each axis.
    const w = el.offsetWidth
    const h = el.offsetHeight
    const maxX = Math.max(0, ((scale - 1) * w) / 2)
    const maxY = Math.max(0, ((scale - 1) * h) / 2)
    return { tx: clamp(tx, -maxX, maxX), ty: clamp(ty, -maxY, maxY) }
  }, [])

  const setCorner = (idx: number, nx: number, ny: number) => {
    const r = { ...rectRef.current }
    // idx: 0 TL, 1 TR, 2 BR, 3 BL
    if (idx === 0 || idx === 3) r.x0 = Math.min(nx, r.x1 - MIN_SIZE)
    else r.x1 = Math.max(nx, r.x0 + MIN_SIZE)
    if (idx === 0 || idx === 1) r.y0 = Math.min(ny, r.y1 - MIN_SIZE)
    else r.y1 = Math.max(ny, r.y0 + MIN_SIZE)
    onRect({
      x0: clamp(r.x0, 0, 1), y0: clamp(r.y0, 0, 1),
      x1: clamp(r.x1, 0, 1), y1: clamp(r.y1, 0, 1),
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      g.current.mode = 'pinch'
      g.current.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      g.current.startScale = viewRef.current.scale
      g.current.startTx = viewRef.current.tx
      g.current.startTy = viewRef.current.ty
      g.current.startMidX = (pts[0].x + pts[1].x) / 2
      g.current.startMidY = (pts[0].y + pts[1].y) / 2
      return
    }

    const handle = (e.target as HTMLElement).closest?.('[data-corner]') as HTMLElement | null
    if (handle) {
      g.current.mode = 'corner'
      g.current.corner = Number(handle.dataset.corner)
    } else {
      g.current.mode = 'pan'
      g.current.startTx = viewRef.current.tx
      g.current.startTy = viewRef.current.ty
      g.current.startMidX = e.clientX
      g.current.startMidY = e.clientY
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const gs = g.current

    if (gs.mode === 'pinch' && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      const scale = clamp(gs.startScale * (dist / gs.startDist), 1, MAX_ZOOM)
      const { tx, ty } = clampPan(scale, gs.startTx + (midX - gs.startMidX), gs.startTy + (midY - gs.startMidY))
      onView({ scale, tx, ty })
      return
    }

    if (gs.mode === 'corner') {
      const { nx, ny } = imgRectNorm(e.clientX, e.clientY)
      setCorner(gs.corner, nx, ny)
      return
    }

    if (gs.mode === 'pan') {
      const { tx, ty } = clampPan(viewRef.current.scale, gs.startTx + (e.clientX - gs.startMidX), gs.startTy + (e.clientY - gs.startMidY))
      onView({ scale: viewRef.current.scale, tx, ty })
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 1) {
      // Dropped from a pinch to one finger — re-anchor pan to the survivor so
      // the next move doesn't jump.
      const [p] = [...pointers.current.values()]
      g.current.mode = 'pan'
      g.current.startTx = viewRef.current.tx
      g.current.startTy = viewRef.current.ty
      g.current.startMidX = p.x
      g.current.startMidY = p.y
    } else if (pointers.current.size === 0) {
      g.current.mode = 'none'
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    const scale = clamp(viewRef.current.scale * (1 - e.deltaY * 0.0015), 1, MAX_ZOOM)
    const { tx, ty } = clampPan(scale, viewRef.current.tx, viewRef.current.ty)
    onView({ scale, tx, ty })
  }

  if (busy) {
    return (
      <div className="h-56 flex items-center justify-center">
        <span className="text-[10pt] text-tertiary">Opening…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="h-56 flex items-center justify-center px-6">
        <p className="text-[9pt] font-medium text-themeredred text-center">{error}</p>
      </div>
    )
  }
  if (!srcUrl) return <div className="h-56" />

  const points = `${rect.x0},${rect.y0} ${rect.x1},${rect.y0} ${rect.x1},${rect.y1} ${rect.x0},${rect.y1}`
  const corners: [number, number][] = [
    [rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x1, rect.y1], [rect.x0, rect.y1],
  ]

  return (
    <div className="p-3">
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/90 select-none touch-none"
        style={{ maxHeight: '52dvh' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        <div
          ref={wrapRef}
          className="relative inline-block"
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={srcUrl}
            alt="Selected"
            className="block max-w-full pointer-events-none"
            style={{ maxHeight: '52dvh' }}
            draggable={false}
          />
          {/* Crop outline + dimmed exterior */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
            <polygon points={points} fill="none" stroke="#63b3ed" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Corner handles */}
          {corners.map(([px, py], i) => (
            <div
              key={i}
              data-corner={i}
              className="absolute w-9 h-9 rounded-full bg-themeblue3/30 border-2 border-white flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{ left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%, -50%) scale(${1 / view.scale})`, touchAction: 'none' }}
            >
              <span className="w-2 h-2 rounded-full bg-white" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[8.5pt] text-tertiary">
        <ZoomIn size={12} /> Pinch or scroll to zoom · drag the corners to crop
      </p>
    </div>
  )
}
