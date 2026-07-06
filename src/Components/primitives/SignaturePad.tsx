import { useRef, useState, useCallback, useEffect } from 'react'
import { Eraser } from 'lucide-react'
import { Modal } from '@/Components/primitives/Modal'

interface SignaturePadProps {
  isOpen: boolean
  onClose: () => void
  /** Fired with the drawn signature as a transparent-background PNG data URL. */
  onComplete: (pngDataUrl: string) => void
  title?: string
  subtitle?: string
  confirmLabel?: string
  zIndex?: number
}

/**
 * SignaturePad — a canvas the recipient draws on to acknowledge a hand receipt.
 * Pointer-events based (works on iOS Safari touch + mouse); transparent
 * background so the strokes stamp cleanly over a PDF form.
 *
 * Follows the no-disabled-actions rule: the confirm pill only renders once ink
 * is present. The whole pad clears on close so it never reopens half-drawn.
 */
export function SignaturePad({
  isOpen,
  onClose,
  onComplete,
  title = 'Recipient signature',
  subtitle = 'Sign to acknowledge receipt',
  confirmLabel = 'Sign & generate',
  zIndex,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Size the canvas backing store to its rendered box × DPR, then scale the
  // context so we can draw in CSS pixels. Runs when the pad opens (children
  // mount with the Modal).
  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'
    setHasInk(false)
  }, [isOpen])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }, [hasInk])

  const endStroke = useCallback(() => { drawing.current = false }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }, [])

  const confirm = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasInk) return
    onComplete(canvas.toDataURL('image/png'))
  }, [hasInk, onComplete])

  return (
    <Modal isOpen={isOpen} onClose={onClose} hideClose maxWidth={420} mobileMaxHeight="auto" zIndex={zIndex}>
      <div className="px-6 py-5 flex flex-col">
        <p className="text-sm font-semibold text-primary text-center mb-1">{title}</p>
        <p className="text-[10pt] text-tertiary text-center leading-relaxed mb-4">{subtitle}</p>

        <div className="relative rounded-xl border border-tertiary/20 bg-tertiary/5 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="block w-full h-44 touch-none cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
          {/* baseline + clear affordance */}
          <div className="pointer-events-none absolute left-4 right-4 bottom-6 border-b border-dashed border-tertiary/30" />
          {hasInk && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear signature"
              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-tertiary bg-themewhite/80 active:scale-95 transition-all"
            >
              <Eraser size={15} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-5">
          {hasInk && (
            <button
              onClick={confirm}
              className="w-full py-2 rounded-full text-[11pt] font-medium text-white active:scale-95 transition-all bg-themeblue2"
            >
              {confirmLabel}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 rounded-full text-[11pt] font-medium text-themeblue2 border border-themeblue2/40 active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
