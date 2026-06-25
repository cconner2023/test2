import { useState, useCallback, useRef } from 'react'
import { FileText, X, Wand2, Check } from 'lucide-react'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { detectGeoRefFromFile, type DetectedGeoRef } from '../../lib/mapImporters/lgiParser'

interface GeoPdfImportFormProps {
  /** Close the host surface (right pane / mobile sheet). */
  onClose: () => void
  onSubmit: (file: File, bounds: [number, number, number, number]) => void
}

interface BoundsForm {
  west: string
  south: string
  east: string
  north: string
}

const EMPTY_BOUNDS: BoundsForm = { west: '', south: '', east: '', north: '' }

function parseBounds(b: BoundsForm): [number, number, number, number] | string {
  const w = parseFloat(b.west)
  const s = parseFloat(b.south)
  const e = parseFloat(b.east)
  const n = parseFloat(b.north)
  if ([w, s, e, n].some(v => !Number.isFinite(v))) return 'All four bounds must be numbers'
  if (s < -85 || n > 85) return 'Latitude must be within ±85° (Web Mercator limit)'
  if (w < -180 || e > 180) return 'Longitude must be within ±180°'
  if (s >= n) return 'South must be less than north'
  if (w >= e) return 'West must be less than east'
  return [w, s, e, n]
}

/** Surfaceless geo-PDF import form, hosted in MapOverlayPanel's right pane
 *  (desktop) / detail sheet (mobile) — the host owns the header + close. */
export function GeoPdfImportForm({ onClose, onSubmit }: GeoPdfImportFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [bounds, setBounds] = useState<BoundsForm>(EMPTY_BOUNDS)
  const [error, setError] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedGeoRef | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const reset = useCallback(() => {
    setFile(null)
    setBounds(EMPTY_BOUNDS)
    setError(null)
    setDetected(null)
  }, [])

  const tryAutoDetect = useCallback(async (target: File) => {
    setDetecting(true)
    setError(null)
    try {
      const found = await detectGeoRefFromFile(target)
      if (found) {
        const [w, s, e, n] = found.bounds
        setBounds({ west: String(w), south: String(s), east: String(e), north: String(n) })
        setDetected(found)
      } else {
        setDetected(null)
      }
    } catch {
      setDetected(null)
    } finally {
      setDetecting(false)
    }
  }, [])

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Select a .pdf file')
      return
    }
    setFile(f)
    setError(null)
    setDetected(null)
    // Auto-attempt detection on pick — silent on failure, populates on success.
    tryAutoDetect(f)
  }, [tryAutoDetect])

  const handleSubmit = useCallback(() => {
    if (!file) { setError('Choose a PDF first'); return }
    const parsed = parseBounds(bounds)
    if (typeof parsed === 'string') { setError(parsed); return }
    onSubmit(file, parsed)
    reset()
    onClose()
  }, [file, bounds, onSubmit, onClose, reset])

  const updateBound = (k: keyof BoundsForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetected(null) // any manual edit invalidates the "auto-detected" badge
    setBounds(prev => ({ ...prev, [k]: e.target.value }))
  }

  const detectionLabel = detected
    ? detected.source === 'vp-measure-gpts'
      ? 'Auto-detected from /VP /Measure'
      : 'Auto-detected from /LGIDict'
    : null

  const inputCls =
    'w-full px-2.5 py-1.5 rounded-md text-[11pt] font-mono tabular-nums text-primary ' +
    'border border-tertiary/15 bg-themewhite focus:border-themeblue3 focus:outline-none transition-colors'

  return (
      <div className="flex flex-col gap-4">
        <p className="text-[10pt] text-tertiary">
          We try to auto-detect bounds from the PDF's georeference dictionary
          (PDF 1.7 /VP /Measure or Adobe /LGIDict). When that fails — usually
          because the PDF compresses its metadata stream — type the bounds in.
        </p>

        {/* File picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-tertiary/30 bg-themewhite2 hover:border-themeblue3 active:scale-[0.99] transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-themewhite flex items-center justify-center text-themeblue3">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            {file ? (
              <>
                <p className="text-[11pt] font-medium text-primary truncate">{file.name}</p>
                <p className="text-[10pt] text-tertiary tabular-nums">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
              </>
            ) : (
              <>
                <p className="text-[11pt] font-medium text-primary">Select PDF</p>
                <p className="text-[10pt] text-tertiary">Tap to pick a .pdf file</p>
              </>
            )}
          </div>
          {file && (
            <span
              role="button"
              aria-label="Clear selection"
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred"
            >
              <X size={14} />
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFilePick}
          className="hidden"
        />

        {/* Detection status row */}
        {file && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-themewhite2 text-[10pt]">
            {detecting ? (
              <>
                <Wand2 size={13} className="text-themeblue3 animate-pulse" />
                <span className="text-tertiary">Scanning for georeference…</span>
              </>
            ) : detectionLabel ? (
              <>
                <Check size={13} className="text-themegreen" />
                <span className="text-primary">{detectionLabel}</span>
              </>
            ) : (
              <>
                <Wand2 size={13} className="text-tertiary/60" />
                <span className="text-tertiary">No georeference found — enter bounds manually</span>
              </>
            )}
            {file && !detecting && (
              <button
                type="button"
                onClick={() => tryAutoDetect(file)}
                className="ml-auto text-[9pt] text-themeblue2 hover:underline"
              >
                Re-scan
              </button>
            )}
          </div>
        )}

        {/* Bounds — N/W/E/S in compass order */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">North (lat)</span>
            <input className={inputCls} placeholder="38.9100" value={bounds.north} onChange={updateBound('north')} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">West (lng)</span>
            <input className={inputCls} placeholder="-77.0500" value={bounds.west} onChange={updateBound('west')} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">East (lng)</span>
            <input className={inputCls} placeholder="-77.0400" value={bounds.east} onChange={updateBound('east')} />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide">South (lat)</span>
            <input className={inputCls} placeholder="38.8900" value={bounds.south} onChange={updateBound('south')} />
          </label>
        </div>

        {error && (
          <p className="text-[10pt] text-themeredred">{error}</p>
        )}

        <ActionPill>
          <ActionButton
            icon={FileText}
            label="Import"
            variant={file ? 'success' : 'disabled'}
            onClick={handleSubmit}
          />
        </ActionPill>
      </div>
  )
}
