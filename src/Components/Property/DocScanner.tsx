import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, Images, Check, Trash2, ScanLine, ArrowRight,
  Crop, Wand2, Palette, Contrast, SunMedium,
} from 'lucide-react'
import {
  fileToCanvas, detectDocumentQuad, warpQuad, outputSizeForQuad, applyFilter,
  assembleScanPdf, type Quad, type ScanFilter, type RasterImage,
} from '../../lib/docScan'
import { openCamera, closeCamera } from '../../lib/vision/camera'
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { TextInput } from '@/Components/primitives/FormInputs'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('DocScanner')

/**
 * DocScanner — an in-browser "Adobe Scan"-style document capture flow that hands
 * a finished multi-page PDF File back to the caller. Built for the PMCS 5988E and
 * dispatch-form attachments: the host sheets used to feed a raw photo straight
 * into the encrypted-attachment upload; now the user gets capture → edge-crop →
 * enhance → multi-page review → title before that File is produced, so a phone
 * photo of a worksheet comes out as a clean, de-skewed, titled PDF.
 *
 * Everything is 2D-canvas (see lib/docScan) — no native scanner, no OpenCV/WASM —
 * so it works in the pure PWA on iOS Safari.
 *
 * Its four stages are an OverlayStack (the drill-down/"morph" primitive): one
 * card whose body morphs between screens instead of pushing a fresh overlay per
 * step. The stack owns the back chevron (review = root, no back) and resets to
 * review on open; navigation between stages is push/replace/pop/reset via the
 * `navRef`. The whole card is still a NESTED overlay — OverlayStack builds on
 * PreviewOverlay, so launched from inside the host PMCS/Dispatch overlay's
 * children it auto-stacks above the host through OverlayStackContext (no explicit
 * zIndex plumbing), scoped to the property drawer via `containerRef`. The popover
 * header carries the close X (top-right); the footer carries the per-stage actions
 * (capture options left, advance/Save right). Returns a File via onComplete; the
 * host treats it like a picked attachment (nothing downstream changes).
 *
 * Four screens, mirroring Adobe Scan (stack flow: review → camera ⇒replace⇒ crop
 * → enhance ⇒reset⇒ review; Photos/edit-page push straight to crop):
 *  - REVIEW: the captured pages (thumbnails) + a title field. Footer = capture
 *            options (Camera / Photos) left, Save right.
 *  - CAMERA: a live getUserMedia preview with a shutter (the real camera, not the
 *            OS file picker — works on the iOS Safari floor and desktop webcam).
 *  - CROP:   the source photo with a draggable 4-corner quad (auto-detected on
 *            capture; drag to fix skew — the "manual fallback"). Footer = Auto-
 *            detect left, Next right.
 *  - ENHANCE: the de-skewed page with a live filter (Auto / Colour / B&W / Grey).
 *            Footer = Add/Done right.
 */

interface DocScannerProps {
  isOpen: boolean
  onClose: () => void
  /** Receives the finished multi-page PDF File (then the host closes the scanner). */
  onComplete: (file: File) => void
  /** Form being scanned (e.g. "5988E", "dispatch form") — seeds the title placeholder. */
  formLabel?: string
  /** Scopes the overlay to the property drawer (matches the host PMCS/Dispatch overlay). */
  containerRef?: React.RefObject<HTMLElement | null>
}

interface Page {
  id: string
  src: RasterImage
  quad: Quad
  filter: ScanFilter
  /** Rendered (warped + filtered) JPEG data URL — the page that goes into the PDF. */
  thumb: string
}

interface Draft {
  id?: string // set when re-editing an existing page
  src: RasterImage
  srcUrl: string // source as a data URL for display in the crop view
  quad: Quad
  filter: ScanFilter
  warped?: HTMLCanvasElement // full-res de-skewed page (unfiltered)
  previewBase?: HTMLCanvasElement // downscaled unfiltered page for fast live filtering
}

const FILTERS: { key: ScanFilter; label: string; icon: typeof Wand2 }[] = [
  { key: 'auto', label: 'Auto', icon: Wand2 },
  { key: 'color', label: 'Colour', icon: Palette },
  { key: 'bw', label: 'B&W', icon: Contrast },
  { key: 'gray', label: 'Grey', icon: SunMedium },
]

function newId(): string {
  try { return crypto.randomUUID() } catch { return `p-${Date.now()}-${Math.round(Math.random() * 1e6)}` }
}

export function DocScanner({ isOpen, onClose, onComplete, formLabel, containerRef }: DocScannerProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const libraryInputRef = useRef<HTMLInputElement>(null)
  // The live nav, for the async/handler-driven steps below. OverlayStack resets
  // its own stack to 'review' whenever isOpen flips, so the data reset here only
  // clears the captured pages/draft.
  const navRef = useRef<StackNav | null>(null)

  // Reset captured data when the scanner closes (stack position is OverlayStack's).
  useEffect(() => {
    if (!isOpen) {
      setPages([]); setDraft(null)
      setTitle(''); setBusy(false); setError(null)
    }
  }, [isOpen])

  const loadFile = useCallback(async (file: File) => {
    setBusy(true); setError(null)
    try {
      const src = await fileToCanvas(file)
      const quad = detectDocumentQuad(src)
      setDraft({ id: undefined, src, srcUrl: src.canvas.toDataURL('image/jpeg', 0.85), quad, filter: 'auto' })
      navRef.current?.push('crop')
    } catch (err) {
      logger.warn('image load failed:', err)
      setError('Could not read that image — try another.')
    } finally {
      setBusy(false)
    }
  }, [])

  const onInputChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    ev.target.value = '' // allow re-picking the same file
    if (f) void loadFile(f)
  }

  // CAMERA → CROP: a frame captured from the live preview enters the same
  // detect-quad → crop pipeline a picked photo does. `replace` swaps camera for
  // crop so the crop step's back returns to review, not the live camera.
  const onCapture = useCallback((canvas: HTMLCanvasElement) => {
    const src: RasterImage = { canvas, width: canvas.width, height: canvas.height }
    const quad = detectDocumentQuad(src)
    setDraft({ id: undefined, src, srcUrl: canvas.toDataURL('image/jpeg', 0.85), quad, filter: 'auto' })
    navRef.current?.replace('crop')
  }, [])

  const onCameraError = useCallback(() => {
    setError('Camera unavailable — use Photos instead.')
    navRef.current?.pop()
  }, [])

  // Re-open a saved page back into the crop step (keeps its source/quad/filter).
  const editPage = (p: Page) => {
    setDraft({ id: p.id, src: p.src, srcUrl: p.src.canvas.toDataURL('image/jpeg', 0.85), quad: p.quad, filter: p.filter })
    navRef.current?.push('crop')
  }

  const deletePage = (id: string) => setPages((prev) => prev.filter((p) => p.id !== id))

  // CROP → ENHANCE: de-skew the quad to a flat page, then build a downscaled base
  // for fast live filter preview.
  const toEnhance = () => {
    if (!draft) return
    const { w, h } = outputSizeForQuad(draft.src, draft.quad)
    const warped = warpQuad(draft.src, draft.quad, w, h)
    const previewBase = downscale(warped, 900)
    setDraft({ ...draft, warped, previewBase })
    navRef.current?.push('enhance')
  }

  // ENHANCE → REVIEW: render the final warped + filtered page and upsert it.
  const commitPage = () => {
    if (!draft?.warped) return
    const final = document.createElement('canvas')
    final.width = draft.warped.width
    final.height = draft.warped.height
    final.getContext('2d')!.drawImage(draft.warped, 0, 0)
    applyFilter(final, draft.filter)
    const thumb = final.toDataURL('image/jpeg', 0.82)
    const page: Page = { id: draft.id ?? newId(), src: draft.src, quad: draft.quad, filter: draft.filter, thumb }
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === page.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = page; return next }
      return [...prev, page]
    })
    setDraft(null)
    navRef.current?.reset()
  }

  const handleSave = async () => {
    if (!pages.length || busy) return
    setBusy(true); setError(null)
    try {
      const name = title.trim() || formLabel || 'scan'
      const file = await assembleScanPdf(pages.map((p) => p.thumb), name)
      onComplete(file)
      onClose()
    } catch (err) {
      logger.warn('PDF assembly failed:', err)
      setError('Could not build the document — try again.')
      setBusy(false)
    }
  }

  // Four screens, mirroring Adobe Scan — the stack owns navigation + the back
  // chevron; each screen's chrome (title/footer/rightFooter) reads live component
  // state, so capture/advance options sit LEFT and the success/confirm (Save /
  // Next / Add) sits RIGHT, matching the PMCS/dispatch footer convention.
  const screens = {
    review: {
      title: 'Scan',
      footer: (_: unknown, nav: StackNav) => (
        <FooterPill>
          <ActionButton icon={Camera} label="Camera" variant={busy ? 'disabled' : 'default'} onClick={() => nav.push('camera')} />
          <ActionButton icon={Images} label="Photos" variant={busy ? 'disabled' : 'default'} onClick={() => libraryInputRef.current?.click()} />
        </FooterPill>
      ),
      rightFooter: (
        <FooterPill side="right">
          <PillButton icon={Check} iconSize={16} accent="success" disabled={!pages.length || busy} onClick={handleSave} label="Save document" />
        </FooterPill>
      ),
      render: () => (
        <>
          <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
          <ReviewView
            pages={pages}
            title={title}
            onTitle={setTitle}
            placeholder={formLabel ? formLabel : 'Document title'}
            error={error}
            onEdit={editPage}
            onDelete={deletePage}
          />
        </>
      ),
    },
    camera: {
      title: 'Camera',
      // Back (→ review) is the default pop; camera teardown rides CameraView unmount.
      render: () => <CameraView onCapture={onCapture} onError={onCameraError} />,
    },
    crop: {
      title: 'Crop',
      // Back drops the in-flight draft before returning to review.
      onBack: (nav: StackNav) => { setDraft(null); nav.pop() },
      footer: (
        <FooterPill>
          <ActionButton icon={Crop} label="Auto-detect" variant="default" onClick={() => draft && setDraft({ ...draft, quad: detectDocumentQuad(draft.src) })} />
        </FooterPill>
      ),
      rightFooter: (
        <FooterPill side="right">
          <PillButton icon={ArrowRight} iconSize={18} accent="info" onClick={toEnhance} label="Next" />
        </FooterPill>
      ),
      render: () => draft ? <CropView draft={draft} onQuad={(quad) => setDraft({ ...draft, quad })} /> : null,
    },
    enhance: {
      title: 'Enhance',
      // Back (→ crop) keeps the draft, so the default pop is right.
      rightFooter: (
        <FooterPill side="right">
          <PillButton icon={Check} iconSize={16} accent="success" onClick={commitPage} label={draft?.id ? 'Done' : 'Add page'} />
        </FooterPill>
      ),
      render: () => draft?.previewBase ? <EnhanceView draft={draft} onFilter={(filter) => setDraft({ ...draft, filter })} /> : null,
    },
  }

  return (
    <OverlayStack
      isOpen={isOpen}
      onClose={onClose}
      containerRef={containerRef}
      navRef={navRef}
      initial={{ key: 'review' }}
      screens={screens}
      maxWidth={400}
      previewMaxHeight="62dvh"
    />
  )
}

// ── Review ────────────────────────────────────────────────────────────────────

function ReviewView({
  pages, title, onTitle, placeholder, error, onEdit, onDelete,
}: {
  pages: Page[]
  title: string
  onTitle: (v: string) => void
  placeholder: string
  error: string | null
  onEdit: (p: Page) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="p-3">
      {/* Title */}
      <div className="mb-3 bg-themewhite2 rounded-xl overflow-hidden">
        <TextInput value={title} onChange={onTitle} placeholder={placeholder} />
      </div>

      {error && <p className="mb-3 text-[9pt] font-medium text-themeredred text-center">{error}</p>}

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-tertiary/25 py-10 px-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-themeblue3/10 flex items-center justify-center mb-3">
            <ScanLine size={26} className="text-themeblue2" />
          </div>
          <p className="text-sm font-medium text-primary">Capture the first page</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {pages.map((p, i) => (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="block w-full aspect-[3/4] rounded-xl overflow-hidden bg-themewhite2 border border-tertiary/10 active:scale-[0.98] transition-transform"
              >
                <img src={p.thumb} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
              </button>
              <span className="absolute bottom-1 left-1 text-[8pt] font-semibold text-white bg-black/60 rounded px-1.5 py-0.5">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-themeredred text-white flex items-center justify-center shadow active:scale-90 transition-transform"
                aria-label={`Delete page ${i + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Camera ──────────────────────────────────────────────────────────────────--

/**
 * CameraView — a live getUserMedia preview with a shutter. This is the real
 * camera (not an `<input capture>` that desktop browsers downgrade to a file
 * picker); it works on the iOS Safari PWA floor and the desktop webcam alike,
 * reusing the shared vision/camera helpers. The shutter grabs the current frame
 * to a canvas and hands it up; the parent runs it through the crop pipeline. The
 * dark capture area fills the white card edge-to-edge (the card is overflow-hidden).
 */
function CameraView({ onCapture, onError }: {
  onCapture: (canvas: HTMLCanvasElement) => void
  onError: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await openCamera('environment')
        if (cancelled) { closeCamera(stream); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!cancelled) setReady(true)
        }
      } catch (err) {
        logger.warn('camera open failed:', err)
        if (!cancelled) onError()
      }
    })()
    return () => {
      cancelled = true
      if (streamRef.current) { closeCamera(streamRef.current); streamRef.current = null }
    }
  }, [onError])

  const shoot = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    onCapture(canvas)
  }

  return (
    <div className="relative w-full h-[52dvh] bg-black">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted />
      {/* Shutter */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-5 pt-4">
        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label="Capture"
          className="w-16 h-16 rounded-full bg-white ring-4 ring-white/40 active:scale-95 transition-all disabled:opacity-40"
        />
      </div>
    </div>
  )
}

// ── Crop ──────────────────────────────────────────────────────────────────────

function CropView({ draft, onQuad }: {
  draft: Draft
  onQuad: (q: Quad) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragIdx = useRef<number>(-1)

  const onPointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    dragIdx.current = idx
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdx.current < 0 || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    const next = draft.quad.map((p, i) => (i === dragIdx.current ? { x, y } : p)) as Quad
    onQuad(next)
  }
  const onPointerUp = () => { dragIdx.current = -1 }

  const points = draft.quad.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="p-3 flex flex-col items-center">
      {/* The <img> is the sizer (intrinsic ratio, capped by max-w/max-h so it's
          never distorted); the overlay + handles sit absolutely over it, and the
          wrapper's bounding rect == the image rect so normalised coords map 1:1. */}
      <div
        ref={wrapRef}
        className="relative inline-block select-none touch-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img src={draft.srcUrl} alt="Captured page" className="block max-w-full rounded-lg pointer-events-none" style={{ maxHeight: '50dvh' }} draggable={false} />
        {/* Quad outline */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon points={points} fill="rgba(99,179,237,0.12)" stroke="#63b3ed" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Corner handles */}
        {draft.quad.map((p, i) => (
          <div
            key={i}
            onPointerDown={onPointerDown(i)}
            className="absolute w-9 h-9 rounded-full bg-themeblue3/30 border-2 border-white flex items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
          >
            <span className="w-2 h-2 rounded-full bg-white" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Enhance ─────────────────────────────────────────────────────────────────--

function EnhanceView({ draft, onFilter }: { draft: Draft; onFilter: (f: ScanFilter) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Live preview — draw the unfiltered downscaled base then apply the filter.
  useEffect(() => {
    const base = draft.previewBase
    const el = canvasRef.current
    if (!base || !el) return
    el.width = base.width
    el.height = base.height
    const ctx = el.getContext('2d')!
    ctx.drawImage(base, 0, 0)
    applyFilter(el, draft.filter)
  }, [draft.previewBase, draft.filter])

  return (
    <div className="p-3 flex flex-col items-center">
      <div className="rounded-lg overflow-hidden bg-tertiary/5">
        <canvas ref={canvasRef} className="block" style={{ maxWidth: '100%', maxHeight: '42dvh', width: 'auto', height: 'auto' }} />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mt-3">
        {FILTERS.map(({ key, label, icon: Icon }) => {
          const active = draft.filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilter(key)}
              className={`h-11 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[8.5pt] font-semibold transition-all active:scale-95 ${
                active ? 'bg-themeblue3 text-white' : 'bg-tertiary/8 text-secondary'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Downscale a canvas so its long edge ≤ `maxLong` (for fast live filtering). */
function downscale(src: HTMLCanvasElement, maxLong: number): HTMLCanvasElement {
  const long = Math.max(src.width, src.height)
  const scale = long > maxLong ? maxLong / long : 1
  if (scale === 1) return src
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(src.width * scale))
  out.height = Math.max(1, Math.round(src.height * scale))
  out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height)
  return out
}
