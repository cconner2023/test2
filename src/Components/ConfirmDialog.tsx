import { XCircle } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useOverlay } from '../Hooks/useOverlay'

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

/* Modal tokens: bg-themewhite rounded-2xl shadow-2xl border-tertiary/10 z-70. Ref: ProvisionalDeviceModal */
const variantStyles = {
  danger: {
    confirmBtn: 'bg-themeredred',
    cancelText: 'text-themeredred',
    cancelBorder: 'border-themeredred/40',
    icon: 'text-themeredred',
    iconBg: 'bg-themeredred/15',
  },
  warning: {
    confirmBtn: 'bg-themeyellow',
    cancelText: 'text-themeyellow',
    cancelBorder: 'border-themeyellow/40',
    icon: 'text-themeyellow',
    iconBg: 'bg-themeyellow/15',
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
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(visible, onCancel)

  const styles = variantStyles[variant]

  if (!mounted) return null

  /* ── Mobile: bottom drawer ── */
  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-70 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
          onClick={close}
        />
        <div
          className={`fixed left-0 right-0 bottom-0 z-70 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            maxHeight: '30dvh',
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={subtitle ? 'confirm-dialog-message' : undefined}
          {...touchHandlers}
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
                className={`w-full py-3 rounded-lg text-[11pt] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing ? 'opacity-60' : ''}`}
              >
                {processing ? 'Processing...' : confirmLabel}
              </button>
              <button
                onClick={close}
                disabled={processing}
                className={`w-full py-3 rounded-lg text-[11pt] font-medium active:scale-95 transition-all ${styles.cancelText} border ${styles.cancelBorder}`}
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
        className={`fixed inset-0 z-70 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={close}
      />
      <div className="fixed inset-0 z-70 flex items-center justify-center pointer-events-none">
        <div
          className={`bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 px-6 py-5 max-w-sm w-full pointer-events-auto transition-all duration-300 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={subtitle ? 'confirm-dialog-message' : undefined}
        >
          <div className="flex justify-center mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
              <XCircle className={`w-5 h-5 ${styles.icon}`} />
            </div>
          </div>

          <p id="confirm-dialog-title" className="text-sm font-semibold text-primary text-center mb-1">
            {title}
          </p>
          {subtitle && (
            <p id="confirm-dialog-message" className="text-xs text-tertiary text-center leading-relaxed mb-5">{subtitle}</p>
          )}
          {!subtitle && <div className="mb-5" />}

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={processing}
              className={`w-full py-2 rounded-lg text-[11pt] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing ? 'opacity-60' : ''}`}
            >
              {processing ? 'Processing...' : confirmLabel}
            </button>
            <button
              onClick={close}
              disabled={processing}
              className={`w-full py-2 rounded-lg text-[11pt] font-medium active:scale-95 transition-all ${styles.cancelText} border ${styles.cancelBorder}`}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
