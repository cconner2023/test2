import { useEffect } from 'react'
import { XCircle, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import { Modal } from '@/Components/primitives/Modal'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'success' | 'primary'
  processing?: boolean
  onConfirm?: () => void
  onCancel: () => void
  /** When true, renders as a read-only notification (single dismiss button). */
  notifyOnly?: boolean
  /** Auto-dismiss after N ms. Meaningful only with notifyOnly. */
  autoDismissMs?: number
  /** Bump above default Z.MODAL when launched from inside a popover/overlay at a higher tier. */
  zIndex?: number
  /** When provided, renders a required text field between subtitle and buttons.
   * Confirm is gated until the value is non-empty. Ignored when notifyOnly. */
  inputValue?: string
  onInputChange?: (value: string) => void
  inputPlaceholder?: string
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
  primary: {
    confirmBtn: 'bg-themeblue2',
    cancelText: 'text-themeblue2',
    cancelBorder: 'border-themeblue2/40',
    icon: 'text-themeblue2',
    iconBg: 'bg-themeblue2/15',
    Icon: HelpCircle,
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
  inputValue,
  onInputChange,
  inputPlaceholder,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant]
  const Icon = styles.Icon
  const resolvedCancelLabel = cancelLabel ?? (notifyOnly ? 'Dismiss' : 'Cancel')
  const hasInput = !notifyOnly && !!onInputChange
  const inputBlocked = hasInput && (inputValue ?? '').trim() === ''

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

        {hasInput && (
          <textarea
            value={inputValue ?? ''}
            onChange={(e) => onInputChange?.(e.target.value)}
            placeholder={inputPlaceholder}
            rows={3}
            autoFocus
            className="w-full mb-5 px-3.5 py-2.5 rounded-xl bg-tertiary/5 border border-tertiary/15 text-sm text-primary placeholder:text-tertiary resize-none focus:outline-none focus:border-themeredred/40"
          />
        )}

        <div className="flex flex-col gap-3">
          {!notifyOnly && (
            <button
              onClick={onConfirm}
              disabled={processing || inputBlocked}
              className={`w-full py-2 rounded-full text-[11pt] font-medium text-white active:scale-95 transition-all ${styles.confirmBtn} ${processing || inputBlocked ? 'opacity-60' : ''}`}
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
