import { useEffect } from 'react'
import { XCircle } from 'lucide-react'
import { Scrim } from '@/Components/primitives/Scrim'

interface IntakeRejectDialogProps {
  visible: boolean
  title: string
  subtitle?: string
  onDismiss: () => void
}

/**
 * Mirrors the main-app ConfirmDialog (notifyOnly + danger variant) visually
 * without importing it — the anon intake bundle stays isolated from
 * src/Components/(non-Public). Centered card on desktop, full-width sheet
 * on small viewports via the same Tailwind utility set scanned by intake.css.
 */
export function IntakeRejectDialog({
  visible,
  title,
  subtitle,
  onDismiss,
}: IntakeRejectDialogProps) {
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 70 }}
    >
      <Scrim progress={1} position="absolute" onClick={onDismiss} />
      <div
        className="relative w-full max-w-sm bg-themewhite3 rounded-2xl surface-shadow"
      >
        <div className="px-6 py-5 flex flex-col">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/15">
              <XCircle className="w-5 h-5 text-themeredred" />
            </div>
          </div>
          <p className="text-sm font-semibold text-primary text-center mb-1">{title}</p>
          {subtitle && (
            <p className="text-[10pt] text-tertiary text-center leading-relaxed mb-5">{subtitle}</p>
          )}
          {!subtitle && <div className="mb-5" />}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2 rounded-full text-[11pt] font-medium text-themeredred border border-themeredred/40 active:scale-95 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
