import { useEffect, useState, useCallback, useRef } from 'react'
import { XCircle } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  processing?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantStyles = {
  danger: {
    confirmBtn: 'bg-themeredred',
    cancelText: 'text-themeredred',
    cancelBorder: 'border-themeredred/40',
    icon: 'text-themeredred',
  },
  warning: {
    confirmBtn: 'bg-themeyellow',
    cancelText: 'text-themeyellow',
    cancelBorder: 'border-themeyellow/40',
    icon: 'text-themeyellow',
  },
} as const

export function ConfirmDialog({
  visible,
  title,
  subtitle,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  processing,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  const styles = variantStyles[variant]

  useEffect(() => {
    if (visible) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    } else {
      setOpen(false)
      const t = setTimeout(() => {
        setMounted(false)
        setDragY(0)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [visible])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onCancel, 300)
  }, [onCancel])

  /* Touch drag for mobile drawer */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-drag-zone]')) return
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current)
    setDragY(dy)
  }, [isDragging])

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 80) {
      handleClose()
    }
    setDragY(0)
  }, [isDragging, dragY, handleClose])

  if (!mounted) return null

  /* ── Mobile: bottom drawer ── */
  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
          onClick={handleClose}
        />
        <div
          className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            maxHeight: '30dvh',
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={subtitle ? 'confirm-dialog-message' : undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25" />
          </div>

          <div className="px-5 pb-5 flex flex-col h-full">
            <h2 id="confirm-dialog-title" className="text-lg font-medium text-primary mb-0.5">
              {title}
            </h2>
            {subtitle && (
              <p id="confirm-dialog-message" className="text-sm text-tertiary mb-4">{subtitle}</p>
            )}
            {!subtitle && <div className="mb-4" />}

            <div className="flex flex-col gap-2.5 mt-auto">
              <button
                onClick={onConfirm}
                disabled={processing}
                className={`w-full py-3 rounded-full text-[15px] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing ? 'opacity-60' : ''}`}
              >
                {processing ? 'Processing...' : confirmLabel}
              </button>
              <button
                onClick={handleClose}
                disabled={processing}
                className={`w-full py-3 rounded-full text-[15px] font-medium active:scale-95 transition-all ${styles.cancelText} border ${styles.cancelBorder}`}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ── Desktop: centered modal ── */
  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-20' : 'opacity-0'}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className={`bg-themewhite rounded-3xl shadow-xl px-8 py-8 max-w-[340px] w-full pointer-events-auto transition-all duration-300 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={subtitle ? 'confirm-dialog-message' : undefined}
        >
          <div className="flex justify-center mb-5">
            <XCircle size={52} strokeWidth={1} className={styles.icon} />
          </div>

          <p id="confirm-dialog-title" className="text-lg font-medium text-primary text-center mb-1">
            {title}
          </p>
          {subtitle && (
            <p id="confirm-dialog-message" className="text-sm text-tertiary text-center mb-6">{subtitle}</p>
          )}
          {!subtitle && <div className="mb-6" />}

          <div className="flex flex-col gap-3 max-w-[260px] mx-auto">
            <button
              onClick={onConfirm}
              disabled={processing}
              className={`w-full py-3 rounded-full text-[15px] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing ? 'opacity-60' : ''}`}
            >
              {processing ? 'Processing...' : confirmLabel}
            </button>
            <button
              onClick={handleClose}
              disabled={processing}
              className={`w-full py-3 rounded-full text-[15px] font-medium active:scale-95 transition-all ${styles.cancelText} border ${styles.cancelBorder}`}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
