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
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-themewhite rounded-2xl shadow-xl px-6 py-5 mx-6 max-w-sm w-full">
        <p className="text-sm font-medium text-primary text-center mb-1">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-tertiary text-center mb-3">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-3" />}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 py-2.5 rounded-full border border-tertiary/15 text-sm font-medium text-tertiary active:scale-95 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium text-white active:scale-95 transition-all ${
              variant === 'danger' ? 'bg-themeredred' : 'bg-themeyellow'
            } ${processing ? 'opacity-60' : ''}`}
          >
            {processing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
