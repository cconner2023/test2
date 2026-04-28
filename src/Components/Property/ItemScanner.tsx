import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ScanLine, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { openCamera, closeCamera, captureFrame } from '../../lib/vision/camera'
import { extractFingerprint } from '../../lib/vision/fingerprint'
import { matchScan, type MatchResult } from '../../lib/vision/matcher'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import { DisambiguationCard } from './DisambiguationCard'

interface ItemScannerProps {
  items: LocalPropertyItem[]
  onMatch: (itemId: string, quantity: number) => void
  onClose: () => void
}

type ScanPhase = 'scanning' | 'processing' | 'ambiguous' | 'confirmed' | 'no_match'

// Offscreen canvas for barcode decoding
function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function ItemScanner({ items, onMatch, onClose }: ItemScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('scanning')
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [confirmedItemId, setConfirmedItemId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScanRef = useRef<number>(0)
  const readerRef = useRef<BrowserMultiFormatReader>(new BrowserMultiFormatReader())
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

    // Barcode decode
    const barcodes: string[] = []
    try {
      const canvas = imageDataToCanvas(imageData)
      const result = readerRef.current.decodeFromCanvas(canvas)
      if (result) barcodes.push(result.getText())
    } catch {
      // No barcode found — normal path
    }

    // Visual fingerprint
    const fingerprint = extractFingerprint(imageData, barcodes)

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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
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
              /* Serialized — single unit only */
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onMatch(confirmedItem.id, 1)}
                  className="w-full py-3 rounded-full bg-themeredred text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
                >
                  Mark as expended
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 text-sm text-secondary font-medium active:scale-95 transition-all"
                >
                  View Item
                </button>
              </div>
            ) : (
              /* Quantity-tracked */
              <div className="flex flex-col gap-3">
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
                  className="w-full py-3 rounded-full bg-themeredred text-white font-semibold text-sm active:scale-95 transition-all shadow-lg"
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
    </div>
  )
}
