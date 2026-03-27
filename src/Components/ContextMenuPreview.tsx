import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuAction {
  key: string
  label: string
  icon?: LucideIcon
  onAction: () => void
  variant?: 'default' | 'danger'
}

interface ContextMenuPreviewProps {
  isVisible: boolean
  onClose: () => void
  /** Bounding rect of the long-pressed element — used for transform origin */
  anchorRect: DOMRect | null
  /** Scrollable preview content */
  preview: ReactNode
  /** Action tile buttons rendered in a horizontal bar below the preview */
  actions: ContextMenuAction[]
}

const ACTION_STYLES = {
  default: {
    bg: 'bg-themeblue2/8',
    iconColor: 'text-themeblue2',
    labelColor: 'text-themeblue2',
  },
  danger: {
    bg: 'bg-themeredred/8',
    iconColor: 'text-themeredred',
    labelColor: 'text-themeredred',
  },
} as const

export function ContextMenuPreview({
  isVisible,
  onClose,
  anchorRect,
  preview,
  actions,
}: ContextMenuPreviewProps) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    } else {
      setOpen(false)
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [isVisible])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  if (!mounted) return null

  const originX = anchorRect ? anchorRect.left + anchorRect.width / 2 : window.innerWidth / 2
  const originY = anchorRect ? anchorRect.top + anchorRect.height / 2 : window.innerHeight / 2

  return createPortal(
    <>
      {/* Backdrop — blurred + dimmed */}
      <div
        className="fixed inset-0 z-80 transition-all duration-300"
        style={{
          backgroundColor: open ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)',
          backdropFilter: open ? 'blur(12px)' : 'blur(0px)',
          WebkitBackdropFilter: open ? 'blur(12px)' : 'blur(0px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />

      {/* Card — vertically constrained, scrollable preview, pinned action tiles */}
      <div className="fixed inset-0 z-80 flex flex-col items-center justify-center pointer-events-none px-6 py-10">
        <div
          className="pointer-events-auto w-full max-w-[340px] flex flex-col items-center gap-2.5 max-h-full"
          style={{
            transformOrigin: `${originX}px ${originY}px`,
            transform: open ? 'scale(1)' : 'scale(0.88)',
            opacity: open ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
          }}
        >
          {/* Preview content — scrollable */}
          <div className="w-full rounded-2xl bg-themewhite shadow-xl border border-tertiary/10 overflow-hidden min-h-0" style={{ maxHeight: '40dvh' }}>
            <div className="overflow-y-auto h-full overscroll-contain">
              {preview}
            </div>
          </div>

          {/* Action tiles — horizontal bar */}
          {actions.length > 0 && (
            <div className="shrink-0 flex gap-1 rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg px-1.5 py-1.5">
              {actions.map((action) => {
                const styles = ACTION_STYLES[action.variant ?? 'default']
                const Icon = action.icon
                return (
                  <button
                    key={action.key}
                    onClick={() => {
                      handleClose()
                      setTimeout(action.onAction, 320)
                    }}
                    className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg ${styles.bg} active:scale-95 transition-all`}
                  >
                    {Icon && <Icon size={14} className={styles.iconColor} />}
                    <span className={`text-[9px] font-medium ${styles.labelColor}`}>{action.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Dismiss button */}
          <button
            onClick={handleClose}
            className="shrink-0 w-8 h-8 rounded-full bg-tertiary/15 flex items-center justify-center active:scale-95 transition-all"
          >
            <span className="text-tertiary text-sm">✕</span>
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
