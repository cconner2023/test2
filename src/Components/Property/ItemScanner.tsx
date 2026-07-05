import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ScanLine, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  BrowserMultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library'
import { openCamera, closeCamera, captureFrame } from '../../lib/vision/camera'
import { extractFingerprint } from '../../lib/vision/fingerprint'
import { matchScan, type MatchResult } from '../../lib/vision/matcher'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import { parseItemTag } from '../../Utilities/itemLabelCodec'
import { parseZoneTag } from '../../Utilities/zoneLabelCodec'
import { DisambiguationCard } from './DisambiguationCard'

interface ItemScannerProps {
  items: LocalPropertyItem[]
  /** Zones the scanner can resolve — a scanned BCN-ZONE label lands on the zone.
   *  Optional so item-only callers/tests are unaffected. */
  locations?: LocalPropertyLocation[]
  /** Expend the matched item (secondary action on the confirmed card). */
  onMatch: (itemId: string, quantity: number) => void
  /** Primary action — surface the matched item on the map ("target it"). */
  onLocate: (itemId: string) => void
  /** Surface a scanned ZONE (BCN-ZONE tag) — the zone sibling of onLocate. */
  onLocateZone?: (zoneId: string) => void
  onClose: () => void
}

type ScanPhase = 'scanning' | 'processing' | 'ambiguous' | 'confirmed' | 'no_match'

// Our printed property/zone labels are Data Matrix symbols (bwip-js `datamatrix`).
// Pin the reader to that one format + TRY_HARDER so a small label in a busy frame is
// actually located, and stray 1D manufacturer codes are never picked up.
const SCAN_HINTS = new Map<DecodeHintType, any>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX]],
  [DecodeHintType.TRY_HARDER, true],
])

// Decode a single frame for a Data Matrix; returns its text or null.
// ZXing 0.21 has NO `decodeFromCanvas` (calling it throws) — build a BinaryBitmap
// from the frame's luminance and decode that. Int32Array views the RGBA buffer as
// packed pixels; RGBLuminanceSource derives luminance from them. Throws NotFound
// when the frame holds no symbol → treated as "keep scanning".
function decodeDataMatrix(reader: BrowserMultiFormatReader, frame: ImageData): string | null {
  try {
    const packed = new Int32Array(frame.data.buffer)
    const source = new RGBLuminanceSource(packed, frame.width, frame.height)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    return reader.decodeBitmap(bitmap).getText()
  } catch {
    return null
  }
}

export function ItemScanner({ items, locations, onMatch, onLocate, onLocateZone, onClose }: ItemScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('scanning')
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [confirmedItemId, setConfirmedItemId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScanRef = useRef<number>(0)
  const readerRef = useRef<BrowserMultiFormatReader>(new BrowserMultiFormatReader(SCAN_HINTS))
  const activeRef = useRef(true)

  const stopLoop = useCallback(() => {
    activeRef.current = false
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    stopLoop()
    if (streamRef.current) {
      closeCamera(streamRef.current)
      streamRef.current = null
    }
  }, [stopLoop])

  // Start camera + scan loop on mount
  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await openCamera()
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        scheduleLoop()
      } catch {
        // Camera unavailable
        setPhase('no_match')
      }
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scheduleLoop() {
    if (!activeRef.current) return
    rafRef.current = requestAnimationFrame(runScan)
  }

  async function runScan(timestamp: number) {
    if (!activeRef.current) return
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scheduleLoop()
      return
    }

    // Throttle to ~500ms between scans
    if (timestamp - lastScanRef.current < 500) {
      scheduleLoop()
      return
    }
    lastScanRef.current = timestamp

    const imageData = captureFrame(videoRef.current)

    // Data Matrix decode — our opaque BCN-ITEM / BCN-ZONE labels.
    const barcodes: string[] = []
    const decoded = decodeDataMatrix(readerRef.current, imageData)
    if (decoded) barcodes.push(decoded)

    // Deterministic resolve: our printed Data Matrix labels encode an opaque id.
    // A ZONE tag (BCN-ZONE) lands on the zone; an ITEM tag (BCN-ITEM) confirms the
    // item. Either skips fuzzy visual matching entirely. Distinct prefixes keep the
    // two unambiguous, so order is immaterial.
    for (const code of barcodes) {
      const zoneId = parseZoneTag(code)
      if (zoneId && locations?.some(l => l.id === zoneId)) {
        stopCamera()
        onLocateZone?.(zoneId)
        return
      }
      const taggedId = parseItemTag(code)
      if (taggedId && items.some(i => i.id === taggedId)) {
        stopCamera()
        setConfirmedItemId(taggedId)
        setQuantity(1)
        setPhase('confirmed')
        return
      }
    }

    // Visual fingerprint. Barcodes drive only the deterministic short-circuit above;
    // enrolled fingerprints never carry barcodes, so feeding a stray decoded symbol
    // here would only sabotage scoring (scoreFingerprints caps the score at 0.35).
    const fingerprint = extractFingerprint(imageData, [])

    // Match against enrolled items
    const result = matchScan(
      fingerprint,
      items.map(i => ({ id: i.id, fingerprint: i.visual_fingerprint })),
    )

    if (result.kind === 'confirmed' || result.kind === 'ambiguous') {
      stopLoop()
      setMatchResult(result)

      if (result.kind === 'confirmed') {
        stopCamera()
        setConfirmedItemId(result.candidate.itemId)
        setQuantity(1)
        setPhase('confirmed')
      } else {
        setPhase('ambiguous')
      }
      return
    }

    // No match yet — keep scanning
    scheduleLoop()
  }

  function handleLocate(itemId: string) {
    stopCamera()
    onLocate(itemId)
  }

  function handleDisambiguationSelect(itemId: string) {
    stopCamera()
    setConfirmedItemId(itemId)
    setQuantity(1)
    setPhase('confirmed')
  }

  function handleTryAgain() {
    activeRef.current = true
    setMatchResult(null)
    setConfirmedItemId(null)
    setQuantity(1)
    setPhase('scanning')

    // Restart camera
    openCamera().then(stream => {
      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().then(() => scheduleLoop())
      }
    }).catch(() => setPhase('no_match'))
  }

  const confirmedItem = confirmedItemId ? items.find(i => i.id === confirmedItemId) : null
  const maxQty = confirmedItem?.quantity ?? 1

  // Portal to body: the scanner is a viewport-level overlay. Rendered in-place it
  // sits inside PropertyDrawer's glassHeader `isolate` content slot, where it can't
  // escape the z-10 glass header / z-[1020] search overlay (they'd paint on top).
  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col">
      {/* Video layer — always rendered so the element exists for the ref */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* ── Scanning phase overlay ── */}
      {phase === 'scanning' && (
        <>
          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-4">
            <p className="text-white/80 text-sm font-medium">Point camera at item</p>
            <button
              onClick={() => { stopCamera(); onClose() }}
              className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center active:scale-95 transition-all"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Viewfinder scan zone */}
          <div className="flex-1 relative z-10 flex items-center justify-center">
            <div
              className="relative border-2 border-white/50 rounded-xl"
              style={{ width: '60%', aspectRatio: '16/10' }}
            >
              {/* Corner accents */}
              <span className="absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-xl" />
              <span className="absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-xl" />
              <span className="absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-xl" />
              <span className="absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-white rounded-br-xl" />
              <ScanLine size={20} className="absolute bottom-2 right-2 text-white/40" />
            </div>
          </div>
        </>
      )}

      {/* ── Processing phase overlay ── */}
      {phase === 'processing' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="text-white animate-spin" />
          <p className="text-white text-sm font-medium">Matching...</p>
        </div>
      )}

      {/* ── Ambiguous phase — disambiguation card ── */}
      {phase === 'ambiguous' && matchResult?.kind === 'ambiguous' && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <DisambiguationCard
              candidates={matchResult.candidates}
              items={items}
              onSelect={handleDisambiguationSelect}
              onManual={onClose}
            />
          </div>
        </div>
      )}

      {/* ── Confirmed phase ── */}
      {phase === 'confirmed' && confirmedItem && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-end justify-center pb-12 px-4">
          <div className="w-full max-w-sm bg-themewhite rounded-2xl shadow-lg p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-themegreen shrink-0" />
              <span className="text-[10pt] font-semibold text-secondary uppercase tracking-wider">Match found</span>
            </div>

            <p className="font-bold text-primary text-base leading-snug">{confirmedItem.name}</p>

            {confirmedItem.is_serialized ? (
              /* Serialized — single unit only. Primary = locate; expend secondary. */
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleLocate(confirmedItem.id)}
                  className="w-full py-3 rounded-full bg-themeblue3 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
                >
                  View on map
                </button>
                <button
                  onClick={() => onMatch(confirmedItem.id, 1)}
                  className="w-full py-2 text-sm text-themeredred font-medium active:scale-95 transition-all"
                >
                  Mark as expended
                </button>
              </div>
            ) : (
              /* Quantity-tracked — locate primary; optional expend with a qty stepper. */
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleLocate(confirmedItem.id)}
                  className="w-full py-3 rounded-full bg-themeblue3 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
                >
                  View on map
                </button>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full bg-themewhite2 border border-tertiary/20 flex items-center justify-center text-lg font-bold text-primary active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold text-primary w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                    className="w-10 h-10 rounded-full bg-themewhite2 border border-tertiary/20 flex items-center justify-center text-lg font-bold text-primary active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onMatch(confirmedItem.id, quantity)}
                  className="w-full py-2 text-sm text-themeredred font-medium active:scale-95 transition-all"
                >
                  Mark {quantity} as expended
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── No-match phase ── */}
      {phase === 'no_match' && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle size={40} className="text-themeredred" />
            <p className="text-white font-semibold text-base">No match found</p>

            <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
              <button
                onClick={handleTryAgain}
                className="w-full py-3 rounded-full bg-themeblue3 text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-full bg-white/10 text-white font-medium text-sm active:scale-95 transition-all"
              >
                Search manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
