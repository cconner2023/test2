import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera, Images, X, Check, Trash2, ChevronLeft, Loader2, ScanLine,
  Crop, Wand2, Palette, Contrast, SunMedium,
} from 'lucide-react'
import {
  fileToCanvas, detectDocumentQuad, warpQuad, outputSizeForQuad, applyFilter,
  assembleScanPdf, type Quad, type ScanFilter, type RasterImage,
} from '../../lib/docScan'
import { TextInput } from '../FormInputs'
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
 * so it works in the pure PWA on iOS Safari. It renders as its own full-screen
 * portal above the property drawer/sheets (the crop interaction needs the room a
 * 340px popover can't give), and returns a File via onComplete; the host treats
 * that File exactly like a picked attachment (nothing downstream changes).
 *
 * Three sub-screens, mirroring Adobe Scan:
 *  - REVIEW: the captured pages (thumbnails), a title field, Add-page, and Save.
 *  - CROP:   the source photo with a draggable 4-corner quad (auto-detected on
 *            capture; drag to fix skew — the "manual fallback").
 *  - ENHANCE: the de-skewed page with a live filter (Auto / Colour / B&W / Grey).
 */

interface DocScannerProps {
  isOpen: boolean
  onClose: () => void
  /** Receives the finished multi-page PDF File (then the host closes the scanner). */
  onComplete: (file: File) => void
  /** Form being scanned (e.g. "5988E", "dispatch form") — seeds the title placeholder. */
  formLabel?: string
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

type Stage = 'review' | 'crop' | 'enhance'

const FILTERS: { key: ScanFilter; label: string; icon: typeof Wand2 }[] = [
  { key: 'auto', label: 'Auto', icon: Wand2 },
  { key: 'color', label: 'Colour', icon: Palette },
  { key: 'bw', label: 'B&W', icon: Contrast },
  { key: 'gray', label: 'Grey', icon: SunMedium },
]

function newId(): string {
  try { return crypto.randomUUID() } catch { return `p-${Date.now()}-${Math.round(Math.random() * 1e6)}` }
}

export function DocScanner({ isOpen, onClose, onComplete, formLabel }: DocScannerProps) {
  const [stage, setStage] = useState<Stage>('review')
  const [pages, setPages] = useState<Page[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  // Reset everything when the scanner closes.
  useEffect(() => {
    if (!isOpen) {
      setStage('review'); setPages([]); setDraft(null)
      setTitle(''); setBusy(false); setError(null)
    }
  }, [isOpen])

  const loadFile = useCallback(async (file: File) => {
    setBusy(true); setError(null)
    try {
      const src = await fileToCanvas(file)
      const quad = detectDocumentQuad(src)
      setDraft({ id: undefined, src, srcUrl: src.canvas.toDataURL('image/jpeg', 0.85), quad, filter: 'auto' })
      setStage('crop')
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

  // Re-open a saved page back into the crop step (keeps its source/quad/filter).
  const editPage = (p: Page) => {
    setDraft({ id: p.id, src: p.src, srcUrl: p.src.canvas.toDataURL('image/jpeg', 0.85), quad: p.quad, filter: p.filter })
    setStage('crop')
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
    setStage('enhance')
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
    setStage('review')
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

  if (!isOpen) return null

  const hiddenInputs = (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} />
      <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
    </>
  )

  return createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/90 flex flex-col" style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      {hiddenInputs}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={stage === 'review' ? onClose : () => { setStage(stage === 'enhance' ? 'crop' : 'review'); if (stage === 'crop') setDraft(null) }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 active:scale-95 transition-all"
          aria-label={stage === 'review' ? 'Close' : 'Back'}
        >
          {stage === 'review' ? <X size={20} /> : <ChevronLeft size={22} />}
        </button>
        <span className="text-sm font-medium text-white flex items-center gap-2">
          <ScanLine size={16} className="text-white/70" />
          {stage === 'crop' ? 'Crop' : stage === 'enhance' ? 'Enhance' : 'Scan document'}
        </span>
        {/* Right slot — Save on review, advance arrows on the editing steps. */}
        {stage === 'review' ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={!pages.length || busy}
            className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-sm font-semibold bg-themegreen text-white disabled:opacity-30 active:scale-95 transition-all"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
            Save
          </button>
        ) : stage === 'crop' ? (
          <button
            type="button"
            onClick={toEnhance}
            className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-sm font-semibold bg-white text-black active:scale-95 transition-all"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={commitPage}
            className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-sm font-semibold bg-themegreen text-white active:scale-95 transition-all"
          >
            <Check size={16} /> {draft?.id ? 'Done' : 'Add'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        {stage === 'review' && (
          <ReviewView
            pages={pages}
            title={title}
            onTitle={setTitle}
            placeholder={formLabel ? formLabel : 'Document title'}
            busy={busy}
            onCamera={() => cameraInputRef.current?.click()}
            onLibrary={() => libraryInputRef.current?.click()}
            onEdit={editPage}
            onDelete={deletePage}
          />
        )}
        {stage === 'crop' && draft && (
          <CropView draft={draft} onQuad={(quad) => setDraft({ ...draft, quad })} onAutoDetect={() => setDraft({ ...draft, quad: detectDocumentQuad(draft.src) })} />
        )}
        {stage === 'enhance' && draft?.previewBase && (
          <EnhanceView draft={draft} onFilter={(filter) => setDraft({ ...draft, filter })} />
        )}
      </div>

      {error && (
        <div className="px-4 py-2 shrink-0">
          <p className="text-[10pt] font-medium text-themered text-center">{error}</p>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ── Review ────────────────────────────────────────────────────────────────────

function ReviewView({
  pages, title, onTitle, placeholder, busy, onCamera, onLibrary, onEdit, onDelete,
}: {
  pages: Page[]
  title: string
  onTitle: (v: string) => void
  placeholder: string
  busy: boolean
  onCamera: () => void
  onLibrary: () => void
  onEdit: (p: Page) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="max-w-md mx-auto py-2">
      {/* Title */}
      <div className="mb-4 bg-themewhite rounded-2xl overflow-hidden">
        <TextInput value={title} onChange={onTitle} placeholder={placeholder} />
      </div>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 py-12 px-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
            <ScanLine size={26} className="text-white/70" />
          </div>
          <p className="text-sm font-medium text-white">Capture the first page</p>
          <p className="text-[10pt] text-white/50 mt-1">Photograph the worksheet — edges are detected automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {pages.map((p, i) => (
            <div key={p.id} className="relative group">
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="block w-full aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/10 active:scale-[0.98] transition-transform"
              >
                <img src={p.thumb} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
              </button>
              <span className="absolute bottom-1 left-1 text-[8pt] font-semibold text-white bg-black/60 rounded px-1.5 py-0.5">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-themered text-white flex items-center justify-center shadow active:scale-90 transition-transform"
                aria-label={`Delete page ${i + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add-page actions */}
      <div className="flex gap-2.5 mt-5">
        <button
          type="button"
          onClick={onCamera}
          disabled={busy}
          className="flex-1 h-12 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          {pages.length ? 'Add page' : 'Camera'}
        </button>
        <button
          type="button"
          onClick={onLibrary}
          disabled={busy}
          className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          aria-label="Choose from photos"
        >
          <Images size={18} />
        </button>
      </div>
    </div>
  )
}

// ── Crop ──────────────────────────────────────────────────────────────────────

function CropView({ draft, onQuad, onAutoDetect }: {
  draft: Draft
  onQuad: (q: Quad) => void
  onAutoDetect: () => void
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
    <div className="max-w-md mx-auto py-2 flex flex-col items-center">
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
        <img src={draft.srcUrl} alt="Captured page" className="block max-w-full rounded-lg pointer-events-none" style={{ maxHeight: '62vh' }} draggable={false} />
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

      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          onClick={onAutoDetect}
          className="h-10 px-4 rounded-full bg-white/10 text-white text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Crop size={15} /> Auto-detect
        </button>
      </div>
      <p className="text-[10pt] text-white/50 mt-3 text-center">Drag the corners to the page edges.</p>
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
    <div className="max-w-md mx-auto py-2 flex flex-col items-center">
      <div className="inline-block rounded-lg overflow-hidden bg-white">
        <canvas ref={canvasRef} className="block" style={{ maxWidth: '100%', maxHeight: '58vh', width: 'auto', height: 'auto' }} />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mt-5">
        {FILTERS.map(({ key, label, icon: Icon }) => {
          const active = draft.filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilter(key)}
              className={`h-11 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[8.5pt] font-semibold transition-all active:scale-95 ${
                active ? 'bg-white text-black' : 'bg-white/10 text-white/80'
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
