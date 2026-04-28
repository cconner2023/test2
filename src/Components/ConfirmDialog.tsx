import { useEffect } from 'react'
import { XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'success'
  processing?: boolean
  onConfirm?: () => void
  onCancel: () => void
  /** When true, renders as a read-only notification (single dismiss button). */
  notifyOnly?: boolean
  /** Auto-dismiss after N ms. Meaningful only with notifyOnly. */
  autoDismissMs?: number
  /** Bump above default Z.MODAL when launched from inside a popover/overlay at a higher tier. */
  zIndex?: number
}

const variantStyles = {
  danger: {
    confirmBtn: 'bg-themeredred',
    cancelText: 'text-themeredred',
    cancelBorder: 'border-themeredred/40',
    icon: 'text-themeredred',
    iconBg: 'bg-themeredred/15',
    Icon: XCircle,
  },
  warning: {
    confirmBtn: 'bg-themeyellow',
    cancelText: 'text-themeyellow',
    cancelBorder: 'border-themeyellow/40',
    icon: 'text-themeyellow',
    iconBg: 'bg-themeyellow/15',
    Icon: AlertTriangle,
  },
  success: {
    confirmBtn: 'bg-themegreen',
    cancelText: 'text-themegreen',
    cancelBorder: 'border-themegreen/40',
    icon: 'text-themegreen',
    iconBg: 'bg-themegreen/15',
    Icon: CheckCircle2,
  },
} as const

export function ConfirmDialog({
  visible,
  title,
  subtitle,
  confirmLabel = 'Delete',
  cancelLabel,
  variant = 'danger',
  processing,
  onConfirm,
  onCancel,
  notifyOnly,
  autoDismissMs,
  zIndex,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant]
  const Icon = styles.Icon
  const resolvedCancelLabel = cancelLabel ?? (notifyOnly ? 'Dismiss' : 'Cancel')

  useEffect(() => {
    if (!visible || !notifyOnly || !autoDismissMs) return
    const t = setTimeout(onCancel, autoDismissMs)
    return () => clearTimeout(t)
  }, [visible, notifyOnly, autoDismissMs, onCancel])

  return (
    <Modal isOpen={visible} onClose={onCancel} hideClose maxWidth={400} mobileMaxHeight="auto" zIndex={zIndex}>
      <div className="px-6 py-5 flex flex-col">
        <div className="flex justify-center mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
            <Icon className={`w-5 h-5 ${styles.icon}`} />
          </div>
        </div>

        <p className="text-sm font-semibold text-primary text-center mb-1">{title}</p>
        {subtitle && (
          <p className="text-[10pt] text-tertiary text-center leading-relaxed mb-5">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-5" />}

        <div className="flex flex-col gap-3">
          {!notifyOnly && (
            <button
              onClick={onConfirm}
              disabled={processing}
              className={`w-full py-2 rounded-full text-[11pt] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing ? 'opacity-60' : ''}`}
            >
              {processing ? 'Processing...' : confirmLabel}
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={processing}
            className={`w-full py-2 rounded-full text-[11pt] font-medium active:scale-95 transition-all ${styles.cancelText} border ${styles.cancelBorder}`}
          >
            {resolvedCancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
